// Encode/decode the user's current view (filters + view) as a human-readable URL query string.
// Returns "" when there's nothing non-default to share, so the URL stays clean by default.
// Decode produces a partial snapshot compatible with applyConfiguration().

import { ISSUE_LIST_DEFAULT_ORDER, ISSUE_LIST_HIDDEN_BY_DEFAULT } from './issueListColumns'

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
const VIEW_MAP = { color: 'colorMode', group: 'grouping', links: 'linkMode', dueSoon: 'dueSoonDays', layout: 'layout' }
const VIEW_DEFAULTS = { colorMode: 'state', grouping: 'none', linkMode: 'none', dueSoonDays: 7, layout: 'graph' }
const LAYOUT_VALUES = new Set(['graph', 'list'])

// List-view column state lives under snapshot.view.listColumns. We pack the
// four pieces (order / hidden / widths / sortBy) into four compact URL keys so
// each can be diffed against its default independently — the URL only carries
// pieces the user actually customised.
//   cols=key1,key2,…      — visible-order list (omitted when equal to defaults)
//   colsHide=key1,key2    — hidden set (omitted when equal to ISSUE_LIST_HIDDEN_BY_DEFAULT)
//   colsW=k~px,k~px       — per-column widths (omitted when empty)
//   sort=k~asc,k~desc     — multi-sort spec (omitted when default = updatedAt~desc)
const LIST_COL_KEYS = ['cols', 'colsHide', 'colsW', 'sort', 'groupOff']
const DEFAULT_SORT = [{ key: 'updatedAt', order: 'desc' }]

// Public URL aliases for internal value names that read awkwardly.
// Internally we use `tag` for "by label" (legacy); the URL exposes `label` instead.
const URL_ALIAS = {
  color: { in: { label: 'tag' }, out: { tag: 'label' } },
  group: { in: { label: 'tag' }, out: { tag: 'label' } }
}
const toInternal = (urlKey, v) => URL_ALIAS[urlKey]?.in?.[v] ?? v
const toPublic = (urlKey, v) => URL_ALIAS[urlKey]?.out?.[v] ?? v

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
    // Layout is carried as the URL path segment (#/list/...) by the router,
    // not as a kv pair, so we skip it here. Decode still accepts the old form
    // for back-compat with previously-shared URLs.
    if (srcKey === 'layout') continue
    const v = view[srcKey]
    if (isEmpty(v)) continue
    if (VIEW_DEFAULTS[srcKey] !== undefined && v === VIEW_DEFAULTS[srcKey]) continue
    collect(parts, [urlKey, encVal(toPublic(urlKey, v))])
  }

  // List-view column state — each piece compared against its default before
  // emitting so URLs only carry what the user customised.
  const lc = view.listColumns
  if (lc && typeof lc === 'object') {
    if (Array.isArray(lc.order) && lc.order.length && lc.order.join(',') !== ISSUE_LIST_DEFAULT_ORDER.join(',')) {
      collect(parts, ['cols', encVal(lc.order)])
    }
    if (Array.isArray(lc.hidden) &&
        [...lc.hidden].sort().join(',') !== [...ISSUE_LIST_HIDDEN_BY_DEFAULT].sort().join(',')) {
      collect(parts, ['colsHide', encVal(lc.hidden)])
    }
    if (lc.widths && typeof lc.widths === 'object') {
      const entries = Object.entries(lc.widths).filter(([, w]) => Number.isFinite(Number(w)))
      if (entries.length) {
        const enc = entries.map(([k, w]) => `${encodeURIComponent(k)}~${Number(w)}`).join(',')
        collect(parts, ['colsW', enc])
      }
    }
    if (Array.isArray(lc.sortBy) && lc.sortBy.length) {
      const isDefault = lc.sortBy.length === 1 &&
                        lc.sortBy[0]?.key === DEFAULT_SORT[0].key &&
                        lc.sortBy[0]?.order === DEFAULT_SORT[0].order
      if (!isDefault) {
        const enc = lc.sortBy
          .filter(s => s && s.key)
          .map(s => `${encodeURIComponent(s.key)}~${s.order === 'desc' ? 'desc' : 'asc'}`)
          .join(',')
        if (enc) collect(parts, ['sort', enc])
      }
    }
    if (Array.isArray(lc.closedGroups) && lc.closedGroups.length) {
      collect(parts, ['groupOff', encVal(lc.closedGroups)])
    }
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
    ...Object.keys(FILTER_MAP), ...Object.keys(DATE_MAP), ...Object.keys(VIEW_MAP),
    ...LIST_COL_KEYS
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
    } else {
      v = toInternal(urlKey, v)
      if (srcKey === 'colorMode' && !COLOR_VALUES.has(v)) {
        warnings.push(`Invalid color="${v}" — ignored.`); continue
      } else if (srcKey === 'grouping' && !GROUP_VALUES.has(v) && !String(v).startsWith('scoped:')) {
        warnings.push(`Invalid group="${v}" — ignored.`); continue
      } else if (srcKey === 'linkMode' && !LINK_VALUES.has(v)) {
        warnings.push(`Invalid links="${v}" — ignored.`); continue
      } else if (srcKey === 'layout' && !LAYOUT_VALUES.has(v)) {
        warnings.push(`Invalid layout="${v}" — ignored.`); continue
      }
    }
    view[srcKey] = v
  }

  // List-view column state — `sanitizeIssueListState` later drops keys we don't
  // know, so we can keep parsing loose here. Each field is only attached when
  // the URL actually carried it (vs default-fallback in the consumer).
  const listColumns = {}
  if ('cols' in pairs) listColumns.order = decVal(pairs.cols, true)
  if ('colsHide' in pairs) listColumns.hidden = decVal(pairs.colsHide, true)
  if ('colsW' in pairs) {
    const widths = {}
    for (const seg of decVal(pairs.colsW, true)) {
      const i = seg.indexOf('~')
      if (i < 0) continue
      const k = seg.slice(0, i)
      const w = Number(seg.slice(i + 1))
      if (k && Number.isFinite(w)) widths[k] = w
    }
    if (Object.keys(widths).length) listColumns.widths = widths
  }
  if ('sort' in pairs) {
    const sortBy = []
    for (const seg of decVal(pairs.sort, true)) {
      const i = seg.indexOf('~')
      const k = i < 0 ? seg : seg.slice(0, i)
      const order = i < 0 ? 'asc' : (seg.slice(i + 1) === 'desc' ? 'desc' : 'asc')
      if (k) sortBy.push({ key: k, order })
    }
    if (sortBy.length) listColumns.sortBy = sortBy
  }
  if ('groupOff' in pairs) listColumns.closedGroups = decVal(pairs.groupOff, true)
  if (Object.keys(listColumns).length) view.listColumns = listColumns

  const snapshot = {}
  if (Object.keys(filters).length) snapshot.filters = filters
  if (Object.keys(view).length) snapshot.view = view
  return { snapshot: Object.keys(snapshot).length ? snapshot : null, warnings }
}
