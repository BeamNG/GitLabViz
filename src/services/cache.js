export const hasFsCache = () => !!(window.electronAPI && window.electronAPI.cacheGetJson)

export const normalizeRepoUrl = (url) => {
  const raw = String(url || '').trim()
  if (!raw) return ''

  // Support dev proxy style "/svn/..."
  if (raw.startsWith('/')) {
    return raw.endsWith('/') ? raw : `${raw}/`
  }

  try {
    const u = new URL(raw)
    const proto = u.protocol.toLowerCase()
    const host = u.hostname.toLowerCase()
    const port = u.port && !((proto === 'http:' && u.port === '80') || (proto === 'https:' && u.port === '443')) ? `:${u.port}` : ''
    let path = u.pathname || '/'
    if (!path.endsWith('/')) path += '/'
    return `${proto}//${host}${port}${path}`
  } catch {
    // best-effort
    return raw.endsWith('/') ? raw : `${raw}/`
  }
}

export const cacheGetJson = async (key) => {
  if (!hasFsCache()) return null
  const res = await window.electronAPI.cacheGetJson(key)
  if (!res || !res.success) return null
  return res.value
}

export const cacheSetJson = async (key, value) => {
  if (!hasFsCache()) return false
  const res = await window.electronAPI.cacheSetJson(key, value)
  return !!(res && res.success)
}

export const cacheDelete = async (key) => {
  if (!hasFsCache()) return false
  const res = await window.electronAPI.cacheDelete(key)
  return !!(res && res.success)
}

export const svnCacheGetMeta = async (repoUrl) => {
  if (!window.electronAPI || !window.electronAPI.svnCacheGetMeta) return null
  const res = await window.electronAPI.svnCacheGetMeta(normalizeRepoUrl(repoUrl))
  if (!res || !res.success) return null
  return res.meta
}

export const svnCacheGetStats = async (repoUrl) => {
  if (!window.electronAPI || !window.electronAPI.svnCacheGetStats) return null
  const res = await window.electronAPI.svnCacheGetStats(normalizeRepoUrl(repoUrl))
  if (!res || !res.success) return null
  return res.stats
}

export const svnCacheClear = async (repoUrl) => {
  if (!window.electronAPI || !window.electronAPI.svnCacheClear) return false
  const res = await window.electronAPI.svnCacheClear(normalizeRepoUrl(repoUrl))
  return !!(res && res.success)
}

export const svnCacheWriteChunk = async (repoUrl, chunk) => {
  if (!window.electronAPI || !window.electronAPI.svnCacheWriteChunk) return null
  const res = await window.electronAPI.svnCacheWriteChunk(normalizeRepoUrl(repoUrl), chunk)
  if (!res || !res.success) return null
  return res.meta
}

export const svnCacheReadPage = async (repoUrl, page, perPage) => {
  if (!window.electronAPI || !window.electronAPI.svnCacheReadPage) return { totalCount: 0, items: [] }
  const res = await window.electronAPI.svnCacheReadPage(normalizeRepoUrl(repoUrl), page, perPage)
  if (!res || !res.success) return { totalCount: 0, items: [] }
  return { totalCount: res.totalCount || 0, items: res.items || [] }
}

export const cacheGetPath = async () => {
  if (!window.electronAPI || !window.electronAPI.cacheGetPath) return null
  const res = await window.electronAPI.cacheGetPath()
  if (!res || !res.success) return null
  return res.path
}

export const cacheOpenFolder = async () => {
  if (!window.electronAPI || !window.electronAPI.cacheOpenFolder) return false
  const res = await window.electronAPI.cacheOpenFolder()
  return !!(res && res.success)
}


