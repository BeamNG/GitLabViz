import { toRaw, watch } from 'vue'
import localforage from 'localforage'
import {
  createGitLabClient,
  createGitLabGraphqlClient,
  enrichEpicTitlesFromRest,
  enrichIssuesFromGraphql,
  fetchProjectIssuesRest,
  fetchIssueLinks,
  fetchTokenInfo,
  normalizeGitLabApiBaseUrl
} from '../services/gitlab'
import { createSvnClient, fetchSvnLog } from '../services/svn'
import { svnCacheGetMeta, svnCacheClear, normalizeRepoUrl } from '../services/cache'
import { MattermostClient } from '../chatTools/mmClient'
import { getScopedLabelValue } from '../utils/scopedLabels'

// Slim copy of a GitLab REST issue stored as `node._raw`. Most of the issue
// payload (description, description_html, _links, time_stats, task_completion,
// discussion_locked, subscribed, …) is never read after the initial load — but
// at thousands of issues × multi-KB-per-issue, those fields dominate cache size
// and JSON-parse time on cold start. Keep only the fields the app actually reads
// (verified by grepping `_raw.*` and `raw.*` across src/). Nested objects are
// pruned to the same field set. The flat `node.*` fields (createdAt, closedAt,
// timeEstimate, …) already capture the rest, so no UI surface loses information.
const slimIssue = (i) => {
  if (!i) return i
  const slim = {
    iid: i.iid,
    title: i.title,
    state: i.state,
    web_url: i.web_url,
    created_at: i.created_at,
    updated_at: i.updated_at,
    closed_at: i.closed_at,
    due_date: i.due_date,
    user_notes_count: i.user_notes_count,
    labels: i.labels,
    weight: i.weight,
    epic_iid: i.epic_iid,
    status_display: i.status_display,
    work_item_status: i.work_item_status
  }
  if (i.references) slim.references = { full: i.references.full, relative: i.references.relative }
  if (i.author) slim.author = { name: i.author.name, state: i.author.state }
  if (i.assignee) slim.assignee = { name: i.assignee.name, state: i.assignee.state }
  if (Array.isArray(i.assignees)) slim.assignees = i.assignees.map(a => ({ name: a?.name, state: a?.state }))
  if (Array.isArray(i.participants)) slim.participants = i.participants.map(p => ({ name: p?.name, username: p?.username, state: p?.state }))
  if (i.milestone) slim.milestone = { title: i.milestone.title, due_date: i.milestone.due_date, start_date: i.milestone.start_date, state: i.milestone.state }
  if (i.epic) slim.epic = { title: i.epic.title }
  if (i.parent) slim.parent = { work_item_type: i.parent.work_item_type, title: i.parent.title }
  if (i.iteration) slim.iteration = { title: i.iteration.title }
  if (i.closed_by) slim.closed_by = { name: i.closed_by.name }
  if (i.__mock) slim.__mock = true
  return slim
}
export { slimIssue }

