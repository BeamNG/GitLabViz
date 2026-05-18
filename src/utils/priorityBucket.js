// Maps a free-form `Priority::*` label (or similar) to a canonical bucket so
// downstream views (kiosk workload bars, list-view priority column, …) can
// colour and group consistently regardless of project-specific spellings
// ("0 - Blocking", "Blocker", "P1 High", …).

export const PRIORITY_BUCKETS = ['blocking', 'high', 'medium', 'low', 'other', 'none']

export const PRIORITY_BUCKET_COLOR = {
  blocking: '#d32f2f', high: '#f57c00', medium: '#fbc02d',
  low: '#7cb342', other: '#1e88e5', none: 'rgba(127,127,127,0.45)'
}

export const PRIORITY_BUCKET_LABEL = {
  blocking: 'Blocking', high: 'High', medium: 'Medium',
  low: 'Low', other: 'Other', none: 'No priority'
}

export const priorityBucket = (label) => {
  const k = String(label || '').toLowerCase()
  if (!k) return 'none'
  if (/blocking|critical/.test(k)) return 'blocking'
  if (/high/.test(k)) return 'high'
  if (/medium|normal/.test(k)) return 'medium'
  if (/low/.test(k)) return 'low'
  return 'other'
}
