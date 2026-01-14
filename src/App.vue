<template>
  <v-app>
    <AppSidebar
      v-if="activePage === 'main'"
      v-model:vizMode="vizMode"
      v-model:svnVizLimit="svnVizLimit"
      :settings="settings"
      :build-title="buildTitle"
      :app-version="appVersion"
      :physics-paused="physicsPaused"
      :loading="loading"
      :loading-message="loadingMessage"
      :is-data-stale="isDataStale"
      :can-use-svn="canUseSvn"
      :is-electron="isElectron"
      :viz-mode-options="vizModeOptions"
      :GLOBAL_PRESETS="GLOBAL_PRESETS"
      :custom-presets="customPresets"
      :all-labels="allLabels"
      :all-authors="allAuthors"
      :all-assignees="allAssignees"
      :all-participants="allParticipants"
      :user-state-by-name="userStateByName"
      :me-name="settings.meta.gitlabMeName"
      :all-milestones="allMilestones"
      :all-priorities="allPriorities"
      :all-types="allTypes"
      :date-filter-modes="dateFilterModes"
      :grouping-mode-options="groupingModeOptions"
      :view-mode-options="viewModeOptions"
      :link-mode-options="linkModeOptions"
      :svn-recent-commits="svnRecentCommits"
      :svn-commit-count-label="svnCommitCountLabel"
      :has-data="hasData"
      :stats-text="statsText"
      :data-age="dataAge"
      :last-updated-date="lastUpdatedDate"
      :group-stats-text="groupStatsText"
      :on-toggle-physics="togglePhysics"
      :on-open-config="openConfig"
      :on-open-changelog="openChangelog"
      :on-refresh-click="handleRefreshClick"
      :on-create-preset="createPreset"
      :on-apply-preset="applyPreset"
      :on-refocus-graph="refocusGraph"
      :on-fit-graph="fitGraph"
      :on-reflow-graph="reflowGraph"
      :on-reset-filters="resetFilters"
      :on-show-svn-log="openSvnLog"
    />

    <!-- <v-app-bar color="primary" density="compact" elevation="1">
      <v-app-bar-title>GitLab Viz</v-app-bar-title>
    </v-app-bar> -->

    <v-main>
      <ConfigPage
        v-if="activePage === 'config'"
        :stats="configStats"
        :update-status="updateStatus"
        :error="error"
        :initial-tab="configInitialTab"
        @close="activePage = 'main'"
        @save="handleConfigSave"
        @tab-change="configInitialTab = $event || 'gitlab'"
        @clear-data="clearData"
        @update-source="handleUpdateSource"
        @clear-source="handleClearSource"
      />
      <ChatToolsPage
        v-else-if="isElectron && activePage === 'chattools'"
        @close="activePage = 'main'"
        @open-config="configInitialTab = 'gitlab'; activePage = 'config'"
      />
      <v-container v-else fluid class="pa-0 fill-height position-relative">
        <div v-if="error" class="position-absolute top-0 w-100 pa-4 text-error z-index-10 bg-surface">
          {{ error }}
        </div>

        <div
          v-if="isMockGraph"
          class="sample-watermark position-absolute top-0 left-0 w-100 h-100 d-flex align-center justify-center"
        >
          SAMPLE DATA
        </div>

        <div
          v-if="isMockGraph"
          class="position-absolute top-0 left-50 pa-3 z-index-10"
          style="max-width: 460px;"
        >
          <v-alert type="info" variant="tonal" density="compact" icon="mdi-flask-outline">
            Showing <strong>sample data</strong>. Configure sources and hit Refresh to load real data.
          </v-alert>
        </div>
        
          <IssueGraph 
          ref="issueGraph"
          v-if="hasData" 
          :nodes="filteredNodes" 
          :edges="filteredEdges" 
          :color-mode="settings.uiState.view.viewMode"
          :group-by="settings.uiState.view.groupingMode"
          :link-mode="settings.uiState.view.linkMode"
          :hide-unlinked="settings.uiState.view.hideUnlinked"
          :physics-paused="physicsPaused"
          :repulsion="settings.uiState.simulation.repulsion"
          :friction="settings.uiState.simulation.friction"
          :group-gravity="settings.uiState.simulation.groupGravity"
          :link-strength="settings.uiState.simulation.linkStrength"
          :link-distance="settings.uiState.simulation.linkDistance"
          :center-gravity="settings.uiState.simulation.centerGravity"
          :grid-strength="settings.uiState.simulation.gridStrength"
          :grid-spacing="settings.uiState.simulation.gridSpacing"
          @issue-state-change="onIssueStateChange"
          @issue-assignee-change="onIssueAssigneeChange"
        />
        
        <div v-else-if="!loading" class="d-flex flex-column align-center justify-center w-100 h-100 text-medium-emphasis pa-8">
          <v-icon icon="mdi-source-branch" size="64" class="mb-4"></v-icon>
          <div class="text-h5 text-center mb-4">No data loaded</div>
          <div class="text-body-1 text-center mb-6">Configure your data sources to get started.</div>
          <v-btn
            color="primary"
            prepend-icon="mdi-cog"
            @click="configInitialTab = 'gitlab'; activePage = 'config'"
            size="large"
          >
            Open Configuration
          </v-btn>
        </div>
      </v-container>
    </v-main>

    <SvnLogDialog v-if="isElectron" v-model="showSvnLog" :repo-url="svnUrl" />

    <v-snackbar
      v-model="snackbar"
      :timeout="2000"
      color="success"
      variant="tonal"
      class="app-snackbar"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          color="on-surface"
          variant="text"
          @click="snackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, toRaw } from 'vue'
