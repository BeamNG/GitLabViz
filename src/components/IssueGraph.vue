<template>
  <div class="graph-wrapper">
    <div ref="container" class="graph-container">
      <canvas ref="canvas"></canvas>
    </div>
    <div
      v-if="contextMenu.visible"
      ref="contextMenuEl"
      class="issue-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @contextmenu.prevent
    >
      <div class="issue-context-menu__header" :style="contextHeaderStyle">
        <div class="issue-context-menu__header-top">
          <div class="issue-context-menu__header-key">
            {{ contextHeaderKey }}
          </div>
          <div v-if="contextHeaderState" class="issue-context-menu__header-state">
            {{ contextHeaderState }}
          </div>
        </div>
        <div class="issue-context-menu__header-title">
          {{ contextHeaderTitle }}
        </div>
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
            <button type="button" class="issue-context-menu__item" @click="onToggleIssueClosed">
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

            <button
              v-else
              type="button"
              class="issue-context-menu__item"
              @click="onUnassign"
            >
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
          <button
            v-if="contextIssueAuthor"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterAuthor"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-account-edit" size="x-small" class="issue-context-menu__icon" />
              <span>Author<br/>{{ contextIssueAuthor }}</span>
            </span>
          </button>
          <button
            v-if="contextIssueAssignee"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterAssignee"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-account" size="x-small" class="issue-context-menu__icon" />
              <span>Assignee <br/>{{ contextIssueAssignee }}</span>
            </span>
          </button>
          <button
            v-if="contextIssueMilestone"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterMilestone"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-flag" size="x-small" class="issue-context-menu__icon" />
              <span>Milestone<br/>{{ contextIssueMilestone }}</span>
            </span>
          </button>
          <button
            v-if="contextIssueStatus"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterStatus"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-list-status" size="x-small" class="issue-context-menu__icon" />
              <span>Status<br/>{{ contextIssueStatus }}</span>
            </span>
          </button>
          <button
            v-if="contextIssuePriority"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterPriority"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-alert-circle" size="x-small" class="issue-context-menu__icon" />
              <span>Priority<br/>{{ contextIssuePriority }}</span>
            </span>
          </button>
          <button
            v-if="contextIssueType"
            type="button"
            class="issue-context-menu__item"
            @click="onFilterType"
          >
            <span class="issue-context-menu__item-content">
              <v-icon icon="mdi-shape" size="x-small" class="issue-context-menu__icon" />
              <span>Type<br/>{{ contextIssueType }}</span>
            </span>
          </button>
        </div>
      </div>

      <template v-if="contextIssueLabels.length">
        <div class="issue-context-menu__divider"></div>
        <div class="issue-context-menu__section">
          <div class="issue-context-menu__title issue-context-menu__title--row">
            <span class="issue-context-menu__title-left">
              <v-icon icon="mdi-tag-multiple" size="x-small" class="issue-context-menu__icon" />
              <span>Filter by label</span>
            </span>
            <button
              type="button"
              class="issue-context-menu__title-action"
              title="Same label combination"
              @click="onFilterSameLabelCombo"
            >
              Same combo
            </button>
          </div>
          <div class="issue-context-menu__chips">
            <button
              v-for="lab in contextIssueLabels"
              :key="lab"
              type="button"
              class="issue-context-menu__chip"
              :title="`Filter by label: ${lab}`"
              @click="onFilterLabel(lab)"
            >
              {{ lab }}
            </button>
          </div>
        </div>
      </template>
    </div>
    <div v-if="(showLegend && (legendItems.length || legendGradient)) || showLinkLegend" class="legend">
      <div class="legend-title">
        <span>Legend</span>
        <div class="legend-controls">
          <label v-if="props.groupBy !== 'none' && props.groupBy !== 'svn_revision'" class="legend-toggle" title="Show group labels">
            <input v-model="showGroupLabels" type="checkbox">
            <span>Groups</span>
          </label>
          <div v-if="!legendGradient" class="legend-sort">
            <button type="button" class="legend-btn" :class="{ active: legendSort === 'name' }" @click="legendSort = 'name'">Name</button>
            <button type="button" class="legend-btn" :class="{ active: legendSort === 'count' }" @click="legendSort = 'count'">#</button>
          </div>
        </div>
      </div>
      <div v-if="legendGradient" class="legend-gradient">
        <div class="legend-gradient-bar" :style="{ background: legendGradient.css }"></div>
        <div class="legend-gradient-labels">
          <span class="legend-grad-min">{{ legendGradient.minLabel }}</span>
          <span class="legend-grad-max">{{ legendGradient.maxLabel }}</span>
        </div>
      </div>

      <div v-else-if="showLegend" class="legend-items">
        <div
          v-for="it in legendItems"
          :key="it.label"
          class="legend-item"
          @mouseenter="legendHoverKey = it.label"
          @mouseleave="legendHoverKey = null"
        >
          <span class="legend-swatch" :style="{ background: it.color }"></span>
          <span class="legend-label" :title="it.label">{{ it.label }}</span>
          <span class="legend-count">{{ it.count }}</span>
        </div>
      </div>

      <div v-if="showLinkLegend" class="link-legend">
        <div class="link-legend-title">Links</div>
        <div class="link-legend-items">
          <div v-for="(it, idx) in linkLegendItems" :key="idx" class="link-legend-item">
            <svg class="link-legend-swatch" viewBox="0 0 44 12" aria-hidden="true">
              <path :d="it.arrow ? 'M2 6 L34 6 M34 6 L29 2 M34 6 L29 10' : 'M2 6 L42 6'" :stroke="it.color" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="link-legend-label">{{ it.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, toRaw, nextTick } from 'vue'
import * as d3 from 'd3'
import { useSettingsStore } from '../composables/useSettingsStore'
import { getScopedLabelValue, getScopedLabelValues } from '../utils/scopedLabels'

const emit = defineEmits(['issue-state-change', 'issue-assignee-change'])

const props = defineProps({
  nodes: Object,
  edges: Object,
  colorMode: { type: String, default: 'state' }, // 'state' | 'tag' | 'author'
  groupBy: { type: String, default: 'none' }, // 'none' | 'tag' | 'author' | 'state' | 'scoped:<Prefix>'
  linkMode: { type: String, default: 'dependency' }, // 'none' | 'dependency' | 'group'
  hideUnlinked: { type: Boolean, default: false },
  physicsPaused: { type: Boolean, default: false },
  repulsion: { type: Number, default: 300 },
  friction: { type: Number, default: 0.6 },
  groupGravity: { type: Number, default: 0.2 },
  linkStrength: { type: Number, default: 0.5 },
  linkDistance: { type: Number, default: 250 },
  centerGravity: { type: Number, default: 0.01 },
  gridStrength: { type: Number, default: 0.08 },
  gridSpacing: { type: Number, default: 1.5 }
})

const container = ref(null)
const canvas = ref(null)
const contextMenuEl = ref(null)

const { settings } = useSettingsStore()

const contextMenu = ref({ visible: false, x: 0, y: 0, node: null, selectedNodeId: null })

const contextIssueRaw = computed(() => contextMenu.value.node?._raw || null)
const contextIssueIid = computed(() => {
  const raw = contextIssueRaw.value
  if (raw && raw.iid != null) return String(raw.iid)
  const n = contextMenu.value.node
  return n && n.id != null ? String(n.id) : ''
})
const canWrite = computed(() => !!settings?.meta?.gitlabCanWrite)
const meId = computed(() => {
  const v = settings?.meta?.gitlabMeId
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
})
const writeDisabledReason = computed(() => {
  if (canWrite.value) return ''
  const scopes = settings?.meta?.gitlabTokenScopes
  if (Array.isArray(scopes) && scopes.length) return `Read-only token (scopes: ${scopes.join(', ')}). Create a token with api scope to enable editing.`
  return 'Write disabled. Click "Test connection" in Configuration → GitLab to verify token scopes, and use a token with api scope to enable editing.'
})
const isContextIssueClosed = computed(() => String(contextIssueRaw.value?.state || '').toLowerCase() === 'closed')
const stateActionLabel = computed(() => (isContextIssueClosed.value ? 'Reopen ticket' : 'Close ticket'))
const stateActionIcon = computed(() => (isContextIssueClosed.value ? 'mdi-lock-open-variant' : 'mdi-lock'))
const stateActionEvent = computed(() => (isContextIssueClosed.value ? 'reopen' : 'close'))
const contextNodeColor = computed(() => contextMenu.value.node?.color || '')
const contextHeaderKey = computed(() => {
  const n = contextMenu.value.node
  const short = getIssueShorthand(n)
  if (short) return short
  const id = n && n.id != null ? String(n.id) : ''
  return id ? `#${id}` : ''
})
const contextHeaderTitle = computed(() => {
  const n = contextMenu.value.node
  const raw = n?._raw || {}
  const title = String(raw.title || '').trim()
  if (title) return title
  return String(n?.name || '').trim()
})
const contextHeaderState = computed(() => {
  const s = String(contextIssueRaw.value?.state || '').trim()
  return s ? s.toUpperCase() : ''
})
const contextHeaderStyle = computed(() => {
  const c = d3.color(contextNodeColor.value || '')
  const accent = c ? c.formatHex() : ''
  const bg = c ? (() => { const x = c.copy({ opacity: 0.14 }); return x.toString() })() : ''
  return {
    borderLeftColor: accent || undefined,
    background: bg || undefined
  }
})
const contextIssueAuthor = computed(() => contextIssueRaw.value?.author?.name || '')
const contextIssueAssignee = computed(() => {
  const raw = contextIssueRaw.value || {}
  const a = raw.assignee || (Array.isArray(raw.assignees) && raw.assignees.length ? raw.assignees[0] : null)
  return a?.name || ''
})
const contextAssigneeId = computed(() => {
  const raw = contextIssueRaw.value || {}
  const a = raw.assignee || (Array.isArray(raw.assignees) && raw.assignees.length ? raw.assignees[0] : null)
  const id = a && a.id != null ? Number(a.id) : NaN
  return Number.isFinite(id) ? id : null
})
const hasAssignee = computed(() => !!contextAssigneeId.value)
const isAssignedToMe = computed(() => !!meId.value && contextAssigneeId.value === meId.value)
const assigneeAction = computed(() => (hasAssignee.value ? 'unassign' : 'assign'))
const assignDisabledReason = computed(() => {
  if (!canWrite.value) return writeDisabledReason.value
  if (!meId.value) return 'Cannot resolve current GitLab user. Click "Refresh" or "Test connection" once to fetch /user.'
  return ''
})
const contextIssueMilestone = computed(() => contextIssueRaw.value?.milestone?.title || '')
const contextIssueStatus = computed(() => {
  const labels = contextIssueRaw.value?.labels || []
  const s = Array.isArray(labels)
    ? labels
      .filter(l => typeof l === 'string' && l.startsWith('Status::'))
      .map(l => l.substring('Status::'.length))
      .filter(Boolean)
    : []
  return s.length ? s[s.length - 1] : ''
})
const contextIssuePriority = computed(() => {
  const labels = contextIssueRaw.value?.labels || []
  const s = Array.isArray(labels)
    ? labels
      .filter(l => typeof l === 'string' && l.startsWith('Priority::'))
      .map(l => l.substring('Priority::'.length))
      .filter(Boolean)
    : []
  return s.length ? s[s.length - 1] : ''
})
const contextIssueType = computed(() => {
  const labels = contextIssueRaw.value?.labels || []
  const s = Array.isArray(labels)
    ? labels
      .filter(l => typeof l === 'string' && l.startsWith('Type::'))
      .map(l => l.substring('Type::'.length))
      .filter(Boolean)
    : []
  return s.length ? s[s.length - 1] : ''
})
const contextIssueLabels = computed(() => {
  const labels = contextIssueRaw.value?.labels || []
  if (!Array.isArray(labels)) return []
  return labels
    .filter(l => typeof l === 'string' && l.trim())
    .slice(0, 18)
})
const contextIssueLabelsAll = computed(() => {
  const labels = contextIssueRaw.value?.labels || []
  if (!Array.isArray(labels)) return []
  return labels
    .filter(l => typeof l === 'string' && l.trim())
    .slice(0, 60)
})

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

function closeContextMenu () {
  if (!contextMenu.value.visible) return
  contextMenu.value.visible = false
  contextMenu.value.node = null
  contextMenu.value.selectedNodeId = null
  scheduleRender()
}

function getNodeAtPointer (event) {
  const [clickX, clickY] = d3.pointer(event)
  const x = (clickX - transform.x) / transform.k
  const y = (clickY - transform.y) / transform.k
  const w = CAPSULE_WIDTH
  const h = CAPSULE_HEIGHT
  for (let i = nodesData.length - 1; i >= 0; i--) {
    const node = nodesData[i]
    const nx = node.x - w / 2
    const ny = node.y - h / 2
    if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) return node
  }
  return null
}

function openContextMenu (event, node) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const MENU_W = 260
  const MENU_H = 460
  const px = event.clientX - rect.left
  const py = event.clientY - rect.top
  contextMenu.value.node = node
  contextMenu.value.selectedNodeId = node && node.id != null ? String(node.id) : null
  contextMenu.value.x = clamp(px, 8, Math.max(8, rect.width - MENU_W - 8))
  contextMenu.value.y = clamp(py, 8, Math.max(8, rect.height - MENU_H - 8))
  contextMenu.value.visible = true
  nextTick(() => {})
  scheduleRender()
}

async function copyText (text) {
  const s = String(text || '')
  if (!s) return false
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(s)
      return true
    }
  } catch {
    // ignore, fallback below
  }
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

function getIssueUrl (node) {
  const raw = node?._raw || {}
  return raw.web_url || raw.webUrl || node.webUrl || node._raw?.web_url || ''
}

