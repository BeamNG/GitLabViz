const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  fetchSvnLog: (config) => ipcRenderer.invoke('fetch-svn-log', config),
  svnRequest: (config) => ipcRenderer.invoke('svn-request', config),
  cacheGetJson: (key) => ipcRenderer.invoke('cache-get-json', { key }),
  cacheSetJson: (key, value) => ipcRenderer.invoke('cache-set-json', { key, value }),
  cacheDelete: (key) => ipcRenderer.invoke('cache-delete', { key }),
  cacheGetPath: () => ipcRenderer.invoke('cache-get-path'),
  cacheOpenFolder: () => ipcRenderer.invoke('cache-open-folder'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  settingsGet: () => ipcRenderer.invoke('settings-get'),
  settingsSet: (settings) => ipcRenderer.invoke('settings-set', { settings }),
  configGet: () => ipcRenderer.invoke('config-get'),
  configSet: (config) => ipcRenderer.invoke('config-set', { config }),
  svnCacheGetMeta: (repoUrl) => ipcRenderer.invoke('svn-cache-get-meta', { repoUrl }),
  svnCacheGetStats: (repoUrl) => ipcRenderer.invoke('svn-cache-get-stats', { repoUrl }),
  svnCacheWriteChunk: (repoUrl, chunk) => ipcRenderer.invoke('svn-cache-write-chunk', { repoUrl, chunk }),
  svnCacheReadPage: (repoUrl, page, perPage) => ipcRenderer.invoke('svn-cache-read-page', { repoUrl, page, perPage }),
  svnCacheClear: (repoUrl) => ipcRenderer.invoke('svn-cache-clear', { repoUrl }),

  // Mattermost (ChatTools assimilation)
  mattermostLogin: (payload) => ipcRenderer.invoke('mattermost-login', payload),
  mattermostRequest: (payload) => ipcRenderer.invoke('mattermost-request', payload),

  // Ollama (for ChatTools AI features)
  ollamaTags: (payload) => ipcRenderer.invoke('ollama-tags', payload),
  ollamaGenerate: (payload) => ipcRenderer.invoke('ollama-generate', payload),

  // Git (for ChatTools3 Team Progress)
  gitRun: (payload) => ipcRenderer.invoke('git-run', payload)
})

