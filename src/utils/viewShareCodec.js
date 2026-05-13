// Encode/decode the user's current view (filters + view) as a human-readable URL query string.
// Returns "" when there's nothing non-default to share, so the URL stays clean by default.
// Decode produces a partial snapshot compatible with applyConfiguration().

// URL key ↔ snapshot field (under snapshot.filters)
const FILTER_MAP = {
  closed: 'includeClosed',
  status: 'statuses',
  sub: 'subscription',
  label: 'labels',
  xlabel: 'excludedLabels',
  author: 'authors',
  assignee: 'assignees',
  milestone: 'milestones',
  priority: 'priorities',
  type: 'types',
  mr: 'mrMode',
  participant: 'participants',
  due: 'dueStatus',
  spent: 'spentMode',
  budget: 'budgetMode',
  estimate: 'estimateBucket',
  task: 'taskMode',
  q: 'searchQuery'
}
const FILTER_ARRAYS = new Set([
  'statuses', 'labels', 'excludedLabels',
  'authors', 'assignees', 'milestones', 'priorities', 'types', 'participants'
])

// URL key ↔ snapshot.view field
const VIEW_MAP = { color: 'colorMode', group: 'grouping', links: 'linkMode', dueSoon: 'dueSoonDays' }
const VIEW_DEFAULTS = { colorMode: 'state', grouping: 'none', linkMode: 'none', dueSoonDays: 7 }

// Enum value whitelist for view fields. Helps us surface typos / corrupt URLs.
// Keep in sync with linkModeOptions / viewModeOptions / groupingModeOptions in App.vue.
const COLOR_VALUES = new Set([
  'none', 'state', 'tag', 'author', 'assignee', 'milestone', 'priority', 'type', 'weight',
  'time_ratio', 'due_status', 'time_estimate', 'time_spent', 'budget_status',
  'estimate_bucket', 'task_completion', 'upvotes', 'merge_requests', 'comments',
  'age', 'last_updated', 'timeline_created', 'timeline_updated', 'timeline_closed'
])
const GROUP_VALUES = new Set([
  'none', 'state', 'tag', 'author', 'assignee', 'milestone', 'priority', 'type', 'weight',
  'epic', 'iteration', 'stale', 'svn_revision',
  'timeline_created', 'timeline_updated', 'timeline_closed'
])
const LINK_VALUES = new Set(['none', 'dependency', 'group'])
// Filter-side small enums (loosely validated; mostly null/'has'/'none' style flags)
const ENUM_FILTERS = {
  dueStatus: new Set(['overdue', 'soon', 'later', 'none']),
  spentMode: new Set(['has', 'none']),
  budgetMode: new Set(['no_est', 'over', 'within']),
  estimateBucket: new Set(['none', 'lt1h', '1_4h', '4_8h', '1_3d', '3dplus']),
  taskMode: new Set(['no_tasks', 'none_done', 'in_progress', 'done']),
  mrMode: new Set(['has', 'none']),
  subscription: new Set(['subscribed', 'unsubscribed'])
}

// URL key ↔ snapshot.filters.dateFilters field
const DATE_MAP = {
  created: 'createdMode', createdAfter: 'createdAfter', createdBefore: 'createdBefore', createdDays: 'createdDays',
  updated: 'updatedMode', updatedAfter: 'updatedAfter', updatedBefore: 'updatedBefore', updatedDays: 'updatedDays',
  dueDate: 'dueDateMode', dueDateAfter: 'dueDateAfter', dueDateBefore: 'dueDateBefore', dueDateDays: 'dueDateDays'
}
const DATE_NUM_FIELDS = new Set(['createdDays', 'updatedDays', 'dueDateDays'])

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

// Encode a single value (or array) for URL: percent-encode spaces/etc, but keep our ',' separator literal.
const encVal = (v) => Array.isArray(v)
  ? v.map(x => encodeURIComponent(String(x))).join(',')
  : encodeURIComponent(String(v))
const decVal = (s, isArray) => isArray
  ? String(s).split(',').filter(Boolean).map(x => decodeURIComponent(x))
  : decodeURIComponent(String(s))

const collect = (params, [urlKey, value]) => { if (!isEmpty(value)) params.push(`${urlKey}=${value}`) }

