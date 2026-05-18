<template>
  <!-- Floating issue context menu — extracted so the graph and list views share
       the same actions. Positioned in viewport coords (clamped on-screen). -->
  <div
    v-if="visible"
    ref="rootEl"
    class="issue-context-menu"
    :style="{ left: clamped.x + 'px', top: clamped.y + 'px' }"
    @contextmenu.prevent
  >
    <div class="issue-context-menu__header" :style="headerStyle">
      <div class="issue-context-menu__header-top">
        <div class="issue-context-menu__header-key">{{ headerKey }}</div>
        <div v-if="headerState" class="issue-context-menu__header-state">{{ headerState }}</div>
      </div>
      <div class="issue-context-menu__header-title">{{ headerTitle }}</div>
    </div>

    <div class="issue-context-menu__section">
      <div class="issue-context-menu__grid issue-context-menu__grid--actions">
        <button type="button" class="issue-context-menu__item" @click="onOpenTicket">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-open-in-new" size="x-small" class="issue-context-menu__icon" />
            <span>Open issue URL</span>
          </span>
        </button>

        <template v-if="canWrite">
          <button type="button" class="issue-context-menu__item" @click="onToggleClosed">
            <span class="issue-context-menu__item-content">
              <v-icon :icon="stateActionIcon" size="x-small" class="issue-context-menu__icon" />
              <span>{{ stateActionLabel }}</span>
            </span>
          </button>

          <button
            v-if="assigneeAction === 'assign'"
            type="button"
            class="issue-context-menu__item"
            :disabled="!meId"
            :aria-disabled="!meId"
            :title="!meId ? assignDisabledReason : ''"
            @click="onAssignToMe"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-account-plus" size="x-small" class="issue-context-menu__icon" />
              <span>Assign to me</span>
            </span>
          </button>

          <button v-else type="button" class="issue-context-menu__item" @click="onUnassign">
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-account-minus" size="x-small" class="issue-context-menu__icon" />
              <span>Unassign me</span>
            </span>
          </button>
        </template>

        <button
          v-else
          type="button"
          class="issue-context-menu__item issue-context-menu__item--warn"
          :title="writeDisabledReason"
          aria-disabled="true"
          disabled
        >
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-alert" size="x-small" class="issue-context-menu__icon" />
            <span>Editing disabled (needs api)</span>
          </span>
        </button>
      </div>
      <div class="issue-context-menu__row">
        <div class="issue-context-menu__row-label">
          <v-icon icon="mdi-content-copy" size="x-small" class="issue-context-menu__icon" />
          <span>Copy</span>
        </div>
        <div class="issue-context-menu__row-actions">
          <button type="button" class="issue-context-menu__pill" title="Copy shorthand" aria-label="Copy shorthand" @click="onCopyShorthand">
            <v-icon icon="mdi-pound" size="x-small" class="issue-context-menu__pill-icon" />
          </button>
          <button type="button" class="issue-context-menu__pill" title="Copy URL" aria-label="Copy URL" @click="onCopyUrl">
            <v-icon icon="mdi-link-variant" size="x-small" class="issue-context-menu__pill-icon" />
          </button>
          <button type="button" class="issue-context-menu__pill" title="Copy markdown link" aria-label="Copy markdown link" @click="onCopyMarkdown">
            <v-icon icon="mdi-language-markdown" size="x-small" class="issue-context-menu__pill-icon" />
          </button>
          <button type="button" class="issue-context-menu__pill" title="Copy summary" aria-label="Copy summary" @click="onCopySummary">
            <v-icon icon="mdi-text-box-outline" size="x-small" class="issue-context-menu__pill-icon" />
          </button>
        </div>
      </div>
    </div>

    <div class="issue-context-menu__divider"></div>

    <div class="issue-context-menu__section">
      <div class="issue-context-menu__title">
        <v-icon icon="mdi-filter-outline" size="x-small" class="issue-context-menu__icon" />
        <span>Filter by</span>
      </div>
      <div class="issue-context-menu__grid">
        <button v-if="ctxAuthor" type="button" class="issue-context-menu__item" @click="onFilterAuthor">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-account-edit" size="x-small" class="issue-context-menu__icon" />
            <span>Author<br/>{{ ctxAuthor }}</span>
          </span>
        </button>
        <button v-if="ctxAssignee" type="button" class="issue-context-menu__item" @click="onFilterAssignee">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-account" size="x-small" class="issue-context-menu__icon" />
            <span>Assignee <br/>{{ ctxAssignee }}</span>
          </span>
        </button>
        <button v-if="ctxMilestone" type="button" class="issue-context-menu__item" @click="onFilterMilestone">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-flag" size="x-small" class="issue-context-menu__icon" />
            <span>Milestone<br/>{{ ctxMilestone }}</span>
          </span>
        </button>
        <button v-if="ctxStatus" type="button" class="issue-context-menu__item" @click="onFilterStatus">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-list-status" size="x-small" class="issue-context-menu__icon" />
            <span>Status<br/>{{ ctxStatus }}</span>
          </span>
        </button>
        <button v-if="ctxPriority" type="button" class="issue-context-menu__item" @click="onFilterPriority">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-alert-circle" size="x-small" class="issue-context-menu__icon" />
            <span>Priority<br/>{{ ctxPriority }}</span>
          </span>
        </button>
        <button v-if="ctxType" type="button" class="issue-context-menu__item" @click="onFilterType">
          <span class="issue-context-menu__item-content">
            <v-icon icon="mdi-shape" size="x-small" class="issue-context-menu__icon" />
            <span>Type<br/>{{ ctxType }}</span>
          </span>
        </button>
      </div>
    </div>

    <template v-if="ctxLabels.length">
      <div class="issue-context-menu__divider"></div>
      <div class="issue-context-menu__section">
        <div class="issue-context-menu__title issue-context-menu__title--row">
          <span class="issue-context-menu__title-left">
            <v-icon icon="mdi-tag-multiple" size="x-small" class="issue-context-menu__icon" />
            <span>Filter by label</span>
          </span>
          <button type="button" class="issue-context-menu__title-action" title="Same label combination" @click="onFilterSameLabelCombo">Same combo</button>
        </div>
        <div class="issue-context-menu__chips">
          <button
            v-for="lab in ctxLabels"
            :key="lab"
            type="button"
            class="issue-context-menu__chip"
            :title="`Filter by label: ${lab}`"
            @click="onFilterLabel(lab)"
          >{{ lab }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useSettingsStore } from '../composables/useSettingsStore'
