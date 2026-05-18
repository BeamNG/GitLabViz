<template>
  <!-- Columns control for the list view — show/hide + drag to reorder. Writes
       directly to `state.view.listColumns` so the table and this panel stay
       in sync via Vue reactivity. Only rendered when the parent decides to
       (list view active). -->
  <div
    class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none"
    @click="state.ui.showColumns = !state.ui.showColumns"
  >
    <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
      Columns · {{ visibleCount }} / {{ ISSUE_LIST_DEFAULT_ORDER.length }}
    </div>
    <v-icon :icon="state.ui.showColumns ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis" />
  </div>

  <v-expand-transition>
    <div v-show="state.ui.showColumns" class="px-1 mb-2">
      <ul class="slc-list">
        <li
          v-for="(key, idx) in order" :key="key"
          class="slc-row"
          :draggable="true"
          @dragstart="onDragStart(idx, $event)"
          @dragover.prevent
          @drop="onDrop(idx, $event)"
        >
          <v-icon icon="mdi-drag" size="small" class="slc-handle" />
          <v-checkbox
            :model-value="!hiddenSet.has(key)"
            @update:model-value="toggle(key, $event)"
            :label="defByKey[key]?.title || key"
            hide-details density="compact"
            class="ma-0 slc-checkbox"
          />
        </li>
      </ul>
      <v-btn size="x-small" variant="text" class="text-none mt-1" @click="reset">Reset columns</v-btn>
    </div>
  </v-expand-transition>

  <v-divider class="my-2" />
</template>

<script setup>
import { computed } from 'vue'
import {
  ISSUE_LIST_DEFAULT_ORDER,
  ISSUE_LIST_COLUMNS_BY_KEY as defByKey,
  sanitizeIssueListOrder,
  sanitizeIssueListState
} from '../../utils/issueListColumns'

const props = defineProps({
  state: { type: Object, required: true } // settings.uiState — we read/write listColumns + ui.showColumns
})

// `state.view.listColumns` may be partial after a settings migration; sanitise
// on read, and write the full canonical object back on every mutation so the
// shape stays predictable for IssueList.
// Run the saved listColumns through `sanitizeIssueListState` so any new
// hidden-by-default columns added in a later app version land in the hidden
// set automatically for users who already have saved state.
const lc = computed(() => sanitizeIssueListState(props.state.view?.listColumns))
const order = computed(() => lc.value.order)
const hiddenSet = computed(() => new Set(lc.value.hidden))
const visibleCount = computed(() => order.value.filter(k => !hiddenSet.value.has(k)).length)

const writeBack = (patch) => {
  props.state.view.listColumns = { ...lc.value, ...patch }
}

const toggle = (key, checked) => {
  const set = new Set(hiddenSet.value)
  if (checked) set.delete(key); else set.add(key)
  writeBack({ hidden: [...set] })
}

const onDragStart = (idx, evt) => {
  evt.dataTransfer.setData('text/plain', order.value[idx])
  evt.dataTransfer.effectAllowed = 'move'
}
const onDrop = (idx, evt) => {
  evt.preventDefault()
  const src = evt.dataTransfer.getData('text/plain')
  const target = order.value[idx]
  if (!src || !target || src === target) return
  const next = [...order.value]
  const srcIdx = next.indexOf(src)
  const dstIdx = next.indexOf(target)
  if (srcIdx < 0 || dstIdx < 0) return
  next.splice(srcIdx, 1)
  next.splice(dstIdx, 0, src)
  writeBack({ order: next })
}

const reset = () => {
  writeBack({ order: [...ISSUE_LIST_DEFAULT_ORDER], hidden: [], widths: {} })
}
</script>

<style scoped>
.slc-list { list-style: none; padding: 0; margin: 0; }
.slc-row {
  display: grid; grid-template-columns: 22px 1fr; align-items: center;
  gap: 4px;
  cursor: grab;
  border-radius: 4px;
}
.slc-row:active { cursor: grabbing; }
.slc-row:hover { background: rgba(127, 127, 127, 0.08); }
.slc-handle { opacity: 0.4; }
.slc-checkbox { font-size: 12px; }
:deep(.slc-checkbox .v-label) { font-size: 12px; opacity: 0.9; }
</style>