import { useTheme } from 'vuetify'
import IssueGraph from './components/IssueGraph.vue'
import AppSidebar from './components/AppSidebar.vue'
import ConfigPage from './components/ConfigPage.vue'
import ChatToolsPage from './components/ChatToolsPage.vue'
import SvnLogDialog from './components/SvnLogDialog.vue'
import { useAppTheme } from './composables/useAppTheme'
import { useHashRouting } from './composables/useHashRouting'
import { useDataLoader } from './composables/useDataLoader'
import { useGraphDerivedState } from './composables/useGraphDerivedState'
import { useSvnVizMode } from './composables/useSvnVizMode'
import { useGitLabIssueMutations } from './composables/useGitLabIssueMutations'
import { useSettingsStore } from './composables/useSettingsStore'
import { GLOBAL_PRESETS } from './presets'
import { getScopedLabelValue, getScopedLabelValues } from './utils/scopedLabels'

const { settings, init: initSettings } = useSettingsStore()

const isElectron = computed(() => !!window.electronAPI)
const hasSvnProxy = computed(() => !!String(import.meta.env.VITE_SVN_PROXY_TARGET || '').trim())
const canUseSvn = computed(() => isElectron.value || hasSvnProxy.value)

const vuetifyTheme = useTheme()
useAppTheme({ settings, vuetifyTheme })

// Core settings (multi-repo SVN aware)
const primarySvnRepo = computed(() => {
  const list = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
  return list.find(r => (r && r.enabled !== false && r.url)) || list[0] || null
})

const svnUrl = computed({
  get: () => primarySvnRepo.value?.url || '',
  set: v => { if (primarySvnRepo.value) primarySvnRepo.value.url = v }
})

const activePage = ref('main') // 'main' | 'config' | 'chattools'
const configInitialTab = ref('gitlab')
useHashRouting({ activePage, configInitialTab })
const loading = ref(false)
const loadingMessage = ref('')
const error = ref('')

const customPresets = computed(() => {
  const p = settings.uiState && settings.uiState.presets ? settings.uiState.presets : null
  return p && Array.isArray(p.custom) ? p.custom : []
})

const resetFilters = () => {
  settings.uiState.filters.includeClosed = false
  settings.uiState.filters.selectedStatuses = []
  settings.uiState.filters.selectedSubscription = null
  settings.uiState.filters.selectedLabels = []
  settings.uiState.filters.excludedLabels = []
  settings.uiState.filters.selectedAuthors = []
  settings.uiState.filters.selectedAssignees = []
  settings.uiState.filters.selectedMilestones = []
  settings.uiState.filters.selectedPriorities = []
  settings.uiState.filters.selectedTypes = []
  settings.uiState.filters.mrMode = null
  settings.uiState.filters.selectedParticipants = []
  settings.uiState.filters.dueStatus = null
  settings.uiState.filters.spentMode = null
  settings.uiState.filters.budgetMode = null
  settings.uiState.filters.estimateBucket = null
  settings.uiState.filters.taskMode = null
  settings.uiState.filters.searchQuery = ''
  settings.uiState.filters.dateFilters.createdMode = 'none'
  settings.uiState.filters.dateFilters.createdAfter = null
  settings.uiState.filters.dateFilters.createdBefore = null
  settings.uiState.filters.dateFilters.createdDays = null
  settings.uiState.filters.dateFilters.updatedMode = 'none'
  settings.uiState.filters.dateFilters.updatedAfter = null
  settings.uiState.filters.dateFilters.updatedBefore = null
  settings.uiState.filters.dateFilters.updatedDays = null
  settings.uiState.filters.dateFilters.dueDateMode = 'none'
  settings.uiState.filters.dateFilters.dueDateAfter = null
  settings.uiState.filters.dateFilters.dueDateBefore = null
  settings.uiState.filters.dateFilters.dueDateDays = null
  settings.uiState.view.viewMode = 'state'
  settings.uiState.view.groupingMode = 'none'
  settings.uiState.view.linkMode = 'none'
  settings.uiState.view.dueSoonDays = 7
}
const snackbar = ref(false)
const snackbarText = ref('')
const lastUpdated = ref(null)

