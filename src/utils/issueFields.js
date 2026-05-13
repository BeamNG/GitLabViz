// Multi-assignee aware: GitLab issues expose `assignees` (array, source of truth)
// and `assignee` (deprecated singular, often == assignees[0] but may be null on multi-assignee).
export function getAssigneeNames (raw) {
  if (!raw) return []
  if (Array.isArray(raw.assignees) && raw.assignees.length) {
    return raw.assignees.map(a => a?.name).filter(Boolean)
  }
  return raw.assignee?.name ? [raw.assignee.name] : []
}

// Resolve the active assignee filter (with @me / @unassigned / @deactivated sentinels)
// into a concrete set of allowed names + flags. Returns null when no filter is active.
export function resolveAssigneeFilter (selectedAssignees, meName, userStateMap) {
  const sel = Array.isArray(selectedAssignees) ? selectedAssignees : []
  if (!sel.length) return null
  const names = new Set()
  let wantsUnassigned = false
  for (const v of sel) {
    if (v === '@me') { if (meName) names.add(meName) }
    else if (v === '@unassigned') wantsUnassigned = true
    else if (v === '@deactivated') {
      const m = userStateMap || {}
      for (const [n, st] of Object.entries(m)) {
        if (st && String(st).trim().toLowerCase() !== 'active') names.add(n)
      }
    }
    else if (v) names.add(v)
  }
  if (!names.size && !wantsUnassigned) return null
  return { names, wantsUnassigned }
}

// Intersect a list of assignee group keys with the resolved filter.
// Returns the input as-is when no filter is active. Falls back to input if nothing matches
// (defensive — node already passed the filter, so at least one should match).
export function filterAssigneeKeys (keys, filter) {
  if (!filter) return keys
  const out = keys.filter(k => k === 'Unassigned' ? filter.wantsUnassigned : filter.names.has(k))
  return out.length ? out : keys
}
