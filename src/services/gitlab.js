import axios from 'axios';
import { decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

// Set to -1 to fetch all pages, or a positive integer (e.g. 3) for debugging/limit
export const PAGE_LIMIT = -1;
const PER_PAGE = 100
// GraphQL responses can get huge; keep pages smaller.
const GRAPHQL_PAGE_SIZE = 50
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 500
const DEFAULT_RETRY_MAX_DELAY_MS = 5_000

// Payload control knobs (kept small on purpose)
const INCLUDE_AVATARS = false
const INCLUDE_DESCRIPTION_HTML = false

export const normalizeGitLabApiBaseUrl = (gitlabUrl) => {
  let u = String(gitlabUrl || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/\/api\/v\d+$/.test(u)) u = `${u}/api/v4`
  return u
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const getRetryAfterMs = (headers) => {
  const ra = headers && (headers['retry-after'] || headers['Retry-After'])
  if (!ra) return 0
  const raw = String(ra).trim()
  if (!raw) return 0

  // either seconds or HTTP date
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000)

  const t = Date.parse(raw)
  if (Number.isFinite(t)) return Math.max(0, Math.min(t - Date.now(), 60_000))
  return 0
}

const isRetryableGitLabError = (error) => {
  const status = error?.response?.status
  // Network / timeout / no response
  if (!status) {
    // Only treat axios-style request failures as retryable.
    // Plain errors (e.g. thrown by our own code) should not be retried.
    if (error?.isAxiosError) return true
    if (error?.code) return true
    if (error?.request) return true
    return false
  }
  // Rate limit + transient server errors
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

const gitlabRequest = async (client, method, url, config = {}, retryOptions = {}) => {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
  } = retryOptions

  let attempt = 0
  // total tries = 1 + maxRetries
  while (true) {
    try {
      // Support both axios instances (client.request) and unit test mocks (client.get/put).
      if (typeof client?.request === 'function') {
        return await client.request({ method, url, ...config })
      }

      const m = String(method || '').toLowerCase()
      if (m === 'get') {
        if (typeof client?.get !== 'function') throw new TypeError('client.get is not a function')
        return await client.get(url, config)
      }
      if (m === 'post') {
        if (typeof client?.post !== 'function') throw new TypeError('client.post is not a function')
        const { data, ...rest } = config || {}
        return await client.post(url, data, rest)
      }
      if (m === 'put') {
        if (typeof client?.put !== 'function') throw new TypeError('client.put is not a function')
        const { data, ...rest } = config || {}
        return await client.put(url, data, rest)
      }

      throw new Error(`Unsupported GitLab client method: ${m || '(empty)'}`)
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableGitLabError(error)) throw error

      const headers = error?.response?.headers || {}
      const retryAfterMs = getRetryAfterMs(headers)
      const backoffMs = Math.min(retryMaxDelayMs, retryBaseDelayMs * (2 ** attempt))
      const waitMs = Math.max(retryAfterMs, backoffMs)

      attempt++
      console.warn(`[GitLab] Request failed (${error?.response?.status || 'network'}). Retrying in ${waitMs}ms...`, url)
      await sleep(waitMs)
    }
  }
}

const gitlabGet = (client, url, config = {}, retryOptions = {}) => {
  return gitlabRequest(client, 'get', url, config, retryOptions)
}

export const createGitLabClient = (baseUrl, token) => {
  return axios.create({
    baseURL: baseUrl,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'PRIVATE-TOKEN': token,
    },
  });
};

export const createGitLabGraphqlClient = (apiBaseUrl, token) => {
  const raw = String(apiBaseUrl || '').trim()
  const baseURL = raw
    ? raw.replace(/\/api\/v4\/?$/, '/api/graphql').replace(/\/+$/, '')
    : raw

  return axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'PRIVATE-TOKEN': token,
    },
  })
}

const gitlabPost = (client, url, config = {}, retryOptions = {}) => {
  return gitlabRequest(client, 'post', url, config, retryOptions)
}

const unwrapTypeName = (t) => {
  let cur = t
  while (cur) {
    if (cur.name) return cur.name
    cur = cur.ofType
  }
  return null
}