// Trigger a periodic refresh of "data age" labels (otherwise Date.now() won't re-render).
const nowTick = ref(Date.now())
let nowTickInterval = null

const appVersion = (() => {
  try {
    return __APP_VERSION__
  } catch (e) {
    return ''
  }
})()

const buildTimeMs = (() => {
  try {
    const t = new Date(__BUILD_TIME__).getTime()
    return Number.isFinite(t) ? t : null
  } catch (e) {
    return null
  }
})()

const buildTitle = computed(() => {
  if (!appVersion) return 'GitLab Viz'
  const lines = [`GitLab Viz v${appVersion}`]
  if (!buildTimeMs) return lines.join('\n')
  const builtAt = new Date(buildTimeMs).toLocaleString()
  const diff = Math.max(0, nowTick.value - buildTimeMs)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  const age =
    days > 0 ? `${days}d ${hours % 24}h` :
    hours > 0 ? `${hours}h ${minutes % 60}m` :
    `${minutes}m`
  lines.push(`Built: ${builtAt}`)
  lines.push(`Age: ${age}`)
  return lines.join('\n')
})

const showSvnLog = ref(false)
const svnRecentCommits = ref([])
const svnCommitCount = ref(0)

const physicsPaused = ref(false)

const togglePhysics = () => { physicsPaused.value = !physicsPaused.value }
const openConfig = () => { configInitialTab.value = 'gitlab'; activePage.value = 'config' }
const openChangelog = () => { configInitialTab.value = 'changelog'; activePage.value = 'config' }
const openSvnLog = () => { showSvnLog.value = true }

const gitlabCacheMeta = ref({ nodes: 0, edges: 0, updatedAt: null })
const updateStatus = ref({ loading: false, source: '', message: '' })
const mattermostMeta = ref({ teams: 0, updatedAt: null })

const configStats = computed(() => ({
  gitlab: {
    nodes: Object.keys(nodes).length,
    edges: Object.keys(edges).length
  },
  gitlabCache: {
    nodes: gitlabCacheMeta.value?.nodes || 0,
    edges: gitlabCacheMeta.value?.edges || 0,
    updatedAt: gitlabCacheMeta.value?.updatedAt || null
  },
  svn: {
    repoUrl: svnUrl.value || '',
    commitCount: svnCommitCount.value || 0
  },
  mattermost: {
    loggedIn: !!settings.config.mattermostToken,
    username: settings.config.mattermostUser?.username || '',
    teams: mattermostMeta.value?.teams ?? 0,
    updatedAt: mattermostMeta.value?.updatedAt ?? null
  }
}))

// SVN viz state is handled by useSvnVizMode

// simulation + persistence handled by settings

