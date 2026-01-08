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
      return await client.request({ method, url, ...config })
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

export const fetchProjectIssues = async (client, projectId, onProgress, options = {}) => {
  try {
    const encodedProjectId = encodeURIComponent(projectId);
    let allIssues = [];
    let page = 1;
    let hasMore = true;
    let totalPages = 0;
    let safetyCounter = 0

    const baseParams = {
      per_page: PER_PAGE,
      state: options.state || 'opened',
      ...options.params
    };

    while (hasMore) {
      safetyCounter++
      // absolute safety valve against any weird pagination loops
      if (safetyCounter > 10_000) throw new Error('Aborting: too many GitLab pagination requests (possible loop).')

      if (onProgress) {
        const stateLabel = baseParams.state === 'opened' ? '' : ` (${baseParams.state})`;
        if (totalPages > 0) {
          const percent = Math.round((page / totalPages) * 100);
          onProgress(`Fetching issues${stateLabel} page ${page} of ${totalPages}, ${percent}%`);
        } else {
          onProgress(`Fetching issues${stateLabel} page ${page}...`);
        }
      }
      
      const response = await gitlabGet(
        client,
        `/projects/${encodedProjectId}/issues`,
        {
          params: {
            ...baseParams,
            page: page
          }
        },
        options.retry
      )

      if (!Array.isArray(response.data)) {
        const ct = String(response?.headers?.['content-type'] || '')
        throw new Error(`GitLab API returned unexpected data (not an array). Check your GitLab URL + token. content-type=${ct || '(unknown)'}`)
      }

      allIssues = allIssues.concat(response.data);
      
      // Try to update total pages from header if available
      if (response.headers['x-total-pages']) {
        const headerTotalPages = parseInt(response.headers['x-total-pages'], 10);
        if (totalPages === 0) {
           totalPages = PAGE_LIMIT === -1 ? headerTotalPages : Math.min(headerTotalPages, PAGE_LIMIT);
        }
      }

      // Determine if we should continue
      const nextPage = String(response.headers['x-next-page'] || '').trim()
      if (PAGE_LIMIT !== -1 && page >= PAGE_LIMIT) hasMore = false
      else if (totalPages > 0 && page >= totalPages) hasMore = false
      else if (nextPage) page = Number(nextPage) || (page + 1)
      else if (response.data.length < PER_PAGE) hasMore = false
      else page++
    }
    
    return allIssues;
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