function getIssueShorthand (node) {
  const raw = node?._raw || {}
  const full = raw.references && typeof raw.references.full === 'string' ? raw.references.full : ''
  if (full) return full
  const rel = raw.references && typeof raw.references.relative === 'string' ? raw.references.relative : ''
  if (rel) {
    const pid = String(settings?.config?.projectId || '').trim()
    if (!pid) return rel
    // If relative already contains a path (rare), keep it; otherwise prefix with config project id.
    if (rel.includes('/')) return rel
    if (rel.startsWith('#')) return `${pid}${rel}`
    return `${pid}#${rel.replace(/^#/, '')}`
  }
  const pid = String(settings?.config?.projectId || '').trim()
  const id = node && node.id != null ? String(node.id) : ''
  return (pid && id) ? `${pid}#${id}` : ''
}

function getIssueSummary (node) {
  const raw = node?._raw || {}
  const title = String(raw.title || '').trim()
  const state = String(raw.state || '').trim()
  const assignee = raw.assignee && raw.assignee.name ? String(raw.assignee.name).trim() : ''
  const short = getIssueShorthand(node)
  const bits = []
  if (short) bits.push(short)
  if (title) bits.push(title)
  if (state) bits.push(`[${state}]`)
  if (assignee) bits.push(`(assignee: ${assignee})`)
  return bits.join(' ')
}

async function onCopyShorthand () {
  await copyText(getIssueShorthand(contextMenu.value.node))
  closeContextMenu()
}
async function onCopyUrl () {
  await copyText(getIssueUrl(contextMenu.value.node))
  closeContextMenu()
}
async function onCopyMarkdown () {
  const n = contextMenu.value.node
  const short = getIssueShorthand(n)
  const url = getIssueUrl(n)
  const title = String(n?._raw?.title || '').trim()
  const base = (short && url) ? `[${short}](${url})` : (short || url)
  const text = title ? `${base} - ${title}` : base
  await copyText(text)
  closeContextMenu()
}
async function onCopySummary () {
  await copyText(getIssueSummary(contextMenu.value.node))
  closeContextMenu()
}

function onToggleIssueClosed () {
  const iid = contextIssueIid.value
  if (!iid) return
  if (!canWrite.value) return
  emit('issue-state-change', { iid, state_event: stateActionEvent.value })
  closeContextMenu()
}

function onAssignToMe () {
  const iid = contextIssueIid.value
  if (!iid) return
  if (!canWrite.value || !meId.value) return
  emit('issue-assignee-change', { iid, assignee_ids: [meId.value] })
  closeContextMenu()
}

function onUnassign () {
  const iid = contextIssueIid.value
  if (!iid) return
  if (!canWrite.value) return
  emit('issue-assignee-change', { iid, assignee_ids: [] })
  closeContextMenu()
}

function onOpenTicket () {
  const n = contextMenu.value.node
  const url = getIssueUrl(n)
  if (!url) return
  try {
    settings.graph.lastOpenedNodeId = n && n.id != null ? String(n.id) : null
  } catch {
    // ignore
  }
  const rawTarget = settings?.uiState?.view?.issueOpenTarget
  const target = (rawTarget === '_blank' || rawTarget === '_self' || rawTarget === 'GitlabVizIssueTab')
    ? rawTarget
    : '_blank'
  closeContextMenu()
  window.open(url, target)
}

function onFilterAuthor () {
  const name = contextIssueAuthor.value
  if (!name) return
  settings.uiState.filters.selectedAuthors = [name]
  closeContextMenu()
}

function onFilterAssignee () {
  const name = contextIssueAssignee.value
  if (!name) return
  settings.uiState.filters.selectedAssignees = [name]
  closeContextMenu()
}

function onFilterMilestone () {
  const title = contextIssueMilestone.value
  if (!title) return
  settings.uiState.filters.selectedMilestones = [title]
  closeContextMenu()
}

function onFilterStatus () {
  const status = contextIssueStatus.value
  if (!status) return
  settings.uiState.filters.selectedStatuses = [status]
  closeContextMenu()
}

function onFilterPriority () {
  const p = contextIssuePriority.value
  if (!p) return
  settings.uiState.filters.selectedPriorities = [p]
  closeContextMenu()
}

function onFilterType () {
  const t = contextIssueType.value
  if (!t) return
  settings.uiState.filters.selectedTypes = [t]
  closeContextMenu()
}

function onFilterLabel (lab) {
  const label = String(lab || '').trim()
  if (!label) return
  settings.uiState.filters.selectedLabels = [label]
  if (Array.isArray(settings.uiState.filters.excludedLabels)) {
    settings.uiState.filters.excludedLabels = settings.uiState.filters.excludedLabels.filter(x => x !== label)
  }
  closeContextMenu()
}

function onFilterSameLabelCombo () {
  const labels = contextIssueLabelsAll.value
  if (!labels.length) return
  settings.uiState.filters.selectedLabels = labels.slice()
  if (Array.isArray(settings.uiState.filters.excludedLabels) && settings.uiState.filters.excludedLabels.length) {
    const set = new Set(labels)
    settings.uiState.filters.excludedLabels = settings.uiState.filters.excludedLabels.filter(x => !set.has(x))
  }
  closeContextMenu()
}

const legendItems = ref([])
const timelineLegend = ref(null) // { css, minLabel, maxLabel } | null
const numericLegend = ref(null) // { css, minLabel, maxLabel } | null
const legendGradient = computed(() => {
  if (props.colorMode && props.colorMode.startsWith('timeline_')) {
    return timelineLegend.value
  }
  if (props.colorMode === 'time_estimate' || props.colorMode === 'time_spent') {
    return numericLegend.value
  }
  const neutral = colors.value.neutralNode
  if (props.colorMode === 'upvotes') {
    return { css: `linear-gradient(90deg, ${neutral}, ${d3.interpolateBlues(1)})`, minLabel: '0', maxLabel: '10+' }
  }
  if (props.colorMode === 'merge_requests') {
    return { css: `linear-gradient(90deg, ${neutral}, ${d3.interpolatePurples(1)})`, minLabel: '0', maxLabel: '5+' }
  }
  if (props.colorMode === 'comments') {
    return { css: `linear-gradient(90deg, ${neutral}, ${d3.interpolateOranges(1)})`, minLabel: '0', maxLabel: '20+' }
  }
  if (props.colorMode === 'age') {
    return { css: `linear-gradient(90deg, ${d3.interpolateRdYlGn(1)}, ${d3.interpolateRdYlGn(0)})`, minLabel: 'New', maxLabel: 'Old' }
  }
  if (props.colorMode === 'last_updated') {
    return { css: `linear-gradient(90deg, ${d3.interpolateRdYlGn(1)}, ${d3.interpolateRdYlGn(0)})`, minLabel: 'Recent', maxLabel: 'Stale' }
  }
  if (props.colorMode === 'time_ratio') {
    // 0 (green) -> 1 (yellow) -> 2+ (red)
    return { css: 'linear-gradient(90deg, #388e3c, #fbc02d, #d32f2f)', minLabel: '0%', maxLabel: '200%+' }
  }
  return null
})

const showLinkLegend = computed(() => props.linkMode === 'dependency')
const isDarkTheme = computed(() => themeName.value === 'dark')

const getDepLinkStyle = (raw, fallback) => {
  const t = String(raw || '').toLowerCase()
  if (t.includes('block')) return { color: isDarkTheme.value ? 'rgba(255, 140, 90, 0.92)' : 'rgba(230, 120, 60, 0.92)', arrow: true, label: 'Blocks' }
  if (t.includes('depend')) return { color: isDarkTheme.value ? 'rgba(110, 190, 255, 0.92)' : 'rgba(30, 136, 229, 0.92)', arrow: true, label: 'Depends on' }
  if (t.includes('reference')) return { color: isDarkTheme.value ? 'rgba(186, 140, 255, 0.9)' : 'rgba(124, 77, 255, 0.9)', arrow: true, label: 'Referenced' }
  if (t.includes('relat')) return { color: fallback, arrow: false, label: 'Related' }
  return { color: fallback, arrow: true, label: 'Link' }
}

const linkLegendItems = computed(() => {
  if (!showLinkLegend.value) return []
  const fallback = colors.value.link
  return [
    getDepLinkStyle('blocks', fallback),
    getDepLinkStyle('depends', fallback),
    getDepLinkStyle('relates', fallback),
    getDepLinkStyle('referenced', fallback)
  ]
})

const showLegend = computed(() => (
  [
    'none',
    'state',
    'tag',
    'author',
    'assignee',
    'milestone',
    'priority',
    'type',
    'weight',
    'due_status',
    'budget_status',
    'estimate_bucket',
    'task_completion',
    'time_ratio',
    'time_estimate',
    'time_spent',
    'upvotes',
    'merge_requests',
    'comments',
    'age',
    'last_updated',
    'timeline_created',
    'timeline_updated',
    'timeline_closed'
  ].includes(props.colorMode)
))
const legendSort = computed({
  get: () => settings?.uiState?.view?.legendSort || 'name',
  set: (v) => { settings.uiState.view.legendSort = v }
})
const showGroupLabels = computed({
  get: () => settings?.uiState?.view?.showGroupLabels ?? true,
  set: (v) => { settings.uiState.view.showGroupLabels = !!v }
})
const legendHoverKey = ref(null)

const sortLegendItems = (items) => {
  const isWeight = props.colorMode === 'weight'
  const byName = (a, b) => {
    if (isWeight) {
      const na = Number(a.label)
      const nb = Number(b.label)
      const aNum = Number.isFinite(na)
      const bNum = Number.isFinite(nb)
      if (aNum && bNum) return na - nb
      if (aNum) return -1
      if (bNum) return 1
      if (a.label === 'No Weight') return 1
      if (b.label === 'No Weight') return -1
    }
    if (a.label === 'undefined') return 1
    if (b.label === 'undefined') return -1
    return String(a.label).localeCompare(String(b.label))
  }

  const list = items.slice()
  if (legendSort.value === 'count') list.sort((a, b) => (b.count - a.count) || byName(a, b))
  else list.sort(byName)
  return list
}

const onWindowBlur = () => { legendHoverKey.value = null }
const onWindowKeyDown = (e) => {
  if (!contextMenu.value.visible) return
  if (e && e.key === 'Escape') closeContextMenu()
}

const onGlobalMouseDown = (e) => {
  if (!contextMenu.value.visible) return
  const el = contextMenuEl.value
  if (el && e && e.target && el.contains(e.target)) return
  closeContextMenu()
}

const themeName = ref(document.documentElement.dataset.theme || 'light')
const lightColors = {
  canvasBg: '#f5f5f5',
  gridMinor: 'rgba(0,0,0,0.035)',
  gridMajor: 'rgba(0,0,0,0.06)',
  hullBase: (intensity) => `rgba(200, 200, 200, ${intensity})`,
  link: '#999',
  shadow: 'rgba(0,0,0,0.1)',
  nodeBg: '#ffffff',
  nodeBorder: '#dddddd',
  hoverShadow: 'rgba(0,0,0,0.3)',
  textId: '#555',
  textDim: '#999',
  textMain: '#202124',
  textMuted: '#5f6368',
  badgeOpenedBg: '#e6f4ea',
  badgeOpenedText: '#1e7e34',
  badgeClosedBg: '#f1f3f4',
  badgeClosedText: '#5f6368',
  badgeUnknownBg: '#f8f9fa',
  badgeUnknownText: '#666',
  labelBg: '#f0f0f0',
  labelText: '#444',
  neutralNode: '#dddddd'
}
const darkColors = {
  canvasBg: '#15181d',
  gridMinor: 'rgba(255,255,255,0.03)',
  gridMajor: 'rgba(255,255,255,0.055)',
  hullBase: (intensity) => `rgba(255, 255, 255, ${intensity * 0.35})`,
  link: 'rgba(255,255,255,0.25)',
  shadow: 'rgba(0,0,0,0.35)',
  nodeBg: '#1b1d1f',
  nodeBorder: '#3a3a3a',
  hoverShadow: 'rgba(0,0,0,0.6)',
  textId: '#c0c3c7',
  textDim: '#9aa0a6',
  textMain: '#e8eaed',
  textMuted: '#b0b3b8',
  badgeOpenedBg: '#14361f',
  badgeOpenedText: '#7ee787',
  badgeClosedBg: '#2a2d2e',
  badgeClosedText: '#c0c3c7',
  badgeUnknownBg: '#1b1d1f',
  badgeUnknownText: '#c0c3c7',
  labelBg: '#2a2d2e',
  labelText: '#e8eaed',
  neutralNode: '#666666'
}
const colors = computed(() => (themeName.value === 'dark' ? darkColors : lightColors))

const onThemeChanged = (e) => {
  const t = e && e.detail && e.detail.theme ? e.detail.theme : (document.documentElement.dataset.theme || 'light')
  themeName.value = t === 'dark' ? 'dark' : 'light'
  scheduleRender()
}

// D3 variables
let simulation
let transform = d3.zoomIdentity
let hoveredNodeId = null
let groupCenters = {} // Persist group centers for rendering
let containerResizeObserver = null
let renderRaf = 0

// Cached render layer for expensive group "smudge" hulls.
// Rebuilt on-demand (throttled) to keep big zooms responsive.
let hullCacheCanvas = null
let hullCacheKey = ''
let hullCacheAt = 0

function applyPhysicsPaused () {
  const paused = !!props.physicsPaused
  if (paused) {
    // Lock current positions in place
    nodesData.forEach(n => {
      if (!n) return
      const x = Number(n.x)
      const y = Number(n.y)
      n.fx = Number.isFinite(x) ? x : 0
      n.fy = Number.isFinite(y) ? y : 0
    })
    if (simulation) simulation.stop()
    scheduleRender()
    return
  }

  // Release locks and resume simulation
  nodesData.forEach(n => {
    if (!n) return
    n.fx = null
    n.fy = null
  })
  if (simulation) simulation.alpha(1).restart()
  scheduleRender()
}

function scheduleRender () {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0
    render()
  })
}

// Color Scale
const colorScale = d3.scaleOrdinal(d3.schemeTableau10)

// Status palette: known statuses use fixed colors; everything else gets a stable palette color.
const statusPalette = d3.scaleOrdinal([...(d3.schemeSet3 || []), ...d3.schemeTableau10])
const statusColors = {
  'to do': '#6c757d',
  'in progress': '#007bff',
  'ready for review': '#fd7e14',
  'done': '#28a745',
  "won't do": '#dc3545',
  'duplicate': '#dc3545'
}

