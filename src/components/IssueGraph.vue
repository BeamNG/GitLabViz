<template>
  <div class="graph-wrapper">
    <div ref="container" class="graph-container">
      <canvas ref="canvas"></canvas>
    </div>
    <div v-if="(showLegend && (legendItems.length || legendGradient)) || showLinkLegend" class="legend">
      <div class="legend-title">
        <span>Legend</span>
        <div v-if="!legendGradient" class="legend-sort">
          <button type="button" class="legend-btn" :class="{ active: legendSort === 'name' }" @click="legendSort = 'name'">Name</button>
          <button type="button" class="legend-btn" :class="{ active: legendSort === 'count' }" @click="legendSort = 'count'">#</button>
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
import { ref, computed, onMounted, onUnmounted, watch, toRaw } from 'vue'
import * as d3 from 'd3'
import { useSettingsStore } from '../composables/useSettingsStore'

const props = defineProps({
  nodes: Object,
  edges: Object,
  colorMode: { type: String, default: 'state' }, // 'state' | 'tag' | 'author'
  groupBy: { type: String, default: 'none' }, // 'none' | 'tag' | 'author' | 'state' | 'scoped:<Prefix>'
  linkMode: { type: String, default: 'dependency' }, // 'none' | 'dependency' | 'group'
  hideUnlinked: { type: Boolean, default: false },
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

const { settings } = useSettingsStore()

const legendItems = ref([])
const timelineLegend = ref(null) // { css, minLabel, maxLabel } | null
const legendGradient = computed(() => {
  if (props.colorMode && props.colorMode.startsWith('timeline_')) {
    return timelineLegend.value
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
    'time_ratio',
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
  if (containerResizeObserver) {
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }
})

watch(() => [props.nodes, props.edges, props.colorMode, props.groupBy, props.linkMode, props.hideUnlinked, props.repulsion, props.friction, props.groupGravity, props.linkStrength, props.linkDistance, props.centerGravity, props.gridStrength, props.gridSpacing], () => {
  updateGraph()
}, { deep: true })

watch(legendSort, () => {
  if (!legendItems.value.length) return
  legendItems.value = sortLegendItems(legendItems.value)
})

watch(legendHoverKey, () => {
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

function updateGraph() {
  if (!props.nodes) return

  const neutralNode = colors.value.neutralNode
  const isSvnRevisionMode = props.groupBy === 'svn_revision'

  // 1. Prepare Data
  nodesData = Object.values(toRaw(props.nodes)).map(n => {
    const node = { ...n }
    
    // Extract metadata
    const labels = node._raw.labels || []
    
    // Helper for scoped labels
    const getScoped = (prefix) => {
        const found = labels.find(l => l.startsWith(prefix + '::'))
        return found ? found.substring(prefix.length + 2) : null
    }

    node.tag = labels.length > 0 ? labels[0] : '_no_tag_'
    node.authorName = node._raw.author ? node._raw.author.name : 'Unknown'
    node.assigneeName = node._raw.assignee ? node._raw.assignee.name : 'Unassigned'
    node.milestoneTitle = node._raw.milestone ? node._raw.milestone.title : 'No Milestone'
    node.state = node._raw.state
    // Status is a scoped label (Status::...). If multiple exist, prefer the last one.
    const statusMatches = labels
      .filter(l => typeof l === 'string' && l.startsWith('Status::'))
      .map(l => l.substring('Status::'.length))
      .filter(Boolean)
    node.statusLabel = statusMatches.length ? statusMatches[statusMatches.length - 1] : null
    node.priority = getScoped('Priority') || 'No Priority'
    node.type = getScoped('Type') || 'No Type'
    node.weight = node._raw.weight != null ? String(node._raw.weight) : 'No Weight'
    node.epic = node._raw.epic ? node._raw.epic.title : 'No Epic'
    node.iteration = node._raw.iteration ? node._raw.iteration.title : 'No Iteration'
    
    // Calculate staleness (days since last update)
    const now = new Date()
    const updated = new Date(node._raw.updated_at)
    const diffTime = Math.abs(now - updated)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    node.daysSinceUpdate = diffDays
    
    const created = new Date(node._raw.created_at)
    const ageDiff = Math.abs(now - created)
    const ageDays = Math.ceil(ageDiff / (1000 * 60 * 60 * 24))
    node.ageDays = ageDays

    // Assign Color
    // "none" = default coloring (only open/closed), no Status:: label overrides
    if (props.colorMode === 'none') {
        node.color = node.state === 'opened' ? '#28a745' : '#dc3545'
        node.displayTag = null
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
    return node
  })

  // Clear "last opened" highlight if that node no longer exists in the graph
  const last = settings?.graph?.lastOpenedNodeId
  if (last != null && !nodesData.some(n => String(n.id) === String(last))) {
    settings.graph.lastOpenedNodeId = null
  }

  // Apply timeline coloring + legend once we know min/max dates.
  timelineLegend.value = null
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

  // Hide nodes with no links (dependency mode only)
  if (props.linkMode === 'dependency' && props.hideUnlinked) {
    const linked = new Set()
    edgesData.forEach(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      if (s != null) linked.add(String(s))
      if (t != null) linked.add(String(t))
    })
    nodesData = nodesData.filter(n => linked.has(String(n.id)))
    const keep = new Set(nodesData.map(n => String(n.id)))
    edgesData = edgesData.filter(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      return keep.has(String(s)) && keep.has(String(t))
    })
  }

  // --- Initial Layout (Grid) ---
  const cols = Math.ceil(Math.sqrt(nodesData.length))
  nodesData.forEach((node, index) => {
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
        else if (props.groupBy === 'state') d._groupKey = d.state
        else if (props.groupBy === 'assignee') d._groupKey = d.assigneeName
        else if (props.groupBy === 'milestone') d._groupKey = d.milestoneTitle
        else if (props.groupBy === 'priority') d._groupKey = d.priority
        else if (props.groupBy === 'type') d._groupKey = d.type
        else if (props.groupBy === 'weight') d._groupKey = d.weight
        else if (props.groupBy === 'epic') d._groupKey = d.epic
        else if (props.groupBy === 'iteration') d._groupKey = d.iteration
        else if (props.groupBy && props.groupBy.startsWith('scoped:')) {
            const prefix = props.groupBy.substring('scoped:'.length)
            const labels = d._raw?.labels || []
            const matches = labels
              .filter(l => typeof l === 'string' && l.startsWith(prefix + '::'))
              .map(l => l.substring(prefix.length + 2))
              .filter(Boolean)
            d._groupKey = matches.length ? matches[matches.length - 1] : `No ${prefix}`
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

      const groupNodes = groups.map(g => {
          const count = groupSizes[g]
          // Heuristic for group radius based on node count and capsule size
          // Used for collision between groups
          // Increased spacing factor to prevent groups from overlapping too much
          const r = Math.sqrt(count) * (CAPSULE_WIDTH * 0.8) + 200
          // Initialize with random positions to prevent stacking at (0,0) and explosion
          return { 
              id: g, 
              r, 
              x: (Math.random() - 0.5) * 1000, 
              y: (Math.random() - 0.5) * 1000 
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

  simulation = d3.forceSimulation(nodesData)
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
    .on("tick", ticked)

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
  
  for (let pass = 0; pass < 3; pass++) { // Reduced passes from 5 to 3
    for (let i = 0; i < l; ++i) {
      const d1 = nodes[i]
      for (let j = i + 1; j < l; ++j) {
        const d2 = nodes[j]
        const dx = d1.x - d2.x
        const dy = d1.y - d2.y
        
        if (dx === 0 && dy === 0) {
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

function render() {
  if (!canvas.value) return
  const c = colors.value
  const ctx = canvas.value.getContext('2d', { alpha: false }) // Optimize: opaque canvas
  const width = canvas.value.width
  const height = canvas.value.height
  const dpr = window.devicePixelRatio || 1

  const drawRoundedPoly = (poly, radius) => {
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

      if (i === 0) ctx.moveTo(p1x, p1y)
      else ctx.lineTo(p1x, p1y)
      ctx.quadraticCurveTo(curr[0], curr[1], p2x, p2y)
    }
    ctx.closePath()
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
  
  // Apply Zoom Transform
  // Note: We scale by DPR here to ensure high res rendering
  ctx.translate(transform.x * dpr, transform.y * dpr)
  ctx.scale(transform.k * dpr, transform.k * dpr)

  // Draw Group Hulls
  if (props.groupBy !== 'none' && props.groupBy !== 'svn_revision') {
      const groups = {}
      nodesData.forEach(node => {
          if (!groups[node._groupKey]) groups[node._groupKey] = []
          groups[node._groupKey].push(node)
      })

      // Use a fixed color for all smudges or varied slightly? Neutral is best for 'smudge'.
      // Darker gray when zoomed out to make groups stand out more
      const intensity = Math.min(0.15, 0.05 + (0.1 / Math.max(0.1, transform.k)))
      // ctx.fillStyle = `rgba(200, 200, 200, ${intensity})` // Dynamic opacity
      // ctx.strokeStyle = '#e0e0e0'
      ctx.lineJoin = 'round'
      ctx.lineWidth = HULL_STROKE_WIDTH // Large stroke to create "smudge" feel around points

      const colorModeMatchesGroup = props.groupBy === props.colorMode

      Object.entries(groups).forEach(([groupKey, groupNodes]) => {
          if (groupNodes.length === 0) return

          // Determine color
          let fillColor = c.hullBase(intensity)
          if (colorModeMatchesGroup && groupNodes[0].color) {
               const dc = d3.color(groupNodes[0].color)
               if (dc) {
                   dc.opacity = intensity * 1.5 
                   fillColor = dc.toString()
               }
          }
          
          // Uniform Smudge Rendering
          // To avoid overlapping borders creating darker regions, we render without stroke.
          // To expand the hull (since we removed the thick stroke), we need a different approach or accept tight fit.
          // However, for "smudge", tight fit with shadowBlur creates a nice soft effect without hard borders.
          
          ctx.fillStyle = fillColor
          ctx.shadowColor = fillColor
          ctx.shadowBlur = 60 // Soft blur to create the smudge effect
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
          
          // Calculate stats for label and hull
          let minY = Infinity
          let avgX = 0
          
          // Create points from corners of all nodes in group
          const points = []
          // Add a small padding to ensure we fully enclose the visual capsule including border
          const pad = 10 
          const hw = CAPSULE_WIDTH / 2 + pad
          const hh = CAPSULE_HEIGHT / 2 + pad
          
          groupNodes.forEach(n => {
              if (n.y < minY) minY = n.y
              avgX += n.x
              
              points.push([n.x - hw, n.y - hh])
              points.push([n.x + hw, n.y - hh])
              points.push([n.x + hw, n.y + hh])
              points.push([n.x - hw, n.y + hh])
          })
          avgX /= groupNodes.length
          
          // Find min Y from hull points for label placement
          let hullMinY = Infinity
          points.forEach(p => {
             if (p[1] < hullMinY) hullMinY = p[1]
          })
          
          if (groupNodes.length === 1) {
              const n = groupNodes[0]
              const w = CAPSULE_WIDTH + 40 // Expand a bit
              const h = CAPSULE_HEIGHT + 40
              const x = n.x - w/2
              const y = n.y - h/2
              ctx.beginPath()
              ctx.roundRect(x, y, w, h, 50) // Rounded corners
              ctx.fill()
          } else {
              const hull = d3.polygonHull(points)
              if (hull) {
                  // Extrude hull by ~20% and round corners for a softer, more "blob" look
                  let cx = 0
                  let cy = 0
                  hull.forEach(p => { cx += p[0]; cy += p[1] })
                  cx /= hull.length
                  cy /= hull.length

                  const extrude = 1.2
                  const hull2 = hull.map(p => [cx + (p[0] - cx) * extrude, cy + (p[1] - cy) * extrude])

                  hullMinY = Infinity
                  hull2.forEach(p => { if (p[1] < hullMinY) hullMinY = p[1] })

                  ctx.beginPath()
                  drawRoundedPoly(hull2, 120)
                  ctx.fill()
              }
          }
          
          // Reset shadow
          ctx.shadowBlur = 0
          ctx.shadowColor = 'transparent'
          
          // Draw Label
          ctx.save()
          ctx.fillStyle = c.textDim
          // Dynamic font size based on zoom
          // Ensure readable on screen (approx 30px height) even when zoomed out
          const minScreenFontSize = 10
          const baseWorldFontSize = 40 
          const fontSize = Math.max(baseWorldFontSize, minScreenFontSize / transform.k)
          
          ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          
          // Place label above the group hull
          const labelY = hullMinY - LABEL_PADDING
          
          ctx.fillText(groupKey, avgX, labelY)
          ctx.restore()
      })
      
      // Reset styles
      ctx.lineWidth = 1
      ctx.lineJoin = 'miter'
  }

  // 1. Draw Links
  if (props.linkMode !== 'none') {
    const depLinksOnTop = props.linkMode === 'dependency' && transform.k < 0.55

    const drawDependencyLinks = () => {
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

  nodesData.forEach(node => {
    const x = node.x - w/2
    const y = node.y - h/2

    const isLegendHover = legendHoverKey.value && node._legendKey === legendHoverKey.value
    const lastOpened = settings?.graph?.lastOpenedNodeId
    const isLastOpened = lastOpened != null && String(node.id) === String(lastOpened)

    // Shadow (Static) - only if not hovered (hover has its own dynamic shadow)
    if (hoveredNodeId !== node.id) {
        ctx.fillStyle = c.shadow
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w, h, r)
        ctx.fill()
    }

    // Capsule Background
    const isZoomedOut = transform.k < 0.4
    if (isZoomedOut && node.color) {
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
    
    // Border
    ctx.strokeStyle = c.nodeBorder
    ctx.lineWidth = 2
    if (node.color) ctx.strokeStyle = node.color

    if (isLegendHover) {
        // Make highlight thickness depend on zoom (so it's still visible zoomed out).
        const scale = Math.max(0.0001, transform.k * dpr)
        // Make highlight smaller when zoomed out, bigger when zoomed in (px-based).
        const px = Math.max(2, Math.min(8, 2 + (transform.k * 6)))
        const lw = px / scale

        // Perf: avoid per-node shadow blur (very expensive with lots of matches).
        // Keep it as a simple thick outline.
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.95)'
        ctx.lineWidth = lw * 1.8
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
    }
    
    // Hover Effect
    if (hoveredNodeId === node.id) {
        ctx.lineWidth = 4
        // ctx.strokeStyle = '#000' // Or make border darker/thicker
        // Maybe add shadow?
        ctx.shadowColor = c.hoverShadow
        ctx.shadowBlur = 15
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4
    } else {
        // Keep legend highlight glow if active; otherwise clear.
        if (!isLegendHover) {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
    }

    // Persistently highlight the last opened issue (one node only)
    if (isLastOpened) {
        const scale = Math.max(0.0001, transform.k * dpr)
        const lw = 6 / scale
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.95)'
        ctx.lineWidth = Math.max(ctx.lineWidth, lw)
        ctx.shadowColor = 'rgba(0, 200, 255, 0.45)'
        ctx.shadowBlur = 18 / scale
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
    }
    
    ctx.stroke()
    
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

    if (transform.k > 0.15) {
        // -- Header Row --
        const headerY = y + 20
        
        // ID (Left)
        ctx.fillStyle = c.textId
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
        ctx.fillStyle = c.textMain
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
        ctx.fillStyle = c.textMuted
        ctx.font = metaFont
        ctx.textAlign = 'left'
        ctx.fillText(authorName, x + 15, y + h - 15)

        // -- Tag (Bottom Right) --
        if (node.displayTag && node.displayTag !== '_no_tag_' && node.displayTag !== authorName) {
          ctx.textAlign = 'right'
          ctx.fillStyle = node.color
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
        
        // Add padding (capsule size + extra)
        const padding = 100
        minX -= CAPSULE_WIDTH/2 + padding
        minY -= CAPSULE_HEIGHT/2 + padding
        maxX += CAPSULE_WIDTH/2 + padding
        maxY += CAPSULE_HEIGHT/2 + padding
        
        const contentWidth = maxX - minX
        const contentHeight = maxY - minY
        const viewWidth = container.value.clientWidth
        const viewHeight = container.value.clientHeight
        
        const scale = Math.min(viewWidth / contentWidth, viewHeight / contentHeight, 2) // Cap max scale
        const x = (viewWidth - contentWidth * scale) / 2 - minX * scale
        const y = (viewHeight - contentHeight * scale) / 2 - minY * scale
        
        const zoom = d3.zoom()
        const t = d3.zoomIdentity.translate(x, y).scale(scale)
        
        d3.select(canvas.value)
            .transition()
            .duration(750)
            .call(zoom.transform, t)
            
        transform = t
        saveTransform(t)
    },
    restartSimulation: () => {
        if (simulation) {
            simulation.alpha(1).restart()
        }
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