import { getAssigneeNames } from '../utils/issueFields'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // Viewport-space click coordinates (clientX/clientY); menu clamps onto screen.
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  // Node-like object: needs `_raw` (GitLab issue), `id`, optional `name`,
  // `color` (used to tint the header strip), `webUrl`.
  node: { type: Object, default: null }
})
const emit = defineEmits(['close', 'issue-state-change', 'issue-assignee-change'])

const { settings } = useSettingsStore()
const rootEl = ref(null)

// Approximate footprint used for viewport clamping. The menu auto-sizes,
// so this is a "stay within the window" hint, not an exact box.
const MENU_W = 320
const MENU_H = 480
const clamped = computed(() => {
  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 768
  return {
    x: Math.max(8, Math.min(props.x, vw - MENU_W - 8)),
    y: Math.max(8, Math.min(props.y, vh - MENU_H - 8))
  }
})

const raw = computed(() => props.node?._raw || null)
const ctxIid = computed(() => {
  if (raw.value?.iid != null) return String(raw.value.iid)
  const n = props.node
  return n && n.id != null ? String(n.id) : ''
})

const canWrite = computed(() => !!settings?.meta?.gitlabCanWrite)
const meId = computed(() => {
  const n = Number(settings?.meta?.gitlabMeId)
  return Number.isFinite(n) && n > 0 ? n : null
})
const writeDisabledReason = computed(() => {
  if (canWrite.value) return ''
  const scopes = settings?.meta?.gitlabTokenScopes
  if (Array.isArray(scopes) && scopes.length) return `Read-only token (scopes: ${scopes.join(', ')}). Create a token with api scope to enable editing.`
  return 'Write disabled. Click "Test connection" in Configuration → GitLab to verify token scopes, and use a token with api scope to enable editing.'
})
const isClosed = computed(() => String(raw.value?.state || '').toLowerCase() === 'closed')
const stateActionLabel = computed(() => (isClosed.value ? 'Reopen ticket' : 'Close ticket'))
const stateActionIcon = computed(() => (isClosed.value ? 'mdi-lock-open-variant' : 'mdi-lock'))
const stateActionEvent = computed(() => (isClosed.value ? 'reopen' : 'close'))