// Layout Constants
const CAPSULE_WIDTH = 260
const CAPSULE_HEIGHT = 120
const SPACING_X = 280
const SPACING_Y = 140
const HULL_STROKE_WIDTH = 300 // Increased from 220 for bigger hull
const LABEL_PADDING = 40      // Padding between hull and label

onMounted(() => {
  window.addEventListener('app-theme-changed', onThemeChanged)
  initGraph()
  if (props.nodes && Object.keys(props.nodes).length > 0) {
    updateGraph()
  }
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('mousedown', onGlobalMouseDown, true)

  // Canvas needs to resize when the sidebar toggles (container size changes without window resize)
  if (typeof ResizeObserver !== 'undefined') {
    containerResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => resizeCanvas())
    })
    if (container.value) containerResizeObserver.observe(container.value)
  }
})

onUnmounted(() => {
  if (simulation) simulation.stop()
  window.removeEventListener('app-theme-changed', onThemeChanged)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('mousedown', onGlobalMouseDown, true)
  if (containerResizeObserver) {
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }
})

watch(() => [props.nodes, props.edges, props.colorMode, props.groupBy, props.linkMode, props.hideUnlinked, props.repulsion, props.friction, props.groupGravity, props.linkStrength, props.linkDistance, props.centerGravity, props.gridStrength, props.gridSpacing], () => {
  updateGraph()
}, { deep: true })

watch(() => props.physicsPaused, () => {
  applyPhysicsPaused()
})

watch(legendSort, () => {
  if (!legendItems.value.length) return
  legendItems.value = sortLegendItems(legendItems.value)
})

watch(legendHoverKey, () => {
  scheduleRender()
})

watch(() => showGroupLabels.value, () => {
  scheduleRender()
})

function initGraph() {
  if (!container.value) return

  // Canvas Setup
  resizeCanvas()

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.01, 4]) // Allow much deeper zoom out
    .on("zoom", (event) => {
      transform = event.transform
      saveTransform(transform)
      // Use requestAnimationFrame but debounce/throttle if needed
      // For now just RAF
      scheduleRender()
    })
    
  // Click handler
  d3.select(canvas.value)
    .on('mousemove', (event) => {
        if (contextMenu.value.visible) return
        // Account for zoom transform
        const [mouseX, mouseY] = d3.pointer(event)
        const x = (mouseX - transform.x) / transform.k
        const y = (mouseY - transform.y) / transform.k
        
        const w = CAPSULE_WIDTH
        const h = CAPSULE_HEIGHT
        
        let found = null
        for (let i = nodesData.length - 1; i >= 0; i--) {
            const node = nodesData[i]
            const nx = node.x - w/2
            const ny = node.y - h/2
            if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
                found = node.id
                break
            }
        }
        
        if (hoveredNodeId !== found) {
            hoveredNodeId = found
            canvas.value.style.cursor = found ? 'pointer' : 'grab'
            scheduleRender() // Re-render for hover effect
        }
    })
    .on('contextmenu', (event) => {
      if (event && event.preventDefault) event.preventDefault()
      if (event && event.stopPropagation) event.stopPropagation()
      const node = getNodeAtPointer(event)
      if (!node) {
        closeContextMenu()
        return
      }
      openContextMenu(event, node)
    })
    .on('auxclick', (event) => {
      // Middle click should open in a new tab (even if "reuse tab" is enabled).
      // Use auxclick so it works consistently across browsers.
      if (!event || event.button !== 1) return
      if (event.preventDefault) event.preventDefault()

      const [clickX, clickY] = d3.pointer(event)
      const x = (clickX - transform.x) / transform.k
      const y = (clickY - transform.y) / transform.k

      const w = CAPSULE_WIDTH
      const h = CAPSULE_HEIGHT
      for (let i = nodesData.length - 1; i >= 0; i--) {
        const node = nodesData[i]
        const nx = node.x - w/2
        const ny = node.y - h/2
        if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
          if (node._raw && node._raw.web_url) {
            settings.graph.lastOpenedNodeId = node.id
            scheduleRender()
            window.open(node._raw.web_url, '_blank')
          }
          return
        }
      }
    })
    .on('dblclick', (event) => {
    // Prevent D3 zoom from also handling the double click (which causes "creeping zoom")
    if (event && event.preventDefault) event.preventDefault()
    if (event && event.stopImmediatePropagation) event.stopImmediatePropagation()
    else if (event && event.stopPropagation) event.stopPropagation()

    // Account for zoom transform
    const [clickX, clickY] = d3.pointer(event)
    const x = (clickX - transform.x) / transform.k
    const y = (clickY - transform.y) / transform.k
    
    // Find clicked node
    const w = CAPSULE_WIDTH
    const h = CAPSULE_HEIGHT
    
    // Reverse iterate to hit top-most node first
    for (let i = nodesData.length - 1; i >= 0; i--) {
        const node = nodesData[i]
        const nx = node.x - w/2
        const ny = node.y - h/2
        
        if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
            if (node._raw.web_url) {
                settings.graph.lastOpenedNodeId = node.id
                scheduleRender()
                const rawTarget = settings?.uiState?.view?.issueOpenTarget
                const target = (rawTarget === '_blank' || rawTarget === '_self' || rawTarget === 'GitlabVizIssueTab')
                  ? rawTarget
                  : '_blank'
                window.open(node._raw.web_url, target)
            }
            return // Stop after first hit
        }
    }
  })

  d3.select(canvas.value)
    .call(zoom)
    // Prevent double click zoom (must be after call(zoom) because call(zoom) attaches dblclick.zoom)
    .on('dblclick.zoom', null)
    
      // Restore saved transform
  const t = settings.graph && settings.graph.transform ? settings.graph.transform : null
  if (t) {
    const x = Number(t.x)
    const y = Number(t.y)
    const k = Number(t.k)
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(k)) {
      const initialTransform = d3.zoomIdentity.translate(x, y).scale(k)
      d3.select(canvas.value).call(zoom.transform, initialTransform)
    } else {
      console.warn('Invalid saved transform, resetting view', t)
      settings.graph.transform = null
      d3.select(canvas.value)
        .call(zoom.transform, d3.zoomIdentity.translate(container.value.clientWidth / 2, container.value.clientHeight / 2).scale(0.5))
    }
  } else {
    // Center initial view
    d3.select(canvas.value)
      .call(zoom.transform, d3.zoomIdentity.translate(container.value.clientWidth / 2, container.value.clientHeight / 2).scale(0.5))
  }
}

// Debounce save transform
let saveTimeout
function saveTransform(t) {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
        settings.graph.transform = { k: t.k, x: t.x, y: t.y }
    }, 500)
}

function resizeCanvas() {
  if (!container.value || !canvas.value) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  const dpr = window.devicePixelRatio || 1
  
  // Set actual size in memory (scaled to account for extra pixel density)
  canvas.value.width = Math.floor(width * dpr)
  canvas.value.height = Math.floor(height * dpr)
  
  // Normalize coordinate system to use css pixels
  // canvas.value.getContext('2d').scale(dpr, dpr) 
  // Wait, if we scale here, we need to handle it in render() differently.
  // The common pattern is:
  // 1. width = cssWidth * dpr
  // 2. height = cssHeight * dpr
  // 3. style.width = cssWidth
  // 4. style.height = cssHeight
  // 5. ctx.scale(dpr, dpr)
  
  canvas.value.style.width = width + 'px'
  canvas.value.style.height = height + 'px'
  
  // Trigger re-render to apply scale
  if (simulation) scheduleRender()
}

// Data refs needed for rendering loop
let nodesData = []
let edgesData = []
let lastGroupBy = null
let dataOnlyUpdateOnce = false

