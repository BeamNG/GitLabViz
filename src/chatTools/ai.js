import { safeText } from './utils'

const hasOllama = () => !!(window.electronAPI && window.electronAPI.ollamaTags && window.electronAPI.ollamaGenerate)

export async function getOllamaModels ({ host } = {}) {
  if (!hasOllama()) throw new Error('Ollama IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.ollamaTags({ host })
  if (!res || !res.success) throw new Error(res?.error || 'Failed to fetch Ollama models')
  return Array.isArray(res.models) ? res.models : []
}

export async function ollamaGenerate ({ host, model, prompt }) {
  if (!hasOllama()) throw new Error('Ollama IPC not available (are you running inside Electron?)')
  const res = await window.electronAPI.ollamaGenerate({ host, model, prompt })
  if (!res || !res.success) throw new Error(res?.error || 'Ollama generate failed')
  return String(res.response || '').trim()
}

export function stripThinkBlocks (s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

export function extractFirstJsonObject (s) {
  const text = String(s || '')
  const m = text.match(/\{[\s\S]*?\}/)
  return m ? m[0] : null
}

// Port of chatTools/ai.py analyze_thread_with_ai()
export async function analyzeThreadWithAI ({ threadText, model } = {}) {
  const thread = String(threadText || '').trim()
  if (!thread) return { success: false, error: 'No thread provided' }

  const prompt =
    'You are an assistant that analyzes chat threads.\n' +
    'The goal is to understand if the thread requires further attention, discussion or intervention. Or if the topic or issues are all solved or require no further action.\n\n' +
    'Your response MUST be a single line of strict JSON with the following fields:\n' +
    ' action_needed: true or false\n' +
    ' who: a category of who should take the next action, such as "programmer", "map artist", "vehicle artist", "marketing", "business", "audio", "physics", etc\n' +
    ' reason: a one-line short summary (max 20 words) of why or what\'s the next step to take\n\n' +
    'For example: {"action_needed": true, "who":"programmer", "reason": "A reported memory leak is still present"}\n' +
    'Or: {"action_needed": false, "who":"", "reason": ""}\n\n' +
    'This is the full thread:\n' +
    thread

  try {
    const raw = await ollamaGenerate({ model: model || undefined, prompt })
    const cleaned = stripThinkBlocks(raw)
    const jsonStr = extractFirstJsonObject(cleaned)
    if (!jsonStr) return { success: false, error: `AI did not return JSON. Full AI response: ${safeText(cleaned)}` }
    try {
      const parsed = JSON.parse(jsonStr)
      return {
        success: true,
        action_needed: !!parsed.action_needed,
        who: String(parsed.who || ''),
        reason: String(parsed.reason || '')
      }
    } catch (e) {
      return { success: false, error: `AI returned invalid JSON: ${jsonStr}\nFull AI response: ${safeText(cleaned)}` }
    }
  } catch (e) {
    return { success: false, error: e?.message || String(e) }
  }
}