const headerKey = computed(() => {
  const short = getShorthand(props.node)
  if (short) return short
  const n = props.node
  return n && n.id != null ? `#${n.id}` : ''
})
const headerTitle = computed(() => {
  const n = props.node
  const t = String(n?._raw?.title || '').trim()
  return t || String(n?.name || '').trim()
})
const headerState = computed(() => {
  const s = String(raw.value?.state || '').trim()
  return s ? s.toUpperCase() : ''
})
const headerStyle = computed(() => {
  const c = d3.color(props.node?.color || '')
  const accent = c ? c.formatHex() : ''
  const bg = c ? c.copy({ opacity: 0.14 }).toString() : ''
  return { borderLeftColor: accent || undefined, background: bg || undefined }
})

const ctxAuthor = computed(() => raw.value?.author?.name || '')
const ctxAssignee = computed(() => {
  const r = raw.value || {}
  const a = r.assignee || (Array.isArray(r.assignees) && r.assignees.length ? r.assignees[0] : null)
  return a?.name || ''
})
const ctxAssigneeId = computed(() => {
  const r = raw.value || {}
  const a = r.assignee || (Array.isArray(r.assignees) && r.assignees.length ? r.assignees[0] : null)
  const id = a && a.id != null ? Number(a.id) : NaN
  return Number.isFinite(id) ? id : null
})
const assigneeAction = computed(() => (ctxAssigneeId.value ? 'unassign' : 'assign'))
const assignDisabledReason = computed(() => {
  if (!canWrite.value) return writeDisabledReason.value
  if (!meId.value) return 'Cannot resolve current GitLab user. Click "Refresh" or "Test connection" once to fetch /user.'
  return ''
})
const ctxMilestone = computed(() => raw.value?.milestone?.title || '')
const scopedFirst = (prefix) => {
  const labels = raw.value?.labels || []
  if (!Array.isArray(labels)) return ''
  const matches = labels.filter(l => typeof l === 'string' && l.startsWith(prefix + '::')).map(l => l.substring(prefix.length + 2)).filter(Boolean)
  return matches.length ? matches[matches.length - 1] : ''
}
const ctxStatus = computed(() => scopedFirst('Status'))
const ctxPriority = computed(() => scopedFirst('Priority'))
const ctxType = computed(() => scopedFirst('Type'))
const ctxLabels = computed(() => {
  const labels = raw.value?.labels || []
  if (!Array.isArray(labels)) return []
  return labels.filter(l => typeof l === 'string' && l.trim()).slice(0, 18)
})
const ctxLabelsAll = computed(() => {
  const labels = raw.value?.labels || []
  if (!Array.isArray(labels)) return []
  return labels.filter(l => typeof l === 'string' && l.trim()).slice(0, 60)
})

const close = () => { if (props.visible) emit('close') }

async function copyText (text) {
  const s = String(text || '')
  if (!s) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(s)
      return true
    }
  } catch { /* fall through */ }
  try {
    const el = document.createElement('textarea')
    el.value = s
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.top = '0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  } catch (e) {
    console.warn('Copy failed:', e)
    return false
  }
}

function getUrl (node) {
  const r = node?._raw || {}
  return r.web_url || r.webUrl || node?.webUrl || ''
}
function getShorthand (node) {
  const r = node?._raw || {}
  const full = r.references && typeof r.references.full === 'string' ? r.references.full : ''
  if (full) return full
  const rel = r.references && typeof r.references.relative === 'string' ? r.references.relative : ''
  const pid = String(settings?.config?.projectId || '').trim()
  if (rel) {
    if (!pid) return rel
    if (rel.includes('/')) return rel
    if (rel.startsWith('#')) return `${pid}${rel}`
    return `${pid}#${rel.replace(/^#/, '')}`
  }
  const id = node && node.id != null ? String(node.id) : ''
  return (pid && id) ? `${pid}#${id}` : ''
}
function getSummary (node) {
  const r = node?._raw || {}
  const title = String(r.title || '').trim()
  const state = String(r.state || '').trim()
  const assignees = getAssigneeNames(r)
  const short = getShorthand(node)
  const bits = []
  if (short) bits.push(short)
  if (title) bits.push(title)
  if (state) bits.push(`[${state}]`)
  if (assignees.length) bits.push(`(assignee${assignees.length > 1 ? 's' : ''}: ${assignees.join(', ')})`)
  return bits.join(' ')
}

