// Mattermost API wrapper via Electron IPC (avoids CORS and handles self-signed certs).

const hasMM = () => !!(window.electronAPI && window.electronAPI.mattermostRequest && window.electronAPI.mattermostLogin)

export async function mattermostLogin ({ baseUrl, email, password, mfaToken }) {
  if (!hasMM()) throw new Error('Mattermost IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.mattermostLogin({ baseUrl, email, password, mfaToken })
  if (!res || !res.success) throw new Error(res?.error || 'Login failed')
  return res
}

export async function mattermostRequest ({ baseUrl, token, method = 'GET', path, params, data, headers }) {
  if (!hasMM()) throw new Error('Mattermost IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.mattermostRequest({ baseUrl, token, method, path, params, data, headers })
  if (!res || !res.success) {
    const msg = res?.error || `${res?.status || ''} ${res?.statusText || ''}`.trim() || 'Request failed'
    const err = new Error(msg)
    err.details = res
    throw err
  }
  return res.data
}

export const mm = {
  login: mattermostLogin,
  request: mattermostRequest,
  // Convenience methods (subset we know we need for porting ChatTools)
  me: ({ baseUrl, token }) => mattermostRequest({ baseUrl, token, path: '/users/me' }),
  teams: ({ baseUrl, token }) => mattermostRequest({ baseUrl, token, path: '/users/me/teams' }),
  teamChannels: ({ baseUrl, token, teamId }) => mattermostRequest({ baseUrl, token, path: `/users/me/teams/${teamId}/channels` }),
  channelById: ({ baseUrl, token, channelId }) => mattermostRequest({ baseUrl, token, path: `/channels/${channelId}` }),
  posts: ({ baseUrl, token, channelId, perPage = 60, page = 0 }) =>
    mattermostRequest({ baseUrl, token, path: `/channels/${channelId}/posts`, params: { per_page: perPage, page } }),
  thread: ({ baseUrl, token, postId }) => mattermostRequest({ baseUrl, token, path: `/posts/${postId}/thread` }),
  usersByIds: ({ baseUrl, token, ids }) => mattermostRequest({ baseUrl, token, method: 'POST', path: '/users/ids', data: ids }),
  userByUsername: ({ baseUrl, token, username }) =>
    mattermostRequest({ baseUrl, token, path: `/users/username/${encodeURIComponent(username)}` }),
  flaggedPosts: ({ baseUrl, token, userId }) => mattermostRequest({ baseUrl, token, path: `/users/${userId}/posts/flagged` }),
  searchPosts: ({ baseUrl, token, teamId, terms, isOrSearch = true }) =>
    mattermostRequest({ baseUrl, token, method: 'POST', path: `/teams/${teamId}/posts/search`, data: { terms, is_or_search: !!isOrSearch } }),
  channelMembersForUser: ({ baseUrl, token, userId, teamId }) =>
    mattermostRequest({ baseUrl, token, path: `/users/${userId}/teams/${teamId}/channels/members` })
}


