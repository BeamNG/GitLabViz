const hasOllama = () => !!(window.electronAPI && window.electronAPI.ollamaTags && window.electronAPI.ollamaGenerate)

export async function getOllamaModels (host) {
  if (!hasOllama()) throw new Error('Ollama IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.ollamaTags({ host })
  if (!res || !res.success) throw new Error(res?.error || 'Failed to fetch Ollama models')
  return res.models || []
}

export async function ollamaGenerate ({ host, model, prompt }) {
  if (!hasOllama()) throw new Error('Ollama IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.ollamaGenerate({ host, model, prompt })
  if (!res || !res.success) throw new Error(res?.error || 'Ollama generate failed')
  return res.response || ''
}