function updateGraph() {
  if (!props.nodes) return

  const neutralNode = colors.value.neutralNode
  const isSvnRevisionMode = props.groupBy === 'svn_revision'
  const layoutModeChanged = lastGroupBy !== props.groupBy
  lastGroupBy = props.groupBy

  const formatSecondsShort = (secs) => {
    const s = Number(secs) || 0
    if (s <= 0) return '0'
    const minutes = Math.round(s / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.round(hours / 24)
    return `${days}d`
  }

  // Preserve previous positions/physics by id so "data refresh" (ex: context menu edits)
  // doesn't reset the graph layout.
  const prevById = new Map(nodesData.map(n => [String(n.id), n]))

  const getWeekYear = (dateStr) => {
    if (!dateStr) return 'No Date'
    const d = new Date(dateStr)
    const onejan = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
  }

  const applyColor = (node) => {
    // Assign Color
    // "none" = default coloring (only open/closed), no Status:: label overrides
    if (props.colorMode === 'none') {
      node.color = node.state === 'opened' ? '#28a745' : '#dc3545'
      node.displayTag = null
    } else if (props.colorMode === 'due_status') {
      const dueRaw = node.dueDate || node._raw?.due_date || node._raw?.dueDate || null
      const due = dueRaw ? new Date(dueRaw) : null
      const dueMs = due && Number.isFinite(due.getTime()) ? due.getTime() : null
      const soonDays = Math.max(1, Number(settings?.uiState?.view?.dueSoonDays) || 7)
      const soonMs = soonDays * 24 * 60 * 60 * 1000
      const nowMs = Date.now()
      if (!dueMs) {
        node.color = neutralNode
        node.displayTag = null
        node._legendKey = 'No due date'
      } else if (dueMs < nowMs) {
        node.color = '#d32f2f'
        node.displayTag = 'Overdue'
        node._legendKey = 'Overdue'
      } else if (dueMs - nowMs <= soonMs) {
        node.color = '#f57c00'
        node.displayTag = 'Due soon'
        node._legendKey = 'Due soon'
      } else {
        node.color = '#388e3c'
        node.displayTag = 'Due later'
        node._legendKey = 'Due later'
      }
    } else if (props.colorMode === 'tag') {
      node.color = node.tag === '_no_tag_' ? neutralNode : colorScale(node.tag)
      node.displayTag = node.tag
    } else if (props.colorMode === 'author') {
      node.color = colorScale(node.authorName)
      node.displayTag = node.authorName
    } else if (props.colorMode === 'assignee') {
      node.color = node.assigneeName === 'Unassigned' ? neutralNode : colorScale(node.assigneeName)
      node.displayTag = node.assigneeName
    } else if (props.colorMode === 'milestone') {
      node.color = node.milestoneTitle === 'No Milestone' ? neutralNode : colorScale(node.milestoneTitle)
      node.displayTag = node.milestoneTitle
    } else if (props.colorMode === 'priority') {
      node.color = node.priority === 'No Priority' ? neutralNode : colorScale(node.priority)
      node.displayTag = node.priority
    } else if (props.colorMode === 'type') {
      node.color = node.type === 'No Type' ? neutralNode : colorScale(node.type)
      node.displayTag = node.type
    } else if (props.colorMode === 'weight') {
      node.color = node.weight === 'No Weight' ? neutralNode : colorScale(node.weight)
      node.displayTag = node.weight
    } else if (props.colorMode === 'time_estimate') {
      const v = Number(node.timeEstimate) || 0
      node._numericT = v > 0 ? v : null
      node.color = neutralNode
      node.displayTag = v > 0 ? formatSecondsShort(v) : null
    } else if (props.colorMode === 'time_spent') {
      const v = Number(node.timeSpent) || 0
      node._numericT = v > 0 ? v : null
      node.color = neutralNode
      node.displayTag = v > 0 ? formatSecondsShort(v) : null
    } else if (props.colorMode === 'budget_status') {
      const est = Number(node.timeEstimate) || 0
      const spent = Number(node.timeSpent) || 0
      if (est <= 0) {
        node.color = neutralNode
        node.displayTag = 'No Est.'
        node._legendKey = 'No estimate'
      } else if (spent > est) {
        node.color = '#d32f2f'
        node.displayTag = 'Over'
        node._legendKey = 'Over budget'
      } else {
        node.color = '#388e3c'
        node.displayTag = 'Within'
        node._legendKey = 'Within budget'
      }
    } else if (props.colorMode === 'estimate_bucket') {
      const est = Number(node.timeEstimate) || 0
      const h = est / 3600
      let key = 'No estimate'
      let color = neutralNode
      if (est <= 0) {
        key = 'No estimate'
        color = neutralNode
      } else if (h < 1) {
        key = '<1h'
        color = '#90caf9'
      } else if (h < 4) {
        key = '1–4h'
        color = '#42a5f5'
      } else if (h < 8) {
        key = '4–8h'
        color = '#1e88e5'
      } else if (h < 24) {
        key = '1–3d'
        color = '#1565c0'
      } else {
        key = '3d+'
        color = '#0d47a1'
      }
      node.color = color
      node.displayTag = est > 0 ? formatSecondsShort(est) : null
      node._legendKey = key
    } else if (props.colorMode === 'task_completion') {
      const tcs = node._raw?.task_completion_status || node._raw?.taskCompletionStatus || null
      const count = Number(tcs?.count) || 0
      const done = Number(tcs?.completed_count ?? tcs?.completedCount) || 0
      if (count <= 0) {
        node.color = neutralNode
        node.displayTag = null
        node._legendKey = 'No tasks'
      } else if (done <= 0) {
        node.color = '#d32f2f'
        node.displayTag = `${done}/${count}`
        node._legendKey = '0% done'
      } else if (done >= count) {
        node.color = '#388e3c'
        node.displayTag = `${done}/${count}`
        node._legendKey = '100% done'
      } else {
        node.color = '#fbc02d'
        node.displayTag = `${done}/${count}`
        node._legendKey = 'In progress'
      }
    } else if (props.colorMode === 'time_ratio') {
      // Continuous scale for time ratio: 0 (green) -> 1 (yellow) -> >1 (red)
      const ratio = node.timeSpentRatio || 0
      if (ratio === 0 && node.timeEstimate === 0) node.color = neutralNode
      else if (ratio <= 1) node.color = d3.interpolateRdYlGn(1 - ratio) // Green to Red (reversed)? No, usually 100% spent is limit.
      // Let's do: 0=Green, 1=Yellow, 2+=Red
      else node.color = '#d32f2f' // Over budget
      
      // Better scale: interpolateYlGn(1-ratio) for under budget?
      // Simple: 
      if (node.timeEstimate === 0) {
        node.color = neutralNode
        node.displayTag = 'No Est.'
      } else {
        const pct = Math.round(ratio * 100)
        node.displayTag = `${pct}%`
        if (ratio > 1.1) node.color = '#d32f2f' // Red (Over)
        else if (ratio > 0.9) node.color = '#fbc02d' // Yellow (Warning)
        else node.color = '#388e3c' // Green (Good)
      }
    } else if (props.colorMode === 'upvotes') {
      node.color = node.upvotes > 0 ? d3.interpolateBlues(Math.min(1, node.upvotes / 10)) : neutralNode
      node.displayTag = node.upvotes > 0 ? `+${node.upvotes}` : null
    } else if (props.colorMode === 'merge_requests') {
      node.color = node.mergeRequestsCount > 0 ? d3.interpolatePurples(Math.min(1, node.mergeRequestsCount / 5)) : neutralNode
      node.displayTag = node.mergeRequestsCount > 0 ? `${node.mergeRequestsCount} MRs` : null
    } else if (props.colorMode === 'comments') {
      node.color = node.commentsCount > 0 ? d3.interpolateOranges(Math.min(1, node.commentsCount / 20)) : neutralNode
      node.displayTag = node.commentsCount > 0 ? `${node.commentsCount} 💬` : null
    } else if (props.colorMode === 'age') {
      // Newer = Green, Older = Red
      // Scale: 0 days -> 365 days
      const maxAge = 365
      const normalized = Math.min(node.ageDays, maxAge) / maxAge
      node.color = d3.interpolateRdYlGn(1 - normalized)
      node.displayTag = `${node.ageDays}d`
    } else if (props.colorMode === 'last_updated') {
      // Recently updated = Green, Stale = Red
      // Scale: 0 days -> 180 days
      const maxStale = 180
      const normalized = Math.min(node.daysSinceUpdate, maxStale) / maxStale
      node.color = d3.interpolateRdYlGn(1 - normalized)
      node.displayTag = `${node.daysSinceUpdate}d`
    } else if (props.colorMode && props.colorMode.startsWith('timeline_')) {
      // Color by date range (old -> red, new -> green). Applied after we compute min/max.
      const field =
        props.colorMode === 'timeline_created' ? 'created_at' :
        props.colorMode === 'timeline_updated' ? 'updated_at' :
        'closed_at'
      const d = node._raw && node._raw[field] ? new Date(node._raw[field]) : null
      node._timelineT = d && Number.isFinite(d.getTime()) ? d.getTime() : null
      node.color = neutralNode
      node.displayTag = null
    } else {
      // Status / State (with Status:: label overrides)
      node.color = node.state === 'opened' ? '#28a745' : '#dc3545' // default
      const s = typeof node.statusLabel === 'string' ? node.statusLabel.trim() : ''
      const sl = s.toLowerCase()
      if (node.state === 'opened' && s) {
        node.color = statusColors[sl] || statusPalette(s)
      }

      node.displayTag = null // Don't show extra tag for state
    }
  }

  // 1. Prepare Data
  nodesData = Object.values(toRaw(props.nodes)).flatMap(n => {
    const baseId = n && n.id != null ? String(n.id) : ''
    const raw = n?._raw || {}

    const labelsRaw = raw.labels || []
    const labels = Array.isArray(labelsRaw)
      ? labelsRaw.filter(l => typeof l === 'string' && l.trim()).map(l => l.trim())
      : []

    // Compute all group keys up front so we can duplicate nodes (and preserve positions by clone id).
    const groupBy = props.groupBy
    let groupKeys = null

    if (groupBy === 'tag') {
      groupKeys = labels.length ? labels : ['_no_tag_']
    } else if (groupBy === 'state') {
      const statusKeys = getScopedLabelValues(labels, 'Status')
      groupKeys = statusKeys.length ? statusKeys : [String(raw.state || '').toLowerCase() === 'closed' ? 'Done' : 'To do']
    } else if (groupBy === 'priority') {
      const keys = getScopedLabelValues(labels, 'Priority')
      groupKeys = keys.length ? keys : ['No Priority']
    } else if (groupBy === 'type') {
      const keys = getScopedLabelValues(labels, 'Type')
      groupKeys = keys.length ? keys : ['No Type']
    } else if (groupBy && groupBy.startsWith('scoped:')) {
      const prefix = groupBy.substring('scoped:'.length)
      const keys = getScopedLabelValues(labels, prefix)
      groupKeys = keys.length ? keys : [`No ${prefix}`]
    } else if (groupBy === 'stale') {
      // based on node.daysSinceUpdate (computed below) but we can compute from raw here
      const now = new Date()
      const updated = raw.updated_at ? new Date(raw.updated_at) : null
      const diffTime = updated ? Math.abs(now - updated) : 0
      const diffDays = updated ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0
      if (diffDays > 90) groupKeys = ['> 90 Days Stale']
      else if (diffDays > 60) groupKeys = ['> 60 Days Stale']
      else if (diffDays > 30) groupKeys = ['> 30 Days Stale']
      else groupKeys = ['Active (< 30 Days)']
    } else if (groupBy === 'timeline_created') {
      groupKeys = [getWeekYear(raw.created_at)]
    } else if (groupBy === 'timeline_updated') {
      groupKeys = [getWeekYear(raw.updated_at)]
    } else if (groupBy === 'timeline_closed') {
      groupKeys = [getWeekYear(raw.closed_at)]
    } else {
      groupKeys = ['default']
    }

    // De-dupe while preserving order
    const seen = new Set()
    groupKeys = groupKeys.filter(k => {
      const key = String(k == null ? '' : k).trim() || 'Unknown'
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).map(k => String(k == null ? '' : k).trim() || 'Unknown')

    const makeId = (groupKey, idx) => {
      if (groupKeys.length <= 1) return baseId
      // Make a stable clone id so we preserve layout across refreshes.
      const key = String(groupKey == null ? '' : groupKey).trim() || 'Unknown'
      return `${baseId}::${groupBy}::${key}${idx ? `#${idx}` : ''}`
    }

    return groupKeys.map((groupKey, idx) => {
      const id = makeId(groupKey, idx)
      const prev = layoutModeChanged ? null : prevById.get(id)
      const node = prev || {}
      const hadPrev = !!prev
      const x = node.x, y = node.y, vx = node.vx, vy = node.vy, fx = node.fx, fy = node.fy

      Object.assign(node, n)
      node.id = id
      node._baseId = baseId
      node._groupKey = groupKey
      node._hadPrev = hadPrev
      if (hadPrev) {
        // Preserve current physics state
        node.x = x; node.y = y
        node.vx = vx; node.vy = vy
        node.fx = fx; node.fy = fy
      }

      // Extract metadata
      node.tags = labels
      node.tag = labels.length > 0 ? labels[0] : '_no_tag_'
      node.authorName = raw.author ? raw.author.name : 'Unknown'
      node.assigneeName = raw.assignee ? raw.assignee.name : 'Unassigned'
      node.milestoneTitle = raw.milestone ? raw.milestone.title : 'No Milestone'
      node.state = raw.state
      // Status is a scoped label (Status::... / Status:...). If multiple exist, prefer the last one.
      node.statusLabel = getScopedLabelValue(labels, 'Status')
      node.priority = getScopedLabelValue(labels, 'Priority') || 'No Priority'
      node.type = getScopedLabelValue(labels, 'Type') || 'No Type'
      node.weight = raw.weight != null ? String(raw.weight) : 'No Weight'
      // Epic can come from:
      // - GitLab "epic" field (if available)
      // - a scoped label like Epic::Something (common in setups without Epics)
      const epicFromApi = raw?.epic?.title
      // Newer GitLab: epics can show up as parent work items.
      const parentType = String(raw?.parent?.work_item_type || '').trim().toLowerCase()
      const epicFromParent = parentType === 'epic' ? raw?.parent?.title : null
      const epicFromIid = raw?.epic_iid != null ? `Epic #${raw.epic_iid}` : null
      const epicFromLabel = getScopedLabelValue(labels, 'Epic')
      node.epic = epicFromApi || epicFromParent || epicFromIid || epicFromLabel || 'No Epic'
      node.iteration = raw.iteration ? raw.iteration.title : 'No Iteration'

      // Calculate staleness (days since last update)
      const now = new Date()
      const updated = raw.updated_at ? new Date(raw.updated_at) : null
      const diffTime = updated ? Math.abs(now - updated) : 0
      const diffDays = updated ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0
      node.daysSinceUpdate = diffDays

      const created = raw.created_at ? new Date(raw.created_at) : null
      const ageDiff = created ? Math.abs(now - created) : 0
      const ageDays = created ? Math.ceil(ageDiff / (1000 * 60 * 60 * 24)) : 0
      node.ageDays = ageDays

      // If this issue is duplicated across groups, make the per-copy metadata match the group.
      if (groupBy === 'tag') node.tag = groupKey
      else if (groupBy === 'state') node.statusLabel = groupKey
      else if (groupBy === 'priority') node.priority = groupKey
      else if (groupBy === 'type') node.type = groupKey

      applyColor(node)
      return node
    })
  })

  // Clear "last opened" highlight if that node no longer exists in the graph
  const last = settings?.graph?.lastOpenedNodeId
  if (last != null && !nodesData.some(n => String(n.id) === String(last))) {
    settings.graph.lastOpenedNodeId = null
  }

  // Apply timeline coloring + legend once we know min/max dates.
  timelineLegend.value = null
  numericLegend.value = null

  if (props.colorMode === 'time_estimate' || props.colorMode === 'time_spent') {
    const values = nodesData.map(n => n._numericT).filter(v => Number.isFinite(v) && v > 0)
    const maxV = values.length ? Math.max(...values) : null
    if (maxV != null && maxV > 0) {
      const scale = d3.scaleSqrt().domain([0, maxV]).range([0, 1])
      const interp = props.colorMode === 'time_estimate' ? d3.interpolateBlues : d3.interpolateOranges
      nodesData.forEach(n => {
        if (!Number.isFinite(n._numericT) || n._numericT <= 0) {
          n.color = neutralNode
          return
        }
        n.color = interp(scale(n._numericT))
      })
      numericLegend.value = {
        css: `linear-gradient(90deg, ${neutralNode}, ${interp(1)})`,
        minLabel: '0',
        maxLabel: formatSecondsShort(maxV)
      }
    } else {
      numericLegend.value = {
        css: `linear-gradient(90deg, ${neutralNode}, ${neutralNode})`,
        minLabel: '0',
        maxLabel: '0'
      }
    }
  }

  if (props.colorMode && props.colorMode.startsWith('timeline_')) {
    const times = nodesData.map(n => n._timelineT).filter(Number.isFinite)
    const minT = times.length ? Math.min(...times) : null
    const maxT = times.length ? Math.max(...times) : null
    if (minT != null && maxT != null && minT !== maxT) {
      const scale = d3.scaleLinear().domain([minT, maxT]).range([0, 1])
      nodesData.forEach(n => {
        if (!Number.isFinite(n._timelineT)) return
        n.color = d3.interpolateRdYlGn(scale(n._timelineT))
      })
      const minLabel = new Date(minT).toLocaleDateString()
      const maxLabel = new Date(maxT).toLocaleDateString()
      timelineLegend.value = {
        css: `linear-gradient(90deg, ${d3.interpolateRdYlGn(0)}, ${d3.interpolateRdYlGn(1)})`,
        minLabel,
        maxLabel
      }
    } else if (minT != null && maxT != null) {
      // Single date: still show a legend.
      const label = new Date(minT).toLocaleDateString()
      timelineLegend.value = {
        css: `linear-gradient(90deg, ${d3.interpolateRdYlGn(0.5)}, ${d3.interpolateRdYlGn(0.5)})`,
        minLabel: label,
        maxLabel: label
      }
    }
  }

  // Legend (right side): only for categorical color modes
  if (showLegend.value) {
    // No hover highlight for gradient legends
    if (legendGradient.value) legendHoverKey.value = null

    const keyFor = (n) => {
      if (props.colorMode === 'none') return n.state || 'Unknown'
      if (props.colorMode === 'state') return n.statusLabel || (n.state === 'closed' ? 'Closed' : 'Open')
      if (props.colorMode === 'tag') return n.tag
      if (props.colorMode === 'author') return n.authorName
      if (props.colorMode === 'assignee') return n.assigneeName
      if (props.colorMode === 'milestone') return n.milestoneTitle
      if (props.colorMode === 'priority') return n.priority
      if (props.colorMode === 'type') return n.type
      if (props.colorMode === 'weight') return n.weight
      if (props.colorMode === 'due_status') return n._legendKey || 'Unknown'
      if (props.colorMode === 'budget_status') return n._legendKey || 'Unknown'
      if (props.colorMode === 'estimate_bucket') return n._legendKey || 'Unknown'
      if (props.colorMode === 'task_completion') return n._legendKey || 'Unknown'
      return null
    }

    if (legendGradient.value) {
      legendItems.value = []
    } else {
      const counts = new Map()
      const colorsBy = new Map()
      nodesData.forEach(n => {
        const k = keyFor(n)
        const key = (k == null || k === '') ? 'Unknown' : k
        n._legendKey = key
        counts.set(key, (counts.get(key) || 0) + 1)
        if (!colorsBy.has(key)) colorsBy.set(key, n.color || colors.value.neutralNode)
      })

      const items = Array.from(colorsBy.entries())
        .map(([label, color]) => ({ label, color, count: counts.get(label) || 0 }))

      legendItems.value = sortLegendItems(items)
    }
  } else {
    legendItems.value = []
  }
  
  edgesData = Object.values(toRaw(props.edges)).map(e => ({ ...e }))

  // If we duplicated nodes (same issue drawn multiple times), expand edges to point at all copies.
  // Keeps "hide unlinked" and link rendering behaving as expected.
  const hasClones = nodesData.some(n => n && n._baseId != null && String(n._baseId) !== String(n.id))
  if (hasClones) {
    const cloneIdsByBaseId = new Map()
    nodesData.forEach(n => {
      const base = n && n._baseId != null ? String(n._baseId) : String(n.id)
      const list = cloneIdsByBaseId.get(base) || []
      list.push(String(n.id))
      cloneIdsByBaseId.set(base, list)
    })

    const expanded = []
    edgesData.forEach(e => {
      const sourceBase = String(typeof e.source === 'object' ? e.source.id : e.source)
      const targetBase = String(typeof e.target === 'object' ? e.target.id : e.target)
      const srcs = cloneIdsByBaseId.get(sourceBase) || [sourceBase]
      const tgts = cloneIdsByBaseId.get(targetBase) || [targetBase]
      const baseEdgeId = e.id != null ? String(e.id) : `${sourceBase}->${targetBase}`
      srcs.forEach(sid => {
        tgts.forEach(tid => {
          expanded.push({
            ...e,
            id: `${baseEdgeId}::${sid}::${tid}`,
            source: sid,
            target: tid
          })
        })
      })
    })
    edgesData = expanded
  }

  // Hide nodes with no links (dependency mode only)
  if (props.linkMode === 'dependency' && props.hideUnlinked) {
    const linked = new Set()
    edgesData.forEach(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      if (s != null) linked.add(String(s))
      if (t != null) linked.add(String(t))
    })
    nodesData = nodesData.filter(n => n?._uiForceShow || linked.has(String(n.id)))
    const keep = new Set(nodesData.map(n => String(n.id)))
    edgesData = edgesData.filter(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      return keep.has(String(s)) && keep.has(String(t))
    })
  }

  // Data-only refresh (context menu edits): keep positions and do NOT tick physics.
  // App sets a one-shot flag before updating a ticket's _raw payload.
  if (dataOnlyUpdateOnce && simulation && !layoutModeChanged) {
    dataOnlyUpdateOnce = false
    simulation.stop()
    // Keep simulation in sync for optional manual reflow later.
    simulation.nodes(nodesData)
    const lf = simulation.force && simulation.force('link')
    if (lf && typeof lf.links === 'function') lf.links(edgesData)
    scheduleRender()
    return
  }
  dataOnlyUpdateOnce = false

  // --- Initial Layout (Grid) ---
  const cols = Math.ceil(Math.sqrt(nodesData.length))
  nodesData.forEach((node, index) => {
    if (!layoutModeChanged && node._hadPrev) return
    const col = index % cols
    const row = Math.floor(index / cols)
    node.x = (col - cols / 2) * SPACING_X
    node.y = (row - cols / 2) * SPACING_Y
  })

  // Special layout for SVN revision timeline: old (left) -> new (right)
  if (isSvnRevisionMode) {
    const svnNodes = nodesData.filter(n => String(n.id).startsWith('svn-'))
    // Extract revision number from id `svn-<rev>`
    const revs = svnNodes
      .map(n => Number(String(n.id).replace('svn-', '')))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)

    const revIndex = {}
    revs.forEach((r, i) => { revIndex[r] = i })

    const spacing = CAPSULE_WIDTH * 1.2
    const mid = (revs.length - 1) / 2

    svnNodes.forEach(n => {
      if (!layoutModeChanged && n._hadPrev) return
      const r = Number(String(n.id).replace('svn-', ''))
      const i = revIndex[r]
      if (i === undefined) return
      n.x = (i - mid) * spacing
      // Small vertical jitter so links aren't perfectly overlapping
      n.y = ((r % 7) - 3) * 20
    })
  }

  // --- Grouping Centers ---
  // Note: using the module-level groupCenters variable, clearing it first
  for (const key in groupCenters) delete groupCenters[key]
  
  if (props.groupBy !== 'none' && !isSvnRevisionMode) {
    // Timeline Helper
    const getWeekYear = (dateStr) => {
        if (!dateStr) return 'No Date'
        const d = new Date(dateStr)
        const onejan = new Date(d.getFullYear(), 0, 1)
        const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7)
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    }

    // Determine group key for each node
    nodesData.forEach(d => {
        if (props.groupBy === 'tag') d._groupKey = d.tag
        else if (props.groupBy === 'author') d._groupKey = d.authorName
        else if (props.groupBy === 'state') {
          // "Status" grouping: prefer Status scoped label, fallback to a simple state bucket.
          const s = typeof d.statusLabel === 'string' ? d.statusLabel.trim() : ''
          d._groupKey = s || (d.state === 'closed' ? 'Done' : 'To do')
        }
        else if (props.groupBy === 'assignee') d._groupKey = d.assigneeName
        else if (props.groupBy === 'milestone') d._groupKey = d.milestoneTitle
        else if (props.groupBy === 'priority') d._groupKey = d.priority
        else if (props.groupBy === 'type') d._groupKey = d.type
        else if (props.groupBy === 'weight') d._groupKey = d.weight
        else if (props.groupBy === 'epic') d._groupKey = d.epic
        else if (props.groupBy === 'iteration') d._groupKey = d.iteration
        else if (props.groupBy && props.groupBy.startsWith('scoped:')) {
            // `_groupKey` can be precomputed (and duplicated) in updateGraph()
            // so keep it if present. Fallback to computing from labels.
            if (!d._groupKey) {
              const prefix = props.groupBy.substring('scoped:'.length)
              const value = getScopedLabelValue(d._raw?.labels || [], prefix)
              d._groupKey = value || `No ${prefix}`
            }
        }
        else if (props.groupBy === 'stale') {
            if (d.daysSinceUpdate > 90) d._groupKey = '> 90 Days Stale'
            else if (d.daysSinceUpdate > 60) d._groupKey = '> 60 Days Stale'
            else if (d.daysSinceUpdate > 30) d._groupKey = '> 30 Days Stale'
            else d._groupKey = 'Active (< 30 Days)'
        }
        else if (props.groupBy === 'timeline_created') d._groupKey = getWeekYear(d._raw.created_at)
        else if (props.groupBy === 'timeline_updated') d._groupKey = getWeekYear(d._raw.updated_at)
        else if (props.groupBy === 'timeline_closed') d._groupKey = getWeekYear(d._raw.closed_at)
        else d._groupKey = 'default'
    })

      const groups = [...new Set(nodesData.map(d => d._groupKey))].sort()
      
      // Calculate group sizes for dynamic layout
      const groupSizes = {}
      nodesData.forEach(d => {
          groupSizes[d._groupKey] = (groupSizes[d._groupKey] || 0) + 1
      })

      // Deterministic "random" group start positions based on group name.
      // Keeps group layout roughly consistent across machines/sessions.
      const hash32 = (s) => {
        let h = 2166136261
        const str = String(s ?? '')
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i)
          h = Math.imul(h, 16777619)
        }
        return h >>> 0
      }

      const groupNodes = groups.map(g => {
          const count = groupSizes[g]
          // Heuristic for group radius based on node count and capsule size
          // Used for collision between groups
          // Increased spacing factor to prevent groups from overlapping too much
          const r = Math.sqrt(count) * (CAPSULE_WIDTH * 0.8) + 200
          // Initialize with deterministic pseudo-random positions to prevent stacking at (0,0).
          const u1 = hash32(`${g}|x`) / 4294967296
          const u2 = hash32(`${g}|y`) / 4294967296
          return { 
              id: g, 
              r, 
              x: (u1 - 0.5) * 1000,
              y: (u2 - 0.5) * 1000
          }
      })

      // Create group links based on node connections
      const nodeGroupMap = {}
      nodesData.forEach(n => nodeGroupMap[n.id] = n._groupKey)

      const groupLinksMap = {}
      edgesData.forEach(e => {
        const sourceId = typeof e.source === 'object' ? e.source.id : e.source
        const targetId = typeof e.target === 'object' ? e.target.id : e.target
        const g1 = nodeGroupMap[sourceId]
        const g2 = nodeGroupMap[targetId]
        
        if (g1 && g2 && g1 !== g2) {
            const key = g1 < g2 ? `${g1}|${g2}` : `${g2}|${g1}`
            if (!groupLinksMap[key]) {
                groupLinksMap[key] = { source: g1, target: g2, weight: 0 }
            }
            groupLinksMap[key].weight++
        }
      })
      const groupLinks = Object.values(groupLinksMap)

      // Run distinct simulation for group centers
      const groupSim = d3.forceSimulation(groupNodes)
        .force("charge", d3.forceManyBody().strength(d => -d.r * 30)) // Increased charge to push apart
        .force("collide", d3.forceCollide().radius(d => d.r).iterations(4)) // Tighter collision radius (1.0)
        .force("link", d3.forceLink(groupLinks).id(d => d.id).distance(d => d.source.r + d.target.r).strength(0.5)) 
        .force("x", d3.forceX(0).strength(0.2)) // Stronger center gravity
        .force("y", d3.forceY(0).strength(0.2))
        .stop()

      // Stabilize group positions
      for (let i = 0; i < 300; ++i) groupSim.tick()

      groups.forEach((g, i) => {
          groupCenters[g] = {
              x: groupNodes[i].x,
              y: groupNodes[i].y
          }
      })
  }

  // --- Simulation ---
  if (simulation) simulation.stop()

  const shouldPreTick = layoutModeChanged || !nodesData.some(n => n._hadPrev)
  const preSimTicks = 40

  simulation = d3.forceSimulation(nodesData).stop()
    .force("charge", d3.forceManyBody().strength(-props.repulsion)) // Increased repulsion
  
  if (props.linkMode !== 'none') {
    simulation.force("link", d3.forceLink(edgesData).id(d => d.id).distance(props.linkDistance).strength(props.linkStrength))
  } else {
    // If links are hidden, remove link force or set empty
    simulation.force("link", null)
  }

  // Grid magnetics: pulls nodes onto a loose grid and prefers unoccupied cells.
  // Helps keep natural spacing so layouts (and links) are easier to read.
  if (!isSvnRevisionMode && (Number(props.gridStrength) || 0) > 0) {
    const factor = Number(props.gridSpacing) || 1.5
    const strength = Number(props.gridStrength) || 0
    const stepX = CAPSULE_WIDTH * factor
    const stepY = CAPSULE_HEIGHT * factor

    simulation.force("grid", () => {
      // Stable assignment order
      const sorted = nodesData.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
      const occ = new Map() // key -> count

      const keyOf = (gx, gy) => `${gx},${gy}`
      const getCount = (k) => occ.get(k) || 0
      const inc = (k) => occ.set(k, getCount(k) + 1)

      // Assign each node to a nearby cell, prefer empty ones
      sorted.forEach(n => {
        const gx0 = Math.round(n.x / stepX)
        const gy0 = Math.round(n.y / stepY)
        let bestGx = gx0
        let bestGy = gy0
        let bestScore = Infinity

        // Search a small neighborhood for a free (or least occupied) cell
        for (let r = 0; r <= 2; r++) {
          for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
              const gx = gx0 + dx
              const gy = gy0 + dy
              const k = keyOf(gx, gy)
              const c = getCount(k)
              const dist = Math.abs(dx) + Math.abs(dy)
              const score = c * 100 + dist
              if (score < bestScore) {
                bestScore = score
                bestGx = gx
                bestGy = gy
                if (c === 0 && dist === 0) break
              }
            }
          }
        }

        n._grid = { gx: bestGx, gy: bestGy }
        inc(keyOf(bestGx, bestGy))
      })

      // Apply pull toward assigned cell centers
      nodesData.forEach(n => {
        const g = n._grid
        if (!g) return
        const tx = g.gx * stepX
        const ty = g.gy * stepY
        n.vx += (tx - n.x) * strength
        n.vy += (ty - n.y) * strength
      })
    })
  } else {
    simulation.force("grid", null)
  }

  simulation
    .alphaDecay(0.02) // Faster decay to stabilize flickering
    .velocityDecay(props.friction) // High friction to prevent jitter

      // Apply Forces based on mode
      if (isSvnRevisionMode) {
          // Keep it on a horizontal timeline
          const strength = Math.max(0.1, props.groupGravity * 3)
          simulation
            .force("x", d3.forceX(d => d.x).strength(strength))
            .force("y", d3.forceY(0).strength(props.centerGravity))
      } else if (props.groupBy.startsWith('timeline_')) {
          // Linear timeline layout logic
          // Extract unique weeks and sort them
          const weeks = [...new Set(Object.keys(groupCenters))].sort()
          const weekMap = {}
          weeks.forEach((w, i) => weekMap[w] = i)
          
          // Position groups linearly along X axis
          const timelineSpacing = CAPSULE_WIDTH * 1.5 // Space between weeks
          
          simulation
            .force("x", d3.forceX(d => {
                const weekIndex = weekMap[d._groupKey]
                if (weekIndex === undefined) return 0
                return (weekIndex - weeks.length / 2) * timelineSpacing
            }).strength(props.groupGravity * 3)) // Stronger pull to timeline slot
            .force("y", d3.forceY(0).strength(props.centerGravity)) // Keep them somewhat centered vertically
      } else if (props.groupBy !== 'none') {
          // Pull towards group centers
          simulation
            .force("x", d3.forceX(d => groupCenters[d._groupKey] ? groupCenters[d._groupKey].x : 0).strength(props.groupGravity))
            .force("y", d3.forceY(d => groupCenters[d._groupKey] ? groupCenters[d._groupKey].y : 0).strength(props.groupGravity))
            
      } else {
          // Default Center Gravity
          simulation
            .force("x", d3.forceX(0).strength(props.centerGravity))
            .force("y", d3.forceY(0).strength(props.centerGravity))
      }

  // Pre-simulate a few steps (no rendering) so initial paint is less "explody".
  if (shouldPreTick && preSimTicks > 0) {
    simulation.alpha(1)
    simulation.tick(preSimTicks)

    const hasGrid = !isSvnRevisionMode && (Number(props.gridStrength) || 0) > 0
    if (hasGrid) {
      const factor = Number(props.gridSpacing) || 1.5
      resolveOverlaps(nodesData, CAPSULE_WIDTH * factor, CAPSULE_HEIGHT * factor)
    } else {
      resolveOverlaps(nodesData, SPACING_X, SPACING_Y)
    }
  }

  simulation.on("tick", ticked)
  simulation.restart()
  scheduleRender()
  applyPhysicsPaused()

  function ticked() {
    const hasGrid = !isSvnRevisionMode && (Number(props.gridStrength) || 0) > 0
    if (hasGrid) {
      const factor = Number(props.gridSpacing) || 1.5
      resolveOverlaps(nodesData, CAPSULE_WIDTH * factor, CAPSULE_HEIGHT * factor)
    } else {
      resolveOverlaps(nodesData, SPACING_X, SPACING_Y)
    }
    scheduleRender()
  }
}

