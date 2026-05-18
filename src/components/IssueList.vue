<template>
  <!-- List view for the currently-filtered tickets. Same `filteredNodes` the
       graph consumes — switching is instant because the data is already in
       memory. Multi-sort (shift-click headers for secondary sort), draggable
       column reordering (drag header text), per-column show/hide via the
       "Columns" menu. Row click opens the issue in GitLab. -->
  <div class="issue-list" ref="issueListEl" @contextmenu="onHeaderContextMenu" :style="{ '--il-total-width': totalWidth + 'px' }">
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
      :items-per-page="isGrouped ? -1 : 50"
      :items-per-page-options="isGrouped ? [] : [25, 50, 100, 250, -1]"
      :hide-default-footer="isGrouped"
      :row-props="rowProps"
      @click:row="onRowClick"
      @dblclick:row="onRowDblClick"
      @contextmenu:row="onRowContextMenu"
    >
      <!-- Group header — clicking anywhere on the row toggles the group; the
           ticket count is right-aligned so multiple group rows have their
           counts in a vertical column. The open/closed state is persisted to
           settings (and the URL) via the syncGroupHeader side-effect. -->
      <template #header.data-table-group />
      <template #item.data-table-group />

      <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
        <tr
          class="il-group-row"
          :class="groupRowLegendClass(item)"
          @click="onGroupToggle(item, toggleGroup)"
        >
          <td :colspan="columns.length">
            <span
              v-for="x in columnDividerOffsets"
              :key="'div-' + x"
              class="il-group-divider"
              :style="{ left: x + 'px' }"
              aria-hidden="true"
            />
            <div class="il-group-content">
              <v-icon :icon="isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="small" />
              <span class="il-group-leading">
                <div
                  v-if="groupingByPerson"
                  class="il-avatar"
                  :class="{ 'il-avatar--photo': !!groupAvatarFor(item) }"
                  :style="!groupAvatarFor(item) ? { background: avatarColor(item.value) } : undefined"
                  :title="item.value"
                >
                  <img v-if="groupAvatarFor(item)" :src="groupAvatarFor(item)" :alt="item.value" referrerpolicy="no-referrer" />
                  <template v-else>{{ initialsOf(item.value) }}</template>
                </div>
                <span v-else class="il-group-dot" :style="{ background: groupColorFor(item.value) }" />
              </span>
              <span class="il-group-title">{{ item.value || '(none)' }}</span>
              <div v-if="groupVerticalPills(item).length" class="il-group-pills">
                <span
                  v-for="(seg, si) in groupVerticalPills(item)" :key="seg.color + si"
                  class="il-group-pill-col"
                  :class="pillLegendClass(seg.color)"
                  :title="pillLegendTitle(seg, item)"
                >
                  <span class="il-group-pill-count">{{ seg.count }}</span>
                  <span
                    class="il-group-pill"
                    :style="{ height: seg.heightPx + 'px', background: seg.color }"
                  />
                </span>
              </div>
              <span class="il-group-count text-medium-emphasis">{{ item.items.length }} ticket{{ item.items.length === 1 ? '' : 's' }}</span>
            </div>
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
        <!-- Hidden data-table-group stub gets no drag / sort / resize. -->
        <template v-if="column.key === 'data-table-group'">
          <span />
        </template>
        <div
          v-else
          class="il-header-cell"
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
        </div>
      </template>

      <!-- # — colorMode-driven pip + IID. The pip is part of the iid cell; with
           a flex container it stays aligned regardless of number width. -->
      <template #item.iid="{ item }">
        <span class="il-iid-cell">
          <span class="il-row-color" :style="{ background: item._color }" />
          <span class="text-medium-emphasis font-weight-medium">#{{ item.iid }}</span>
        </span>
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
        <div class="il-chip-cell">
          <v-chip
            :color="item.state === 'closed' ? 'grey' : 'success'"
            size="x-small" variant="tonal" class="text-capitalize"
          >{{ item.state || 'open' }}</v-chip>
        </div>
      </template>

      <template #item.status="{ item }">
        <div v-if="item.status" class="il-chip-cell">
          <v-chip
            size="x-small" variant="tonal"
            :style="{ color: STATUS_COLORS[item.status] || '#1e88e5', 'background-color': (STATUS_COLORS[item.status] || '#1e88e5') + '22' }"
          >{{ item.status }}</v-chip>
        </div>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.priority="{ item }">
        <div v-if="item.priority" class="il-chip-cell">
          <v-chip
            size="x-small" variant="tonal"
            :style="{ color: PRIORITY_BUCKET_COLOR[item.priorityBucket], 'background-color': PRIORITY_BUCKET_COLOR[item.priorityBucket] + '22' }"
          >{{ item.priority }}</v-chip>
        </div>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.type="{ item }">
        <span v-if="item.type" class="text-caption">{{ item.type }}</span>
        <span v-else class="text-disabled text-caption">—</span>
      </template>

      <template #item.assignees="{ item }">
        <div v-if="item.assignees.length" class="d-flex align-center ga-1" :title="item.assignees.join(', ')">
          <div
            class="il-avatar"
            :class="{ 'il-avatar--photo': !!item.assigneeAvatar }"
            :style="!item.assigneeAvatar ? { background: avatarColor(item.assignees[0]) } : undefined"
          >
            <img v-if="item.assigneeAvatar" :src="item.assigneeAvatar" :alt="item.assignees[0]" referrerpolicy="no-referrer" />
            <template v-else>{{ initialsOf(item.assignees[0]) }}</template>
          </div>
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
          <div
            class="il-avatar"
            :class="{ 'il-avatar--photo': !!item.authorAvatar }"
            :style="!item.authorAvatar ? { background: avatarColor(item.author) } : undefined"
          >
            <img v-if="item.authorAvatar" :src="item.authorAvatar" :alt="item.author" referrerpolicy="no-referrer" />
            <template v-else>{{ initialsOf(item.author) }}</template>
          </div>
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

    <IssueContextMenu
      :visible="rowCtx.visible"
      :x="rowCtx.x"
      :y="rowCtx.y"
      :node="rowCtx.node"
      @close="closeRowCtx"
      @issue-state-change="onIssueStateChange"
      @issue-assignee-change="onIssueAssigneeChange"
    />

    <div v-if="colorLegend.length" class="il-color-legend">
      <button
        v-for="ent in colorLegend"
        :key="ent.label"
        type="button"
        class="il-legend-item"
        :class="{
          'il-legend-item--on': effectiveLegendColor === ent.color,
          'il-legend-item--pinned': legendPinned === ent.color
        }"
        @mouseenter="legendHover = ent.color"
        @mouseleave="legendHover = null"
        @click="toggleLegendPin(ent.color)"
      >
        <span class="il-legend-swatch" :style="{ background: ent.color }" />
        <span class="il-legend-label">{{ ent.label }}</span>
        <span v-if="effectiveLegendColor === ent.color" class="il-legend-count">
          {{ ent.count }} / {{ totalIssueCount }}
        </span>
      </button>
    </div>

    <!-- Right-click anywhere on a column header opens this menu. Top section
         (when a column was the target) gives column-specific actions; the
         column list below shows live sort state, supports drag-reorder, and
         lets you toggle visibility. -->
    <v-menu
      v-model="ctxMenu.open"
      :target="[ctxMenu.x, ctxMenu.y]"
      :close-on-content-click="false"
      location="bottom end"
    >
      <v-card class="il-ctx-card" min-width="280" max-height="560">
        <template v-if="ctxColTitle">
          <div class="il-ctx-section">{{ ctxColTitle }}</div>
          <v-list density="compact" class="py-0">
            <v-list-item
              :active="sortIndex(ctxMenu.colKey) !== -1 && sortOrder(ctxMenu.colKey) === 'asc'"
              prepend-icon="mdi-sort-ascending" @click="setSort(ctxMenu.colKey, 'asc')"
            ><v-list-item-title>Sort ascending</v-list-item-title></v-list-item>
            <v-list-item
              :active="sortIndex(ctxMenu.colKey) !== -1 && sortOrder(ctxMenu.colKey) === 'desc'"
              prepend-icon="mdi-sort-descending" @click="setSort(ctxMenu.colKey, 'desc')"
            ><v-list-item-title>Sort descending</v-list-item-title></v-list-item>
            <v-list-item
              v-if="sortIndex(ctxMenu.colKey) !== -1"
              prepend-icon="mdi-sort-variant-off" @click="clearSortFor(ctxMenu.colKey)"
            ><v-list-item-title>Clear sort</v-list-item-title></v-list-item>
            <v-list-item
              prepend-icon="mdi-sort-variant" @click="addSort(ctxMenu.colKey, 'asc')"
            ><v-list-item-title>Add to multi-sort</v-list-item-title></v-list-item>
            <v-divider class="my-1" />
            <v-list-item
              prepend-icon="mdi-page-first" @click="moveColumn(ctxMenu.colKey, 'start')"
              :disabled="columnOrder[0] === ctxMenu.colKey"
            ><v-list-item-title>Move to start</v-list-item-title></v-list-item>
            <v-list-item
              prepend-icon="mdi-page-last" @click="moveColumn(ctxMenu.colKey, 'end')"
              :disabled="columnOrder[columnOrder.length - 1] === ctxMenu.colKey"
            ><v-list-item-title>Move to end</v-list-item-title></v-list-item>
            <v-list-item
              prepend-icon="mdi-arrow-expand-horizontal" @click="resetColWidth(ctxMenu.colKey)"
            ><v-list-item-title>Reset width</v-list-item-title></v-list-item>
            <v-list-item
              prepend-icon="mdi-eye-off" @click="hideColumn(ctxMenu.colKey)"
            ><v-list-item-title>Hide column</v-list-item-title></v-list-item>
          </v-list>
          <v-divider />
        </template>

        <div class="il-ctx-section d-flex align-center">
          <span>Columns ({{ columnOrder.length - hiddenColumns.size }} / {{ columnOrder.length }})</span>
          <v-spacer />
          <v-btn size="x-small" variant="text" class="text-none" @click="showAllColumns">All</v-btn>
          <v-btn size="x-small" variant="text" class="text-none" @click="hideAllColumns">None</v-btn>
        </div>
        <v-list density="compact" class="py-0 il-ctx-list">
          <v-list-item
            v-for="key in columnOrder" :key="key"
            class="il-ctx-row"
            :class="{ 'il-ctx-row--target': key === ctxMenu.colKey, 'il-ctx-row--over': dragOverKey === key && dragOverKey !== draggingKey }"
            draggable="true"
            @dragstart="onColumnDragStart(key, $event)"
            @dragover.prevent="onColumnDragOver(key, $event)"
            @dragleave="onColumnDragLeave(key)"
            @dragend="onColumnDragEnd"
            @drop="onColumnDrop(key, $event)"
            @click.stop="cycleSort(key)"
          >
            <template #prepend>
              <v-icon icon="mdi-drag-vertical" size="small" class="il-ctx-drag" />
              <v-checkbox-btn
                :model-value="!hiddenColumns.has(key)"
                density="compact" hide-details
                @click.stop
                @update:model-value="toggleHidden(key, $event)"
              />
            </template>
            <v-list-item-title class="il-ctx-name">{{ defByKey[key]?.title || key }}</v-list-item-title>
            <template #append>
              <span v-if="sortIndex(key) !== -1" class="il-ctx-sort">
                <v-icon :icon="sortOrder(key) === 'desc' ? 'mdi-arrow-down' : 'mdi-arrow-up'" size="x-small" />
                <span v-if="sortBy.length > 1" class="il-sort-idx ms-1">{{ sortIndex(key) + 1 }}</span>
              </span>
            </template>
          </v-list-item>
        </v-list>
        <v-divider />
        <v-card-actions class="py-1">
          <v-btn size="small" variant="text" class="text-none" prepend-icon="mdi-sort-variant-off" @click="clearAllSorts">Clear sorts</v-btn>
          <v-spacer />
          <v-btn size="small" variant="text" class="text-none" prepend-icon="mdi-restore" @click="resetAll">Reset all</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { getScopedLabelValue } from '../utils/scopedLabels'
