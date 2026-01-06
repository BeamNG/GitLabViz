// Helpers shared by multiple ChatTools ports (thread_summary + per-thread AI analyze buttons)

export function extractPostIdFromUrl (urlOrId) {
  const s = String(urlOrId || '').trim()
  if (!s) return null
  const m = s.match(/\/pl\/([a-zA-Z0-9]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9]{26}$/.test(s)) return s
  return null
}

export async function formatThreadForAI (api, threadData) {
  const posts = threadData?.posts || {}
  const order = Array.isArray(threadData?.order) ? threadData.order : []
  if (!order.length) return { text: '', participants: {} }

  const userIds = Array.from(new Set(order.map(pid => posts?.[pid]?.user_id).filter(Boolean)))
  const users = await api.usersByIds(userIds)

  const participants = {}
  const parts = []
  for (const pid of order) {
    const p = posts?.[pid]
    if (!p) continue
    const msg = String(p.message || '').trim()
    if (!msg) continue
    const uid = p.user_id
    const username = users?.[uid]?.username || 'Unknown'
    if (!participants[uid]) participants[uid] = { username, messages: [] }
    participants[uid].messages.push(msg)
    parts.push(`${username}: ${msg}`)
  }

  return { text: parts.join('\n\n'), participants }
}

export function buildPostPermalink (baseUrl, team, postId) {
  const url = String(baseUrl || '').replace(/\/+$/, '')
  const teamName = typeof team === 'string' ? team : (team?.name || team?.display_name || '')
  const pid = String(postId || '').trim()
  if (!url || !teamName || !pid) return ''
  // Mattermost permalink shape: https://host/<team>/pl/<postId>
  return `${url}/${teamName}/pl/${pid}`
}