// Geometric overlap resolution
function resolveOverlaps(nodes, width, height) {
  const l = nodes.length
  if (l < 2) return

  // This used to be O(n^2) per tick, which gets extremely slow on large graphs.
  // Use a simple spatial hash grid so we only compare nodes that are plausibly overlapping.
  const cellW = Math.max(1, width)
  const cellH = Math.max(1, height)
  const passes = l > 900 ? 1 : 3

  const keyOf = (gx, gy) => `${gx}|${gy}`

  for (let pass = 0; pass < passes; pass++) {
    const buckets = new Map() // key -> [indices]

    for (let i = 0; i < l; i++) {
      const n = nodes[i]
      const gx = Math.floor(n.x / cellW)
      const gy = Math.floor(n.y / cellH)
      const k = keyOf(gx, gy)
      const arr = buckets.get(k)
      if (arr) arr.push(i)
      else buckets.set(k, [i])
    }

    for (let i = 0; i < l; i++) {
      const d1 = nodes[i]
      const gx0 = Math.floor(d1.x / cellW)
      const gy0 = Math.floor(d1.y / cellH)

      for (let dxCell = -1; dxCell <= 1; dxCell++) {
        for (let dyCell = -1; dyCell <= 1; dyCell++) {
          const arr = buckets.get(keyOf(gx0 + dxCell, gy0 + dyCell))
          if (!arr) continue

          for (let ai = 0; ai < arr.length; ai++) {
            const j = arr[ai]
            if (j <= i) continue

            const d2 = nodes[j]
            const dx = d1.x - d2.x
            const dy = d1.y - d2.y

            if (dx === 0 && dy === 0) {
              // Break ties deterministically-ish to avoid stacking.
              d1.x += Math.random() - 0.5
              d1.y += Math.random() - 0.5
              continue
            }

            const absX = Math.abs(dx)
            const absY = Math.abs(dy)

            if (absX < width && absY < height) {
              const ox = width - absX
              const oy = height - absY

              if (ox < oy) {
                const move = ox / 2
                const sx = dx > 0 ? 1 : -1
                d1.x += sx * move
                d2.x -= sx * move
              } else {
                const move = oy / 2
                const sy = dy > 0 ? 1 : -1
                d1.y += sy * move
                d2.y -= sy * move
              }
            }
          }
        }
      }
    }
  }
}

