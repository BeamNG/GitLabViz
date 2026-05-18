<template>
  <!-- List view for the currently-filtered tickets. Same `filteredNodes` the
       graph consumes — switching is instant because the data is already in
       memory. Multi-sort (shift-click headers for secondary sort), draggable
       column reordering (drag header text), per-column show/hide via the
       "Columns" menu. Row click opens the issue in GitLab. -->
  <div class="issue-list" :style="{ '--il-total-width': totalWidth + 'px' }">
    <v-data-table
      :headers="headers"
      :items="items"
      v-model:sort-by="sortBy"
      :group-by="groupBy"
      multi-sort
      must-sort
      density="compact"
      hover
      fixed-header
      class="issue-list-table"
      :items-per-page="50"
      :items-per-page-options="[25, 50, 100, 250, -1]"
      @click:row="onRowClick"
    >
      <!-- Group header — clicking anywhere on the row toggles the group; the
           ticket count is right-aligned so multiple group rows have their
           counts in a vertical column. The open/closed state is persisted to
           settings (and the URL) via the syncGroupHeader side-effect. -->
      <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
        <tr class="il-group-row" @click="onGroupToggle(item, toggleGroup)">
          <td :colspan="columns.length">
            <span class="il-group-content">
              <v-icon :icon="isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="small" />
              <span class="il-group-title">{{ item.value || '(none)' }}</span>
              <span class="il-group-count text-medium-emphasis">{{ item.items.length }} ticket{{ item.items.length === 1 ? '' : 's' }}</span>
            </span>
            <!-- Side-effect: pull v-data-table's internal expand state in line
                 with our persisted closedGroups on first render of each group. -->
            <template v-if="syncGroupHeader(item, toggleGroup)" />
          </td>
        </tr>
      </template>
      <!-- Header slots — the label is a drag handle (drag onto another header
           to reorder); the click toggles sort (shift-click for multi-sort);
           and the right edge is a thin resize grip. -->
      <template
        v-for="h in headers" :key="h.key"
        #[`header.${h.key}`]="{ column, toggleSort }"
      >
        <span
          class="il-header"
          :class="{ 'il-drop-target': dragOverKey === column.key && dragOverKey !== draggingKey }"
          draggable="true"
          @dragstart="onColumnDragStart(column.key, $event)"
          @dragover.prevent="onColumnDragOver(column.key, $event)"
          @dragleave="onColumnDragLeave(column.key)"
          @dragend="onColumnDragEnd"
          @drop="onColumnDrop(column.key, $event)"
          @click.stop="toggleSort(column)"
          @contextmenu.prevent.stop="openContextMenu($event)"
        >
          <span>{{ column.title }}</span>
          <template v-if="sortIndex(column.key) !== -1">
            <v-icon :icon="sortOrder(column.key) === 'desc' ? 'mdi-arrow-down' : 'mdi-arrow-up'" size="x-small" />
            <span v-if="sortBy.length > 1" class="il-sort-idx">{{ sortIndex(column.key) + 1 }}</span>
          </template>
        </span>
        <span
          class="il-resize-handle"
          title="Drag to resize"
          @mousedown.stop.prevent="onResizeStart(column.key, $event)"
          @click.stop
        />
      </template>

      <!-- # — prefixed by a small colour pip driven by colorMode (state / priority /
           status / due-status / type). 'none' colour mode = transparent pip. -->
      <template #item.iid="{ item }">
        <span class="il-row-color" :style="{ background: item._color }" />
        <span class="text-medium-emphasis font-weight-medium">#{{ item.iid }}</span>
      </template>

      <!-- Title — single line with ellipsis; full title in tooltip. -->
      <template #item.title="{ item }">
        <span
          class="issue-list-title"
          :class="{ 'issue-list-closed': item.state === 'closed' }"
          :title="item.title"
        >{{ item.title }}</span>
      </template>

      <template #item.state="{ item }">
        <v-chip
          :color="item.state === 'closed' ? 'grey' : 'success'"
          size="x-small" variant="tonal" class="text-capitalize"
        >{{ item.state || 'open' }}</v-chip>
      </template>

      <template #item.status="{ item }">
        <span v-if="item.status" class="text-caption">{{ item.status }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.priority="{ item }">
        <v-chip
          v-if="item.priority"
          size="x-small" variant="tonal"
          :style="{ color: PRIORITY_BUCKET_COLOR[item.priorityBucket], 'background-color': PRIORITY_BUCKET_COLOR[item.priorityBucket] + '22' }"
        >{{ item.priority }}</v-chip>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.type="{ item }">
        <span v-if="item.type" class="text-caption">{{ item.type }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.assignees="{ item }">
        <div v-if="item.assignees.length" class="d-flex align-center ga-1" :title="item.assignees.join(', ')">
          <div class="il-avatar" :style="{ background: avatarColor(item.assignees[0]) }">{{ initialsOf(item.assignees[0]) }}</div>
          <span class="text-caption text-truncate">{{ item.assignees[0] }}{{ item.assignees.length > 1 ? ` +${item.assignees.length - 1}` : '' }}</span>
        </div>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.milestone="{ item }">
        <span v-if="item.milestone" class="text-caption">{{ item.milestone }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.dueDate="{ item }">
        <span v-if="item.dueDate" :class="item.overdue ? 'text-error font-weight-medium' : ''" class="text-caption">{{ item.dueDate }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>
      <template #item.updatedAt="{ item }">
        <span class="text-caption" :title="item.updatedAt">{{ relativeTime(item.updatedAtMs) }}</span>
      </template>
      <template #item.createdAt="{ item }">
        <span class="text-caption" :title="item.createdAt">{{ relativeTime(item.createdAtMs) }}</span>
      </template>
      <template #item.closedAt="{ item }">
        <span v-if="item.closedAtMs" class="text-caption" :title="item.closedAt">{{ relativeTime(item.closedAtMs) }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.author="{ item }">
        <div v-if="item.author" class="d-flex align-center ga-1" :title="item.author">
          <div class="il-avatar" :style="{ background: avatarColor(item.author) }">{{ initialsOf(item.author) }}</div>
          <span class="text-caption text-truncate">{{ item.author }}</span>
        </div>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.labels="{ item }">
        <span v-if="item.labels.length" class="text-caption" :title="item.labels.join(', ')">{{ item.labels.join(' · ') }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.comments="{ item }">
        <span v-if="item.comments" class="text-caption font-weight-medium">{{ item.comments }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.weight="{ item }">
        <span v-if="item.weight != null" class="text-caption font-weight-medium">{{ item.weight }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.epic="{ item }">
        <span v-if="item.epic" class="text-caption">{{ item.epic }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.iteration="{ item }">
        <span v-if="item.iteration" class="text-caption">{{ item.iteration }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.timeEstimate="{ item }">
        <span v-if="item.timeEstimate" class="text-caption">{{ formatDuration(item.timeEstimate) }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.timeSpent="{ item }">
        <span v-if="item.timeSpent" class="text-caption">{{ formatDuration(item.timeSpent) }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #no-data>
        <div class="text-medium-emphasis py-6 text-center">
          No tickets match the current filters.
        </div>
      </template>
    </v-data-table>

    <!-- Right-click context menu on any column header — Show/hide checkboxes
         for every column. Same shape as the sidebar Columns panel; cheaper
         path for users who want to toggle a column without opening the sidebar. -->
    <v-menu
      v-model="ctxMenu.open"
      :target="[ctxMenu.x, ctxMenu.y]"
      :close-on-content-click="false"
      location="bottom end"
    >
      <v-card min-width="220" max-height="400" class="overflow-auto">
        <v-list density="compact" class="py-1">
          <v-list-item v-for="key in columnOrder" :key="key" class="py-0">
            <v-checkbox
              :model-value="!hiddenColumns.has(key)"
              @update:model-value="toggleHidden(key, $event)"
              :label="defByKey[key]?.title || key"
              hide-details density="compact"
              class="ma-0"
            />
          </v-list-item>
        </v-list>
        <v-divider />
        <v-card-actions class="py-1">
          <v-btn size="small" variant="text" class="text-none" @click="resetColumns">Reset</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { getScopedLabelValue } from '../utils/scopedLabels'
import { currentStatusOfRaw } from '../composables/useGraphDerivedState'
import { priorityBucket, PRIORITY_BUCKET_COLOR } from '../utils/priorityBucket'
import {
  ISSUE_LIST_COLUMNS as COLUMN_DEFS,
  ISSUE_LIST_COLUMNS_BY_KEY as defByKey,
  ISSUE_LIST_DEFAULT_ORDER as DEFAULT_ORDER,
  sanitizeIssueListOrder as sanitizeOrder
} from '../utils/issueListColumns'

const props = defineProps({
  nodes: { type: Object, default: () => ({}) },
  issueOpenTarget: { type: String, default: '_blank' },
  // Persisted state — { order: [keys…], hidden: [keys…], sortBy: [{ key, order }] }
  // owned by App.vue settings; we mirror via v-model. Keys come from COLUMN_DEFS below.
  columnState: {
    type: Object,
    default: () => ({ order: [], hidden: [], sortBy: [{ key: 'updatedAt', order: 'desc' }] })
  },
  // Display settings carried over from the graph's sidebar so the list mirrors
  // what the user picked — `groupingMode` drives v-data-table's group-by;
  // `colorMode` colours a left-edge swatch on each row.
  groupingMode: { type: String, default: 'none' },
  colorMode:    { type: String, default: 'state' },
  dueSoonDays:  { type: Number, default: 7 }
})
const emit = defineEmits(['update:columnState'])

// Column order + hidden set come from `props.columnState`; the sidebar's
// SidebarListColumns panel is the canonical UI for editing them. We just read.
const columnOrder = computed({
  get: () => sanitizeOrder(props.columnState?.order),
  set: (v) => emit('update:columnState', { ...currentState(), order: v })
})
const hiddenColumns = computed(() => new Set(Array.isArray(props.columnState?.hidden) ? props.columnState.hidden : []))

const sortBy = computed({
  get: () => Array.isArray(props.columnState?.sortBy) && props.columnState.sortBy.length
    ? props.columnState.sortBy
    : [{ key: 'updatedAt', order: 'desc' }],
  set: (v) => emit('update:columnState', { ...currentState(), sortBy: v })
})
const widths = computed(() => (props.columnState?.widths && typeof props.columnState.widths === 'object') ? props.columnState.widths : {})
const currentState = () => ({
  order: sanitizeOrder(props.columnState?.order),
  hidden: Array.isArray(props.columnState?.hidden) ? props.columnState.hidden : [],
  sortBy: Array.isArray(props.columnState?.sortBy) ? props.columnState.sortBy : [{ key: 'updatedAt', order: 'desc' }],
  widths: { ...widths.value },
  closedGroups: [...closedGroupsArr.value]
})
// Headers honour user-resized widths if present, otherwise fall back to the
// column's default. The table's `min-width` (set as a CSS variable on the root)
// is the sum so the wrapper scrolls horizontally instead of squashing columns.
const headers = computed(() => columnOrder.value
  .filter(k => !hiddenColumns.value.has(k))
  .map(k => {
    const def = defByKey[k]
    if (!def) return null
    const w = widths.value[k] || def.width
    return { ...def, width: w }
  })
  .filter(Boolean))
const totalWidth = computed(() => headers.value.reduce((s, h) => s + (Number(h.width) || 100), 0))

// Sort-arrow helpers: -1 = not sorted by this column; else the multi-sort index.
const sortIndex = (key) => sortBy.value.findIndex(s => s.key === key)
const sortOrder = (key) => {
  const i = sortIndex(key)
  return i === -1 ? null : sortBy.value[i].order
}

// Drag-reorder highlight — `dragOverKey` tracks which header the user is
// hovering over while dragging, so we can light it up as the drop target.
const draggingKey = ref(null)
const dragOverKey = ref(null)
const onColumnDragOver = (key, evt) => {
  evt.preventDefault()
  if (dragOverKey.value !== key) dragOverKey.value = key
}
const onColumnDragLeave = (key) => {
  if (dragOverKey.value === key) dragOverKey.value = null
}
const onColumnDragEnd = () => {
  draggingKey.value = null
  dragOverKey.value = null
}

// Right-click context menu — single shared v-menu positioned at click coords.
const ctxMenu = reactive({ open: false, x: 0, y: 0 })
const openContextMenu = (evt) => {
  ctxMenu.x = evt.clientX
  ctxMenu.y = evt.clientY
  ctxMenu.open = true
}
const toggleHidden = (key, checked) => {
  const set = new Set(hiddenColumns.value)
  if (checked) set.delete(key); else set.add(key)
  emit('update:columnState', { ...currentState(), hidden: [...set] })
}
const resetColumns = () => {
  emit('update:columnState', { order: [...DEFAULT_ORDER], hidden: [], widths: {}, sortBy: sortBy.value })
}

// Column resize — pointer drag on the right-edge handle. Local width tracked
// during drag (to avoid emitting on every mousemove); committed on mouseup.
let resizingKey = null
let resizingStartX = 0
let resizingStartW = 0
let resizingLatest = 0
const onResizeStart = (key, evt) => {
  resizingKey = key
  resizingStartX = evt.clientX
  resizingStartW = Number(widths.value[key] || defByKey[key]?.width || 120)
  resizingLatest = resizingStartW
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}
const onResizeMove = (evt) => {
  if (!resizingKey) return
  const dx = evt.clientX - resizingStartX
  resizingLatest = Math.max(50, Math.min(800, resizingStartW + dx))
  // Live update via local widths so the user sees the drag immediately.
  emit('update:columnState', { ...currentState(), widths: { ...widths.value, [resizingKey]: resizingLatest } })
}
const onResizeEnd = () => {
  resizingKey = null
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

// Drag-reorder: works both on the table headers and the menu rows. Both write
// the same `columnOrder` so the table and menu stay in sync.
const onColumnDragStart = (key, evt) => {
  evt.dataTransfer.setData('text/plain', key)
  evt.dataTransfer.effectAllowed = 'move'
  draggingKey.value = key
}
const onColumnDrop = (key, evt) => {
  evt.preventDefault()
  const src = evt.dataTransfer.getData('text/plain')
  draggingKey.value = null
  dragOverKey.value = null
  if (!src || src === key) return
  const order = [...columnOrder.value]
  const srcIdx = order.indexOf(src)
  const dstIdx = order.indexOf(key)
  if (srcIdx < 0 || dstIdx < 0) return
  order.splice(srcIdx, 1)
  order.splice(dstIdx, 0, src)
  columnOrder.value = order
}

// Row colour for the left-edge swatch — mirrors the graph's `viewMode`.
// Status palette intentionally matches what useDataLoader writes to `node.color`.
const STATUS_COLORS = {
  'To do':            '#6c757d',
  'In progress':      '#007bff',
  'Ready for Review': '#fd7e14',
  'On Hold/Blocked':  '#dc3545',
  'Done':             '#28a745'
}
const hashHue = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
const colorForRow = (item) => {
  switch (props.colorMode) {
    case 'state':    return item.state === 'closed' ? '#90a4ae' : '#43a047'
    case 'priority': return PRIORITY_BUCKET_COLOR[item.priorityBucket] || PRIORITY_BUCKET_COLOR.none
    case 'status': {
      const c = STATUS_COLORS[item.status]
      if (c) return c
      return item.state === 'closed' ? '#90a4ae' : '#1e88e5'
    }
    case 'due_status': {
      if (!item.dueDateMs) return 'rgba(127,127,127,0.4)'
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      if (item.dueDateMs < now)                              return '#ef5350'
      if (item.dueDateMs < now + (props.dueSoonDays || 7) * day) return '#ffb300'
      return '#66bb6a'
    }
    case 'type':     return item.type ? `hsl(${hashHue(item.type)}, 55%, 55%)` : 'rgba(127,127,127,0.4)'
    default:         return 'transparent'
  }
}
// Synthetic group key per row driven by `groupingMode`. v-data-table groups
// rows sharing the same `_group` value. 'none' = no grouping (key undefined).
const groupKeyFor = (item) => {
  switch (props.groupingMode) {
    case 'status':         return item.status || '(No status)'
    case 'priority':       return item.priority || '(No priority)'
    case 'type':           return item.type || '(No type)'
    case 'milestone':      return item.milestone || '(No milestone)'
    case 'author':         return item.author || '(No author)'
    case 'assignee':       return item.assignees[0] || '(Unassigned)'
    default:               return undefined
  }
}

const items = computed(() => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const out = []
  for (const id in props.nodes) {
    const n = props.nodes[id]
    if (!n || n.type !== 'gitlab_issue') continue
    const raw = n._raw || {}
    const priority = getScopedLabelValue(raw.labels, 'Priority') || ''
    const type     = getScopedLabelValue(raw.labels, 'Type') || ''
    const dueIso = raw.due_date || ''
    const dueMs = dueIso ? new Date(dueIso).getTime() : 0
    const createdMs = raw.created_at ? new Date(raw.created_at).getTime() : 0
    const updatedMs = raw.updated_at ? new Date(raw.updated_at).getTime() : createdMs
    const closedIso = raw.closed_at || ''
    const closedMs = closedIso ? new Date(closedIso).getTime() : 0
    const assignees = Array.isArray(raw.assignees) ? raw.assignees.map(a => a?.name).filter(Boolean) : []
    // Strip scoped labels from the chip list so the Labels column doesn't
    // duplicate Priority::/Type::/Status::/etc. that already have their own
    // dedicated columns. Falls back to all labels if all are scoped.
    const plainLabels = (Array.isArray(raw.labels) ? raw.labels : []).filter(l => typeof l === 'string' && !l.includes('::'))
    const item = {
      id,
      iid: raw.iid != null ? String(raw.iid) : id,
      title: raw.title || n.name || '',
      url: raw.web_url || '',
      state: raw.state || 'opened',
      status: currentStatusOfRaw(raw) || '',
      priority,
      priorityBucket: priorityBucket(priority),
      type,
      author: raw.author?.name || '',
      assignees,
      milestone: raw.milestone?.title || '',
      dueDate: dueIso,
      dueDateMs: dueMs,
      overdue: !!(dueMs && raw.state === 'opened' && dueMs < now - day),
      updatedAt: raw.updated_at || '',
      updatedAtMs: updatedMs,
      createdAt: raw.created_at || '',
      createdAtMs: createdMs,
      // Hidden-by-default columns (Author column is exposed as a separate sort
      // key from the existing Assignee column).
      labels: plainLabels,
      comments: Number(raw.user_notes_count) || 0,
      weight: raw.weight != null ? Number(raw.weight) : null,
      epic: raw.epic?.title || '',
      iteration: raw.iteration?.title || '',
      timeEstimate: Number(n.timeEstimate) || 0,
      timeSpent: Number(n.timeSpent) || 0,
      closedAt: closedIso,
      closedAtMs: closedMs
    }
    item._group = groupKeyFor(item)
    item._color = colorForRow(item)
    out.push(item)
  }
  return out
})

// Format a duration in seconds (GitLab time-tracking values) as "2h 30m" /
// "1d 4h" — keep it short enough for the tight column.
const formatDuration = (sec) => {
  if (!sec) return ''
  const s = Math.abs(Math.floor(sec))
  const day = 8 * 3600 // GitLab convention: 1d = 8h
  const d = Math.floor(s / day)
  const h = Math.floor((s % day) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d${h ? ' ' + h + 'h' : ''}`
  if (h) return `${h}h${m ? ' ' + m + 'm' : ''}`
  if (m) return `${m}m`
  return '<1m'
}

// `group-by` Vuetify prop expects an array of { key, order? }. Empty array
// means no grouping; otherwise we use our synthetic `_group` column.
const groupBy = computed(() => props.groupingMode && props.groupingMode !== 'none'
  ? [{ key: '_group', order: 'asc' }]
  : [])

// Collapsed group values are persisted to settings (and via the URL share
// codec). v-data-table's group state is internal — there's no controlled
// prop — so we sync it on every group-header render: if the persisted state
// says a group should be closed but Vuetify currently shows it open, we
// defer a `toggleGroup` call. A per-session Set guards against re-toggling
// already-synced groups (would otherwise loop). Cleared whenever the group
// dimension or filtered items change.
const closedGroupsArr = computed(() => Array.isArray(props.columnState?.closedGroups) ? props.columnState.closedGroups : [])
const closedGroupsSet = computed(() => new Set(closedGroupsArr.value.map(String)))
const syncedClosed = new Set()
watch([groupBy, items], () => { syncedClosed.clear() })
const groupKey = (item) => String(item?.value ?? '(none)')
const syncGroupHeader = (item, toggleGroup) => {
  const key = groupKey(item)
  if (closedGroupsSet.value.has(key) && !syncedClosed.has(key)) {
    syncedClosed.add(key)
    nextTick(() => toggleGroup(item))
  }
}
const onGroupToggle = (item, toggleGroup) => {
  toggleGroup(item) // flip Vuetify's internal state
  const key = groupKey(item)
  const closed = new Set(closedGroupsSet.value)
  if (closed.has(key)) closed.delete(key)
  else closed.add(key)
  syncedClosed.add(key)
  emit('update:columnState', { ...currentState(), closedGroups: [...closed] })
}

const onRowClick = (_evt, { item }) => {
  if (item?.url) window.open(item.url, props.issueOpenTarget || '_blank')
}

const relativeTime = (ms) => {
  if (!ms) return '—'
  const diff = Date.now() - ms
  const day = 24 * 60 * 60 * 1000
  if (diff < 60 * 1000) return 'just now'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`
  return `${Math.floor(diff / (365 * day))}y ago`
}

const initialsOf = (name) => {
  const s = String(name || '').trim()
  if (!s) return '?'
  return s.split(/\s+/).filter(Boolean).map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('')
}
const avatarColor = (name) => {
  const s = String(name || '')
  if (!s) return 'hsl(0, 0%, 35%)'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360}, 42%, 42%)`
}
</script>

<style scoped>
.issue-list { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.issue-list-table { flex: 1; min-height: 0; }
.issue-list-title {
  font-weight: 500;
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.issue-list-closed { text-decoration: line-through; opacity: 0.65; }
.il-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  color: #fff; font-size: 10px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.il-header { cursor: grab; user-select: none; display: inline-flex; align-items: center; gap: 4px; }
.il-header:active { cursor: grabbing; }
.il-row-color {
  display: inline-block;
  width: 4px; height: 14px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: middle;
}
.il-group-row { cursor: pointer; }
.il-group-row td {
  padding: 4px 8px !important;
  background: rgba(127, 127, 127, 0.18) !important;
  font-weight: 600;
  position: sticky;
  left: 0;
}
.il-group-row:hover td { background: rgba(127, 127, 127, 0.25) !important; }
.il-group-content {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.il-group-title { font-size: 13px; flex: 0 0 auto; }
.il-group-count {
  font-size: 12px;
  margin-left: auto;        /* push the count to the right edge */
  font-weight: 500;
  min-width: 90px;          /* keep counts aligned across rows */
  text-align: right;
}
/* Drag-reorder highlight — primary-coloured wash + thick left border on the
   header the user is hovering over while dragging another column. */
.il-drop-target {
  background: rgba(var(--v-theme-primary), 0.22);
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}
/* Multi-sort numeric badge next to the arrow icon. */
.il-sort-idx {
  display: inline-block;
  font-size: 9px; font-weight: 700;
  background: rgba(127, 127, 127, 0.25);
  border-radius: 7px;
  padding: 0 4px;
  margin-left: 1px;
  line-height: 14px;
}
/* Column resize grip — thin invisible strip at the right edge of every th. */
.il-resize-handle {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 6px;
  cursor: col-resize;
  user-select: none;
  z-index: 2;
}
.il-resize-handle:hover { background: rgba(var(--v-theme-primary), 0.4); }
:deep(.v-data-table-header__content) { position: relative; }
:deep(th) { position: relative; }
/* Fixed table layout + min-width on the underlying <table> = columns respect
   their declared widths instead of Vuetify squeezing everything to fit. When
   the available space is narrower than the sum of widths, the wrapper scrolls
   horizontally. The min-width is the sum of effective column widths, exposed
   as a CSS variable so resizing updates it without re-rendering rules. */
:deep(.v-data-table) {
  font-size: 13px;
  /* Stretch the table into a flex column so the footer is pushed to the
     bottom of the container regardless of how few rows there are. */
  display: flex;
  flex-direction: column;
  height: 100%;
}
:deep(.v-table__wrapper) { overflow: auto; flex: 1; min-height: 0; }
:deep(.v-data-table table) { table-layout: fixed; min-width: var(--il-total-width, 1380px); }
/* Tighter rows than Vuetify's default `density="compact"`. Default compact is
   ~32px high — we want closer to ~26-28px so more rows fit on screen and the
   table stops feeling so sparse. */
:deep(.v-data-table__td),
:deep(.v-data-table__th) {
  padding: 0 8px !important;
  height: 28px !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
:deep(.v-data-table__td) { cursor: pointer; }
:deep(.v-data-table-rows-no-data .v-data-table__td) { cursor: default; }
/* Visible row separator — the default is so faint it disappears against the
   zebra stripe. Use a theme-aware semi-transparent line. */
:deep(.v-data-table__tr) { border-bottom: 1px solid rgba(127, 127, 127, 0.18); }
:deep(.v-data-table__tr:last-child) { border-bottom: 0; }
/* Vertical column separation — alternating tint on header cells, plus a thin
   right border on every cell so the eye can track columns top-to-bottom. */
:deep(.v-data-table__th) { border-right: 1px solid rgba(127, 127, 127, 0.15); }
:deep(.v-data-table__td) { border-right: 1px solid rgba(127, 127, 127, 0.08); }
:deep(.v-data-table__th:last-child),
:deep(.v-data-table__td:last-child) { border-right: 0; }
:deep(.v-data-table__th:nth-child(even)) { background: rgba(127, 127, 127, 0.12); }
/* Zebra striping — slightly stronger now that rows are tighter, so the eye
   can still pick out alternating rows. Hover still wins. */
:deep(.v-data-table__tr:nth-child(even):not(:hover) .v-data-table__td) {
  background: rgba(127, 127, 127, 0.09);
}
/* Compact the footer — Vuetify's default is quite tall. */
:deep(.v-data-table-footer) {
  padding: 2px 8px !important;
  min-height: 36px !important;
  font-size: 12px;
}
:deep(.v-data-table-footer__items-per-page) { padding-inline-end: 8px !important; }
:deep(.v-data-table-footer .v-select) { max-width: 80px; }
:deep(.v-data-table-footer__info) { padding: 0 8px !important; }
</style>
