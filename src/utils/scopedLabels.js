export function getScopedLabelValue (labels, prefix) {
  if (!Array.isArray(labels)) return null
  const p = String(prefix || '').trim()
  if (!p) return null

  const matches = labels
    .map(l => {
      if (typeof l !== 'string') return null
      if (l.startsWith(p + '::')) return l.substring(p.length + 2).trim()
      if (l.startsWith(p + ':')) return l.substring(p.length + 1).trim()
      return null
    })
    .filter(Boolean)

  return matches.length ? matches[matches.length - 1] : null
}