function render() {
  if (!canvas.value) return
  const c = colors.value
  let ctx = null
  try {
    ctx = canvas.value.getContext('2d', { alpha: false }) // Optimize: opaque canvas
  } catch {
    // jsdom doesn't implement canvas getContext() without extra deps.
    return
  }
  if (!ctx) return
  const width = canvas.value.width
  const height = canvas.value.height
  const dpr = window.devicePixelRatio || 1

  const drawRoundedPoly = (pctx, poly, radius) => {
    if (!poly || poly.length < 3) return
    const n = poly.length
    for (let i = 0; i < n; i++) {
      const prev = poly[(i + n - 1) % n]
      const curr = poly[i]
      const next = poly[(i + 1) % n]

      const v1x = curr[0] - prev[0]
      const v1y = curr[1] - prev[1]
      const v2x = next[0] - curr[0]
      const v2y = next[1] - curr[1]

      const d1 = Math.hypot(v1x, v1y) || 1
      const d2 = Math.hypot(v2x, v2y) || 1
      const r = Math.min(radius, d1 * 0.5, d2 * 0.5)

      const u1x = v1x / d1
      const u1y = v1y / d1
      const u2x = v2x / d2
      const u2y = v2y / d2

      const p1x = curr[0] - u1x * r
      const p1y = curr[1] - u1y * r
      const p2x = curr[0] + u2x * r
      const p2y = curr[1] + u2y * r

      if (i === 0) pctx.moveTo(p1x, p1y)
      else pctx.lineTo(p1x, p1y)
      pctx.quadraticCurveTo(curr[0], curr[1], p2x, p2y)
    }
    pctx.closePath()
  }

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  
  // Background fill (since we disabled alpha)
  ctx.fillStyle = c.canvasBg
  ctx.fillRect(0, 0, width, height)

  // Subtle grid background (world-space: pans + zooms with the graph)
  ctx.save()
  ctx.translate(transform.x * dpr, transform.y * dpr)
  ctx.scale(transform.k * dpr, transform.k * dpr)

  const cssW = width / dpr
  const cssH = height / dpr
  const x0 = (-transform.x) / transform.k
  const y0 = (-transform.y) / transform.k
  const x1 = (cssW - transform.x) / transform.k
  const y1 = (cssH - transform.y) / transform.k

  // Keep grid lines ~1 device pixel wide regardless of zoom/DPR
  ctx.lineWidth = 1 / (transform.k * dpr)

  const useMagGrid = (Number(props.gridStrength) || 0) > 0

  // Either align with node magnet grid, or choose a "nice" grid spacing based on zoom.
  const minorStepX = useMagGrid ? (CAPSULE_WIDTH * (Number(props.gridSpacing) || 1.5)) : null
  const minorStepY = useMagGrid ? (CAPSULE_HEIGHT * (Number(props.gridSpacing) || 1.5)) : null

  const pickNiceStep = () => {
    const targetPx = 44
    const raw = targetPx / transform.k
    const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))))
    const scaled = raw / pow10
    const base = scaled <= 1 ? 1 : (scaled <= 2 ? 2 : (scaled <= 5 ? 5 : 10))
    return base * pow10
  }

  const stepX = (minorStepX && minorStepX > 0) ? minorStepX : pickNiceStep()
  const stepY = (minorStepY && minorStepY > 0) ? minorStepY : stepX
  const majorStepX = stepX * 5
  const majorStepY = stepY * 5

  const startMinorX = Math.floor(x0 / stepX) * stepX
  const startMinorY = Math.floor(y0 / stepY) * stepY
  const startMajorX = Math.floor(x0 / majorStepX) * majorStepX
  const startMajorY = Math.floor(y0 / majorStepY) * majorStepY

  // Minor grid
  ctx.beginPath()
  ctx.strokeStyle = c.gridMinor
  for (let x = startMinorX; x <= x1; x += stepX) {
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (let y = startMinorY; y <= y1; y += stepY) {
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.stroke()

  // Major grid
  ctx.beginPath()
  ctx.strokeStyle = c.gridMajor
  for (let x = startMajorX; x <= x1; x += majorStepX) {
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (let y = startMajorY; y <= y1; y += majorStepY) {
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.stroke()
  ctx.restore()

  // "OLD DATA" watermark when data is stale (>6 hours). For demo/dev, show immediately.
  const last = settings?.meta?.lastUpdated
  const lastMs = typeof last === 'number' ? last : (last ? new Date(last).getTime() : 0)
  const thresholdMs = 6 * 60 * 60 * 1000
  const isOldData = !lastMs || (Date.now() - lastMs) > thresholdMs
  if (isOldData) {
    ctx.save()
    const label = '< REFRESH DATA'
    const angle = 0.25
    let fontSize = Math.max(22, Math.floor(Math.min(width, height) * 0.07))

    // Prefer anchoring near the Refresh button (top-left UI), fallback to top-left of canvas.
    let x = 24 * dpr
    let y = 24 * dpr
    try {
      const btn = document.getElementById('glv-refresh-data-btn')
      const cRect = canvas.value && canvas.value.getBoundingClientRect ? canvas.value.getBoundingClientRect() : null
      const bRect = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null
      if (cRect && bRect) {
        x = (bRect.left + bRect.width / 2 - cRect.left) * dpr
        y = (bRect.bottom - cRect.top + 6) * dpr
      }
    } catch {
      // ignore
    }

    const pad = 12 * dpr
    x = Math.max(pad, Math.min(x, width - pad)) + 10
    y = Math.max(pad, Math.min(y, height - pad)) - 30

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, "Segoe UI", sans-serif`

    const maxW = Math.max(0, (width - x) - pad)
    const tw = ctx.measureText(label).width
    if (tw > 0 && tw > maxW) {
      fontSize = Math.max(16, Math.floor(fontSize * (maxW / tw)))
      ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, "Segoe UI", sans-serif`
    }

    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.fillStyle = 'rgba(255, 193, 7, 0.12)'
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.22)'
    ctx.lineWidth = Math.max(2, Math.floor(fontSize / 30))
    ctx.strokeText(label, 0, 0)
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }
  
  // Draw cached group hull layer (screen-space). This keeps big zooms responsive by
  // not recomputing the expensive smudge polygons every single frame/tick.
  // Allow smudges even at the furthest zoom (scaleExtent min is 0.01).
  // Keep it cached/throttled so it stays fast.
  const canDrawHulls = props.groupBy !== 'none' && props.groupBy !== 'svn_revision' && transform.k > 0.0001
  if (canDrawHulls) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const alpha = (!props.physicsPaused && simulation && simulation.alpha) ? Number(simulation.alpha()) : 0
    const maxAgeMs = alpha > 0.02 ? 140 : 1000
    const key = [
      width, height, dpr,
      themeName.value,
      props.groupBy, props.colorMode,
      // Pan/zoom affects the screen-space layer.
      Math.round(transform.x * 10) / 10,
      Math.round(transform.y * 10) / 10,
      Math.round(transform.k * 1000) / 1000
    ].join('|')

    const stale = key !== hullCacheKey || (now - hullCacheAt) > maxAgeMs
    if (stale) {
      hullCacheKey = key
      hullCacheAt = now
      if (!hullCacheCanvas && typeof document !== 'undefined' && document.createElement) {
        hullCacheCanvas = document.createElement('canvas')
      }
      if (hullCacheCanvas) {
        if (hullCacheCanvas.width !== width) hullCacheCanvas.width = width
        if (hullCacheCanvas.height !== height) hullCacheCanvas.height = height

        const hctx = hullCacheCanvas.getContext('2d')
        if (hctx) {
          hctx.setTransform(1, 0, 0, 1, 0, 0)
          hctx.clearRect(0, 0, width, height)

          // Match world-space transform so the cached layer lines up.
          hctx.save()
          hctx.translate(transform.x * dpr, transform.y * dpr)
          hctx.scale(transform.k * dpr, transform.k * dpr)

          // Draw Group Hulls ("smudge")
          const groups = {}
          nodesData.forEach(node => {
            if (!groups[node._groupKey]) groups[node._groupKey] = []
            groups[node._groupKey].push(node)
          })

          const intensity = Math.min(0.15, 0.05 + (0.1 / Math.max(0.1, transform.k)))
          hctx.lineJoin = 'round'
          hctx.lineWidth = HULL_STROKE_WIDTH

          const colorModeMatchesGroup = props.groupBy === props.colorMode

          Object.entries(groups).forEach(([groupKey, groupNodes]) => {
            if (groupNodes.length === 0) return

            let fillColor = c.hullBase(intensity)
            if (colorModeMatchesGroup && groupNodes[0].color) {
              const dc = d3.color(groupNodes[0].color)
              if (dc) {
                dc.opacity = intensity * 1.5
                fillColor = dc.toString()
              }
            }

            hctx.fillStyle = fillColor
            hctx.shadowColor = fillColor
            hctx.shadowBlur = 60
            hctx.shadowOffsetX = 0
            hctx.shadowOffsetY = 0

            let avgX = 0
            const points = []
            const pad = 10
            const hw = CAPSULE_WIDTH / 2 + pad
            const hh = CAPSULE_HEIGHT / 2 + pad

            groupNodes.forEach(n => {
              avgX += n.x
              points.push([n.x - hw, n.y - hh])
              points.push([n.x + hw, n.y - hh])
              points.push([n.x + hw, n.y + hh])
              points.push([n.x - hw, n.y + hh])
            })
            avgX /= groupNodes.length

            let hullMinY = Infinity
            points.forEach(p => { if (p[1] < hullMinY) hullMinY = p[1] })

            if (groupNodes.length === 1) {
              const n = groupNodes[0]
              const w = CAPSULE_WIDTH + 40
              const h = CAPSULE_HEIGHT + 40
              const x = n.x - w / 2
              const y = n.y - h / 2
              hctx.beginPath()
              hctx.roundRect(x, y, w, h, 50)
              hctx.fill()
            } else {
              const hull = d3.polygonHull(points)
              if (hull) {
                let cx = 0
                let cy = 0
                hull.forEach(p => { cx += p[0]; cy += p[1] })
                cx /= hull.length
                cy /= hull.length

                const extrude = 1.2
                const hull2 = hull.map(p => [cx + (p[0] - cx) * extrude, cy + (p[1] - cy) * extrude])

                hullMinY = Infinity
                hull2.forEach(p => { if (p[1] < hullMinY) hullMinY = p[1] })

                hctx.beginPath()
                drawRoundedPoly(hctx, hull2, 120)
                hctx.fill()
              }
            }

            hctx.shadowBlur = 0
            hctx.shadowColor = 'transparent'
          })

          hctx.restore()
          hctx.lineWidth = 1
          hctx.lineJoin = 'miter'
        }
      }
    }

    if (hullCacheCanvas) {
      // Draw in screen-space (identity transform at this point).
      ctx.drawImage(hullCacheCanvas, 0, 0)
    }
  }

  // Apply Zoom Transform
  // Note: We scale by DPR here to ensure high res rendering
  ctx.translate(transform.x * dpr, transform.y * dpr)
  ctx.scale(transform.k * dpr, transform.k * dpr)

  // Group labels (cheap): decoupled from smudge caching so toggling "Labels"
  // doesn't force a full hull recompute.
  if (showGroupLabels.value && props.groupBy !== 'none' && props.groupBy !== 'svn_revision' && transform.k > 0.04) {
    // Keep this cheap: approximate "hull top" using capsule corners (matches smudge math closely).
    const pad = 10
    const hh = (CAPSULE_HEIGHT / 2) + pad
    const stats = new Map() // key -> { sumX, minY, count }
    nodesData.forEach(n => {
      const k = n._groupKey
      if (!k) return
      let s = stats.get(k)
      if (!s) {
        s = { sumX: 0, minY: Infinity, count: 0 }
        stats.set(k, s)
      }
      s.sumX += n.x
      const top = n.y - hh
      if (top < s.minY) s.minY = top
      s.count++
    })

    ctx.save()
    ctx.fillStyle = c.textDim
    const minScreenFontSize = 10
    const baseWorldFontSize = 40
    const fontSize = Math.max(baseWorldFontSize, minScreenFontSize / transform.k)
    ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    for (const [groupKey, s] of stats.entries()) {
      if (!s.count || !Number.isFinite(s.minY)) continue
      const avgX = s.sumX / s.count
      const labelY = s.minY - LABEL_PADDING
      ctx.fillText(groupKey, avgX, labelY)
    }
    ctx.restore()
  }

  // 1. Draw Links
  if (props.linkMode !== 'none') {
    const depLinksOnTop = props.linkMode === 'dependency' && transform.k < 0.55

    const drawDependencyLinks = () => {
      const showArrows = transform.k > 0.22
      const arrowPx = 10
      const arrow = arrowPx / (transform.k * dpr)
      const lw = 4 / (transform.k * dpr)

      // Start/end: capsule edge (rect approximation) + ~10% extra space.
      const halfW = CAPSULE_WIDTH / 2
      const halfH = CAPSULE_HEIGHT / 2
      const margin = CAPSULE_WIDTH * 0.10

      ctx.globalAlpha = 0.95
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      edgesData.forEach(link => {
        const src = link.source
        const dst = link.target
        if (!src || !dst) return

        const label = link.label || 'related'
        const t = String(label).toLowerCase()
        const flip = (t === 'is_blocked_by' || t === 'blocked_by')
        const a = flip ? dst : src
        const b = flip ? src : dst

        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy)
        if (!len) return
        const ux = dx / len
        const uy = dy / len

        const distToRectEdge = Math.min(
          Math.abs(ux) > 1e-6 ? (halfW / Math.abs(ux)) : Infinity,
          Math.abs(uy) > 1e-6 ? (halfH / Math.abs(uy)) : Infinity
        )

        const pad = distToRectEdge + margin
        const x1 = a.x + ux * pad
        const y1 = a.y + uy * pad
        const x2 = b.x - ux * pad
        const y2 = b.y - uy * pad

        const stroke = getDepLinkStyle(label, c.link).color
        ctx.strokeStyle = stroke
        ctx.lineWidth = lw

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        if (showArrows) {
          // Arrow head at target
          const ax = x2
          const ay = y2
          const leftX = ax - ux * arrow - uy * (arrow * 0.7)
          const leftY = ay - uy * arrow + ux * (arrow * 0.7)
          const rightX = ax - ux * arrow + uy * (arrow * 0.7)
          const rightY = ay - uy * arrow - ux * (arrow * 0.7)

          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(leftX, leftY)
          ctx.moveTo(ax, ay)
          ctx.lineTo(rightX, rightY)
          ctx.stroke()
        }
      })

      ctx.globalAlpha = 1.0
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
    }

    if (props.linkMode === 'dependency') {
      // When zoomed out, draw above nodes (we render again later after nodes).
      if (!depLinksOnTop) drawDependencyLinks()
    } else {
      ctx.beginPath()
      ctx.strokeStyle = c.link
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      edgesData.forEach(link => {
        ctx.moveTo(link.source.x, link.source.y)
        ctx.lineTo(link.target.x, link.target.y)
      })
      ctx.stroke()
      ctx.globalAlpha = 1.0
    }
  }

  // 2. Draw Nodes (Capsules)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Font settings
  const titleFont = '600 13px "Segoe UI", sans-serif'
  const metaFont = '11px "Segoe UI", sans-serif'
  const idFont = 'bold 11px "Segoe UI", sans-serif'
  
  const w = CAPSULE_WIDTH
  const h = CAPSULE_HEIGHT
  const r = 20 // radius
  const k = transform.k
  const isFarZoom = k < 0.15
  const isVeryFarZoom = k < 0.08

  nodesData.forEach(node => {
    const x = node.x - w/2
    const y = node.y - h/2

    const isLegendHover = legendHoverKey.value && node._legendKey === legendHoverKey.value
    const lastOpened = settings?.graph?.lastOpenedNodeId
    const isLastOpened = lastOpened != null && String(node.id) === String(lastOpened)
    const selectedId = contextMenu.value.selectedNodeId
    const isContextSelected = selectedId != null && String(node.id) === String(selectedId)
    const isForceShow = !!node._uiForceShow
    const isForceClosed = isForceShow && String(node._raw?.state || node.state || '').toLowerCase() === 'closed'
    const isHovered = hoveredNodeId === node.id
    const needsFocus = isHovered || isLegendHover || isLastOpened || isContextSelected || isForceShow

    // Ultra zoomed out: draw a cheap box at the exact capsule bounds.
    // Keep full rendering for focused/highlighted nodes so interactions still work.
    if (isVeryFarZoom && !needsFocus) {
      ctx.save()
      ctx.fillStyle = node.color || c.neutralNode
      ctx.globalAlpha = node.color ? 0.55 : 0.35
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }

    // Shadow (Static) - only if not hovered (hover has its own dynamic shadow)
    if (!isFarZoom && !isHovered) {
        ctx.fillStyle = c.shadow
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w, h, r)
        ctx.fill()
    }

    // Capsule Background
    const isZoomedOut = k < 0.4
    if (isForceClosed) {
      // Force-grey closed user-updated issues so they stay visually "done",
      // regardless of the current view / filter settings.
      ctx.fillStyle = themeName.value === 'dark' ? '#2a2d2e' : '#eeeeee'
      ctx.globalAlpha = 1.0
    } else if (isZoomedOut && node.color) {
      // Lighten the color for background
      ctx.fillStyle = node.color
      ctx.globalAlpha = 0.55
    } else {
      ctx.fillStyle = c.nodeBg
      ctx.globalAlpha = 1.0
    }
    
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
    ctx.globalAlpha = 1.0

    // Force-show highlight (subtle tint) for user-updated issues
    if (isForceShow && !isForceClosed) {
      ctx.save()
      ctx.fillStyle = themeName.value === 'dark' ? 'rgba(255, 152, 0, 0.18)' : 'rgba(255, 152, 0, 0.12)'
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.fill()
      ctx.restore()
    }

    // Legend hover: also tint the capsule body to match the legend category
    if (isLegendHover && node.color) {
      ctx.save()
      ctx.fillStyle = node.color
      ctx.globalAlpha = isZoomedOut ? 0.35 : 0.18
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.fill()
      ctx.restore()
    }
    
    // Border (skip at far zoom unless we need focus/highlight)
    if (!isFarZoom || needsFocus) {
      ctx.strokeStyle = c.nodeBorder
      ctx.lineWidth = 2
      if (node.color) ctx.strokeStyle = node.color

      if (isForceClosed) {
        ctx.strokeStyle = c.neutralNode
      } else if (isForceShow && !isLegendHover && !isLastOpened && !isContextSelected && !isHovered) {
        const scale = Math.max(0.0001, k * dpr)
        const lw = 5 / scale
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.95)'
        ctx.lineWidth = Math.max(ctx.lineWidth, lw)
        ctx.shadowColor = themeName.value === 'dark' ? 'rgba(255, 152, 0, 0.28)' : 'rgba(255, 152, 0, 0.22)'
        ctx.shadowBlur = 16 / scale
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }

      if (isLegendHover) {
        const scale = Math.max(0.0001, k * dpr)
        const px = Math.max(2, Math.min(8, 2 + (k * 6)))
        const lw = px / scale
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.95)'
        ctx.lineWidth = lw * 1.8
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }

      if (isHovered) {
        ctx.lineWidth = 4
        ctx.shadowColor = c.hoverShadow
        ctx.shadowBlur = 15
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4
      } else {
        if (!isLegendHover) {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
      }

      if (isLastOpened) {
        const scale = Math.max(0.0001, k * dpr)
        const lw = 6 / scale
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.95)'
        ctx.lineWidth = Math.max(ctx.lineWidth, lw)
        ctx.shadowColor = 'rgba(0, 200, 255, 0.45)'
        ctx.shadowBlur = 18 / scale
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }

      ctx.stroke()
    }

    // Right-click selection highlight (independent from hover + last-opened)
    if (isContextSelected) {
        const scale = Math.max(0.0001, transform.k * dpr)
        const pad = 3 / scale
        const lw = 5 / scale
        ctx.save()
        ctx.strokeStyle = 'rgba(255, 64, 129, 0.95)'
        ctx.lineWidth = lw
        ctx.setLineDash([10 / scale, 7 / scale])
        ctx.shadowColor = 'rgba(255, 64, 129, 0.35)'
        ctx.shadowBlur = 16 / scale
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.beginPath()
        ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, r + pad)
        ctx.stroke()
        ctx.restore()
    }
    
    // Reset shadow for text
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Content Clipping
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.clip()

    // LOD: Hide details when zoomed out
    // Show details only if zoom level is sufficient
    // Threshold: 0.15 seems reasonable (adjust as needed)
    let lineY = y + 35 // Reduced from 50 for tighter spacing

    if (k > 0.15) {
        // -- Header Row --
        const headerY = y + 20
        
        // ID (Left)
        ctx.fillStyle = isForceClosed ? c.textDim : c.textId
        ctx.font = idFont
        ctx.textAlign = 'left'
        
        // Check for JIRA ID in title
        let displayId = `#${node.id}`
        let displayTitle = node._raw.title || node.name || 'Untitled'
        let jiraId = null
        const titleText = node._raw.title || ''
        const jiraMatch = titleText.match(/^\[([A-Z]+-\d+)\]\s+(.*)/)
        
        if (jiraMatch) {
            jiraId = jiraMatch[1]
            displayTitle = jiraMatch[2]
        }
        
        ctx.fillText(displayId, x + 15, headerY)
        
        if (jiraId) {
            const idWidth = ctx.measureText(displayId).width
            ctx.fillStyle = c.textDim
            ctx.fillText(jiraId, x + 15 + idWidth + 6, headerY)
        }

        // State Badge (Right) - always OPEN/CLOSED (separate from Status)
        let stateText = (node._raw.state || 'open').toUpperCase()
        
        ctx.textAlign = 'right'
        const badgeWidth = ctx.measureText(stateText).width + 12
        const badgeX = x + w - 15 - badgeWidth
        const badgeY = headerY - 8
        
        // Badge BG (state)
        if (node._raw.state === 'opened') {
            ctx.fillStyle = c.badgeOpenedBg
        }
        else if (node._raw.state === 'closed') ctx.fillStyle = c.badgeClosedBg
        else ctx.fillStyle = c.badgeUnknownBg
        
        ctx.beginPath()
        ctx.roundRect(badgeX, badgeY, badgeWidth, 16, 8)
        ctx.fill()
        
        // Badge Text (state)
        if (node._raw.state === 'opened') {
            ctx.fillStyle = c.badgeOpenedText
        }
        else if (node._raw.state === 'closed') ctx.fillStyle = c.badgeClosedText
        else ctx.fillStyle = c.badgeUnknownText

        ctx.font = 'bold 9px "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(stateText, badgeX + badgeWidth/2, headerY)

        // Status Badge (optional, next to state)
        if (node.statusLabel) {
            const statusText = String(node.statusLabel).toUpperCase()
            ctx.font = 'bold 9px "Segoe UI", sans-serif'
            ctx.textAlign = 'right'

            const sw = ctx.measureText(statusText).width + 12
            const sx = badgeX - 6 - sw
            const sy = badgeY

            const statusLower = String(node.statusLabel).trim().toLowerCase()
            // Status BG
        if (statusLower === 'in progress') ctx.fillStyle = '#e7f0ff'
            else if (statusLower === 'ready for review') ctx.fillStyle = '#fff4e5'
            else ctx.fillStyle = c.labelBg
            ctx.beginPath()
            ctx.roundRect(sx, sy, sw, 16, 8)
            ctx.fill()

            // Status Text
            if (statusLower === 'in progress') ctx.fillStyle = '#0056b3'
            else if (statusLower === 'ready for review') ctx.fillStyle = '#a35200'
            else ctx.fillStyle = c.labelText
            ctx.textAlign = 'center'
            ctx.fillText(statusText, sx + sw/2, headerY)
        }

        // -- Title --
        ctx.fillStyle = isForceClosed ? c.textDim : c.textMain
        ctx.font = titleFont
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        
        // Wrap text manually (Canvas doesn't auto-wrap)
        const maxWidth = w - 30
        const words = displayTitle.split(' ')
        let line = ''
        const lineHeight = 16
        
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' '
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x + 15, lineY)
            line = words[n] + ' '
            lineY += lineHeight
            if (lineY > y + h - 35) break; // Clip if too long
          } else {
            line = testLine
          }
        }
        ctx.fillText(line, x + 15, lineY)
        ctx.textBaseline = 'middle'

        // -- Author (Bottom) --
        const authorName = node._raw.author ? node._raw.author.name : 'Unknown'
        ctx.fillStyle = isForceClosed ? c.textDim : c.textMuted
        ctx.font = metaFont
        ctx.textAlign = 'left'
        ctx.fillText(authorName, x + 15, y + h - 15)

        // -- Tag (Bottom Right) --
        if (node.displayTag && node.displayTag !== '_no_tag_' && node.displayTag !== authorName) {
          ctx.textAlign = 'right'
          ctx.fillStyle = isForceClosed ? c.textDim : node.color
          ctx.font = 'bold 10px "Segoe UI", sans-serif'
          ctx.fillText(node.displayTag, x + w - 15, y + h - 15)
        }
    }

    // High Detail Mode (Zoom > 1.2)
    if (transform.k > 1.2) {
         const labels = node._raw.labels || []
         // Start drawing labels below the title
         // Use the lineY from title loop (which is y coord of next line)
         // Adjusted for top baseline of title and desired spacing
         let tagY = lineY + 20 
         let tagX = x + 15
         
         if (labels.length > 0 && tagY < y + h - 25) {
             ctx.font = '9px "Segoe UI", sans-serif'
             ctx.textAlign = 'left'
             ctx.textBaseline = 'middle'
             
             labels.forEach(label => {
                 if (label.startsWith('Priority') || label.startsWith('Type')) return 
                 
                 const labelWidth = ctx.measureText(label).width + 6
                 if (tagX + labelWidth > x + w - 15) {
                     // Wrap to next line?
                     tagX = x + 15
                     tagY += 14
                 }
                 
                 if (tagY > y + h - 25) return // Clip
                 
                 // Draw label background
                 ctx.fillStyle = c.labelBg
                 ctx.beginPath()
                 ctx.roundRect(tagX, tagY - 6, labelWidth, 12, 4)
                 ctx.fill()
                 
                 ctx.fillStyle = c.labelText
                 ctx.fillText(label, tagX + 3, tagY)
                 
                 tagX += labelWidth + 4
             })
         }
    }

    ctx.restore()
  })

  // Dependency links on top when zoomed out (better readability)
  if (props.linkMode === 'dependency' && transform.k < 0.55) {
    const arrowPx = 10
    const arrow = arrowPx / (transform.k * dpr)
    const lw = 4 / (transform.k * dpr)
    const halfW = CAPSULE_WIDTH / 2
    const halfH = CAPSULE_HEIGHT / 2
    const margin = CAPSULE_WIDTH * 0.10

    ctx.save()
    ctx.globalAlpha = 0.95
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    edgesData.forEach(link => {
      const src = link.source
      const dst = link.target
      if (!src || !dst) return

      const label = link.label || 'related'
      const t = String(label).toLowerCase()
      const flip = (t === 'is_blocked_by' || t === 'blocked_by')
      const a = flip ? dst : src
      const b = flip ? src : dst

      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy)
      if (!len) return
      const ux = dx / len
      const uy = dy / len

      const distToRectEdge = Math.min(
        Math.abs(ux) > 1e-6 ? (halfW / Math.abs(ux)) : Infinity,
        Math.abs(uy) > 1e-6 ? (halfH / Math.abs(uy)) : Infinity
      )
      const pad = distToRectEdge + margin

      const x1 = a.x + ux * pad
      const y1 = a.y + uy * pad
      const x2 = b.x - ux * pad
      const y2 = b.y - uy * pad

      const stroke = getDepLinkStyle(label, c.link).color
      ctx.strokeStyle = stroke
      ctx.lineWidth = lw

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      const ax = x2
      const ay = y2
      const leftX = ax - ux * arrow - uy * (arrow * 0.7)
      const leftY = ay - uy * arrow + ux * (arrow * 0.7)
      const rightX = ax - ux * arrow + uy * (arrow * 0.7)
      const rightY = ay - uy * arrow - ux * (arrow * 0.7)

      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(leftX, leftY)
      ctx.moveTo(ax, ay)
      ctx.lineTo(rightX, rightY)
      ctx.stroke()
    })

    ctx.restore()
  }

  // Bottom-right scale bar (screen-space): "N tickets" wide, like a map scale
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const margin = 14 * dpr
  const target = 120 * dpr
  const minW = 80 * dpr
  const maxW = 180 * dpr
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20]

  let best = null
  for (const tickets of candidates) {
    const w = tickets * CAPSULE_WIDTH * transform.k * dpr
    if (w < minW || w > maxW) continue
    const score = Math.abs(w - target)
    if (!best || score < best.score) best = { tickets, w, score }
  }
  if (!best) {
    // Fallback: pick closest even if outside bounds
    for (const tickets of candidates) {
      const w = tickets * CAPSULE_WIDTH * transform.k * dpr
      const score = Math.abs(w - target)
      if (!best || score < best.score) best = { tickets, w, score }
    }
  }

  const ticketStr = Number.isInteger(best.tickets) ? String(best.tickets) : String(best.tickets)
  const label = best.tickets === 1 ? '1 ticket' : `${ticketStr} tickets`

  const fontSize = 11 * dpr
  ctx.font = `600 ${fontSize}px "Segoe UI", sans-serif`
  const pad = 8 * dpr
  const lineH = Math.ceil(fontSize * 1.25)
  const tickH = 6 * dpr
  const gap = 6 * dpr
  const boxH = pad + lineH + gap + tickH + pad
  const textW = ctx.measureText(label).width
  const barW = Math.max(best.w, 40 * dpr)
  const boxW = Math.max(textW, barW) + pad * 2
  const boxX = width - margin - boxW
  const boxY = height - margin - boxH

  const bg = themeName.value === 'dark' ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.9)'
  const stroke = themeName.value === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'

  ctx.fillStyle = bg
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1 * dpr
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 7 * dpr)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = c.textMain
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(label, boxX + pad, boxY + pad)

  const barX = boxX + pad
  const barY = boxY + pad + lineH + gap + tickH / 2
  ctx.strokeStyle = c.textMain
  ctx.lineWidth = 2 * dpr
  ctx.beginPath()
  ctx.moveTo(barX, barY)
  ctx.lineTo(barX + barW, barY)
  ctx.moveTo(barX, barY - tickH / 2)
  ctx.lineTo(barX, barY + tickH / 2)
  ctx.moveTo(barX + barW, barY - tickH / 2)
  ctx.lineTo(barX + barW, barY + tickH / 2)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

