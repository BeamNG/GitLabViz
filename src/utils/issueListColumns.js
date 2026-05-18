// Column catalog for IssueList.vue + the matching sidebar section. Single
// source of truth — adding a column = one entry here plus the matching
// `#item.<key>` slot in IssueList. Widths are tuned for a typical 1080p
// desktop; the table scrolls horizontally if the wrapper is narrower.

// Columns flagged `hiddenByDefault: true` start off in the hidden set even
// for users who have saved column state from before the column existed (we
// add unseen hidden-by-default keys to their hidden set on load — see
// `sanitizeIssueListState` below).
export const ISSUE_LIST_COLUMNS = [
  { key: 'iid',          title: '#',         align: 'end', width: 80 },
  { key: 'title',        title: 'Title',     width: 320 },
  { key: 'state',        title: 'State',     width: 95 },
  { key: 'status',       title: 'Status',    width: 130 },
  { key: 'priority',     title: 'Priority',  width: 130 },
  { key: 'type',         title: 'Type',      width: 110 },
  { key: 'assignees',    title: 'Assignee',  width: 170, sortable: false },
  { key: 'milestone',    title: 'Milestone', width: 120 },
  { key: 'dueDate',      title: 'Due',       width: 110 },
  { key: 'updatedAt',    title: 'Updated',   width: 100 },
  { key: 'createdAt',    title: 'Created',   width: 100 },
  { key: 'author',       title: 'Author',    width: 150, hiddenByDefault: true },
  { key: 'labels',       title: 'Labels',    width: 220, sortable: false, hiddenByDefault: true },
  { key: 'comments',     title: 'Comments',  width: 100, align: 'end', hiddenByDefault: true },
  { key: 'weight',       title: 'Weight',    width: 90,  align: 'end', hiddenByDefault: true },
  { key: 'epic',         title: 'Epic',      width: 140, hiddenByDefault: true },
  { key: 'iteration',    title: 'Iteration', width: 130, hiddenByDefault: true },
  { key: 'timeEstimate', title: 'Estimate',  width: 110, align: 'end', hiddenByDefault: true },
  { key: 'timeSpent',    title: 'Spent',     width: 110, align: 'end', hiddenByDefault: true },
  { key: 'closedAt',     title: 'Closed',    width: 100, hiddenByDefault: true }
]

export const ISSUE_LIST_COLUMNS_BY_KEY = ISSUE_LIST_COLUMNS.reduce((acc, c) => { acc[c.key] = c; return acc }, {})
export const ISSUE_LIST_DEFAULT_ORDER = ISSUE_LIST_COLUMNS.map(c => c.key)
export const ISSUE_LIST_HIDDEN_BY_DEFAULT = ISSUE_LIST_COLUMNS.filter(c => c.hiddenByDefault).map(c => c.key)

// Re-flow a saved order array, dropping unknown keys and appending any
// defaults missing from the saved state. Used by both the table and the
// sidebar controls so they agree on what to render.
export function sanitizeIssueListOrder (arr) {
  const known = new Set(ISSUE_LIST_DEFAULT_ORDER)
  const seen = new Set()
  const out = []
  for (const k of (Array.isArray(arr) ? arr : [])) {
    if (known.has(k) && !seen.has(k)) { out.push(k); seen.add(k) }
  }
  for (const k of ISSUE_LIST_DEFAULT_ORDER) if (!seen.has(k)) out.push(k)
  return out
}

// Migrate a saved column state — sanitises order, ensures hidden / widths /
// sortBy have valid shapes, and auto-hides any new `hiddenByDefault` column
// the user hasn't seen yet (e.g. on first encounter after an app update).
// The "seen" set is whatever's currently in their `order` array.
export function sanitizeIssueListState (state) {
  const order = sanitizeIssueListOrder(state?.order)
  const knownKeys = new Set(Array.isArray(state?.order) ? state.order : [])
  const hidden = new Set(Array.isArray(state?.hidden) ? state.hidden : [])
  for (const k of ISSUE_LIST_HIDDEN_BY_DEFAULT) {
    if (!knownKeys.has(k)) hidden.add(k)
  }
  return {
    order,
    hidden: [...hidden],
    widths: (state?.widths && typeof state.widths === 'object') ? state.widths : {},
    sortBy: Array.isArray(state?.sortBy) && state.sortBy.length
      ? state.sortBy
      : [{ key: 'updatedAt', order: 'desc' }],
    closedGroups: Array.isArray(state?.closedGroups) ? [...state.closedGroups] : []
  }
}