import { currentStatusOfRaw } from '../composables/useGraphDerivedState'
import { priorityBucket, PRIORITY_BUCKET_COLOR, PRIORITY_BUCKETS, PRIORITY_BUCKET_LABEL } from '../utils/priorityBucket'
import {
  ISSUE_LIST_COLUMNS as COLUMN_DEFS,
  ISSUE_LIST_COLUMNS_BY_KEY as defByKey,
  ISSUE_LIST_DEFAULT_ORDER as DEFAULT_ORDER,
  sanitizeIssueListOrder as sanitizeOrder
} from '../utils/issueListColumns'
import IssueContextMenu from './IssueContextMenu.vue'

const props = defineProps({
  nodes: { type: Object, default: () => ({}) },
  issueOpenTarget: { type: String, default: '_blank' },
  // 'open' = single-click opens the ticket (legacy). 'select' = single-click
  // highlights the row (blue glow); double-click opens. Double-click always opens
  // regardless of this setting.
  rowClickAction: { type: String, default: 'open' },
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
const emit = defineEmits(['update:columnState', 'issue-state-change', 'issue-assignee-change'])
const onIssueStateChange    = (payload) => emit('issue-state-change',    payload)
const onIssueAssigneeChange = (payload) => emit('issue-assignee-change', payload)

// Column order + hidden set come from `props.columnState` (header context menu).
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
// When grouping is active we prepend a hidden `data-table-group` stub — this
// is the key Vuetify uses for its auto-injected group column, so providing
// our own with width:0 + display:none CSS suppresses it (our
// #group-header slot already renders a row spanning all columns). The stub
// is zero-width and visually hidden via CSS.
const headers = computed(() => {
  const visible = columnOrder.value
    .filter(k => !hiddenColumns.value.has(k))
    .map(k => {
      const def = defByKey[k]
      if (!def) return null
      const w = widths.value[k] || def.width
      return { ...def, width: w, headerProps: { 'data-col-key': k }, cellProps: { 'data-col-key': k } }
    })
    .filter(Boolean)
  if (props.groupingMode && props.groupingMode !== 'none') {
    visible.unshift({ key: 'data-table-group', title: '', width: 0, sortable: false, headerProps: { class: 'il-group-stub' }, cellProps: { class: 'il-group-stub' } })
  }
  return visible
})
const totalWidth = computed(() => headers.value
  .filter(h => h.key !== 'data-table-group')
  .reduce((s, h) => s + (Number(h.width) || 100), 0))
// Cumulative left offsets of column boundaries (skipping the hidden group
// stub). Used to paint vertical dividers across the group-header row so the
// column grid stays continuous through collapses.
const columnDividerOffsets = computed(() => {
  const out = []
  let x = 0
  for (const h of headers.value) {
    if (h.key === 'data-table-group') continue
    x += Number(h.width) || 100
    out.push(x)
  }
  out.pop()
  return out
})
const groupingByPerson = computed(() => props.groupingMode === 'assignee' || props.groupingMode === 'author')

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

// Right-click context menu — positioned at click coords. `colKey` tracks the
// column the user right-clicked (null if right-clicked on a non-column area
// inside the header, so only the all-columns list is shown).
const ctxMenu = reactive({ open: false, x: 0, y: 0, colKey: null })
const ctxColTitle = computed(() => ctxMenu.colKey && defByKey[ctxMenu.colKey]?.title)
const onHeaderContextMenu = (evt) => {
  const th = evt.target.closest('thead th')
  if (!th) return
  evt.preventDefault()
  const key = th.getAttribute('data-col-key')
  // The hidden data-table-group stub has no key — open the menu with no column target.
  ctxMenu.colKey = key && defByKey[key] ? key : null
  ctxMenu.x = evt.clientX
  ctxMenu.y = evt.clientY
  ctxMenu.open = true
}
const toggleHidden = (key, checked) => {
  const set = new Set(hiddenColumns.value)
  if (checked) set.delete(key); else set.add(key)
  emit('update:columnState', { ...currentState(), hidden: [...set] })
}
const hideColumn = (key) => { toggleHidden(key, false); ctxMenu.open = false }
const showAllColumns = () => emit('update:columnState', { ...currentState(), hidden: [] })
const hideAllColumns = () => {
  // Keep at least Title visible so the user can recover.
  emit('update:columnState', { ...currentState(), hidden: DEFAULT_ORDER.filter(k => k !== 'title') })
}
const resetAll = () => {
  emit('update:columnState', {
    order: [...DEFAULT_ORDER], hidden: [], widths: {},
    sortBy: [{ key: 'updatedAt', order: 'desc' }],
    closedGroups: []
  })
  ctxMenu.open = false
}

// Sort actions used by the header context menu. `must-sort` on v-data-table
// requires at least one sort; falling back to "updatedAt desc" matches the
// initial state so the table never ends up with an empty sortBy.
const DEFAULT_SORT = [{ key: 'updatedAt', order: 'desc' }]
const setSort = (key, order) => { sortBy.value = [{ key, order }]; ctxMenu.open = false }
const addSort = (key, order) => {
  const list = sortBy.value.filter(s => s.key !== key)
  list.push({ key, order })
  sortBy.value = list
}
const clearSortFor = (key) => {
  const next = sortBy.value.filter(s => s.key !== key)
  sortBy.value = next.length ? next : DEFAULT_SORT
}
const clearAllSorts = () => { sortBy.value = [...DEFAULT_SORT] }
// asc → desc → off, replacing any existing sort (single-sort cycle). Use
// Add to multi-sort in the menu for shift-click style behaviour.
const cycleSort = (key) => {
  const cur = sortBy.value.find(s => s.key === key)
  if (!cur) sortBy.value = [{ key, order: 'asc' }]
  else if (cur.order === 'asc') sortBy.value = [{ key, order: 'desc' }]
  else clearAllSorts()
}

const moveColumn = (key, where) => {
  const order = [...columnOrder.value]
  const idx = order.indexOf(key)
  if (idx === -1) return
  order.splice(idx, 1)
  if (where === 'start') order.unshift(key)
  else if (where === 'end') order.push(key)
  columnOrder.value = order
}
const resetColWidth = (key) => {
  const w = { ...widths.value }
  delete w[key]
  emit('update:columnState', { ...currentState(), widths: w })
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
// Reusable gradients keyed by purpose.
//   AGE_PALETTE — fresh (green) → ancient (red), used for created/updated age.
//   BLUE_PALETTE — light (low) → dark (high), used for time + count metrics.
const AGE_PALETTE  = ['#66bb6a', '#9ccc65', '#fbc02d', '#fb8c00', '#e53935']
const BLUE_PALETTE = ['#90a4ae', '#64b5f6', '#42a5f5', '#1e88e5', '#0d47a1']
const NEUTRAL = 'rgba(127,127,127,0.4)'

const hashHue = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
// Pick a palette colour for a value against ordered thresholds. `palette[i+1]`
// is used when value crosses `thresholds[i]`; palette[0] reserved for "empty".
const bucketColor = (palette, value, thresholds) => {
  if (!value || value <= 0) return palette[0]
  for (let i = 0; i < thresholds.length; i++) {
    if (value < thresholds[i]) return palette[i + 1] || palette[palette.length - 1]
  }
  return palette[palette.length - 1]
}
// ISO week label "2026-W21" — used for timeline_* coloring/grouping. Falls
// back to empty when no timestamp is available.
const isoWeekLabel = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  const week = 1 + Math.ceil((firstThursday - target) / 604800000)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}
const DAY_MS = 24 * 60 * 60 * 1000
const ageDays = (ms) => ms ? Math.max(0, Math.floor((Date.now() - ms) / DAY_MS)) : null
const colorForRow = (item) => {
  switch (props.colorMode) {
    case 'none':
    case 'state': return item.state === 'closed' ? '#90a4ae' : '#43a047'
    case 'priority': return PRIORITY_BUCKET_COLOR[item.priorityBucket] || PRIORITY_BUCKET_COLOR.none
    case 'status': {
      const c = STATUS_COLORS[item.status]
      if (c) return c
      return item.state === 'closed' ? '#90a4ae' : '#1e88e5'
    }
    case 'due_status': {
      if (!item.dueDateMs) return NEUTRAL
      const now = Date.now()
      if (item.dueDateMs < now)                                  return '#ef5350'
      if (item.dueDateMs < now + (props.dueSoonDays || 7) * DAY_MS) return '#ffb300'
      return '#66bb6a'
    }
    case 'type':     return item.type ? `hsl(${hashHue(item.type)}, 55%, 55%)` : NEUTRAL
    case 'tag': {
      // Use the first non-scoped label as the colour signature.
      const tag = item.labels?.[0] || ''
      return tag ? `hsl(${hashHue(tag)}, 60%, 55%)` : NEUTRAL
    }
    case 'author':   return item.author     ? avatarColor(item.author)     : NEUTRAL
    case 'assignee': return item.assignees[0] ? avatarColor(item.assignees[0]) : NEUTRAL
    case 'milestone':return item.milestone  ? `hsl(${hashHue(item.milestone)}, 48%, 52%)` : NEUTRAL
    case 'epic':     return item.epic       ? `hsl(${hashHue(item.epic)}, 60%, 55%)`  : NEUTRAL
    case 'iteration':return item.iteration  ? `hsl(${hashHue(item.iteration)}, 55%, 55%)` : NEUTRAL
    case 'weight':   return item.weight == null ? NEUTRAL : bucketColor(BLUE_PALETTE, item.weight, [1, 3, 5, 8])
    case 'age': {
      // Created-at age: 0–7d green, 7–30d, 30–90d, 90–365d, >365d red.
      const d = ageDays(item.createdAtMs)
      return d == null ? NEUTRAL : bucketColor(AGE_PALETTE, d + 0.01, [7, 30, 90, 365])
    }
    case 'last_updated': {
      const d = ageDays(item.updatedAtMs)
      return d == null ? NEUTRAL : bucketColor(AGE_PALETTE, d + 0.01, [3, 14, 60, 180])
    }
    case 'time_estimate': {
      // Bucket seconds: 0=none, <4h, 4–16h, 16h–3d, >3d (8h = 1d GitLab convention).
      return bucketColor(BLUE_PALETTE, item.timeEstimate, [4 * 3600, 16 * 3600, 24 * 3600, 72 * 3600])
    }
    case 'time_spent': {
      return bucketColor(BLUE_PALETTE, item.timeSpent, [4 * 3600, 16 * 3600, 24 * 3600, 72 * 3600])
    }
    case 'time_ratio': {
      // Spent / estimate. No estimate => neutral. <0.5 green, 0.5-1 yellow,
      // 1-1.5 orange, >1.5 red. Matches "are we over budget?" vibe.
      if (!item.timeEstimate) return NEUTRAL
      const r = item.timeSpentRatio || (item.timeSpent / item.timeEstimate)
      if (r < 0.5) return '#66bb6a'
      if (r < 1.0) return '#fbc02d'
      if (r < 1.5) return '#fb8c00'
      return '#e53935'
    }
    case 'budget_status': {
      // Graph uses 'no_est' / 'within' / 'over' bucketing.
      if (!item.timeEstimate) return NEUTRAL // no estimate
      if (item.timeSpent <= item.timeEstimate) return '#66bb6a' // within
      return '#e53935' // over
    }
    case 'estimate_bucket': {
      // 6 buckets: none, <1h, 1-4h, 4-8h, 1-3d, 3d+
      const s = item.timeEstimate
      if (!s) return BLUE_PALETTE[0]
      if (s < 3600)         return '#9ccc65'
      if (s < 4 * 3600)     return '#26a69a'
      if (s < 8 * 3600)     return '#42a5f5'
      if (s < 3 * 24 * 3600) return '#7e57c2'
      return '#5e35b1'
    }
    case 'task_completion': {
      if (!item.hasTasks) return NEUTRAL
      // taskStatus string format: "3 of 10 checklist items completed"
      const m = String(item.taskStatus || '').match(/(\d+)\s*of\s*(\d+)/i)
      if (!m) return NEUTRAL
      const done = Number(m[1]), total = Number(m[2])
      if (!total) return NEUTRAL
      if (done >= total) return '#43a047'
      if (done === 0)    return '#e53935'
      return '#fbc02d'
    }
    case 'upvotes':        return bucketColor(BLUE_PALETTE, item.upvotes,            [1, 3, 10, 25])
    case 'merge_requests': return bucketColor(BLUE_PALETTE, item.mergeRequestsCount, [1, 2, 5, 10])
    case 'comments':       return bucketColor(BLUE_PALETTE, item.comments,           [1, 5, 20, 50])
    case 'timeline_created': {
      const k = isoWeekLabel(item.createdAtMs)
      return k ? `hsl(${hashHue(k)}, 55%, 55%)` : NEUTRAL
    }
    case 'timeline_updated': {
      const k = isoWeekLabel(item.updatedAtMs)
      return k ? `hsl(${hashHue(k)}, 55%, 55%)` : NEUTRAL
    }
    case 'timeline_closed': {
      const k = isoWeekLabel(item.closedAtMs)
      return k ? `hsl(${hashHue(k)}, 55%, 55%)` : NEUTRAL
    }
    default: return 'transparent'
  }
}
// Color for a group header — derived from the group's identity (independent
// of colorMode). E.g., grouping by priority always paints "Blocking" red even
// if the row colour mode is something else.
const groupColorFor = (groupValue) => {
  const v = String(groupValue || '')
  if (!v || /^\(/.test(v)) return 'rgba(127,127,127,0.4)' // "(No xxx)" placeholders
  const mode = props.groupingMode
  switch (mode) {
    case 'state':    return v === 'Closed' ? '#90a4ae' : '#43a047'
    case 'priority': return PRIORITY_BUCKET_COLOR[priorityBucket(v)] || PRIORITY_BUCKET_COLOR.none
    case 'status':   return STATUS_COLORS[v] || '#1e88e5'
    case 'type':     return `hsl(${hashHue(v)}, 55%, 55%)`
    case 'milestone':return `hsl(${hashHue(v)}, 45%, 52%)`
    case 'author':
    case 'assignee': return avatarColor(v)
    case 'tag':      return `hsl(${hashHue(v)}, 50%, 50%)`
    case 'epic':     return `hsl(${hashHue(v)}, 60%, 55%)`
    case 'iteration':return `hsl(${hashHue(v)}, 55%, 55%)`
    case 'weight': {
      // Group keys look like "Weight 3" / "Weight 0" — extract the number for the bucket palette.
      const m = v.match(/-?\d+(\.\d+)?/)
      const n = m ? Number(m[0]) : null
      return n == null ? 'rgba(127,127,127,0.4)' : bucketColor(BLUE_PALETTE, n + 0.01, [1, 3, 5, 8])
    }
    case 'stale':           return `hsl(${hashHue(v)}, 55%, 50%)`
    case 'timeline_created':
    case 'timeline_updated':
    case 'timeline_closed': return `hsl(${hashHue(v)}, 55%, 55%)`
    default:
      if (mode && mode.startsWith('scoped:')) return `hsl(${hashHue(v)}, 50%, 50%)`
      return 'rgba(127,127,127,0.4)'
  }
}
// GitLab profile photo for assignee/author group headers (first row in the group).
const groupAvatarFor = (groupItem) => {
  const mode = props.groupingMode
  if (mode !== 'assignee' && mode !== 'author') return ''
  for (const wrap of (Array.isArray(groupItem?.items) ? groupItem.items : [])) {
    const it = wrap?.raw
    if (!it) continue
    if (mode === 'assignee') return it.assigneeAvatar || ''
    if (mode === 'author') return it.authorAvatar || ''
  }
  return ''
}
// Single pass over `items` builds a per-group index of colour counts and
// pre-computed pill segments. Group-header render helpers below are then O(1)
// map lookups instead of re-iterating each group's items on every call.
const PILL_MAX_H = 28
const groupColorIndex = computed(() => {
  const idx = new Map()
  for (const it of items.value) {
    const key = String(it._group ?? '(none)')
    let e = idx.get(key)
    if (!e) { e = { byColor: new Map(), total: 0 }; idx.set(key, e) }
    const c = it._color || 'rgba(127,127,127,0.4)'
    e.byColor.set(c, (e.byColor.get(c) || 0) + 1)
    e.total++
  }
  for (const e of idx.values()) {
    const segs = [...e.byColor.entries()]
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count)
    const max = segs[0]?.count || 1
    e.segments = segs.map(s => ({
      ...s,
      heightPx: Math.max(4, Math.round((s.count / max) * PILL_MAX_H)),
      title: `${s.count} ticket${s.count === 1 ? '' : 's'}`
    }))
  }
  return idx
})
const groupKeyOf = (groupItem) => String(groupItem?.value ?? '(none)')
const groupVerticalPills = (groupItem) => groupColorIndex.value.get(groupKeyOf(groupItem))?.segments || []
// Build palette-bucket legend entries matching `bucketColor` semantics.
// `labels` length must be palette.length (one per bucket, [0] = "none").
const paletteLegend = (palette, labels) => labels.map((label, i) => ({
  label, color: palette[i]
}))
// Hue-hashed legend pulled from the current items list, capped to avoid
// crowding the footer when there are dozens of unique values.
const hueLegendFromItems = (extract, hueFn, noneLabel = '(None)') => {
  const seen = new Map()
  for (const it of items.value) {
    const v = extract(it)
    const label = v || noneLabel
    if (!seen.has(label)) seen.set(label, v ? hueFn(v) : NEUTRAL)
    if (seen.size >= 14) break
  }
  return [...seen.entries()].map(([label, color]) => ({ label, color }))
}
const colorLegendEntries = computed(() => {
  switch (props.colorMode) {
    case 'none': return []
    case 'state': return [
      { label: 'Open', color: '#43a047' },
      { label: 'Closed', color: '#90a4ae' }
    ]
    case 'priority': return PRIORITY_BUCKETS.map(b => ({
      label: PRIORITY_BUCKET_LABEL[b], color: PRIORITY_BUCKET_COLOR[b]
    }))
    case 'status': return Object.entries(STATUS_COLORS).map(([label, color]) => ({ label, color }))
    case 'due_status': return [
      { label: 'Overdue', color: '#ef5350' },
      { label: `Due within ${props.dueSoonDays || 7}d`, color: '#ffb300' },
      { label: 'On track', color: '#66bb6a' },
      { label: 'No due date', color: NEUTRAL }
    ]
    case 'type':     return hueLegendFromItems(it => it.type,         t => `hsl(${hashHue(t)}, 55%, 55%)`, '(No type)')
    case 'tag':      return hueLegendFromItems(it => it.labels?.[0],  t => `hsl(${hashHue(t)}, 60%, 55%)`, '(No labels)')
    case 'author':   return hueLegendFromItems(it => it.author,       n => avatarColor(n),                 '(No author)')
    case 'assignee': return hueLegendFromItems(it => it.assignees[0], n => avatarColor(n),                 '(Unassigned)')
    case 'milestone':return hueLegendFromItems(it => it.milestone,    n => `hsl(${hashHue(n)}, 48%, 52%)`, '(No milestone)')
    case 'epic':     return hueLegendFromItems(it => it.epic,         n => `hsl(${hashHue(n)}, 60%, 55%)`, '(No epic)')
    case 'iteration':return hueLegendFromItems(it => it.iteration,    n => `hsl(${hashHue(n)}, 55%, 55%)`, '(No iteration)')
    case 'age':            return paletteLegend(AGE_PALETTE, ['Unknown', '<7d', '<30d', '<90d', '<1y', '>1y'].slice(0, AGE_PALETTE.length))
    case 'last_updated':   return paletteLegend(AGE_PALETTE, ['Unknown', '<3d', '<2w', '<2mo', '<6mo', '>6mo'].slice(0, AGE_PALETTE.length))
    case 'weight':         return paletteLegend(BLUE_PALETTE, ['No weight', '<1', '1-2', '3-4', '5-7', '8+'].slice(0, BLUE_PALETTE.length))
    case 'time_estimate':  return paletteLegend(BLUE_PALETTE, ['None', '<4h', '4-16h', '16-24h', '1-3d', '>3d'].slice(0, BLUE_PALETTE.length))
    case 'time_spent':     return paletteLegend(BLUE_PALETTE, ['None', '<4h', '4-16h', '16-24h', '1-3d', '>3d'].slice(0, BLUE_PALETTE.length))
    case 'upvotes':        return paletteLegend(BLUE_PALETTE, ['0', '1-2', '3-9', '10-24', '25+'].slice(0, BLUE_PALETTE.length))
    case 'merge_requests': return paletteLegend(BLUE_PALETTE, ['0', '1', '2-4', '5-9', '10+'].slice(0, BLUE_PALETTE.length))
    case 'comments':       return paletteLegend(BLUE_PALETTE, ['0', '1-4', '5-19', '20-49', '50+'].slice(0, BLUE_PALETTE.length))
    case 'time_ratio': return [
      { label: 'No estimate', color: NEUTRAL },
      { label: '<50%', color: '#66bb6a' },
      { label: '50-100%', color: '#fbc02d' },
      { label: '100-150%', color: '#fb8c00' },
      { label: '>150%', color: '#e53935' }
    ]
    case 'budget_status': return [
      { label: 'No estimate', color: NEUTRAL },
      { label: 'Within', color: '#66bb6a' },
      { label: 'Over', color: '#e53935' }
    ]
    case 'estimate_bucket': return [
      { label: 'None', color: BLUE_PALETTE[0] },
      { label: '<1h', color: '#9ccc65' },
      { label: '1-4h', color: '#26a69a' },
      { label: '4-8h', color: '#42a5f5' },
      { label: '1-3d', color: '#7e57c2' },
      { label: '>3d', color: '#5e35b1' }
    ]
    case 'task_completion': return [
      { label: 'No tasks', color: NEUTRAL },
      { label: 'None done', color: '#e53935' },
      { label: 'Partial', color: '#fbc02d' },
      { label: 'All done', color: '#43a047' }
    ]
    case 'timeline_created':
    case 'timeline_updated':
    case 'timeline_closed': {
      const field = props.colorMode === 'timeline_created' ? 'createdAtMs'
                  : props.colorMode === 'timeline_updated' ? 'updatedAtMs'
                  : 'closedAtMs'
      return hueLegendFromItems(it => isoWeekLabel(it[field]), w => `hsl(${hashHue(w)}, 55%, 55%)`, '(No date)')
    }
    default: return []
  }
})
// Bucket helpers for time- and age-based grouping. Keys are lexicographically
// sortable so v-data-table's default ascending order produces chronological /
// stale-first ordering without a custom sorter.
const monthBucketKey = (ms) => {
  if (!ms) return '~ (None)'
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const staleBucketKey = (ms) => {
  if (!ms) return '7: Unknown'
  const days = Math.floor((Date.now() - ms) / 86400000)
  if (days < 30) return '1: <30 days'
  if (days < 60) return '2: 30-60 days'
  if (days < 90) return '3: 60-90 days'
  if (days < 180) return '4: 90-180 days'
  if (days < 365) return '5: 180-365 days'
  return '6: >1 year'
}
// Synthetic group key per row driven by `groupingMode`. v-data-table groups
// rows sharing the same `_group` value. 'none' = no grouping (key undefined).
const groupKeyFor = (item) => {
  const mode = props.groupingMode
  if (!mode || mode === 'none') return undefined
  switch (mode) {
    case 'state':     return item.state === 'closed' ? 'Closed' : 'Open'
    case 'status':    return item.status || '(No status)'
    case 'priority':  return item.priority || '(No priority)'
    case 'type':      return item.type || '(No type)'
    case 'milestone': return item.milestone || '(No milestone)'
    case 'author':    return item.author || '(No author)'
    case 'assignee':  return item.assignees[0] || '(Unassigned)'
    case 'tag':       return item.labels[0] || '(No labels)'
    case 'weight':    return item.weight != null ? `Weight ${item.weight}` : '(No weight)'
    case 'epic':      return item.epic || '(No epic)'
    case 'iteration': return item.iteration || '(No iteration)'
    case 'stale':            return staleBucketKey(item.updatedAtMs)
    case 'timeline_created': return monthBucketKey(item.createdAtMs)
    case 'timeline_updated': return monthBucketKey(item.updatedAtMs)
    case 'timeline_closed':  return item.closedAtMs ? monthBucketKey(item.closedAtMs) : '~ (Open)'
    case 'svn_revision':     return undefined
    default:
      if (mode.startsWith('scoped:')) {
        const prefix = mode.slice(7)
        return getScopedLabelValue(item.rawLabels, prefix) || `(No ${prefix})`
      }
      return undefined
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
      authorAvatar: raw.author?.avatar_url || '',
      assignees,
      assigneeAvatar: (raw.assignees?.[0]?.avatar_url) || raw.assignee?.avatar_url || '',
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
      rawLabels: Array.isArray(raw.labels) ? raw.labels : [],
      comments: Number(raw.user_notes_count) || 0,
      weight: raw.weight != null ? Number(raw.weight) : null,
      epic: raw.epic?.title || '',
      iteration: raw.iteration?.title || '',
      timeEstimate: Number(n.timeEstimate) || 0,
      timeSpent: Number(n.timeSpent) || 0,
      timeSpentRatio: Number(n.timeSpentRatio) || 0,
      upvotes: Number(n.upvotes) || 0,
      mergeRequestsCount: Number(n.mergeRequestsCount) || 0,
      hasTasks: !!n.hasTasks,
      taskStatus: n.taskStatus || '',
      closedAt: closedIso,
      closedAtMs: closedMs
    }
    item._group = groupKeyFor(item)
    item._color = colorForRow(item)
    out.push(item)
  }
  return out
})

const totalIssueCount = computed(() => items.value.length)
const colorCountsByColor = computed(() => {
  const m = new Map()
  for (const it of items.value) m.set(it._color, (m.get(it._color) || 0) + 1)
  return m
})
const colorLegend = computed(() => colorLegendEntries.value.map(e => ({
  ...e,
  count: colorCountsByColor.value.get(e.color) || 0
})))

const legendPinned = ref(null)
const legendHover = ref(null)
const effectiveLegendColor = computed(() => legendPinned.value ?? legendHover.value)
watch(() => props.colorMode, () => { legendPinned.value = null; legendHover.value = null })
const toggleLegendPin = (color) => {
  legendPinned.value = legendPinned.value === color ? null : color
}

// Row-props is independent of legend state so changing the active legend
// colour doesn't force Vuetify to re-render all rows. The match/dim classes
// are toggled directly on the DOM by the watcher below. The ctx-active
// class is also DOM-toggled (in onRowContextMenu / close) to avoid re-rendering.
const rowProps = ({ item }) => ({ 'data-row-color': item._color || '', 'data-row-id': item.id })
const issueListEl = ref(null)
const applyLegendClasses = () => {
  const root = issueListEl.value
  if (!root) return
  const color = effectiveLegendColor.value
  const rows = root.querySelectorAll('tr[data-row-color]')
  for (const row of rows) {
    if (!color) {
      row.classList.remove('il-row-legend-match', 'il-row-legend-dim')
      continue
    }
    const same = row.getAttribute('data-row-color') === color
    row.classList.toggle('il-row-legend-match', same)
    row.classList.toggle('il-row-legend-dim', !same)
  }
}
watch([effectiveLegendColor, items], () => nextTick(() => {
  applyLegendClasses()
  applyRowClass('il-row-ctx-active', rowCtx.activeId)
  applyRowClass('il-row-selected', selectedId.value)
}))
// Clear selection if user switches the click-action setting back to "open".
watch(() => props.rowClickAction, (v) => { if (v !== 'select') { selectedId.value = null; applyRowClass('il-row-selected', null) } })

const groupRowLegendClass = (groupItem) => {
  const focus = effectiveLegendColor.value
  if (!focus) return {}
  const e = groupColorIndex.value.get(groupKeyOf(groupItem))
  const n = e?.byColor.get(focus) || 0
  return {
    'il-group-row--legend-match': n > 0,
    'il-group-row--legend-dim': n === 0 && (e?.total || 0) > 0
  }
}
const pillLegendClass = (color) => {
  const focus = effectiveLegendColor.value
  if (!focus) return {}
  return {
    'il-group-pill--match': color === focus,
    'il-group-pill--dim': color !== focus
  }
}
const pillLegendTitle = (seg, groupItem) => {
  const focus = effectiveLegendColor.value
  if (!focus || seg.color !== focus) return seg.title
  const e = groupColorIndex.value.get(groupKeyOf(groupItem))
  return `${e?.byColor.get(focus) || 0} / ${e?.total || 0} tickets`
}

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
const isGrouped = computed(() => groupBy.value.length > 0)

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

const openTicket = (item) => {
  if (item?.url) window.open(item.url, props.issueOpenTarget || '_blank')
}
const onRowClick = (_evt, { item }) => {
  if (props.rowClickAction === 'select') {
    selectedId.value = item?.id ?? null
    applyRowClass('il-row-selected', selectedId.value)
    return
  }
  openTicket(item)
}
const onRowDblClick = (_evt, { item }) => openTicket(item)

// Right-click on a row → same context menu the graph uses. We pass the
// original node (with `_raw`) plus the row's `_color` so the menu's header
// strip matches the pip the user is looking at. Active rows (yellow for
// right-click target, blue for selection) get a class toggled directly on
// the DOM via `applyRowClass` to avoid forcing rowProps re-renders.
const rowCtx = reactive({ visible: false, x: 0, y: 0, node: null, activeId: null })
const selectedId = ref(null)
const applyRowClass = (className, id) => {
  const root = issueListEl.value
  if (!root) return
  for (const row of root.querySelectorAll(`tr.${className}`)) row.classList.remove(className)
  if (id == null) return
  const sel = root.querySelector(`tr[data-row-id="${CSS.escape(String(id))}"]`)
  if (sel) sel.classList.add(className)
}
const onRowContextMenu = (evt, { item }) => {
  const n = item && props.nodes ? props.nodes[item.id] : null
  if (!n) return
  evt.preventDefault()
  rowCtx.node = { ...n, color: item._color || n.color || '' }
  rowCtx.x = evt.clientX
  rowCtx.y = evt.clientY
  rowCtx.visible = true
  rowCtx.activeId = item.id
  nextTick(() => applyRowClass('il-row-ctx-active', item.id))
}
const closeRowCtx = () => {
  rowCtx.visible = false
  rowCtx.activeId = null
  applyRowClass('il-row-ctx-active', null)
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
.issue-list {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.issue-list-table { flex: 1 1 0; min-height: 0; overflow: hidden; }
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
  overflow: hidden;
}
.il-avatar--photo { background: transparent !important; }
.il-avatar--photo img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.il-header-cell {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  min-width: 0;
}
.il-header {
  cursor: grab;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding-right: 6px;
}
.il-header:active { cursor: grabbing; }
.il-iid-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  min-width: 0;
}
.il-row-color {
  display: inline-block;
  width: 6px; height: 18px;
  border-radius: 3px;
  flex: 0 0 6px;
}
.il-group-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.il-group-row { cursor: pointer; }
.il-group-row td { position: relative; }
.il-group-divider {
  position: absolute;
  top: 0; bottom: 0;
  width: 1px;
  background: rgba(127, 127, 127, 0.15);
  pointer-events: none;
}
.il-group-row td {
  padding: 6px 8px 4px !important;
  height: auto !important;   /* overrides the row-height rule for non-group rows */
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
.il-group-leading {
  flex: 0 0 22px;
  width: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.il-group-title {
  font-size: 13px;
  flex: 0 0 200px;
  width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.il-group-pills {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 36px;
  flex: 0 0 auto;
  padding-left: 10px;
}
.il-group-pill-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  height: 36px;
}
.il-group-pill-count {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.8;
}
.il-group-pill-col.il-group-pill--match .il-group-pill-count { opacity: 1; }
.il-group-count {
  font-size: 12px;
  margin-left: auto;
  font-weight: 500;
  min-width: 90px;
  text-align: right;
}
.il-group-pill {
  width: 8px;
  min-height: 4px;
  border-radius: 2px;
}
.il-chip-cell {
  display: flex;
  align-items: center;
  height: 28px;
}
.il-chip-cell :deep(.v-chip) { margin: 0; }
.il-color-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  padding: 6px 12px;
  font-size: 11px;
  border-top: 1px solid rgba(127, 127, 127, 0.18);
  flex-shrink: 0;
}
.il-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.il-legend-item:hover,
.il-legend-item--on {
  background: rgba(127, 127, 127, 0.16);
  border-color: rgba(127, 127, 127, 0.22);
}
.il-legend-item--pinned { border-color: rgba(var(--v-theme-primary), 0.55); }
.il-legend-count {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.85;
  margin-left: 2px;
}
.il-legend-swatch {
  width: 10px; height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
:deep(.il-row-legend-match .v-data-table__td) {
  background: rgba(var(--v-theme-primary), 0.14) !important;
}
:deep(.il-row-legend-match .il-row-color) {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.55);
}
:deep(.il-row-legend-dim .v-data-table__td) { opacity: 0.32; }
:deep(.il-row-legend-dim .v-data-table__td:hover) { opacity: 0.55; }
/* Right-click target — yellow glow on the row while its context menu is open.
   `!important` overrides zebra striping + legend-dim background. */
:deep(.il-row-ctx-active .v-data-table__td) {
  background: rgba(255, 213, 79, 0.28) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.55);
}
/* Click-to-select target — primary-coloured glow (only used when the
   "single-click selects" setting is on; double-click still opens). */
:deep(.il-row-selected .v-data-table__td) {
  background: rgba(var(--v-theme-primary), 0.18) !important;
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.55);
}
.il-group-row--legend-match td { box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary)); }
.il-group-row--legend-dim td { opacity: 0.4; }
.il-group-pill--match { box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7); }
.il-group-pill--dim { opacity: 0.25; }
/* Drag-reorder highlight — primary-coloured wash + thick left border on the
   header the user is hovering over while dragging another column. */