function onWindowResize() {
  resizeCanvas()
}

defineExpose({
    resetZoom: () => {
        if (!canvas.value || !container.value) return
        const zoom = d3.zoom()
        const t = d3.zoomIdentity.translate(container.value.clientWidth / 2, container.value.clientHeight / 2).scale(0.5)
        d3.select(canvas.value)
            .transition()
            .duration(750)
            .call(zoom.transform, t)
        
        // Update local transform var
        transform = t
        saveTransform(t)
    },
    fitToScreen: () => {
        if (!canvas.value || !container.value || nodesData.length === 0) return
        
        // Calculate bounding box of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        nodesData.forEach(n => {
            minX = Math.min(minX, n.x)
            minY = Math.min(minY, n.y)
            maxX = Math.max(maxX, n.x)
            maxY = Math.max(maxY, n.y)
        })
        
        // Add padding (capsule size + small extra)
        const padding = 20
        minX -= CAPSULE_WIDTH / 2 + padding
        minY -= CAPSULE_HEIGHT / 2 + padding
        maxX += CAPSULE_WIDTH / 2 + padding
        maxY += CAPSULE_HEIGHT / 2 + padding
        
        const contentWidth = Math.max(0.0001, maxX - minX)
        const contentHeight = Math.max(0.0001, maxY - minY)
        let viewWidth = container.value.clientWidth
        const viewHeight = container.value.clientHeight

        // Don't fit "behind" the legend (legend overlays the right side)
        const wrapper = container.value.closest('.graph-wrapper')
        const legendEl = wrapper ? wrapper.querySelector('.legend') : null
        if (legendEl) {
          const legendWidth = legendEl.getBoundingClientRect().width
          const legendGap = 24 // allow some breathing room from legend edge
          viewWidth = Math.max(1, viewWidth - legendWidth - legendGap)
        }

        // Add 20% border around the fitted content (10% per side)
        const borderFrac = 0.2
        const effectiveW = Math.max(1, viewWidth * (1 - borderFrac))
        const effectiveH = Math.max(1, viewHeight * (1 - borderFrac))
        const marginX = (viewWidth - effectiveW) / 2
        const marginY = (viewHeight - effectiveH) / 2
        
        const scale = Math.min(effectiveW / contentWidth, effectiveH / contentHeight, 2) // Cap max scale
        const x = marginX + (effectiveW - contentWidth * scale) / 2 - minX * scale
        const y = marginY + (effectiveH - contentHeight * scale) / 2 - minY * scale
        
        const zoom = d3.zoom()
        const t = d3.zoomIdentity.translate(x, y).scale(scale)
        
        d3.select(canvas.value)
            .transition()
            .duration(750)
            .call(zoom.transform, t)
            
        transform = t
        saveTransform(t)
    },
    markDataOnlyUpdate: () => {
        dataOnlyUpdateOnce = true
    },
    restartSimulation: () => {
        if (props.physicsPaused) return
        if (simulation) simulation.alpha(1).restart()
    }
})
</script>