const getCurrentConfigSnapshot = () => ({
  filters: {
    includeClosed: settings.uiState.filters.includeClosed,
    statuses: settings.uiState.filters.selectedStatuses,
    subscription: settings.uiState.filters.selectedSubscription,
    labels: settings.uiState.filters.selectedLabels,
    excludedLabels: settings.uiState.filters.excludedLabels,
    authors: settings.uiState.filters.selectedAuthors,
    assignees: settings.uiState.filters.selectedAssignees,
    milestones: settings.uiState.filters.selectedMilestones,
    priorities: settings.uiState.filters.selectedPriorities,
    types: settings.uiState.filters.selectedTypes,
    mrMode: settings.uiState.filters.mrMode,
    participants: settings.uiState.filters.selectedParticipants,
    dueStatus: settings.uiState.filters.dueStatus,
    spentMode: settings.uiState.filters.spentMode,
    budgetMode: settings.uiState.filters.budgetMode,
    estimateBucket: settings.uiState.filters.estimateBucket,
    taskMode: settings.uiState.filters.taskMode,
    dateFilters: { ...settings.uiState.filters.dateFilters }
  },
  view: {
    colorMode: settings.uiState.view.viewMode,
    grouping: settings.uiState.view.groupingMode,
    linkMode: settings.uiState.view.linkMode,
    dueSoonDays: settings.uiState.view.dueSoonDays,
    issueOpenTarget: settings.uiState.view.issueOpenTarget,
    colorOverrides: JSON.parse(JSON.stringify(settings.uiState.view.colorOverrides || {}))
  },
  ui: {
    showFilters: settings.uiState.ui.showFilters,
    showTemplates: settings.uiState.ui.showTemplates,
    showDisplay: settings.uiState.ui.showDisplay,
    showAdvancedSim: settings.uiState.ui.showAdvancedSim
  },
  simulation: {
    repulsion: settings.uiState.simulation.repulsion,
    linkStrength: settings.uiState.simulation.linkStrength,
    linkDistance: settings.uiState.simulation.linkDistance,
    friction: settings.uiState.simulation.friction,
    groupGravity: settings.uiState.simulation.groupGravity,
    centerGravity: settings.uiState.simulation.centerGravity,
    gridStrength: settings.uiState.simulation.gridStrength,
    gridSpacing: settings.uiState.simulation.gridSpacing
  }
})

const createPreset = async () => {
  try {
    const name = (prompt('Preset name?') || '').trim()
    if (!name) return

    //console.log('[App] Creating preset:', name)
    settings.uiState.presets = settings.uiState.presets || { custom: [] }
    const cur = Array.isArray(settings.uiState.presets.custom) ? settings.uiState.presets.custom : []

    const sanitizePreset = (p) => {
      if (!p || !p.name) return null
      try {
        const raw = p.config || p.settings?.config || p.settings
        const config = JSON.parse(JSON.stringify(toRaw(raw)))
        return { name: String(p.name), config }
      } catch {
        return null
      }
    }

    const list = cur.map(sanitizePreset).filter(Boolean)
    const next = { name: String(name), config: JSON.parse(JSON.stringify(getCurrentConfigSnapshot())) }

    const idx = list.findIndex(p => p && p.name === name)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    
    //console.log('[App] Updating settings.uiState.presets.custom with list:', list)
    settings.uiState.presets.custom = list

    settings.uiState.ui.showTemplates = true
    settings.uiState.ui.currentTemplateName = name
    snackbarText.value = `Created preset: ${name}`
    snackbar.value = true
  } catch (e) {
    console.error('Failed to create preset:', e)
    snackbarText.value = 'Failed to create preset'
    snackbar.value = true
  }
}


// drawer persistence handled by settings

// Need to define issueGraph ref
const issueGraph = ref(null)
const dateFilterModes = [
  { title: 'Any Time', value: 'none', icon: 'mdi-clock-outline' },
  { title: 'Before', value: 'before', icon: 'mdi-clock-start' },
  { title: 'After', value: 'after', icon: 'mdi-clock-end' },
  { title: 'Between', value: 'between', icon: 'mdi-clock-in' },
  { title: 'Last X Days', value: 'last_x_days', icon: 'mdi-history' }
]

const nodes = reactive({})
const edges = reactive({})

const { vizMode, svnVizLimit, issueGraphSnapshot, vizModeOptions, buildSvnVizGraph } = useSvnVizMode({
  settings,
  nodes,
  edges,
  svnRecentCommits,
  canUseSvn,
  isElectron,
  activePage
})

const linkModeOptions = [
  { title: 'None (No Links)', value: 'none', icon: 'mdi-link-off' },
  { title: 'Issue Dependency', value: 'dependency', icon: 'mdi-link-variant' },
  { title: 'Selected Group', value: 'group', icon: 'mdi-link-group' }
]