export function encodeView (snapshot) {
  const parts = []
  const f = snapshot?.filters || {}

  for (const [urlKey, srcKey] of Object.entries(FILTER_MAP)) {
    const v = f[srcKey]
    if (isEmpty(v)) continue
    if (srcKey === 'includeClosed') { if (v) parts.push(`${urlKey}=1`); continue }
    if (FILTER_ARRAYS.has(srcKey)) collect(parts, [urlKey, encVal(v)])
    else collect(parts, [urlKey, encVal(v)])
  }

  const df = f.dateFilters || {}
  for (const [urlKey, srcKey] of Object.entries(DATE_MAP)) {
    const v = df[srcKey]
    if (isEmpty(v) || v === 'none') continue
    collect(parts, [urlKey, encVal(v)])
  }

  const view = snapshot?.view || {}
  for (const [urlKey, srcKey] of Object.entries(VIEW_MAP)) {
    const v = view[srcKey]
    if (isEmpty(v)) continue
    if (VIEW_DEFAULTS[srcKey] !== undefined && v === VIEW_DEFAULTS[srcKey]) continue
    collect(parts, [urlKey, encVal(v)])
  }

  return parts.join('/')
}

// Returns { snapshot, warnings: string[] }. snapshot is null when nothing usable was parsed.
// Strict path-style only: segments separated by '/'. No '?' or '&' tolerated.
export function decodeView (path) {
  const warnings = []
  const s = String(path || '').replace(/^\/+/, '').trim()
  if (!s) return { snapshot: null, warnings }
  if (s.includes('?') || s.includes('&')) {
    warnings.push('URL uses unsupported "?" / "&" syntax — use "/" separators (e.g. group=author/color=priority).')
    return { snapshot: null, warnings }
  }

  const KNOWN_KEYS = new Set([
    ...Object.keys(FILTER_MAP), ...Object.keys(DATE_MAP), ...Object.keys(VIEW_MAP)
  ])

  const pairs = {}
  for (const seg of s.split('/')) {
    if (!seg) continue
    const i = seg.indexOf('=')
    if (i < 0) { warnings.push(`Ignored malformed segment "${seg}" (no '=').`); continue }
    const key = seg.slice(0, i)
    const value = seg.slice(i + 1)
    if (!KNOWN_KEYS.has(key)) { warnings.push(`Unknown URL key "${key}" — ignored.`); continue }
    if (key in pairs) warnings.push(`Duplicate URL key "${key}" — using last value.`)
    pairs[key] = value
  }
  if (!Object.keys(pairs).length) return { snapshot: null, warnings }

  const filters = {}
  const dateFilters = {}
  const view = {}

  for (const [urlKey, srcKey] of Object.entries(FILTER_MAP)) {
    if (!(urlKey in pairs)) continue
    const v = pairs[urlKey]
    if (srcKey === 'includeClosed') { filters.includeClosed = v === '1' || v === 'true'; continue }
    const decoded = decVal(v, FILTER_ARRAYS.has(srcKey))
    if (!FILTER_ARRAYS.has(srcKey) && ENUM_FILTERS[srcKey] && !ENUM_FILTERS[srcKey].has(decoded)) {
      warnings.push(`Invalid ${urlKey}="${decoded}" — ignored.`)
      continue
    }
    filters[srcKey] = decoded
  }

  for (const [urlKey, srcKey] of Object.entries(DATE_MAP)) {
    if (!(urlKey in pairs)) continue
    let v = decVal(pairs[urlKey], false)
    if (DATE_NUM_FIELDS.has(srcKey)) {
      const n = Number(v)
      if (!Number.isFinite(n)) { warnings.push(`Invalid ${urlKey}="${v}" — expected number.`); continue }
      v = n
    }
    dateFilters[srcKey] = v
  }
  if (Object.keys(dateFilters).length) filters.dateFilters = dateFilters

  for (const [urlKey, srcKey] of Object.entries(VIEW_MAP)) {
    if (!(urlKey in pairs)) continue
    let v = decVal(pairs[urlKey], false)
    if (srcKey === 'dueSoonDays') {
      const n = Number(v)
      if (!Number.isFinite(n)) { warnings.push(`Invalid ${urlKey}="${v}" — expected number.`); continue }
      v = n
    } else if (srcKey === 'colorMode' && !COLOR_VALUES.has(v)) {
      warnings.push(`Invalid color="${v}" — ignored.`); continue
    } else if (srcKey === 'grouping' && !GROUP_VALUES.has(v) && !String(v).startsWith('scoped:')) {
      warnings.push(`Invalid group="${v}" — ignored.`); continue
    } else if (srcKey === 'linkMode' && !LINK_VALUES.has(v)) {
      warnings.push(`Invalid links="${v}" — ignored.`); continue
    }
    view[srcKey] = v
  }

  const snapshot = {}
  if (Object.keys(filters).length) snapshot.filters = filters
  if (Object.keys(view).length) snapshot.view = view
  return { snapshot: Object.keys(snapshot).length ? snapshot : null, warnings }
}
