export function getScopedLabelValues (labels, prefix) {
  if (!Array.isArray(labels)) return []
  const p = String(prefix || '').trim()
  if (!p) return []

  const out = []
  const seen = new Set()
  for (const l of labels) {
    if (typeof l !== 'string') continue
    let v = null
    if (l.startsWith(p + '::')) v = l.substring(p.length + 2).trim()
    else if (l.startsWith(p + ':')) v = l.substring(p.length + 1).trim()
    if (!v) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function getScopedLabelValue (labels, prefix) {
  const matches = getScopedLabelValues(labels, prefix)
  return matches.length ? matches[matches.length - 1] : null
}