const getWidgetBaseTypeNameFromIssue = async (client) => {
  try {
    const q = `
      query {
        __type(name: "Issue") {
          fields {
            name
            type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
          }
        }
      }
    `
    const r = await gitlabPost(client, '', { data: { query: q } }, { maxRetries: 1 })
    const fields = r?.data?.data?.__type?.fields || []
    const widgetsField = Array.isArray(fields) ? fields.find(f => f?.name === 'widgets') : null
    return widgetsField ? unwrapTypeName(widgetsField.type) : null
  } catch {
    return null
  }
}

const detectProjectIssuesArgs = async (client) => {
  const key = '__glvProjectIssuesArgs'
  if (client && client[key]) return client[key]

  const fallback = { stateType: 'IssuableState', stateEnumValues: null, issuesCountField: null }
  if (!client) return fallback

  try {
    const query = `
      query {
        __type(name: "Project") {
          fields {
            name
            type { kind name ofType { kind name ofType { kind name } } }
            args {
              name
              type { kind name ofType { kind name ofType { kind name } } }
            }
          }
        }
      }
    `
    const resp = await gitlabPost(client, '', { data: { query } }, { maxRetries: 1 })
    const fields = resp?.data?.data?.__type?.fields || []
    const issuesField = Array.isArray(fields) ? fields.find(f => f?.name === 'issues') : null
    const args = issuesField?.args || []
    const stateArg = Array.isArray(args) ? args.find(a => a?.name === 'state') : null
    const stateType = unwrapTypeName(stateArg?.type) || fallback.stateType
    const connType = unwrapTypeName(issuesField?.type) || 'IssueConnection'

    let stateEnumValues = null
    let issuesCountField = null
    try {
      const q2 = `
        query GetCaps($stateType: String!, $connType: String!) {
          stateEnum: __type(name: $stateType) { enumValues { name } }
          conn: __type(name: $connType) { fields { name } }
        }
      `
      const r2 = await gitlabPost(
        client,
        '',
        { data: { query: q2, variables: { stateType, connType } } },
        { maxRetries: 1 }
      )
      const vals = r2?.data?.data?.stateEnum?.enumValues?.map(v => v?.name).filter(Boolean) || null
      stateEnumValues = Array.isArray(vals) && vals.length ? vals : null

      const connFields = r2?.data?.data?.conn?.fields?.map(f => f?.name).filter(Boolean) || []
      if (connFields.includes('totalCount')) issuesCountField = 'totalCount'
      else if (connFields.includes('count')) issuesCountField = 'count'
    } catch {}

    const out = { stateType, stateEnumValues, issuesCountField }
    client[key] = out
    return out
  } catch {
    client[key] = fallback
    return fallback
  }
}

const detectMilestoneCaps = async (client) => {
  const key = '__glvMilestoneCaps'
  if (client && client[key]) return client[key]

  const fallback = { hasWebUrl: false, hasWebPath: false }
  if (!client) return fallback

  try {
    const query = `
      query {
        __type(name: "Milestone") {
          fields { name }
        }
      }
    `
    const resp = await gitlabPost(client, '', { data: { query } }, { maxRetries: 1 })
    const fields = resp?.data?.data?.__type?.fields?.map(f => f?.name).filter(Boolean) || []
    const has = (name) => fields.includes(name)
    const caps = {
      hasWebUrl: has('webUrl'),
      hasWebPath: has('webPath')
    }
    client[key] = caps
    return caps
  } catch {
    client[key] = fallback
    return fallback
  }
}

/**
 * Detect which GraphQL Issue fields exist on this GitLab instance.
 * Cached per-client instance.
 */