const viewModeOptions = [
  { title: 'None (Open/Closed)', value: 'none', icon: 'mdi-undo' },
  { title: 'Status', value: 'state', icon: 'mdi-list-status' },
  { title: 'Label', value: 'tag', icon: 'mdi-tag' },
  { title: 'Author', value: 'author', icon: 'mdi-account-edit' },
  { title: 'Assignee', value: 'assignee', icon: 'mdi-account-check' },
  { title: 'Milestone', value: 'milestone', icon: 'mdi-flag' },
  { title: 'Priority', value: 'priority', icon: 'mdi-alert-circle' },
  { title: 'Type', value: 'type', icon: 'mdi-shape' },
  { title: 'Weight', value: 'weight', icon: 'mdi-weight' },
  { title: 'Time Spent Ratio', value: 'time_ratio', icon: 'mdi-timer-outline' },
  { title: 'Due Status', value: 'due_status', icon: 'mdi-calendar-alert' },
  { title: 'Time Estimate', value: 'time_estimate', icon: 'mdi-timer-sand' },
  { title: 'Time Spent', value: 'time_spent', icon: 'mdi-timer' },
  { title: 'Budget (Over/Within)', value: 'budget_status', icon: 'mdi-cash' },
  { title: 'Estimate Buckets', value: 'estimate_bucket', icon: 'mdi-format-list-bulleted' },
  { title: 'Task Completion', value: 'task_completion', icon: 'mdi-format-list-checks' },
  { title: 'Upvotes', value: 'upvotes', icon: 'mdi-thumb-up-outline' },
  { title: 'Merge Requests', value: 'merge_requests', icon: 'mdi-git' },
  { title: 'Comment Count', value: 'comments', icon: 'mdi-comment-outline' },
  { title: 'Ticket Age', value: 'age', icon: 'mdi-calendar-clock' },
  { title: 'Last Updated', value: 'last_updated', icon: 'mdi-update' },
  { title: 'Timeline (Created)', value: 'timeline_created', icon: 'mdi-timeline-outline' },
  { title: 'Timeline (Updated)', value: 'timeline_updated', icon: 'mdi-timeline-clock-outline' },
  { title: 'Timeline (Closed)', value: 'timeline_closed', icon: 'mdi-timeline-check-outline' }
]

const groupingModeOptions = computed(() => {
  const scopedPrefixes = new Set()
  Object.values(nodes).forEach(node => {
    const labels = node?._raw?.labels || []
    labels.forEach(l => {
      if (typeof l !== 'string') return
      const idx2 = l.indexOf('::')
      if (idx2 > 0) {
        scopedPrefixes.add(l.slice(0, idx2))
        return
      }
      const idx1 = l.indexOf(':')
      if (idx1 > 0) scopedPrefixes.add(l.slice(0, idx1))
    })
  })

  const standard = [
    { title: 'None', value: 'none', icon: 'mdi-group-off' },
    { title: 'Status', value: 'state', icon: 'mdi-list-status' },
    { title: 'Label', value: 'tag', icon: 'mdi-tag' },
    { title: 'Author', value: 'author', icon: 'mdi-account-edit' },
    { title: 'Assignee', value: 'assignee', icon: 'mdi-account-check' },
    { title: 'Milestone', value: 'milestone', icon: 'mdi-flag' },
    { title: 'Priority', value: 'priority', icon: 'mdi-alert-circle' },
    { title: 'Type', value: 'type', icon: 'mdi-shape' },
    { title: 'Weight', value: 'weight', icon: 'mdi-weight' },
    { title: 'Epic', value: 'epic', icon: 'mdi-book-open-variant' },
    { title: 'Iteration', value: 'iteration', icon: 'mdi-repeat' },
    { title: 'Staleness', value: 'stale', icon: 'mdi-clock-alert-outline' },
    { title: 'Timeline (Created)', value: 'timeline_created', icon: 'mdi-timeline-outline' },
    { title: 'Timeline (Updated)', value: 'timeline_updated', icon: 'mdi-timeline-clock-outline' },
    { title: 'Timeline (Closed)', value: 'timeline_closed', icon: 'mdi-timeline-check-outline' }
  ]

  if (canUseSvn.value) {
    standard.splice(12, 0, { title: 'SVN Revision (Old → New)', value: 'svn_revision', icon: 'mdi-source-repository' })
  }

  const scoped = Array.from(scopedPrefixes)
    .sort()
    .filter(p => p && !['Priority', 'Type'].includes(p))
    .map(p => ({
      title: p === 'Status' ? 'Status (Label)' : `${p} (Label)`,
      value: `scoped:${p}`,
      icon: 'mdi-tag-text-outline'
    }))

  const items = [{ title: 'Standard', type: 'subheader' }, ...standard]
  if (scoped.length) items.push({ title: 'Labels', type: 'subheader' }, ...scoped)
  return items
})

