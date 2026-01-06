import axios from 'axios';

// Set to -1 to fetch all pages, or a positive integer (e.g. 3) for debugging/limit
export const PAGE_LIMIT = -1;
const PER_PAGE = 100

export const normalizeGitLabApiBaseUrl = (gitlabUrl) => {
  let u = String(gitlabUrl || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/\/api\/v\d+$/.test(u)) u = `${u}/api/v4`
  return u
}

export const createGitLabClient = (baseUrl, token) => {
  return axios.create({
    baseURL: baseUrl,
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

    const baseParams = {
      per_page: PER_PAGE,
      state: options.state || 'opened',
      ...options.params
    };

    while (hasMore) {
      if (onProgress) {
        const stateLabel = baseParams.state === 'opened' ? '' : ` (${baseParams.state})`;
        if (totalPages > 0) {
          const percent = Math.round((page / totalPages) * 100);
          onProgress(`Fetching issues${stateLabel} page ${page} of ${totalPages}, ${percent}%`);
        } else {
          onProgress(`Fetching issues${stateLabel} page ${page}...`);
        }
      }
      
      const response = await client.get(`/projects/${encodedProjectId}/issues`, {
        params: {
          ...baseParams,
          page: page
        }
      });

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
    const response = await client.get(`/projects/${encodedProjectId}/issues/${issueIid}/links`);
    return response.data;
  } catch (error) {
     console.warn(`Warning: Failed to fetch links for issue ${issueIid}: ${error.message}`);
     return []; // Return empty array on error to allow partial loading
  }
}
