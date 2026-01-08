import axios from 'axios';
import { decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

// Set to -1 to fetch all pages, or a positive integer (e.g. 3) for debugging/limit
export const PAGE_LIMIT = -1;
const PER_PAGE = 100
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 500
const DEFAULT_RETRY_MAX_DELAY_MS = 5_000

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
    }

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
    const state = options.state || 'opened' // opened | closed
    const updatedAfter = options?.params?.updated_after || null

    const iterationField = caps.hasIteration ? 'iteration { id title }' : ''
    const healthField = caps.hasHealthStatus ? 'healthStatus' : ''
    const severityField = caps.hasSeverity ? 'severity' : ''
    const issueTypeField = caps.hasIssueType ? 'issueType' : ''
    const statusField = caps.hasStatus ? 'status { name }' : ''
    const epicField = caps.hasEpic ? 'epic { id title }' : ''

    // Keep the "fetch all issues" query reasonably light:
    // include additional scalars if available; omit huge nested collections (linkedIssues, emails, designs, etc.)
    const descriptionHtmlField = caps.hasDescriptionHtml ? 'descriptionHtml' : ''
    const hiddenField = caps.hasHidden ? 'hidden' : ''
    const webPathField = caps.hasWebPath ? 'webPath' : ''
    const referenceField = caps.hasReference ? 'reference(full: true)' : ''
    const startDateField = caps.hasStartDate ? 'startDate' : ''
    const relativePositionField = caps.hasRelativePosition ? 'relativePosition' : ''
    const typeLegacyField = caps.hasTypeLegacy ? 'type' : ''
    const participantsField = caps.hasParticipants ? 'participants { nodes { username name avatarUrl } }' : ''
    const userDiscussionsCountField = caps.hasUserDiscussionsCount ? 'userDiscussionsCount' : ''
    const subscribedField = caps.hasSubscribed ? 'subscribed' : ''
    const parentField = caps.hasParent ? 'parent { id iid title }' : ''

    const query = `
      query ProjectIssues($fullPath: ID!, $first: Int!, $after: String, $state: IssueState, $updatedAfter: Time) {
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
              timeStats { timeEstimate totalTimeSpent }
              labels { nodes { title } }
              author { id name username webUrl avatarUrl }
              assignees { nodes { id name username webUrl avatarUrl } }
              ${participantsField}
              milestone {
                id iid title description state createdAt updatedAt dueDate startDate expired webUrl
              }
              ${parentField}
              ${statusField}
              ${iterationField}
              ${epicField}
              ${healthField}
              ${severityField}
              ${issueTypeField}
              ${typeLegacyField}
              ${subscribedField}
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `

    const first = PER_PAGE
    let after = null
    let hasMore = true
    let page = 0
    const allIssues = []

    while (hasMore) {
      page++
      if (PAGE_LIMIT !== -1 && page > PAGE_LIMIT) break

      if (onProgress) {
        const stateLabel = state === 'opened' ? '' : ` (${state})`
        onProgress(`Fetching issues${stateLabel} page ${page}...`)
      }

      const variables = { fullPath, first, after, state, updatedAfter: updatedAfter || null }
      const resp = await gitlabPost(client, '', { data: { query, variables } }, options.retry)

      const payload = resp?.data || {}
      if (Array.isArray(payload?.errors) && payload.errors.length) {
        const msg = payload.errors.map(e => e?.message).filter(Boolean).join('; ') || 'GraphQL error'
        throw new Error(msg)
      }

      const nodes = payload?.data?.project?.issues?.nodes
      const pageInfo = payload?.data?.project?.issues?.pageInfo
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
        const time = n?.timeStats || null

        const statusName = caps.hasStatus && n?.status?.name ? String(n.status.name).trim() : ''
        const withStatusLabel = statusName ? [`Status::${statusName}`, ...labels] : labels

        allIssues.push({
          id: n?.id || null,
          iid: n?.iid != null ? Number(n.iid) : null,
          project_id: null,
          title: n?.title || '',
          description: n?.description || '',
          description_html: caps.hasDescriptionHtml ? (n?.descriptionHtml || null) : null,
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
                web_url: n.milestone.webUrl
              }
            : null,
          assignees: assignees.map(a => ({
            id: a?.id,
            username: a?.username,
            public_email: null,
            name: a?.name,
            state: 'active',
            locked: false,
            avatar_url: a?.avatarUrl || null,
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
                avatar_url: n.author.avatarUrl || null,
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
                avatar_url: assignee?.avatarUrl || null,
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
            time_estimate: Number(time?.timeEstimate) || 0,
            total_time_spent: Number(time?.totalTimeSpent) || 0,
            human_time_estimate: null,
            human_total_time_spent: null
          },
          task_completion_status: { count, completed_count: completed },
          weight: n?.weight ?? null,
          blocking_issues_count: 0,
          has_tasks: true,
          task_status: `${completed} of ${count} checklist items completed`,
          _links: {},
          references: {},
          severity: 'UNKNOWN',
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
            avatar_url: p?.avatarUrl || null
          })) : [],
          work_item_status: statusName || null
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