.il-drop-target {
  background: rgba(var(--v-theme-primary), 0.22);
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}
/* Stub group column — exists only to suppress Vuetify's auto-injected "Group"
   header that would otherwise shift everything right when group-by is active. */
:deep(.il-group-stub) {
  display: none !important;
  width: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}
/* Right-click context menu (header) — section headers, list rows, drag hints. */
.il-ctx-section {
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
:deep(.il-ctx-list .v-list-item) { cursor: pointer; min-height: 30px; }
:deep(.il-ctx-row--target) { background: rgba(var(--v-theme-primary), 0.10); }
:deep(.il-ctx-row--over) {
  background: rgba(var(--v-theme-primary), 0.20);
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}
.il-ctx-drag { opacity: 0.45; cursor: grab; margin-right: 2px; }
.il-ctx-drag:active { cursor: grabbing; }
.il-ctx-name { font-size: 13px; }
.il-ctx-sort { display: inline-flex; align-items: center; opacity: 0.85; }
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
:deep(.v-data-table-header__content) {
  position: relative;
  width: 100%;
  height: 100%;
}
:deep(thead th) { position: relative; }
/* Fixed table layout + min-width on the underlying <table> = columns respect
   their declared widths instead of Vuetify squeezing everything to fit. When
   the available space is narrower than the sum of widths, the wrapper scrolls
   horizontally. The min-width is the sum of effective column widths, exposed
   as a CSS variable so resizing updates it without re-rendering rules. */
:deep(.v-data-table) {
  font-size: 13px;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
:deep(.v-table__wrapper) {
  overflow: auto;
  flex: 1 1 0;
  min-height: 0;
}
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
/* fixed-header sticky cells need an opaque background so scrolled rows
   don't bleed through. Theme-aware via the v-theme-surface variable. */
:deep(.v-data-table__th) { background: rgb(var(--v-theme-surface)) !important; }
:deep(.v-data-table__th:nth-child(even)) {
  background:
    linear-gradient(rgba(127, 127, 127, 0.12), rgba(127, 127, 127, 0.12)),
    rgb(var(--v-theme-surface)) !important;
}
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