async function onCopyShorthand () { await copyText(getShorthand(props.node)); close() }
async function onCopyUrl ()       { await copyText(getUrl(props.node)); close() }
async function onCopyMarkdown () {
  const n = props.node
  const short = getShorthand(n)
  const url = getUrl(n)
  const title = String(n?._raw?.title || '').trim()
  const base = (short && url) ? `[${short}](${url})` : (short || url)
  await copyText(title ? `${base} - ${title}` : base)
  close()
}
async function onCopySummary () { await copyText(getSummary(props.node)); close() }

function onToggleClosed () {
  if (!ctxIid.value || !canWrite.value) return
  emit('issue-state-change', { iid: ctxIid.value, state_event: stateActionEvent.value })
  close()
}
function onAssignToMe () {
  if (!ctxIid.value || !canWrite.value || !meId.value) return
  emit('issue-assignee-change', { iid: ctxIid.value, assignee_ids: [meId.value] })
  close()
}
function onUnassign () {
  if (!ctxIid.value || !canWrite.value) return
  emit('issue-assignee-change', { iid: ctxIid.value, assignee_ids: [] })
  close()
}
function onOpenTicket () {
  const n = props.node
  const url = getUrl(n)
  if (!url) return
  try { settings.graph.lastOpenedNodeId = n && n.id != null ? String(n.id) : null } catch { /* ignore */ }
  const t = settings?.uiState?.view?.issueOpenTarget
  const target = (t === '_blank' || t === '_self' || t === 'GitlabVizIssueTab') ? t : '_blank'
  close()
  window.open(url, target)
}

// Filter-by handlers — single-select replacements; pruning excludes prevents the
// just-added label from being simultaneously included AND excluded.
const setSingle = (key, value) => {
  if (!value) return
  settings.uiState.filters[key] = [value]
  close()
}
function onFilterAuthor    () { setSingle('selectedAuthors',    ctxAuthor.value) }
function onFilterAssignee  () { setSingle('selectedAssignees',  ctxAssignee.value) }
function onFilterMilestone () { setSingle('selectedMilestones', ctxMilestone.value) }
function onFilterStatus    () { setSingle('selectedStatuses',   ctxStatus.value) }
function onFilterPriority  () { setSingle('selectedPriorities', ctxPriority.value) }
function onFilterType      () { setSingle('selectedTypes',      ctxType.value) }

function onFilterLabel (lab) {
  const label = String(lab || '').trim()
  if (!label) return
  settings.uiState.filters.selectedLabels = [label]
  if (Array.isArray(settings.uiState.filters.excludedLabels)) {
    settings.uiState.filters.excludedLabels = settings.uiState.filters.excludedLabels.filter(x => x !== label)
  }
  close()
}
function onFilterSameLabelCombo () {
  const labels = ctxLabelsAll.value
  if (!labels.length) return
  settings.uiState.filters.selectedLabels = labels.slice()
  if (Array.isArray(settings.uiState.filters.excludedLabels) && settings.uiState.filters.excludedLabels.length) {
    const set = new Set(labels)
    settings.uiState.filters.excludedLabels = settings.uiState.filters.excludedLabels.filter(x => !set.has(x))
  }
  close()
}