export function useDataLoader ({
  settings,
  nodes,
  edges,
  issueGraphSnapshot,
  svnUrl,
  svnVizLimit,
  svnRecentCommits,
  svnCommitCount,
  gitlabCacheMeta,
  mattermostMeta,
  lastUpdated,
  loading,
  loadingMessage,
  updateStatus,
  error,
  isElectron,
  canUseSvn,
  vizMode,
  buildSvnVizGraph,
  resetFilters,
  createMockIssuesGraph
}) {
  // Some config changes (notably gitlabClosedDays) widen the fetch window such that the
  // incremental sync would skip the newly-included history. The primary mechanism is
  // comparing the current setting to `settings.meta.lastSyncClosedDays` inside loadData;
  // this watcher is a belt-and-braces flag for changes that happen mid-session.
  let pendingFullSync = false
  watch(() => settings.config.gitlabClosedDays, (newVal, oldVal) => {
    if (oldVal === undefined || newVal === oldVal) return
    pendingFullSync = true
  })

  const resolveGitLabApiBaseUrl = () => {
    const direct = normalizeGitLabApiBaseUrl(settings.config.gitlabApiBaseUrl)
    if (!direct) return ''

    // In dev (web), use Vite proxy if configured and the URL matches that proxy target.
    if (!window.electronAPI && import.meta.env.DEV) {
      const proxyTarget = String(import.meta.env.VITE_GITLAB_PROXY_TARGET || '').trim().replace(/\/+$/, '')
      if (proxyTarget && direct.startsWith(proxyTarget)) return '/gitlab/api/v4'
    }

    return direct
  }

  const initCachedData = async () => {
    try {
      const cachedMeta = await localforage.getItem('gitlab_meta')
      if (cachedMeta && typeof cachedMeta === 'object') {
        gitlabCacheMeta.value = {
          nodes: cachedMeta.nodes || 0,
          edges: cachedMeta.edges || 0,
          updatedAt: cachedMeta.updatedAt || null,
          // incremental sync cursor + cache identity (backward compatible)
          syncCursor: cachedMeta.syncCursor || null,
          projectId: cachedMeta.projectId || null,
          apiBaseUrl: cachedMeta.apiBaseUrl || null
        }
      }
      const cachedNodes = await localforage.getItem('gitlab_nodes')
      const cachedEdges = await localforage.getItem('gitlab_edges')

      // Load lastUpdated from settings
      if (settings.meta && settings.meta.lastUpdated) lastUpdated.value = settings.meta.lastUpdated

      if (cachedNodes && cachedEdges) {
        // localforage handles JSON parsing automatically
        // Important: Do NOT load massive SVN commit nodes into the graph on startup.
        // The force-directed graph cannot handle tens/hundreds of thousands of nodes and will freeze the UI.
        const filteredCachedNodes = {}
        Object.entries(cachedNodes).forEach(([id, n]) => {
          const isSvn = (n && (n.type === 'svn_commit' || String(id).startsWith('svn-')))
          if (isSvn) return
          // Re-slim `_raw` on cached GitLab issues from older versions of the
          // app — caches written before 0.12.16 still carry the full payload
          // (description, _links, time_stats, …). One pass on load drops them
          // from RAM immediately; next sync rewrites the disk cache slim too.
          if (n?.type === 'gitlab_issue' && n._raw) n._raw = slimIssue(n._raw)
          filteredCachedNodes[id] = n
        })

        const filteredCachedEdges = {}
        Object.entries(cachedEdges).forEach(([id, e]) => {
          const source = e && e.source ? String(e.source) : ''
          const target = e && e.target ? String(e.target) : ''
          const isSvnEdge = source.startsWith('svn-') || target.startsWith('svn-')
          if (!isSvnEdge) filteredCachedEdges[id] = e
        })

        Object.assign(nodes, filteredCachedNodes)
        Object.assign(edges, filteredCachedEdges)

        // Keep a snapshot so mode switching works without refetch
        Object.assign(issueGraphSnapshot.nodes, filteredCachedNodes)
        Object.assign(issueGraphSnapshot.edges, filteredCachedEdges)
      }

      // If no cached data exists at all, populate a small sample graph so the UI isn't empty.
      if (Object.keys(nodes).length === 0 && Object.keys(edges).length === 0) {
        const mock = createMockIssuesGraph()
        Object.assign(nodes, mock.nodes)
        Object.assign(edges, mock.edges)
        Object.assign(issueGraphSnapshot.nodes, mock.nodes)
        Object.assign(issueGraphSnapshot.edges, mock.edges)
      }
    } catch (e) {
      console.error('Failed to load cached data:', e)
    }
  }

  const updateAllSvnCaches = async (override) => {
    if (!isElectron.value) {
      throw new Error('SVN disk cache updates require Electron (browser mode has no disk cache).')
    }
    const repos = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
    const urlsFromSettings = repos.map(r => normalizeRepoUrl(r && r.url)).filter(Boolean)
    const urlsFromOverride = override && Array.isArray(override.urls) ? override.urls.map(u => normalizeRepoUrl(u)).filter(Boolean) : []
    const urls = urlsFromOverride.length ? urlsFromOverride : urlsFromSettings
    if (urls.length === 0) return

    const username = (override && typeof override.username === 'string') ? override.username : (settings.config.svnUsername || '')
    const password = (override && typeof override.password === 'string') ? override.password : (settings.config.svnPassword || '')

    updateStatus.value = { loading: true, source: 'svn', message: `Updating ${urls.length} repos...` }
    loadingMessage.value = `SVN\nupdating ${urls.length} repos…`

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      const prefix = `SVN ${i + 1} / ${urls.length}`
      updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: starting...` }
      loadingMessage.value = `${prefix}\nstarting…`

      const svnClient = createSvnClient(url, username, password)
      await fetchSvnLog(svnClient, 0, {
        pageSize: 2000,
        cacheRepoUrl: url,
        onProgress: (msg) => {
          // `msg` may already be two-line; if not, push it onto the second line.
          const oneLine = !msg.includes('\n')
          loadingMessage.value = oneLine ? `${prefix}\n${msg}` : msg
          updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: ${msg.replace(/\n/g, ' · ')}` }
        }
      })
    }

    // Update footer counter based on the first repo (keeps existing UI semantics)
    const meta = await svnCacheGetMeta(urls[0])
    if (meta && meta.totalCount != null) svnCommitCount.value = meta.totalCount
  }

  // Lightweight standalone token introspection (scopes + expiry) without a full fetch.
  // Safe to call on app startup: at most 1-2 cheap GitLab API calls; swallows all errors.
  const checkTokenInfo = async () => {
    if (!settings.config.enableGitLab) return
    const token = String(settings.config.token || '').trim()
    const baseURL = resolveGitLabApiBaseUrl()
    if (!token || !baseURL) return
    try {
      const client = createGitLabClient(baseURL, token)
      const info = await fetchTokenInfo(client)
      settings.meta.gitlabTokenScopes = info.scopes
      settings.meta.gitlabTokenExpiresAt = info.expiresAt
      settings.meta.gitlabCanWrite = Array.isArray(info.scopes) ? info.scopes.includes('api') : false
    } catch (e) {
      console.warn('[GitLab] Startup token check failed:', e?.message || String(e))
    }
  }

  const loadData = async (opts = {}) => {
    // Do not start another fetch while one is already running (no queueing).
    // Set the flag synchronously to close the TOCTOU window before the first await.
    if (loading.value) return
    loading.value = true

    // Check for app updates (hosted builds) before re-fetching data.
    try {
      if (typeof window.__glvCheckForUpdate === 'function') {
        const didReload = await window.__glvCheckForUpdate()
        if (didReload) { loading.value = false; return }
      }
    } catch {}

    const only = opts.only || 'both' // 'gitlab' | 'svn' | 'mattermost' | 'both'
    let forceFull = !!opts.forceFull
    if (pendingFullSync) { forceFull = true; pendingFullSync = false }
    // If the closed-days window has changed since the last successful sync, the cached
    // cursor would miss the newly-included closed history — force a full re-sync.
    const curClosedDays = Number(settings.config.gitlabClosedDays) || 0
    const lastSyncClosedDays = settings.meta && settings.meta.lastSyncClosedDays
    if (typeof lastSyncClosedDays === 'number' && lastSyncClosedDays !== curClosedDays) {
      forceFull = true
    }
    const doGitLab = (only === 'both' || only === 'gitlab') && settings.config.enableGitLab
    const doSvn = canUseSvn.value && (only === 'both' || only === 'svn') && settings.config.enableSvn
    const doMattermost = isElectron.value && (only === 'both' || only === 'mattermost') && !!settings.config.mattermostUrl && !!settings.config.mattermostToken

    const gitlabApiBaseUrl = resolveGitLabApiBaseUrl()

    const bail = (msg) => { error.value = msg; loading.value = false }

    if (doGitLab && (!settings.config.token || !settings.config.projectId || !gitlabApiBaseUrl)) {
      return bail('Please provide GitLab URL, Token, and Project ID')
    }
    if (doSvn && !svnUrl.value) {
      return bail('Please provide SVN URL')
    }
    if (only === 'mattermost' && (!settings.config.mattermostUrl || !settings.config.mattermostToken)) {
      return bail('Please configure Mattermost URL and login token in Configuration → Mattermost')
    }
    if (!doGitLab && !doSvn && !doMattermost) {
      return bail('Please enable at least one data source (GitLab / SVN) or log into Mattermost')
    }

    error.value = ''
    loadingMessage.value = 'Starting…'
    updateStatus.value = { loading: true, source: only === 'both' ? '' : only, message: 'Starting...' }

    // Drop sample/mock data before fetching so the user doesn't see fake nodes during the load.
    // Mock nodes are tagged with `_raw.__mock` by createMockIssuesGraph().
    const hasMock = Object.values(nodes).some(n => n && n._raw && n._raw.__mock)
    if (hasMock) {
      for (const k in nodes) delete nodes[k]
      for (const k in edges) delete edges[k]
      for (const k in issueGraphSnapshot.nodes) delete issueGraphSnapshot.nodes[k]
      for (const k in issueGraphSnapshot.edges) delete issueGraphSnapshot.edges[k]
    }

    // Incremental GitLab sync (skip existing data) if cache matches this project.
    const cachedProjectId = String(gitlabCacheMeta.value?.projectId || '').trim()
    const cachedApiBaseUrl = String(gitlabCacheMeta.value?.apiBaseUrl || '').trim()
    const cachedCursor = String(gitlabCacheMeta.value?.syncCursor || gitlabCacheMeta.value?.updatedAt || '').trim()
    const sameGitlabCacheIdentity =
      !!cachedProjectId &&
      !!cachedApiBaseUrl &&
      cachedProjectId === String(settings.config.projectId || '').trim() &&
      cachedApiBaseUrl === String(gitlabApiBaseUrl || '').trim()
    let canIncrementalGitLab = doGitLab && sameGitlabCacheIdentity && !!cachedCursor
    if (forceFull) canIncrementalGitLab = false

    // IMPORTANT: do NOT clear existing data up front.
    // If the connection drops mid-sync, we want to keep whatever is already loaded,
    // and merge partial results so the next refresh can resume.
    const replaceGitLabDataOnSuccess = doGitLab && !canIncrementalGitLab

    const restClient = doGitLab ? createGitLabClient(gitlabApiBaseUrl, settings.config.token) : null
    const gqlClient = doGitLab ? createGitLabGraphqlClient(gitlabApiBaseUrl, settings.config.token) : null
    let didGitLabFetch = false
    let gitlabSyncCursorForSave = null

    try {
      // 0. Refresh Mattermost (ChatTools) session data (lightweight)
      if (doMattermost) {
        loadingMessage.value = 'Mattermost\nvalidating login…'
        updateStatus.value = { loading: true, source: 'mattermost', message: 'Validating login...' }
        try {
          const api = new MattermostClient({ baseUrl: settings.config.mattermostUrl, token: settings.config.mattermostToken })
          const me = await api.me()
          settings.config.mattermostUser = me || null
          updateStatus.value = { loading: true, source: 'mattermost', message: 'Fetching teams...' }
          const teams = await api.teams()
          const now = Date.now()
          mattermostMeta.value = { teams: Array.isArray(teams) ? teams.length : 0, updatedAt: now }
        } catch (mmErr) {
          // Do not hard-fail GitLab/SVN updates if Mattermost refresh fails.
          if (only === 'mattermost') throw mmErr
          console.error('Mattermost update failed:', mmErr)
        }
      }

      // 1. Fetch GitLab Data
      let issues = []
      if (doGitLab) {
        const startedCursor = new Date().toISOString()
        // Safety overlap: tolerate clock/timezone drift.
        const cursorBufferMs = 2 * 60 * 60 * 1000
        const parseCursorMs = (v) => {
          const t = Date.parse(String(v || ''))
          return Number.isFinite(t) ? t : null
        }
        const cursorMs = canIncrementalGitLab ? parseCursorMs(cachedCursor) : null
        const updatedAfter = (canIncrementalGitLab && cursorMs != null)
          ? new Date(Math.max(0, cursorMs - cursorBufferMs)).toISOString()
          : null

        loadingMessage.value = canIncrementalGitLab ? 'Issues\nfetching updates…' : 'Issues\nstarting…'
        updateStatus.value = { loading: true, source: 'gitlab', message: 'Fetching issues...' }
        try {
          // Cache "me" for dynamic presets (By me / Assigned to me)
          try {
            const me = await restClient.get('/user')
            settings.meta.gitlabMeName = me?.data?.name || ''
            settings.meta.gitlabMeId = me?.data?.id || null
          } catch (e) {
            console.warn('[GitLab] Failed to fetch /user for presets:', e)
            settings.meta.gitlabMeName = ''
            settings.meta.gitlabMeId = null
          }

          // Best-effort: detect scopes + expiry to enable/disable write features and show expiry in UI.
          try {
            const info = await fetchTokenInfo(restClient)
            settings.meta.gitlabTokenScopes = info.scopes
            settings.meta.gitlabTokenExpiresAt = info.expiresAt
            settings.meta.gitlabCanWrite = Array.isArray(info.scopes) ? info.scopes.includes('api') : false
          } catch (e) {
            console.warn('[GitLab] Failed to detect token info:', e)
            settings.meta.gitlabTokenScopes = null
            settings.meta.gitlabTokenExpiresAt = null
            settings.meta.gitlabCanWrite = false
          }

          if (updatedAfter) {
            // Incremental sync must include state transitions (opened <-> closed), not just new opened issues.
            const updated = await fetchProjectIssuesRest(
              restClient,
              settings.config.projectId,
              (msg) => {
                loadingMessage.value = msg
                updateStatus.value = { loading: true, source: 'gitlab', message: msg }
              },
              { state: 'all', params: { updated_after: updatedAfter } }
            )
            const partialUpdated = !!updated?.__glvPartial

            // NOTE: In incremental mode, always apply updates for issues that are already in cache/graph,
            // regardless of gitlabClosedDays. gitlabClosedDays only affects adding *new* closed issues.
            const closedAfter = (() => {
              if (!(settings.config.gitlabClosedDays > 0)) return null
              const d = new Date()
              d.setDate(d.getDate() - settings.config.gitlabClosedDays)
              return d
            })()
            issues = updated.filter(i => {
              if (!i || i.iid == null) return false
              const id = String(i.iid)
              const exists = !!nodes[id]
              if (i.state !== 'closed') return true
              if (exists) return true
              if (!closedAfter) return false
              return !!(i.closed_at && new Date(i.closed_at) >= closedAfter)
            })

            if (partialUpdated) {
              try { Object.defineProperty(issues, '__glvPartial', { value: true, enumerable: false }) } catch {}
            }
          } else {
            // Full fetch: opened issues (REST: fast + includes epic_iid)
            issues = await fetchProjectIssuesRest(
              restClient,
              settings.config.projectId,
              (msg) => {
                loadingMessage.value = msg
                updateStatus.value = { loading: true, source: 'gitlab', message: msg }
              }
            )
            const partialOpened = !!issues?.__glvPartial

            // Fetch closed issues if requested
            if (settings.config.gitlabClosedDays > 0) {
              const closedAfter = new Date()
              closedAfter.setDate(closedAfter.getDate() - settings.config.gitlabClosedDays)

              const closedAfterMs = closedAfter.getTime()
              const closedUpdatedAfter = (() => {
                const updatedAfterMs = parseCursorMs(updatedAfter)
                if (updatedAfterMs == null) return closedAfter.toISOString()
                return new Date(Math.max(closedAfterMs, updatedAfterMs)).toISOString()
              })()

              const closedIssues = await fetchProjectIssuesRest(
                restClient,
                settings.config.projectId,
                (msg) => {
                  loadingMessage.value = msg
                  updateStatus.value = { loading: true, source: 'gitlab', message: msg }
                },
                {
                  state: 'closed',
                  params: {
                    updated_after: closedUpdatedAfter
                  }
                }
              )
              const partialClosed = !!closedIssues?.__glvPartial

              // Filter to ensure they were actually closed after the date (updated_after is broader)
              const actuallyClosed = closedIssues.filter(i => i.closed_at && new Date(i.closed_at) >= closedAfter)
              issues = [...issues, ...actuallyClosed]
              // propagate partial marker
              if (partialOpened || partialClosed) {
                try { Object.defineProperty(issues, '__glvPartial', { value: true, enumerable: false }) } catch {}
              }
            }
          }

          // Optional GraphQL enrichment pass for fields REST doesn't provide (kept minimal).
          if (gqlClient) {
            await enrichIssuesFromGraphql(gqlClient, settings.config.projectId, issues, (msg) => {
              loadingMessage.value = msg
              updateStatus.value = { loading: true, source: 'gitlab', message: msg }
            })
          }
          if (restClient) {
            await enrichEpicTitlesFromRest(restClient, settings.config.projectId, issues, (msg) => {
              loadingMessage.value = msg
              updateStatus.value = { loading: true, source: 'gitlab', message: msg }
            })
          }

          didGitLabFetch = true
          gitlabSyncCursorForSave = startedCursor

          // Create nodes
          loadingMessage.value = 'Building graph\ncreating nodes…'

          // Only replace the whole dataset when we got a full (non-partial) fetch.
          // If partial, merge into existing nodes/edges instead (resume-friendly).
          const isPartial = !!issues?.__glvPartial
          // For Ctrl+Click (force full clean), never merge partial results into existing data.
          if (forceFull && isPartial) {
            throw new Error('GitLab fetch interrupted (partial). Retry (Ctrl+Click again) to complete the clean update.')
          }
          if (replaceGitLabDataOnSuccess && !isPartial) {
            for (const key in nodes) delete nodes[key]
            for (const key in edges) delete edges[key]
          }

          issues.forEach(issue => {
            const id = String(issue.iid)

            // Calculate time spent ratio if available
            let timeSpentRatio = 0
            if (issue.time_stats && issue.time_stats.time_estimate > 0) {
              timeSpentRatio = issue.time_stats.total_time_spent / issue.time_stats.time_estimate
            }

            // Determine color based on status label or state
            const status = (typeof issue.status_display === 'string' && issue.status_display.trim())
              ? issue.status_display.trim()
              : getScopedLabelValue(issue.labels, 'Status')
            let color = issue.state === 'opened' ? '#28a745' : '#dc3545' // defaults

            if (status === 'To do') color = '#6c757d'
            else if (status === 'In progress') color = '#007bff'
            else if (status === 'Ready for Review') color = '#fd7e14'
            else if (status === 'On Hold/Blocked') color = '#dc3545'
            else if (status === 'Done') color = '#28a745'
            else if (status === 'Won\'t do' || status === 'Duplicate') color = '#dc3545'

            nodes[id] = {
              id,
              name: `#${id} ${issue.title.length > 20 ? issue.title.substring(0, 20) + '...' : issue.title}`,
              color,
              commentsCount: issue.user_notes_count,
              updatedAt: issue.updated_at,
              createdAt: issue.created_at,
              closedAt: issue.closed_at,
              dueDate: issue.due_date,
              confidential: issue.confidential,
              webUrl: issue.web_url,
              weight: issue.weight,
              timeEstimate: issue.time_stats ? issue.time_stats.time_estimate : 0,
              timeSpent: issue.time_stats ? issue.time_stats.total_time_spent : 0,
              timeSpentRatio,
              upvotes: issue.upvotes,
              downvotes: issue.downvotes,
              mergeRequestsCount: issue.merge_requests_count,
              hasTasks: issue.has_tasks,
              taskStatus: issue.task_status,
              type: 'gitlab_issue',
              _raw: slimIssue(issue)
            }
          })

          // Persist sync cursor (conservative watermark) for next incremental run
          settings.meta.gitlabSyncCursor = startedCursor
        } catch (e) {
          console.error(e)
          error.value = `GitLab Error: ${e?.message || String(e)}`
          // If SVN is enabled, continue?
          if (!settings.config.enableSvn) throw e
        }
      }

      // 2. Fetch SVN Data if configured
      if (doSvn && svnUrl.value) {
        try {
          loadingMessage.value = 'SVN log\nfetching…'
          updateStatus.value = { loading: true, source: 'svn', message: 'Fetching SVN log...' }

          // Adjust URL to use proxy in DEV mode if it matches our configured proxy target
          let targetUrl = svnUrl.value
          if (!window.electronAPI) {
            const proxyTarget = String(import.meta.env.VITE_SVN_PROXY_TARGET || '').trim().replace(/\/+$/, '')
            if (proxyTarget && targetUrl.startsWith(proxyTarget)) {
              // Proxy: /svn -> VITE_SVN_PROXY_TARGET
              targetUrl = targetUrl.replace(proxyTarget, '/svn')
            }
          }

          const svnClient = createSvnClient(targetUrl, settings.config.svnUsername, settings.config.svnPassword)

          // Stream SVN log into disk cache (chunked) and only keep a small in-memory slice.
          svnRecentCommits.value = []
          const maxKeep = Math.max(5000, Math.max(100, Math.min(Number(svnVizLimit.value) || 2000, 5000)))

          // IMPORTANT: Do not create a node for every SVN revision (can be 100k+ and will freeze graph).
          // Only create SVN nodes that actually reference existing GitLab issues (high-signal + keeps graph small).
          const MAX_SVN_NODES = 5000
          let svnNodeCount = 0

          const cacheKeyUrl = normalizeRepoUrl(svnUrl.value)
          await fetchSvnLog(svnClient, 0, {
            pageSize: 2000,
            cacheRepoUrl: cacheKeyUrl,
            onProgress: (msg) => {
              loadingMessage.value = msg.includes('\n') ? msg : `SVN log\n${msg}`
            },
            onPage: async (pageCommits) => {
              // keep a small slice in memory for SVN tree
              for (const c of pageCommits) {
                if (svnRecentCommits.value.length >= maxKeep) break
                svnRecentCommits.value.push(c)
              }

              // issue linking (bounded)
              if (svnNodeCount >= MAX_SVN_NODES) return
              for (const commit of pageCommits) {
                if (!commit || !commit.message) continue
                const issueMatches = commit.message.matchAll(/(?:refs?|issues?|tickets?|^)?\s*#(\d+)/gim)

                let shouldCreateNode = false
                const matchedIssueIds = []
                for (const match of issueMatches) {
                  const issueId = match[1]
                  if (nodes[issueId]) {
                    shouldCreateNode = true
                    matchedIssueIds.push(issueId)
                  }
                }

                if (!shouldCreateNode) continue
                if (svnNodeCount >= MAX_SVN_NODES) break

                const id = `svn-${commit.revision}`
                if (!nodes[id]) {
                  nodes[id] = {
                    id,
                    name: `r${commit.revision} ${commit.author}`,
                    color: '#6f42c1',
                    updatedAt: commit.date,
                    createdAt: commit.date,
                    author: { name: commit.author },
                    webUrl: '',
                    type: 'svn_commit',
                    _raw: commit
                  }
                  svnNodeCount++
                }

                for (const issueId of matchedIssueIds) {
                  const edgeId = `${id}-${issueId}`
                  edges[edgeId] = {
                    source: id,
                    target: issueId,
                    label: 'referenced'
                  }
                }
              }
            }
          })

          const meta = await svnCacheGetMeta(cacheKeyUrl)
          if (meta && meta.totalCount != null) svnCommitCount.value = meta.totalCount
          updateStatus.value = { loading: true, source: 'svn', message: `SVN: cached ${svnCommitCount.value.toLocaleString()} commits` }
        } catch (svnErr) {
          console.error('SVN Error:', svnErr)
          // Don't fail completely if SVN fails
          error.value = `GitLab loaded, but SVN failed: ${svnErr?.message || String(svnErr)}`
          // Keep going to show GitLab data
        }
      }

      // Fetch links for each issue with concurrency limit
      if (settings.config.enableGitLab && issues.length > 0) {
        loadingMessage.value = 'Issue links\nstarting…'
        let completedLinks = 0
        const CONCURRENCY_LIMIT = 20
        const linksResults = new Array(issues.length)
        let nextIssueIndex = 0

        // Incremental sync: remove old GitLab issue-link edges for updated issues only.
        if (doGitLab && canIncrementalGitLab) {
          const touched = new Set(issues.map(i => String(i?.iid || '')).filter(Boolean))
          const isIssueId = (v) => /^\d+$/.test(String(v || ''))
          for (const k in edges) {
            const e = edges[k]
            if (!e) continue
            const a = String(e.source || '')
            const b = String(e.target || '')
            if (!isIssueId(a) || !isIssueId(b)) continue // keep SVN edges, etc.
            if (touched.has(a) || touched.has(b)) delete edges[k]
          }
        }

        const fetchWorker = async () => {
          while (nextIssueIndex < issues.length) {
            const index = nextIssueIndex++
            const issue = issues[index]
            try {
              linksResults[index] = await fetchIssueLinks(restClient, settings.config.projectId, issue.iid)
            } catch (e) {
              linksResults[index] = []
            }
            completedLinks++
            if (completedLinks % 10 === 0 || completedLinks === issues.length) {
              loadingMessage.value = `Issue links\n${completedLinks} / ${issues.length} · ${Math.round((completedLinks / issues.length) * 100)}%`
            }
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY_LIMIT }, fetchWorker))

        loadingMessage.value = 'Issue links\nprocessing…'
        linksResults.forEach((links, index) => {
          const sourceIssue = issues[index]
          const sourceId = String(sourceIssue.iid)

          if (links && links.length > 0) {
            links.forEach(link => {
              const targetId = String(link.iid)

              // Avoid duplicate edges (A->B and B->A)
              const rawType = String(link.link_type || 'related')
              const t = rawType.toLowerCase()
              let a = sourceId
              let b = targetId
              let label = rawType

              // Normalize direction so arrows can be meaningful:
              // - blocks: blocker -> blocked
              // - is_blocked_by: flip to blocker -> blocked, but keep a readable label
              if (t === 'is_blocked_by' || t === 'blocked_by') {
                a = targetId
                b = sourceId
                label = 'blocks'
              } else if (t === 'blocks') {
                a = sourceId
                b = targetId
                label = 'blocks'
              } else if (t === 'relates' || t === 'relates_to' || t === 'related') {
                // undirected-ish: keep stable ordering
                if (a > b) { const tmp = a; a = b; b = tmp }
                label = 'relates'
              }

              const edgeId = `${a}-${b}-${label}`

              if (nodes[b] && !edges[edgeId]) {
                edges[edgeId] = { source: a, target: b, label }
              }
            })
          }
        })
      }

      // Save to cache (IndexedDB via localforage)
      try {
        // Persist current "issues" view snapshot (never persist SVN rev-tree)
        for (const k in issueGraphSnapshot.nodes) delete issueGraphSnapshot.nodes[k]
        for (const k in issueGraphSnapshot.edges) delete issueGraphSnapshot.edges[k]
        Object.assign(issueGraphSnapshot.nodes, toRaw(nodes))
        Object.assign(issueGraphSnapshot.edges, toRaw(edges))

        if (doGitLab && didGitLabFetch) {
          await localforage.setItem('gitlab_nodes', toRaw(nodes))
          await localforage.setItem('gitlab_edges', toRaw(edges))
          const now = Date.now()
          const syncCursor = String(gitlabSyncCursorForSave || settings.meta.gitlabSyncCursor || '') || new Date(now).toISOString()
          const meta = {
            nodes: Object.keys(nodes).length,
            edges: Object.keys(edges).length,
            updatedAt: now,
            syncCursor,
            projectId: String(settings.config.projectId || '').trim(),
            apiBaseUrl: String(gitlabApiBaseUrl || '').trim()
          }
          await localforage.setItem('gitlab_meta', meta)
          gitlabCacheMeta.value = meta
        }
        const now = Date.now()
        lastUpdated.value = now
        settings.meta.lastUpdated = now
        // Remember the closed-days window we just synced under, so a later change
        // to `gitlabClosedDays` is detected at the top of loadData and triggers a
        // full re-sync without the user needing Ctrl+Refresh.
        settings.meta.lastSyncClosedDays = Number(settings.config.gitlabClosedDays) || 0
      } catch (e) {
        console.error('Failed to save to cache:', e)
        error.value = `Failed to save to cache: ${e?.message || String(e)}`
      }
    } catch (err) {
      error.value = err?.message || String(err) || 'Failed to load data'
      console.error(err)
    } finally {
      loading.value = false
      updateStatus.value = { loading: false, source: updateStatus.value.source || '', message: loadingMessage.value }
    }

    // If user is currently in SVN mode, rebuild SVN graph now that we have commits.
    if (vizMode.value === 'svn') {
      buildSvnVizGraph()
    }
  }

  const handleRefreshClick = (e) => {
    const forceFull = !!(e && (e.ctrlKey || e.metaKey))
    return loadData({ forceFull })
  }

  const runSvnUpdate = async (override) => {
    // Refuse if any other update (loadData/SVN/etc.) is in progress to avoid
    // racing the shared `loading` flag and concurrent SVN writes.
    if (loading.value) return
    loading.value = true
    try {
      error.value = ''
      await updateAllSvnCaches(override)
    } catch (e) {
      error.value = `SVN Error: ${e?.message || String(e)}`
    } finally {
      loading.value = false
      updateStatus.value = { loading: false, source: 'svn', message: 'Done' }
    }
  }

  const handleUpdateSource = async (payload) => {
    // run update without leaving the config page
    if (typeof payload === 'string') {
      if (payload === 'svn') return runSvnUpdate()
      await loadData({ only: payload })
      return
    }
    if (payload && typeof payload === 'object' && payload.source === 'svn' && payload.mode === 'all') {
      return runSvnUpdate(payload)
    }
  }

  const handleClearSource = async (payload) => {
    if (payload === 'svn' || (payload && typeof payload === 'object' && payload.source === 'svn' && payload.mode === 'all')) {
      const urls = (payload && typeof payload === 'object' && Array.isArray(payload.urls))
        ? payload.urls.map(u => normalizeRepoUrl(u)).filter(Boolean)
        : (Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos.map(r => normalizeRepoUrl(r && r.url)).filter(Boolean) : [])
      if (urls.length === 0) return
      if (!confirm(`Delete SVN cache for ALL repos (${urls.length})?`)) return
      for (const url of urls) {
        await svnCacheClear(url)
      }
      svnCommitCount.value = 0
      svnRecentCommits.value = []
      return
    }

    const source = payload
    if (source === 'gitlab') {
      if (!confirm('Delete GitLab cache (nodes/edges)?')) return
      await localforage.removeItem('gitlab_nodes')
      await localforage.removeItem('gitlab_edges')
      await localforage.removeItem('gitlab_meta')
      gitlabCacheMeta.value = { nodes: 0, edges: 0, updatedAt: null }
      for (const k in nodes) delete nodes[k]
      for (const k in edges) delete edges[k]
    }
  }

  const clearData = async () => {
    if (confirm('Are you sure you want to clear all data and cache?')) {
      // Clear in-memory
      for (const key in nodes) delete nodes[key]
      for (const key in edges) delete edges[key]
      svnRecentCommits.value = []
      svnCommitCount.value = 0

      // Clear storage
      await localforage.clear()

      resetFilters()
    }
  }

  return {
    resolveGitLabApiBaseUrl,
    initCachedData,
    loadData,
    checkTokenInfo,
    handleRefreshClick,
    handleUpdateSource,
    handleClearSource,
    clearData
  }
}