const {
  allLabels,
  allAuthors,
  allAssignees,
  allParticipants,
  userStateByName,
  allMilestones,
  allPriorities,
  allTypes,
  filteredNodes,
  filteredEdges,
  hasData,
  isMockGraph,
  statsText,
  groupStatsText
} = useGraphDerivedState({ settings, nodes, edges })

const dataAge = computed(() => {
  if (!lastUpdated.value) return null
  // If the saved timestamp is slightly in the future (clock skew / timezone / restore),
  // clamp to 0 to avoid negative "age" labels like "-1m ago".
  const diff = Math.max(0, nowTick.value - lastUpdated.value)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
})

const lastUpdatedDate = computed(() => {
  if (!lastUpdated.value) return ''
  return new Date(lastUpdated.value).toLocaleString()
})

const isDataStale = computed(() => {
  if (!lastUpdated.value) return false
  const hours = Math.max(0, (nowTick.value - lastUpdated.value) / (1000 * 60 * 60))
  return hours > 6
})

const svnCommitCountLabel = computed(() => svnCommitCount.value)

const {
  resolveGitLabApiBaseUrl,
  initCachedData,
  loadData,
  handleRefreshClick,
  handleUpdateSource,
  handleClearSource,
  clearData
} = useDataLoader({
  settings,
  nodes,
  edges,
  issueGraphSnapshot,
  svnUrl,
  svnVizLimit,
  svnRecentCommits,
  svnCommitCount,
  gitlabCacheMeta,
  mattermostMeta,
  lastUpdated,
  loading,
  loadingMessage,
  updateStatus,
  error,
  isElectron,
  canUseSvn,
  vizMode,
  buildSvnVizGraph,
  resetFilters,
  createMockIssuesGraph
})

const { onIssueStateChange, onIssueAssigneeChange } = useGitLabIssueMutations({
  settings,
  nodes,
  issueGraph,
  resolveGitLabApiBaseUrl,
  snackbarText,
  snackbar
})

onMounted(async () => {
  // Set document title with version
  try {
    document.title = `GitLab Viz v${__APP_VERSION__}`
  } catch (e) {
    document.title = 'GitLab Viz'
  }

  // Ensure settings are loaded (disk-backed)
  await initSettings()

  // Keep sidebar "data age" fresh.
  nowTick.value = Date.now()
  nowTickInterval = setInterval(() => { nowTick.value = Date.now() }, 10 * 60 * 1000)

  await initCachedData()
})

onUnmounted(() => {
  if (nowTickInterval) clearInterval(nowTickInterval)
  nowTickInterval = null
})

function createMockIssuesGraph () {
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  const mk = (iid, title, labels = [], author = 'mock', assignee = null) => {
    const raw = {
      iid,
      id: iid,
      title,
      description: 'Sample issue (mock). Configure GitLab and refresh to load real data.',
      state: iid % 2 === 0 ? 'opened' : 'closed',
      labels,
      author: { name: author },
      assignee: assignee ? { name: assignee } : null,
      assignees: assignee ? [{ name: assignee }] : [],
      milestone: null,
      created_at: iso(now - iid * 86400000),
      updated_at: iso(now - iid * 43200000),
      closed_at: null,
      due_date: null,
      web_url: '',
      time_stats: { time_estimate: 0, total_time_spent: 0 },
      user_notes_count: iid % 5,
      merge_requests_count: iid % 3,
      upvotes: iid % 4,
      downvotes: 0,
      has_tasks: false,
      task_status: null,
      __mock: true
    }
    const id = String(iid)
    return [id, {
      id,
      name: `#${id} ${title.length > 20 ? title.substring(0, 20) + '...' : title}`,
      color: raw.state === 'opened' ? '#28a745' : '#dc3545',
      commentsCount: raw.user_notes_count,
      updatedAt: raw.updated_at,
      createdAt: raw.created_at,
      closedAt: raw.closed_at,
      dueDate: raw.due_date,
      confidential: false,
      webUrl: raw.web_url,
      weight: null,
      timeEstimate: 0,
      timeSpent: 0,
      timeSpentRatio: 0,
      upvotes: raw.upvotes,
      downvotes: 0,
      mergeRequestsCount: raw.merge_requests_count,
      hasTasks: false,
      taskStatus: null,
      type: 'gitlab_issue',
      _raw: raw
    }]
  }

  const nodesOut = {}
  const edgesOut = {}

  const samples = [
    mk(101, 'Mock: Onboarding checklist', ['Type::Chore', 'Priority::Low'], 'alice', 'bob'),
    mk(102, 'Mock: Fix crash on startup', ['Type::Bug', 'Priority::0 - Blocking'], 'carol', 'alice'),
    mk(103, 'Mock: Improve rendering perf', ['Type::Performance', 'Priority::High'], 'bob', 'carol'),
    mk(104, 'Mock: Add settings screen', ['Type::Feature', 'Priority::Medium'], 'alice', null),
    mk(105, 'Mock: Refactor color', ['Type::Chore', 'Priority::Low'], 'dan', 'alice')
  ]
  for (const [id, n] of samples) nodesOut[id] = n

  // a tiny dependency chain
  edgesOut['101-102'] = { source: '101', target: '102', label: 'blocks' }
  edgesOut['102-103'] = { source: '102', target: '103', label: 'related' }
  edgesOut['103-104'] = { source: '103', target: '104', label: 'relates' }

  return { nodes: nodesOut, edges: edgesOut }
}