const detectFeatures = async (client) => {
  const key = '__glvIssueFieldCaps'
  if (client && client[key]) return client[key]

  try {
    const query = `
      query {
        __type(name: "Issue") {
          fields { name }
        }
      }
    `

    const resp = await gitlabPost(client, '', { data: { query } }, { maxRetries: 1 })
    const fields = resp?.data?.data?.__type?.fields?.map(f => f?.name).filter(Boolean) || []
    const has = (name) => fields.includes(name)

    const caps = {
      // Newer work-item status field (To do / In progress / ...)
      hasIteration: has('iteration'),
      hasHealthStatus: has('healthStatus'),
      hasSeverity: has('severity'),
      hasIssueType: has('issueType'),
      hasStatus: has('status'),
      hasEpic: has('epic'),
      hasWidgets: has('widgets'),
      hasWorkItemType: has('workItemType'),

      // Extra fields (vary by GitLab version/edition)
      hasDescriptionHtml: has('descriptionHtml'),
      hasHidden: has('hidden'),
      hasWebPath: has('webPath'),
      hasReference: has('reference'),
      hasStartDate: has('startDate'),
      hasRelativePosition: has('relativePosition'),
      hasTypeLegacy: has('type'),
      hasParent: has('parent'),
      hasParticipants: has('participants'),
      hasUserDiscussionsCount: has('userDiscussionsCount'),
      hasSubscribed: has('subscribed'),
      hasLinkedIssues: has('linkedIssues'),
      hasRelatedMergeRequests: has('relatedMergeRequests'),
      hasExternalAuthor: has('externalAuthor'),
      hasEmails: has('emails'),
      hasCustomerRelationsContacts: has('customerRelationsContacts'),
      hasUserPermissions: has('userPermissions'),
      hasDesignCollection: has('designCollection'),

      // Time tracking: schema varies by version
      hasTimeStats: has('timeStats'),
      hasTimeEstimate: has('timeEstimate'),
      hasTotalTimeSpent: has('totalTimeSpent'),
      hasHumanTimeEstimate: has('humanTimeEstimate'),
      hasHumanTotalTimeSpent: has('humanTotalTimeSpent'),
    }

    // Only reference WorkItemWidgetStatus in queries if:
    // - the type exists, AND
    // - it's a possible type of Issue.widgets (union/interface)
    caps.hasWorkItemWidgetStatusType = false
    if (caps.hasWidgets) {
      try {
        const widgetsBase = await getWidgetBaseTypeNameFromIssue(client)
        if (widgetsBase) {
          const q = `
            query {
              base: __type(name: "${widgetsBase}") { possibleTypes { name } }
              st: __type(name: "WorkItemWidgetStatus") { name }
            }
          `
          const r = await gitlabPost(client, '', { data: { query: q } }, { maxRetries: 1 })
          const possible = r?.data?.data?.base?.possibleTypes?.map(x => x?.name).filter(Boolean) || []
          const statusExists = !!r?.data?.data?.st?.name
          caps.hasWorkItemWidgetStatusType = statusExists && possible.includes('WorkItemWidgetStatus')
        }
      } catch {}
    }

    // Detect if the Project type exposes work item queries (for future on-demand status fetches)
    caps.hasProjectWorkItem = false
    caps.hasProjectWorkItems = false
    try {
      const q = `
        query {
          __type(name: "Project") {
            fields { name }
          }
        }
      `
      const r = await gitlabPost(client, '', { data: { query: q } }, { maxRetries: 1 })
      const f = r?.data?.data?.__type?.fields?.map(x => x?.name).filter(Boolean) || []
      caps.hasProjectWorkItem = f.includes('workItem')
      caps.hasProjectWorkItems = f.includes('workItems')
    } catch {}

    if (client) client[key] = caps
    return caps
  } catch (e) {
    const caps = {
      hasIteration: false,
      hasHealthStatus: false,
      hasSeverity: false,
      hasIssueType: false,
      hasStatus: false,
      hasEpic: false,
      hasWidgets: false,
      hasWorkItemType: false,
      hasWorkItemWidgetStatusType: false,
      hasDescriptionHtml: false,
      hasHidden: false,
      hasWebPath: false,
      hasReference: false,
      hasStartDate: false,
      hasRelativePosition: false,
      hasTypeLegacy: false,
      hasParent: false,
      hasParticipants: false,
      hasUserDiscussionsCount: false,
      hasSubscribed: false,
      hasLinkedIssues: false,
      hasRelatedMergeRequests: false,
      hasExternalAuthor: false,
      hasEmails: false,
      hasCustomerRelationsContacts: false,
      hasUserPermissions: false,
      hasDesignCollection: false,
      hasTimeStats: false,
      hasTimeEstimate: false,
      hasTotalTimeSpent: false,
      hasHumanTimeEstimate: false,
      hasHumanTotalTimeSpent: false,
      hasProjectWorkItem: false,
      hasProjectWorkItems: false,
    }
    if (client) client[key] = caps
    return caps
  }
}

