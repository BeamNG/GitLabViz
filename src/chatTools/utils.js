import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

export function renderMarkdown (text) {
  const s = String(text || '')
  if (!s) return ''
  return md.render(s)
}

const stripAnsi = (s) => String(s || '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')

export function keywordToStyle (keyword) {
  const kw = String(keyword || '').toLowerCase()
  if (!kw) return ''
  // simple hash -> hue
  let hash = 0
  for (let i = 0; i < kw.length; i++) hash = ((hash << 5) - hash) + kw.charCodeAt(i)
  const hue = (Math.abs(hash) * 137) % 360
  const saturation = 55
  const lightness = 55
  // approximate luminance: convert HSL -> RGB
  const l = lightness / 100
  const s = saturation / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = hue / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0; let g1 = 0; let b1 = 0
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x }
  else if (hp < 2) { r1 = x; g1 = c }
  else if (hp < 3) { g1 = c; b1 = x }
  else if (hp < 4) { g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const m = l - c / 2
  const r = r1 + m; const g = g1 + m; const b = b1 + m
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const fg = luminance > 0.6 ? '#111' : '#fff'
  const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  return `--highlight-bg: ${bg}; --highlight-fg: ${fg};`
}

export function highlightKeywordsInHtml (html, keywords) {
  const list = (Array.isArray(keywords) ? keywords : [])
    .map(k => String(k || '').trim())
    .filter(Boolean)
  if (!html || list.length === 0) return html || ''

  // Sort longest first (avoid partial overlap), mimic Python behavior
  const sorted = list.slice().sort((a, b) => b.length - a.length)
  let out = String(html)

  for (const kw of sorted) {
    const lower = kw.toLowerCase()
    const style = keywordToStyle(lower)
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const isAlnum = /^[a-z0-9]+$/i.test(kw)
    const pattern = isAlnum ? new RegExp(`\\b${escaped}\\b`, 'gi') : new RegExp(escaped, 'gi')
    out = out.replace(pattern, (match) => {
      return `<span class="highlighted-keyword" style="${style}" data-keyword="${lower}">${match}</span>`
    })
  }

  return out
}

export function safeText (s) {
  return stripAnsi(String(s ?? '')).trim()
}