// Close on outside-click / Escape. Capture-phase so we catch clicks before
// they reach other handlers; the rootEl check ignores clicks inside the menu.
const onMouseDown = (e) => {
  if (!props.visible) return
  if (rootEl.value && e?.target && rootEl.value.contains(e.target)) return
  close()
}
const onKeyDown = (e) => { if (props.visible && e?.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onMouseDown, true)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.issue-context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 260px;
  max-width: 320px;
  max-height: 70vh;
  overflow: auto;
  padding: 6px;
  border-radius: 0 10px 10px 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.98);
  color: rgba(0, 0, 0, 0.9);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  cursor: default;
}
.issue-context-menu__header {
  margin: -6px -6px 6px -6px;
  padding: 10px 12px 8px 12px;
  border-radius: 0 10px 0 0;
  border: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.10);
  border-left: 6px solid rgba(0, 0, 0, 0.18);
}
:global(html[data-theme="dark"]) .issue-context-menu__header {
  border-left-color: rgba(255, 255, 255, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.issue-context-menu__header-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.issue-context-menu__header-key {
  font-weight: 700; font-size: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.issue-context-menu__header-state {
  font-size: 10px; opacity: 0.8;
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 2px 6px; border-radius: 999px; white-space: nowrap;
}
:global(html[data-theme="dark"]) .issue-context-menu__header-state {
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.issue-context-menu__header-title {
  margin-top: 2px; font-size: 12px; opacity: 0.95;
  display: -webkit-box;
  line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.issue-context-menu__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; }
.issue-context-menu__grid .issue-context-menu__item { padding: 5px 8px; }
.issue-context-menu__grid--actions { margin-bottom: 2px; }
.issue-context-menu__item--warn { opacity: 0.9; }
:global(html[data-theme="dark"]) .issue-context-menu {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(20, 22, 26, 0.98);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
}
.issue-context-menu__section { display: flex; flex-direction: column; gap: 1px; }
.issue-context-menu__divider {
  height: 1px; margin: 5px 4px; background: rgba(0, 0, 0, 0.08);
}
:global(html[data-theme="dark"]) .issue-context-menu__divider { background: rgba(255, 255, 255, 0.10); }
.issue-context-menu__title {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; opacity: 0.75; padding: 2px 6px 2px 6px;
}
.issue-context-menu__title--row { justify-content: space-between; gap: 10px; }
.issue-context-menu__title-left { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.issue-context-menu__title-action {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit; cursor: pointer;
  border-radius: 999px; padding: 3px 8px;
  font-size: 11px; line-height: 1.1;
  user-select: none; -webkit-user-select: none; -ms-user-select: none;
  white-space: nowrap;
}
.issue-context-menu__title-action:hover { background: rgba(0, 0, 0, 0.06); }
:global(html[data-theme="dark"]) .issue-context-menu__title-action {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}
:global(html[data-theme="dark"]) .issue-context-menu__title-action:hover {
  background: rgba(255, 255, 255, 0.10);
}
.issue-context-menu__item-content { display: flex; align-items: center; gap: 8px; }
.issue-context-menu__icon { opacity: 0.85; }
.issue-context-menu__item {
  appearance: none; border: 0; background: transparent;
  color: inherit; text-align: left; cursor: pointer;
  padding: 6px 8px; border-radius: 8px;
  font-size: 12px; line-height: 1.2;
  user-select: none; -webkit-user-select: none; -ms-user-select: none;
}
.issue-context-menu__item:hover { background: rgba(0, 0, 0, 0.06); }
:global(html[data-theme="dark"]) .issue-context-menu__item:hover { background: rgba(255, 255, 255, 0.08); }
.issue-context-menu__item:disabled,
.issue-context-menu__item[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
.issue-context-menu__item:disabled:hover,
.issue-context-menu__item[aria-disabled="true"]:hover { background: transparent; }
.issue-context-menu__row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 8px; border-radius: 8px;
}
.issue-context-menu__row:hover { background: rgba(0, 0, 0, 0.04); }
:global(html[data-theme="dark"]) .issue-context-menu__row:hover { background: rgba(255, 255, 255, 0.06); }
.issue-context-menu__row-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; opacity: 0.85; white-space: nowrap;
}
.issue-context-menu__row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.issue-context-menu__pill {
  display: inline-flex; align-items: center; gap: 6px;
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit; cursor: pointer;
  border-radius: 999px; padding: 4px 8px;
  font-size: 11px; line-height: 1.1;
  user-select: none; -webkit-user-select: none; -ms-user-select: none;
}
.issue-context-menu__pill-icon { opacity: 0.9; }
.issue-context-menu__pill:hover { background: rgba(0, 0, 0, 0.06); }
:global(html[data-theme="dark"]) .issue-context-menu__pill {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}
:global(html[data-theme="dark"]) .issue-context-menu__pill:hover { background: rgba(255, 255, 255, 0.10); }
.issue-context-menu__chips {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 6px 2px 6px;
}
.issue-context-menu__chip {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit; cursor: pointer;
  border-radius: 999px; padding: 4px 10px;
  font-size: 11px; line-height: 1.1;
  user-select: none; -webkit-user-select: none; -ms-user-select: none;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.issue-context-menu__chip:hover { background: rgba(0, 0, 0, 0.06); }
:global(html[data-theme="dark"]) .issue-context-menu__chip {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}
:global(html[data-theme="dark"]) .issue-context-menu__chip:hover { background: rgba(255, 255, 255, 0.10); }
</style>