export const fetchProjectIssues = async (client, projectId, onProgress, options = {}) => {
  try {
    const fullPath = String(projectId || '').trim()
    if (!fullPath) return []

    const caps = await detectFeatures(client)
    const issueArgs = await detectProjectIssuesArgs(client)
    const milestoneCaps = await detectMilestoneCaps(client)
    const state = options.state || 'opened' // opened | closed
    const updatedAfter = options?.params?.updated_after || null

    const enumVals = issueArgs.stateEnumValues
    const pickState = (s) => {
      const want = String(s || '')
      if (!enumVals) return want
      if (enumVals.includes(want)) return want
      const upper = want.toUpperCase()
      if (enumVals.includes(upper)) return upper
      const cap = upper.charAt(0) + upper.slice(1).toLowerCase()
      if (enumVals.includes(cap)) return cap
      return want
    }
    const stateValue = pickState(state)

    const iterationField = caps.hasIteration ? 'iteration { id title }' : ''
    const healthField = caps.hasHealthStatus ? 'healthStatus' : ''
    const severityField = caps.hasSeverity ? 'severity' : ''
    const issueTypeField = caps.hasIssueType ? 'issueType' : ''
    const statusField = caps.hasStatus ? 'status { name }' : ''
    const epicField = caps.hasEpic ? 'epic { id title }' : ''

    const widgetStatusField =
      (caps.hasWidgets && caps.hasWorkItemWidgetStatusType)
        ? `
          widgets {
            __typename
            ... on WorkItemWidgetStatus {
              status { name }
            }
          }
        `
        : ''

    const workItemTypeField = caps.hasWorkItemType ? 'workItemType { name }' : ''

    const timeField = caps.hasTimeStats
      ? 'timeStats { timeEstimate totalTimeSpent humanTimeEstimate humanTotalTimeSpent }'
      : [
          caps.hasTimeEstimate ? 'timeEstimate' : '',
          caps.hasTotalTimeSpent ? 'totalTimeSpent' : '',
          caps.hasHumanTimeEstimate ? 'humanTimeEstimate' : '',
          caps.hasHumanTotalTimeSpent ? 'humanTotalTimeSpent' : ''
        ].filter(Boolean).join('\n')

    // Keep the "fetch all issues" query reasonably light:
    // include additional scalars if available; omit huge nested collections (linkedIssues, emails, designs, etc.)
    const descriptionHtmlField = (INCLUDE_DESCRIPTION_HTML && caps.hasDescriptionHtml) ? 'descriptionHtml' : ''
    const hiddenField = caps.hasHidden ? 'hidden' : ''
    const webPathField = caps.hasWebPath ? 'webPath' : ''
    const referenceField = caps.hasReference ? 'reference(full: true)' : ''
    const startDateField = caps.hasStartDate ? 'startDate' : ''
    const relativePositionField = caps.hasRelativePosition ? 'relativePosition' : ''
    const typeLegacyField = caps.hasTypeLegacy ? 'type' : ''
    const participantsField = caps.hasParticipants ? 'participants { nodes { username name } }' : ''
    const userDiscussionsCountField = caps.hasUserDiscussionsCount ? 'userDiscussionsCount' : ''
    const subscribedField = caps.hasSubscribed ? 'subscribed' : ''
    const parentField = caps.hasParent ? 'parent { id iid title }' : ''

    const milestoneWebField = milestoneCaps.hasWebUrl ? 'webUrl' : (milestoneCaps.hasWebPath ? 'webPath' : '')
    const issuesCountField = issueArgs.issuesCountField ? issueArgs.issuesCountField : ''

    const query = `
      query ProjectIssues($fullPath: ID!, $first: Int!, $after: String, $state: ${issueArgs.stateType}, $updatedAfter: Time) {
        project(fullPath: $fullPath) {
          issues(first: $first, after: $after, state: $state, updatedAfter: $updatedAfter) {
            nodes {
              id
              iid
              title
              description
              ${descriptionHtmlField}
              state
              ${hiddenField}
              createdAt
              updatedAt
              closedAt
              dueDate
              ${startDateField}
              ${relativePositionField}
              confidential
              webUrl
              ${webPathField}
              ${referenceField}
              weight
              upvotes
              downvotes
              userNotesCount
              ${userDiscussionsCountField}
              mergeRequestsCount
              taskCompletionStatus { count completedCount }
              ${timeField}
              labels { nodes { title } }
              author { id name username webUrl ${INCLUDE_AVATARS ? 'avatarUrl' : ''} }
              assignees { nodes { id name username webUrl ${INCLUDE_AVATARS ? 'avatarUrl' : ''} } }
              ${participantsField}
              milestone {
                id iid title description state createdAt updatedAt dueDate startDate expired ${milestoneWebField}
              }
              ${parentField}
              ${statusField}
              ${workItemTypeField}
              ${widgetStatusField}
              ${iterationField}
              ${epicField}
              ${healthField}
              ${severityField}
              ${issueTypeField}
              ${typeLegacyField}
              ${subscribedField}
            }
            pageInfo { hasNextPage endCursor }
            ${issuesCountField}
          }
        }
      }
    `

    const first = GRAPHQL_PAGE_SIZE
    let after = null
    let hasMore = true
    let page = 0
    const allIssues = []
    let totalCount = null

    while (hasMore) {
      page++
      if (PAGE_LIMIT !== -1 && page > PAGE_LIMIT) break

      if (onProgress) {
        const stateLabel = state === 'opened' ? '' : ` (${state})`
        if (Number.isFinite(totalCount) && totalCount > 0) {
          const totalPages = Math.max(1, Math.ceil(totalCount / first))
          const pct = Math.round((allIssues.length / totalCount) * 100)
          onProgress(`Fetching issues${stateLabel} page ${page} of ${totalPages} (${pct}%)...`)
        } else {
          onProgress(`Fetching issues${stateLabel} page ${page}... (${allIssues.length} fetched)`)
        }
      }

      const variables = { fullPath, first, after, state: stateValue, updatedAfter: updatedAfter || null }
      const resp = await gitlabPost(client, '', { data: { query, variables } }, options.retry)

      const payload = resp?.data || {}
      if (Array.isArray(payload?.errors) && payload.errors.length) {
        const msg = payload.errors.map(e => e?.message).filter(Boolean).join('; ') || 'GraphQL error'
        throw new Error(msg)
      }

      const nodes = payload?.data?.project?.issues?.nodes
      const pageInfo = payload?.data?.project?.issues?.pageInfo
      if (issueArgs.issuesCountField) {
        const rawCount = payload?.data?.project?.issues?.[issueArgs.issuesCountField]
        const n = Number(rawCount)
        if (Number.isFinite(n) && n >= 0) totalCount = n
      }
      if (!Array.isArray(nodes)) throw new Error('GitLab GraphQL returned unexpected data (issues.nodes missing)')

      nodes.forEach(n => {
        const labels = Array.isArray(n?.labels?.nodes) ? n.labels.nodes.map(x => x?.title).filter(Boolean) : []
        const assignees = Array.isArray(n?.assignees?.nodes) ? n.assignees.nodes : []
        const assignee = assignees.length ? assignees[0] : null
        const participants = Array.isArray(n?.participants?.nodes) ? n.participants.nodes : []
        const parent = n?.parent || null
        const tc = n?.taskCompletionStatus || null
        const count = Number(tc?.count) || 0
        const completed = Number(tc?.completedCount) || 0
        const time = caps.hasTimeStats ? (n?.timeStats || null) : null

        const legacyLabelStatus = (() => {
          const hit = labels.find(l => typeof l === 'string' && (l.startsWith('Status::') || l.startsWith('Status:')))
          if (!hit) return ''
          const v = hit.includes('::') ? hit.split('::').slice(1).join('::') : hit.split(':').slice(1).join(':')
          return String(v || '').trim()
        })()

        const statusFromField = caps.hasStatus && n?.status?.name ? String(n.status.name).trim() : ''
        const statusFromWidget = (() => {
          if (!caps.hasWidgets || !Array.isArray(n?.widgets)) return ''
          const w = n.widgets.find(x => x && x.status && x.status.name)
          return w?.status?.name ? String(w.status.name).trim() : ''
        })()

        const workItemStatus = statusFromWidget || statusFromField || ''
        const withStatusLabel = workItemStatus ? [`Status::${workItemStatus}`, ...labels] : labels

        allIssues.push({
          id: n?.id || null,
          iid: n?.iid != null ? Number(n.iid) : null,
          project_id: null,
          title: n?.title || '',
          description: n?.description || '',
          state: n?.state || '',
          hidden: caps.hasHidden ? !!n?.hidden : false,
          created_at: n?.createdAt || null,
          updated_at: n?.updatedAt || null,
          closed_at: n?.closedAt || null,
          closed_by: null,
          start_date: caps.hasStartDate ? (n?.startDate || null) : null,
          relative_position: caps.hasRelativePosition ? (n?.relativePosition ?? null) : null,
          labels: withStatusLabel,
          milestone: n?.milestone
            ? {
                id: n.milestone.id,
                iid: n.milestone.iid,
                group_id: null,
                title: n.milestone.title,
                description: n.milestone.description || '',
                state: n.milestone.state,
                created_at: n.milestone.createdAt,
                updated_at: n.milestone.updatedAt,
                due_date: n.milestone.dueDate,
                start_date: n.milestone.startDate,
                expired: n.milestone.expired,
                web_url: milestoneCaps.hasWebUrl ? (n.milestone.webUrl || '') : '',
                web_path: milestoneCaps.hasWebPath ? (n.milestone.webPath || '') : ''
              }
            : null,
          assignees: assignees.map(a => ({
            id: a?.id,
            username: a?.username,
            public_email: null,
            name: a?.name,
            state: 'active',
            locked: false,
            avatar_url: INCLUDE_AVATARS ? (a?.avatarUrl || null) : null,
            web_url: a?.webUrl || ''
          })),
          author: n?.author
            ? {
                id: n.author.id,
                username: n.author.username,
                public_email: null,
                name: n.author.name,
                state: 'active',
                locked: false,
                avatar_url: INCLUDE_AVATARS ? (n.author.avatarUrl || null) : null,
                web_url: n.author.webUrl || ''
              }
            : null,
          type: 'ISSUE',
          assignee: assignee
            ? {
                id: assignee?.id,
                username: assignee?.username,
                public_email: null,
                name: assignee?.name,
                state: 'active',
                locked: false,
                avatar_url: INCLUDE_AVATARS ? (assignee?.avatarUrl || null) : null,
                web_url: assignee?.webUrl || ''
              }
            : null,
          user_notes_count: Number(n?.userNotesCount) || 0,
          user_discussions_count: caps.hasUserDiscussionsCount ? (Number(n?.userDiscussionsCount) || 0) : 0,
          merge_requests_count: Number(n?.mergeRequestsCount) || 0,
          upvotes: Number(n?.upvotes) || 0,
          downvotes: Number(n?.downvotes) || 0,
          due_date: n?.dueDate || null,
          confidential: !!n?.confidential,
          subscribed: caps.hasSubscribed ? !!n?.subscribed : false,
          web_path: caps.hasWebPath ? (n?.webPath || '') : '',
          reference: caps.hasReference ? (n?.reference || '') : '',
          issue_type: 'issue',
          web_url: n?.webUrl || '',
          health_status: caps.hasHealthStatus ? (n?.healthStatus || null) : null,
          severity: caps.hasSeverity ? (n?.severity || 'UNKNOWN') : 'UNKNOWN',
          issue_type_field: caps.hasIssueType ? (n?.issueType || null) : null,
          legacy_type: caps.hasTypeLegacy ? (n?.type || null) : null,
          time_stats: {
            time_estimate: Number((caps.hasTimeStats ? time?.timeEstimate : n?.timeEstimate)) || 0,
            total_time_spent: Number((caps.hasTimeStats ? time?.totalTimeSpent : n?.totalTimeSpent)) || 0,
            human_time_estimate: (caps.hasTimeStats ? (time?.humanTimeEstimate ?? null) : (n?.humanTimeEstimate ?? null)),
            human_total_time_spent: (caps.hasTimeStats ? (time?.humanTotalTimeSpent ?? null) : (n?.humanTotalTimeSpent ?? null))
          },
          task_completion_status: { count, completed_count: completed },
          weight: n?.weight ?? null,
          blocking_issues_count: 0,
          has_tasks: true,
          task_status: `${completed} of ${count} checklist items completed`,
          _links: {},
          references: {},
          moved_to_id: null,
          imported: false,
          imported_from: 'none',
          service_desk_reply_to: null,
          epic_iid: null,
          epic: caps.hasEpic && n?.epic ? { title: n.epic.title } : null,
          iteration: caps.hasIteration && n?.iteration ? { title: n.iteration.title } : null,
          parent: caps.hasParent && parent ? { id: parent.id, iid: parent.iid, title: parent.title } : null,
          participants: caps.hasParticipants ? participants.map(p => ({
            username: p?.username,
            name: p?.name,
            avatar_url: INCLUDE_AVATARS ? (p?.avatarUrl || null) : null
          })) : [],
          work_item_status: workItemStatus || null,
          status_display: workItemStatus || legacyLabelStatus || (String(n?.state) === 'closed' ? 'Done' : 'To do'),
        })
      })

      hasMore = !!pageInfo?.hasNextPage
      after = pageInfo?.endCursor || null
      if (hasMore && !after) hasMore = false
    }

    return allIssues
  } catch (error) {
    console.error('Error fetching issues:', error);
    throw error;
  }
};

