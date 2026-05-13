// Compute GitLab PAT expiry status from settings.meta.
// status: 'expired' | 'soon' | 'ok' | 'never' | 'unknown'
// `soonDays` is the threshold (inclusive) for 'soon' (default 14).
export function getTokenExpiry (meta, soonDays = 14) {
  const v = meta && meta.gitlabTokenExpiresAt
  if (v === null) {
    // null + scopes known => introspected and confirmed no expiry
    return meta && meta.gitlabTokenScopes
      ? { status: 'never', dateStr: '', days: null }
      : { status: 'unknown', dateStr: '', days: null }
  }
  if (!v) return { status: 'unknown', dateStr: '', days: null }
  const t = Date.parse(String(v))
  if (!Number.isFinite(t)) return { status: 'unknown', dateStr: String(v), days: null }
  const days = Math.ceil((t - Date.now()) / 86400000)
  const dateStr = new Date(t).toLocaleDateString()
  if (days < 0) return { status: 'expired', dateStr, days }
  if (days <= soonDays) return { status: 'soon', dateStr, days }
  return { status: 'ok', dateStr, days }
}