// UI/filter persistence handled by settings

const handleConfigSave = () => {
    activePage.value = 'main'
    if (loading.value) return
    loadData()
}

// GitLab mutations are handled by useGitLabIssueMutations

// resetFilters provided locally (settings-backed)

const refocusGraph = () => {
    if (issueGraph.value) {
        issueGraph.value.resetZoom()
    }
}

const fitGraph = () => {
    if (issueGraph.value) {
        issueGraph.value.fitToScreen()
    }
}

const reflowGraph = () => {
    if (issueGraph.value) {
        issueGraph.value.restartSimulation()
    }
}

const applyConfiguration = (config) => {
    // Reset filters first (especially for templates that assume clean state)
    resetFilters()

    // Validate and Apply
    if (config.filters) {
      const meName = settings.meta.gitlabMeName || ''
      const resolveMe = (list) => {
        if (!Array.isArray(list)) return list
        if (!meName) return list.filter(v => v !== '@me')
        return list.map(v => (v === '@me' ? meName : v))
      }

      if (config.filters.includeClosed !== undefined) settings.uiState.filters.includeClosed = config.filters.includeClosed
      if (config.filters.statuses) settings.uiState.filters.selectedStatuses = config.filters.statuses
      if (config.filters.subscription !== undefined) settings.uiState.filters.selectedSubscription = config.filters.subscription
      if (config.filters.labels) settings.uiState.filters.selectedLabels = config.filters.labels
      if (config.filters.excludedLabels) settings.uiState.filters.excludedLabels = config.filters.excludedLabels
      if (config.filters.mrMode != null) settings.uiState.filters.mrMode = config.filters.mrMode
      if (config.filters.participants) settings.uiState.filters.selectedParticipants = resolveMe(config.filters.participants)
      if (config.filters.dueStatus != null) settings.uiState.filters.dueStatus = config.filters.dueStatus
      if (config.filters.spentMode != null) settings.uiState.filters.spentMode = config.filters.spentMode
      if (config.filters.budgetMode != null) settings.uiState.filters.budgetMode = config.filters.budgetMode
      if (config.filters.estimateBucket != null) settings.uiState.filters.estimateBucket = config.filters.estimateBucket
      if (config.filters.taskMode != null) settings.uiState.filters.taskMode = config.filters.taskMode
      if (config.filters.authors) settings.uiState.filters.selectedAuthors = resolveMe(config.filters.authors)
      if (config.filters.assignees) settings.uiState.filters.selectedAssignees = resolveMe(config.filters.assignees)
      if (config.filters.milestones) settings.uiState.filters.selectedMilestones = config.filters.milestones
      if (config.filters.priorities) settings.uiState.filters.selectedPriorities = config.filters.priorities
      if (config.filters.types) settings.uiState.filters.selectedTypes = config.filters.types
      if (config.filters.dateFilters) Object.assign(settings.uiState.filters.dateFilters, config.filters.dateFilters)
    }
    
    if (config.view) {
      if (config.view.colorMode) settings.uiState.view.viewMode = config.view.colorMode
      if (config.view.grouping) settings.uiState.view.groupingMode = config.view.grouping
      if (config.view.linkMode) settings.uiState.view.linkMode = config.view.linkMode
      if (config.view.dueSoonDays != null) settings.uiState.view.dueSoonDays = config.view.dueSoonDays
      if (config.view.issueOpenTarget) settings.uiState.view.issueOpenTarget = config.view.issueOpenTarget
      if (config.view.colorOverrides) settings.uiState.view.colorOverrides = config.view.colorOverrides
    }

    if (config.ui) {
        if (config.ui.showFilters !== undefined) settings.uiState.ui.showFilters = config.ui.showFilters
        if (config.ui.showDisplay !== undefined) settings.uiState.ui.showDisplay = config.ui.showDisplay
        if (config.ui.showAdvancedSim !== undefined) settings.uiState.ui.showAdvancedSim = config.ui.showAdvancedSim
    }

    if (config.simulation) {
        if (config.simulation.repulsion !== undefined) settings.uiState.simulation.repulsion = config.simulation.repulsion
        if (config.simulation.linkStrength !== undefined) settings.uiState.simulation.linkStrength = config.simulation.linkStrength
        if (config.simulation.linkDistance !== undefined) settings.uiState.simulation.linkDistance = config.simulation.linkDistance
        if (config.simulation.friction !== undefined) settings.uiState.simulation.friction = config.simulation.friction
        if (config.simulation.groupGravity !== undefined) settings.uiState.simulation.groupGravity = config.simulation.groupGravity
        if (config.simulation.centerGravity !== undefined) settings.uiState.simulation.centerGravity = config.simulation.centerGravity
        if (config.simulation.gridStrength !== undefined) settings.uiState.simulation.gridStrength = config.simulation.gridStrength
        if (config.simulation.gridSpacing !== undefined) settings.uiState.simulation.gridSpacing = config.simulation.gridSpacing
    }
}