export const fetchIssueLinks = async (client, projectId, issueIid) => {
   try {
    const encodedProjectId = encodeURIComponent(projectId);
    const response = await gitlabGet(
      client,
      `/projects/${encodedProjectId}/issues/${issueIid}/links`,
      {},
      { maxRetries: 1 }
    )
    return response.data;
  } catch (error) {
     console.warn(`Warning: Failed to fetch links for issue ${issueIid}: ${error.message}`);
     return []; // Return empty array on error to allow partial loading
  }
}

const parseScopesHeader = (v) => {
  const s = String(v || '').trim()
  if (!s) return null
  const scopes = s.split(',').map(x => x.trim()).filter(Boolean)
  return scopes.length ? scopes : null
}

// Best-effort token scope detection:
// - Newer GitLab: GET /personal_access_tokens/self (returns { scopes: [...] })
// - Fallback: read X-OAuth-Scopes header if present (typically OAuth tokens; some setups may include it)
export const fetchTokenScopes = async (client) => {
  if (!client) return null

  // 1) Prefer the explicit introspection endpoint if available.
  try {
    const resp = await gitlabGet(client, '/personal_access_tokens/self', {}, { maxRetries: 1 })
    const scopes = Array.isArray(resp?.data?.scopes) ? resp.data.scopes.filter(Boolean) : null
    if (scopes && scopes.length) return scopes
  } catch (e) {
    const status = e?.response?.status
    // If unsupported/forbidden, we'll fall back below.
    if (!(status === 404 || status === 401 || status === 403)) throw e
  }

  // 2) Fallback: probe a cheap endpoint and inspect headers if available.
  try {
    const resp = await gitlabGet(client, '/user', {}, { maxRetries: 1 })
    const h = resp?.headers || {}
    return (
      parseScopesHeader(h['x-oauth-scopes']) ||
      parseScopesHeader(h['X-OAuth-Scopes']) ||
      null
    )
  } catch (e) {
    const status = e?.response?.status
    if (status === 401) return null
    throw e
  }
}

export const updateIssue = async (client, projectId, issueIid, payload) => {
  const encodedProjectId = encodeURIComponent(projectId)
  const resp = await gitlabRequest(
    client,
    'put',
    `/projects/${encodedProjectId}/issues/${issueIid}`,
    { data: payload || {} },
    { maxRetries: 1 }
  )
  return resp.data
}
