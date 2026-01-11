import { toRaw } from 'vue'
import localforage from 'localforage'
import {
  createGitLabClient,
  createGitLabGraphqlClient,
  enrichEpicTitlesFromRest,
  enrichIssuesFromGraphql,
  fetchProjectIssuesRest,
  fetchIssueLinks,
  fetchTokenScopes,
  normalizeGitLabApiBaseUrl
} from '../services/gitlab'
import { createSvnClient, fetchSvnLog } from '../services/svn'
import { svnCacheGetMeta, svnCacheClear, normalizeRepoUrl } from '../services/cache'
import { MattermostClient } from '../chatTools/mmClient'
import { getScopedLabelValue } from '../utils/scopedLabels'

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
  const resolveGitLabApiBaseUrl = () => {
    const raw = String(settings.config.gitlabApiBaseUrl || '').trim()
    if (!raw) return ''

    const direct = normalizeGitLabApiBaseUrl(raw)
    if (!direct) return ''

    // In dev (web), use Vite proxy if configured and the URL matches that proxy target.
    if (!window.electronAPI && import.meta.env.DEV) {
      const proxyTarget = String(import.meta.env.VITE_GITLAB_PROXY_TARGET || '').trim().replace(/\/+$/, '')
      const host = String(raw || '').trim().replace(/\/+$/, '')
      if (proxyTarget && host.startsWith(proxyTarget)) return '/gitlab/api/v4'
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
          if (!isSvn) filteredCachedNodes[id] = n
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
    loadingMessage.value = `SVN: updating ${urls.length} repos...`

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      const prefix = `SVN (${i + 1}/${urls.length})`
      updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: starting...` }
      loadingMessage.value = `${prefix}: starting...`

      const svnClient = createSvnClient(url, username, password)
      await fetchSvnLog(svnClient, 0, {
        pageSize: 2000,
        cacheRepoUrl: url,
        onProgress: (msg) => {
          loadingMessage.value = `${prefix}: ${msg}`
          updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: ${msg}` }
        }
      })
    }

    // Update footer counter based on the first repo (keeps existing UI semantics)
    const meta = await svnCacheGetMeta(urls[0])
    if (meta && meta.totalCount != null) svnCommitCount.value = meta.totalCount
  }

  const loadData = async (opts = {}) => {
    // Do not start another fetch while one is already running (no queueing).
    if (loading.value) return

    // Check for app updates (hosted builds) before re-fetching data.
    try {
      if (typeof window.__glvCheckForUpdate === 'function') {
        const didReload = await window.__glvCheckForUpdate()
        if (didReload) return
      }
    } catch {}

    const only = opts.only || 'both' // 'gitlab' | 'svn' | 'mattermost' | 'both'
    const forceFull = !!opts.forceFull
    const doGitLab = (only === 'both' || only === 'gitlab') && settings.config.enableGitLab
    const doSvn = canUseSvn.value && (only === 'both' || only === 'svn') && settings.config.enableSvn
    const doMattermost = isElectron.value && (only === 'both' || only === 'mattermost') && !!settings.config.mattermostUrl && !!settings.config.mattermostToken

    const gitlabApiBaseUrl = resolveGitLabApiBaseUrl()

    if (doGitLab && (!settings.config.token || !settings.config.projectId || !gitlabApiBaseUrl)) {
      error.value = 'Please provide GitLab URL, Token, and Project ID'
      return
    }

    if (doSvn && !svnUrl.value) {
      error.value = 'Please provide SVN URL'
      return
    }

    if (only === 'mattermost' && (!settings.config.mattermostUrl || !settings.config.mattermostToken)) {
      error.value = 'Please configure Mattermost URL and login token in Configuration → Mattermost'
      return
    }

    if (!doGitLab && !doSvn && !doMattermost) {
      error.value = 'Please enable at least one data source (GitLab / SVN) or log into Mattermost'
      return
    }

    loading.value = true
    error.value = ''
    loadingMessage.value = 'Starting...'
    updateStatus.value = { loading: true, source: only === 'both' ? '' : only, message: 'Starting...' }

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
        loadingMessage.value = 'Mattermost: validating login...'
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

        loadingMessage.value = canIncrementalGitLab ? 'Fetching updated issues...' : 'Fetching issues...'
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

          // Best-effort: detect scopes to enable/disable write features in UI.
          try {
            const scopes = await fetchTokenScopes(restClient)
            settings.meta.gitlabTokenScopes = scopes
            settings.meta.gitlabCanWrite = Array.isArray(scopes) ? scopes.includes('api') : false
          } catch (e) {
            console.warn('[GitLab] Failed to detect token scopes:', e)
            settings.meta.gitlabTokenScopes = null
            settings.meta.gitlabCanWrite = false
          }

          // Fetch opened issues (REST: fast + includes epic_iid)
          issues = await fetchProjectIssuesRest(
            restClient,
            settings.config.projectId,
            (msg) => {
              loadingMessage.value = msg
              updateStatus.value = { loading: true, source: 'gitlab', message: msg }
            },
            updatedAfter ? { params: { updated_after: updatedAfter } } : {}
          )
          const partialOpened = !!issues?.__glvPartial

          // Fetch closed issues if requested
          if (settings.config.gitlabClosedDays > 0) {
            const closedAfter = new Date()
            closedAfter.setDate(closedAfter.getDate() - settings.config.gitlabClosedDays)

            const closedAfterMs = closedAfter.getTime()
            const closedUpdatedAfter = (() => {
              if (!updatedAfter) return closedAfter.toISOString()
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
          loadingMessage.value = 'Creating nodes...'

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
              _raw: issue,
              // preserve UI-only flags if present
              _uiForceShow: nodes[id]?._uiForceShow
            }
          })

          // Persist sync cursor (conservative watermark) for next incremental run
          settings.meta.gitlabSyncCursor = startedCursor
        } catch (e) {
          console.error(e)
          error.value = `GitLab Error: ${e.message}`
          // If SVN is enabled, continue?
          if (!settings.config.enableSvn) throw e
        }
      }

      // 2. Fetch SVN Data if configured
      if (doSvn && svnUrl.value) {
        try {
          loadingMessage.value = 'Fetching SVN log...'
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
            onProgress: (msg) => { loadingMessage.value = msg },
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
          error.value = `GitLab loaded, but SVN failed: ${svnErr.message}`
          // Keep going to show GitLab data
        }
      }

      // Fetch links for each issue with concurrency limit
      if (settings.config.enableGitLab && issues.length > 0) {
        loadingMessage.value = 'Fetching issue links...'
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
              loadingMessage.value = `Fetching links: ${completedLinks} / ${issues.length}`
            }
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY_LIMIT }, fetchWorker))

        loadingMessage.value = 'Processing links...'
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
      } catch (e) {
        console.error('Failed to save to cache:', e)
        error.value = 'Failed to save to cache: ' + e.message
      }
    } catch (err) {
      error.value = err.message || 'Failed to load data'
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

  const handleUpdateSource = async (payload) => {
    // run update without leaving the config page
    if (typeof payload === 'string') {
      if (payload === 'svn') {
        try {
          error.value = ''
          loading.value = true
          await updateAllSvnCaches()
        } catch (e) {
          error.value = `SVN Error: ${e?.message || String(e)}`
        } finally {
          loading.value = false
          updateStatus.value = { loading: false, source: 'svn', message: 'Done' }
        }
        return
      }
      await loadData({ only: payload })
      return
    }
    if (payload && typeof payload === 'object' && payload.source === 'svn' && payload.mode === 'all') {
      try {
        error.value = ''
        loading.value = true
        await updateAllSvnCaches(payload)
      } catch (e) {
        error.value = `SVN Error: ${e?.message || String(e)}`
      } finally {
        loading.value = false
        updateStatus.value = { loading: false, source: 'svn', message: 'Done' }
      }
      return
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
    handleRefreshClick,
    handleUpdateSource,
    handleClearSource,
    clearData
  }
}