<style>
.graph-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
  cursor: grab;
}
.graph-wrapper:active {
  cursor: grabbing;
}
/* Override cursor when we set it manually in JS */
/* .graph-wrapper canvas {} */
.graph-container {
  width: 100%;
  height: 100%;
}
canvas {
  display: block;
  /* Ensure canvas doesn't blur on CSS scaling, though we set width/height attributes correctly */
  touch-action: none;
}

.issue-context-menu {
  position: absolute;
  z-index: 20;
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
  /* Full-bleed title bar (no inset card look) */
  margin: -6px -6px 6px -6px;
  padding: 10px 12px 8px 12px;
  border-radius: 0 10px 0 0;
  border: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.10);
  border-left: 6px solid rgba(0, 0, 0, 0.18);
}

html[data-theme="dark"] .issue-context-menu__header {
  border-left-color: rgba(255, 255, 255, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.issue-context-menu__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.issue-context-menu__header-key {
  font-weight: 700;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-context-menu__header-state {
  font-size: 10px;
  opacity: 0.8;
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
}

html[data-theme="dark"] .issue-context-menu__header-state {
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.issue-context-menu__header-title {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.95;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.issue-context-menu__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 6px;
}

.issue-context-menu__grid .issue-context-menu__item {
  padding: 5px 8px;
}

.issue-context-menu__grid--actions {
  margin-bottom: 2px;
}

.issue-context-menu__item--warn {
  opacity: 0.9;
}

html[data-theme="dark"] .issue-context-menu {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(20, 22, 26, 0.98);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
}

.issue-context-menu__section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.issue-context-menu__divider {
  height: 1px;
  margin: 5px 4px;
  background: rgba(0, 0, 0, 0.08);
}

html[data-theme="dark"] .issue-context-menu__divider {
  background: rgba(255, 255, 255, 0.10);
}

.issue-context-menu__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  opacity: 0.75;
  padding: 2px 6px 2px 6px;
}

.issue-context-menu__title--row {
  justify-content: space-between;
  gap: 10px;
}

.issue-context-menu__title-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.issue-context-menu__title-action {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit;
  cursor: pointer;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  line-height: 1.1;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  white-space: nowrap;
}

.issue-context-menu__title-action:hover {
  background: rgba(0, 0, 0, 0.06);
}

html[data-theme="dark"] .issue-context-menu__title-action {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

html[data-theme="dark"] .issue-context-menu__title-action:hover {
  background: rgba(255, 255, 255, 0.10);
}

.issue-context-menu__item-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue-context-menu__icon {
  opacity: 0.85;
}

.issue-context-menu__item {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.2;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

.issue-context-menu__item:hover {
  background: rgba(0, 0, 0, 0.06);
}

html[data-theme="dark"] .issue-context-menu__item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.issue-context-menu__item:disabled,
.issue-context-menu__item[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
}

.issue-context-menu__item:disabled:hover,
.issue-context-menu__item[aria-disabled="true"]:hover {
  background: transparent;
}

.issue-context-menu__item--small {
  font-size: 11px;
  padding: 6px 8px;
}

.issue-context-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
}

.issue-context-menu__row:hover {
  background: rgba(0, 0, 0, 0.04);
}

html[data-theme="dark"] .issue-context-menu__row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.issue-context-menu__row-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
}

.issue-context-menu__row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.issue-context-menu__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit;
  cursor: pointer;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.1;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

.issue-context-menu__pill-icon {
  opacity: 0.9;
}

.issue-context-menu__pill:hover {
  background: rgba(0, 0, 0, 0.06);
}

html[data-theme="dark"] .issue-context-menu__pill {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

html[data-theme="dark"] .issue-context-menu__pill:hover {
  background: rgba(255, 255, 255, 0.10);
}

.issue-context-menu__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 6px 2px 6px;
}

.issue-context-menu__chip {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  color: inherit;
  cursor: pointer;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  line-height: 1.1;
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-context-menu__chip:hover {
  background: rgba(0, 0, 0, 0.06);
}

html[data-theme="dark"] .issue-context-menu__chip {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

html[data-theme="dark"] .issue-context-menu__chip:hover {
  background: rgba(255, 255, 255, 0.10);
}

.legend {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 220px;
  max-height: calc(100% - 24px);
  overflow: auto;
  padding: 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
}

.legend-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 700;
  margin-bottom: 8px;
  opacity: 0.9;
}

.legend-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.legend-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.85;
  cursor: pointer;
  user-select: none;
}

.legend-toggle input {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: #ffc107;
}

.legend-sort {
  display: flex;
  gap: 6px;
}

.legend-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 11px;
  cursor: pointer;
}

.legend-btn.active {
  border-color: rgba(255, 193, 7, 0.45);
  background: rgba(255, 193, 7, 0.12);
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 2px 4px;
}

.legend-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.legend-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.95;
}

.legend-count {
  opacity: 0.65;
}

.legend-gradient {
  margin-top: 6px;
}

.legend-gradient-bar {
  height: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.legend-gradient-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.8;
}

.link-legend {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.link-legend-title {
  font-weight: 700;
  margin-bottom: 6px;
  opacity: 0.9;
}

.link-legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-legend-item {
  display: grid;
  grid-template-columns: 50px 1fr;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 2px 4px;
}

.link-legend-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.link-legend-swatch {
  width: 50px;
  height: 14px;
  display: block;
}

.link-legend-label {
  opacity: 0.95;
  white-space: nowrap;
}
</style>