const applyPreset = (preset) => {
    try {
        const wantsMe =
          preset?.config?.filters?.authors?.includes('@me') ||
          preset?.config?.filters?.assignees?.includes('@me')

        if (wantsMe && !settings.meta.gitlabMeName) {
            if (!settings.config.enableGitLab || !settings.config.token) {
                snackbarText.value = 'Cannot resolve @me: set GitLab token and refresh once'
                snackbar.value = true
                return
            }
        }

        resetFilters() // Reset first
        applyConfiguration(preset.config)
        settings.uiState.ui.currentTemplateName = preset.name
        snackbarText.value = `Applied preset: ${preset.name}`
        snackbar.value = true
        
        // Fit graph after applying template (allow reactivity to update first)
        setTimeout(() => {
            fitGraph()
        }, 100)
    } catch (e) {
        console.error("Failed to apply preset", e)
        snackbarText.value = 'Failed to apply preset'
        snackbar.value = true
    }
}
</script>

<style>
html, body {
  overflow: hidden; /* Prevent scrolling */
  height: 100%;
}
#app {
  height: 100%;
}
body {
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
.z-index-10 {
  z-index: 10;
}

/* Hide default scrollbar for drawer content to use our custom flex scrolling */
.v-navigation-drawer__content {
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}

/* Compact Input Overrides */
.compact-input .v-field__input {
  min-height: 32px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
.compact-input .v-field__append-inner,
.compact-input .v-field__prepend-inner {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  align-items: center !important;
}
.compact-input .v-label.v-field-label {
  top: 50% !important;
  transform: translateY(-50%) !important;
  font-size: 12px !important;
}
.compact-input .v-field--focused .v-label.v-field-label,
.compact-input .v-field--active .v-label.v-field-label {
  top: 0 !important;
  transform: translateY(-50%) scale(0.85) !important;
}
/* Reduce chip size if present */
.compact-input .v-chip {
  height: 20px !important;
  font-size: 10px !important;
}

.sample-watermark {
  z-index: 1;
  pointer-events: none;
  font-size: clamp(48px, 10vw, 140px);
  font-weight: 900;
  letter-spacing: 0.12em;
  color: rgba(0, 0, 0, 0.12);
  text-transform: uppercase;
  user-select: none;
  transform: rotate(-18deg);
  text-align: center;
  padding: 24px;
}
:root[data-theme="dark"] .sample-watermark {
  color: rgba(255, 255, 255, 0.08);
}

.custom-preset-btn {
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
}

.app-titlebar {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

:root[data-theme="dark"] .app-titlebar {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .app-toolbar.v-toolbar {
  background: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .app-snackbar .v-snackbar__wrapper {
  background: rgba(var(--v-theme-surface), 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-left: 3px solid rgba(var(--v-theme-success), 0.8) !important;
}

.app-version {
  opacity: 0.55;
  font-weight: 500;
  font-size: 0.7em;
  margin-left: 8px;
}
</style>
