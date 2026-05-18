<template>
  <v-app>
    <AppSidebar
      v-if="activePage === 'main' && !settings.uiState.ui.focusMode"
      v-model:vizMode="vizMode"
      v-model:svnVizLimit="svnVizLimit"
      v-model:viewLayout="settings.uiState.view.layout"
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
      :all-statuses="allStatuses"
      :all-labels="allLabels"
      :all-authors="allAuthors"
      :all-assignees="allAssignees"
      :all-participants="allParticipants"
      :user-state-by-name="userStateByName"
      :me-name="settings.meta.gitlabMeName"
      :all-milestones="allMilestones"
      :all-priorities="allPriorities"
      :all-types="allTypes"
      :filter-counts="filterCounts"
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

    <v-app-bar
      v-if="(tokenExpired || tokenExpiringSoon) && !settings.uiState.ui.focusMode"
      :color="tokenExpired ? 'error' : 'warning'"
      density="compact"
      :elevation="0"
      class="token-banner"
      @click="openTokenConfig"
    >
      <v-icon :icon="tokenExpired ? 'mdi-alert-circle' : 'mdi-clock-alert-outline'" class="ms-3 me-2" />
      <v-app-bar-title class="text-body-2">
        <strong v-if="tokenExpired">GitLab token expired</strong>
        <strong v-else>GitLab token expires in {{ tokenExpiry.days }} day{{ tokenExpiry.days === 1 ? '' : 's' }}</strong>
        <span class="ms-2 text-medium-emphasis">({{ tokenExpiry.dateStr }})</span>
        — click to create a new one.
      </v-app-bar-title>
      <v-btn
        variant="outlined"
        size="small"
        class="text-none me-3"
        prepend-icon="mdi-key-plus"
        @click.stop="openTokenConfig"
      >Create new token</v-btn>
    </v-app-bar>

    <v-app-bar
      v-if="isMockGraph && !tokenExpired && !settings.uiState.ui.focusMode"
      color="info"
      density="compact"
      :elevation="0"
      class="token-banner"
      @click="openTokenConfig"
    >
      <v-icon icon="mdi-flask-outline" class="ms-3 me-2" />
      <v-app-bar-title class="text-body-2">
        <strong>Showing sample data</strong>
        <span class="ms-2 text-medium-emphasis">— configure GitLab and hit Refresh to load real issues.</span>
      </v-app-bar-title>
      <v-btn
        variant="outlined"
        size="small"
        class="text-none me-3"
        prepend-icon="mdi-cog"
        @click.stop="openTokenConfig"
      >Open Configuration</v-btn>
    </v-app-bar>

    <v-main>
      <ConfigPage
        v-if="activePage === 'config'"
        :stats="configStats"
        :update-status="updateStatus"
        :error="error"
        :initial-tab="configInitialTab"
        :all-milestones="allMilestones"
        @close="activePage = 'main'"
        @save="handleConfigSave"
        @tab-change="configInitialTab = $event || 'gitlab'"
        @clear-data="clearData"
        @update-source="handleUpdateSource"
        @clear-source="handleClearSource"
        @open-kiosk="enterKiosk"
      />
      <ChatToolsPage
        v-else-if="isElectron && activePage === 'chattools'"
        @close="activePage = 'main'"
        @open-config="configInitialTab = 'gitlab'; activePage = 'config'"
      />
      <KioskPage
        v-else-if="activePage === 'kiosk'"
        :nodes="nodes"
        :loading="loading"
        :last-updated="lastUpdated"
        :on-refresh="handleRefreshClick"
        :mode="kioskMode"
        :view-param="viewParam"
        @update:mode="kioskMode = $event"
        @update:view-param="setView"
        @apply-filter="applyKioskFilter"
        @open-config="configInitialTab = 'kiosk'; activePage = 'config'"
        @close="activePage = 'main'"
      />
      <v-container v-else fluid class="pa-0 fill-height position-relative d-flex flex-column">
        <div v-if="error" class="position-absolute top-0 w-100 pa-4 text-error z-index-10 bg-surface">
          {{ error }}
        </div>

        <div
          v-if="isMockGraph && !tokenExpired"
          class="sample-watermark position-absolute top-0 left-0 w-100 h-100 d-flex align-center justify-center"
        >
          SAMPLE DATA
        </div>


        <div
          v-if="tokenExpired && isMockGraph"
          class="token-expired-overlay position-absolute top-0 left-0 w-100 h-100 d-flex flex-column align-center justify-center pa-8 text-center"
        >
          <v-icon icon="mdi-alert-circle" size="96" color="error" class="mb-4" />
          <div class="token-expired-title mb-3">TOKEN EXPIRED</div>
          <div class="text-body-1 mb-2">
            Your GitLab Personal Access Token expired on <strong>{{ tokenExpiry.dateStr }}</strong>.
          </div>
          <div class="text-body-2 text-medium-emphasis mb-6">
            Create a new token in GitLab and paste it into the configuration to resume loading data.
          </div>
          <v-btn color="error" size="large" prepend-icon="mdi-key-plus" class="text-none" @click="openTokenConfig">
            Create new token
          </v-btn>
        </div>
        
          <!-- Graph and list share `filteredNodes` so switching between them
               is just a render swap — no data refetch / lag. v-if (not v-show)
               keeps each view's resources clean while it's not visible. -->
          <IssueGraph
            ref="issueGraph"
            v-if="hasData && !(tokenExpired && isMockGraph) && settings.uiState.view.layout !== 'list'"
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
            :clone-multi-assignee="settings.uiState.view.cloneMultiAssignee"
            :assignee-filter="assigneeFilter"
            @issue-state-change="onIssueStateChange"
            @issue-assignee-change="onIssueAssigneeChange"
          />
          <IssueList
            v-else-if="hasData && !(tokenExpired && isMockGraph) && settings.uiState.view.layout === 'list'"
            class="flex-grow-1 min-h-0"
            :nodes="filteredNodes"
            :issue-open-target="settings.uiState.view.issueOpenTarget"
            :grouping-mode="settings.uiState.view.groupingMode"
            :color-mode="settings.uiState.view.viewMode"
            :due-soon-days="settings.uiState.view.dueSoonDays"
            v-model:columnState="settings.uiState.view.listColumns"
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

    <button
      v-if="settings.uiState.ui.focusMode && activePage === 'main'"
      type="button"
      class="focus-exit-btn"
      title="Exit focus mode (F)"
      @click="settings.uiState.ui.focusMode = false"
    >×</button>

    <v-dialog v-model="showHotkeyHelp" max-width="520">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-keyboard-outline" class="mr-2" />
          Keyboard shortcuts
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="showHotkeyHelp = false" />
        </v-card-title>
        <v-divider />
        <v-card-text class="hotkey-help-list">
          <div v-for="g in hotkeyHelpGroups" :key="g.id" class="hotkey-help-group">
            <div class="hotkey-help-group-title">{{ g.label }}</div>
            <div v-for="row in g.items" :key="row.id" class="hotkey-help-row">
              <span class="hotkey-help-label">{{ row.label }}</span>
              <kbd class="hotkey-help-combo">{{ row.combo }}</kbd>
            </div>
          </div>
          <div class="text-caption text-medium-emphasis mt-3">
            Customize in Configuration → Hotkeys.
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, toRaw } from 'vue'
import { useTheme } from 'vuetify'
import IssueGraph from './components/IssueGraph.vue'
import IssueList from './components/IssueList.vue'
import AppSidebar from './components/AppSidebar.vue'
import ConfigPage from './components/ConfigPage.vue'
import ChatToolsPage from './components/ChatToolsPage.vue'
import KioskPage from './components/KioskPage.vue'
import SvnLogDialog from './components/SvnLogDialog.vue'
import { useAppTheme } from './composables/useAppTheme'
import { useHashRouting } from './composables/useHashRouting'
import { useDataLoader } from './composables/useDataLoader'
import { useGraphDerivedState } from './composables/useGraphDerivedState'
import { useSvnVizMode } from './composables/useSvnVizMode'
import { useGitLabIssueMutations } from './composables/useGitLabIssueMutations'
import { useSettingsStore } from './composables/useSettingsStore'
import { useHotkeys, formatCombo, groupedHotkeyActions } from './composables/useHotkeys'
import { GLOBAL_PRESETS } from './presets'
import { getScopedLabelValue, getScopedLabelValues } from './utils/scopedLabels'
import { getTokenExpiry } from './utils/tokenExpiry'
import { encodeView, decodeView } from './utils/viewShareCodec'
import { resolveAssigneeFilter } from './utils/issueFields'

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

const activePage = ref('main') // 'main' | 'config' | 'chattools' | 'kiosk'
const configInitialTab = ref('gitlab')
const kioskMode = ref('today')
// When the user opens the kiosk from inside the app (hotkey / Open-kiosk button),
// reset to the first enabled mode rather than picking up wherever the cycle had
// drifted last session. URL-based entries (e.g. `#/kiosk/burndown/…`) still take
// effect because the routing parser sets `kioskMode` after this point.
const enterKiosk = () => { kioskMode.value = ''; activePage.value = 'kiosk' }
// Main-page layout (graph / list) — mirrored to the URL path so it appears as
// the first segment (e.g. `#/list/q=foo`) rather than as a kv param.
const mainLayout = computed({
  get: () => settings.uiState.view.layout || 'graph',
  set: (v) => { settings.uiState.view.layout = (v === 'list' ? 'list' : 'graph') }
})
const { viewParam, setView } = useHashRouting({ activePage, configInitialTab, kioskMode, mainLayout })
const loading = ref(false)
const loadingMessage = ref('')
const error = ref('')

const customPresets = computed(() => {
  const p = settings.uiState && settings.uiState.presets ? settings.uiState.presets : null
  return p && Array.isArray(p.custom) ? p.custom : []
})

const resetFilters = () => {
  settings.uiState.filters.includeClosed = false
  settings.uiState.filters.selectedState = ''
  settings.uiState.filters.selectedStatuses = []
  settings.uiState.filters.selectedSubscription = null
  settings.uiState.filters.selectedLabels = []
  settings.uiState.filters.excludedLabels = []
  settings.uiState.filters.selectedAuthors = []
  settings.uiState.filters.selectedAssignees = []
  settings.uiState.filters.selectedMilestones = []
  settings.uiState.filters.selectedPriorities = []
  settings.uiState.filters.selectedTypes = []
  settings.uiState.filters.selectedIids = []
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

// Export current graph + UI state as JSON (debug only, triggered by Ctrl+Shift+E).
// Used for repro fixtures / filter regression tests; not exposed in the UI.
const exportData = () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion,
    nodes: toRaw(nodes),
    edges: toRaw(edges),
    uiState: JSON.parse(JSON.stringify(toRaw(settings.uiState))),
    meta: { gitlabMeName: settings.meta.gitlabMeName || '' }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `gitlabviz-export-${stamp}.unittestdata.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
    layout: settings.uiState.view.layout,
    colorMode: settings.uiState.view.viewMode,
    grouping: settings.uiState.view.groupingMode,
    linkMode: settings.uiState.view.linkMode,
    dueSoonDays: settings.uiState.view.dueSoonDays,
    issueOpenTarget: settings.uiState.view.issueOpenTarget,
    colorOverrides: JSON.parse(JSON.stringify(settings.uiState.view.colorOverrides || {})),
    listColumns: JSON.parse(JSON.stringify(settings.uiState.view.listColumns || {}))
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
  { title: 'Any Time', value: 'none', icon: 'mdi-clock-outline', color: 'medium-emphasis' },
  { title: 'Before', value: 'before', icon: 'mdi-clock-start', color: 'info' },
  { title: 'After', value: 'after', icon: 'mdi-clock-end', color: 'success' },
  { title: 'Between', value: 'between', icon: 'mdi-clock-in', color: 'warning' },
  { title: 'Last X Days', value: 'last_x_days', icon: 'mdi-history', color: 'amber' }
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
  allStatuses,
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
  groupStatsText,
  filterCounts
} = useGraphDerivedState({ settings, nodes, edges })

// Active assignee filter resolved into a concrete name set + flags. Drives multi-assignee
// clone restriction in IssueGraph so co-assignees not in the filter don't get spawned groups.
const assigneeFilter = computed(() => resolveAssigneeFilter(
  settings.uiState.filters.selectedAssignees,
  settings.meta.gitlabMeName || '',
  userStateByName.value
))

// Token expiry — banner appears for <=7 days or expired; expired also blocks demo data.
const tokenExpiry = computed(() => getTokenExpiry(settings.meta, 7))
const tokenExpired = computed(() => tokenExpiry.value.status === 'expired')
const tokenExpiringSoon = computed(() => tokenExpiry.value.status === 'soon')
const openTokenConfig = () => { configInitialTab.value = 'gitlab'; activePage.value = 'config' }

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
  checkTokenInfo,
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

  // If a shared view is present in the URL, apply it AFTER local settings so the link wins.
  // Skip when on the kiosk page — its kv args (paused / cycle / refresh) aren't share-codec keys.
  if (viewParam.value && activePage.value === 'main') applyViewFromParam(viewParam.value)

  // Keep sidebar "data age" fresh.
  nowTick.value = Date.now()
  nowTickInterval = setInterval(() => { nowTick.value = Date.now() }, 10 * 60 * 1000)

  await initCachedData()

  // Fire-and-forget: detect token scopes + expiry on startup so the UI can warn about expiring tokens
  // without waiting for the user to trigger a full refresh.
  checkTokenInfo()

  // Dev-only: register the export hotkey. Stripped from prod bundles.
  if (import.meta.env.DEV) window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  if (nowTickInterval) clearInterval(nowTickInterval)
  nowTickInterval = null
  if (import.meta.env.DEV) window.removeEventListener('keydown', onGlobalKeydown)
})

// Hidden dev-only shortcut: Ctrl+Shift+E exports the current graph + filter state for fixture tests.
const onGlobalKeydown = (e) => {
  if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'E' || e.key === 'e')) {
    e.preventDefault()
    exportData()
  }
}

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

const showHotkeyHelp = ref(false)

// Apply a filter patch coming from kiosk deep-clicks. Resets filters first so the deep
// link is unambiguous, then merges the patch (including nested dateFilters) and exits to
// the main graph view.
const applyKioskFilter = (patch) => {
  if (!patch || typeof patch !== 'object') return
  resetFilters()
  const { dateFilters, layout, ...rest } = patch
  Object.assign(settings.uiState.filters, rest)
  if (dateFilters) Object.assign(settings.uiState.filters.dateFilters, dateFilters)
  if (layout === 'list' || layout === 'graph') settings.uiState.view.layout = layout
  activePage.value = 'main'
}

const setAllSections = (open) => {
  settings.uiState.ui.showFilters = open
  settings.uiState.ui.showTemplates = open
  settings.uiState.ui.showDisplay = open
  settings.uiState.ui.showAdvancedSim = open
}

// Cycle to the next value in a list, wrapping at the end. Skips subheaders / items
// without a usable scalar `.value` (groupingModeOptions has `{ type: 'subheader' }`
// entries that must not be selectable).
const cycleValue = (list, current) => {
  if (!Array.isArray(list)) return current
  const values = list
    .map(o => (o && typeof o === 'object') ? o.value : o)
    .filter(v => v !== undefined && v !== null && typeof v !== 'object')
  if (!values.length) return current
  const idx = values.indexOf(current)
  return values[(idx + 1 + values.length) % values.length]
}

const hotkeyHandlers = {
  toggleSidebar: () => { settings.uiState.ui.isDrawerExpanded = !settings.uiState.ui.isDrawerExpanded },
  toggleFocus:   () => { settings.uiState.ui.focusMode = !settings.uiState.ui.focusMode },
  toggleLegend:  () => { settings.uiState.view.legendHidden = !settings.uiState.view.legendHidden },
  toggleLegendCollapse: () => { settings.uiState.view.legendCollapsed = !settings.uiState.view.legendCollapsed },
  togglePhysics,
  refocusGraph,
  fitGraph,
  reflowGraph,
  toggleListView: () => { settings.uiState.view.layout = settings.uiState.view.layout === 'list' ? 'graph' : 'list' },
  cycleColorMode: () => { settings.uiState.view.viewMode = cycleValue(viewModeOptions, settings.uiState.view.viewMode) },
  cycleGrouping:  () => { settings.uiState.view.groupingMode = cycleValue(groupingModeOptions.value || [], settings.uiState.view.groupingMode) },
  cycleLinkMode:  () => { settings.uiState.view.linkMode = cycleValue(linkModeOptions, settings.uiState.view.linkMode) },
  toggleHideUnlinked: () => { settings.uiState.view.hideUnlinked = !settings.uiState.view.hideUnlinked },
  expandAllSections:   () => setAllSections(true),
  collapseAllSections: () => setAllSections(false),
  resetFilters,
  toggleTheme: () => {
    const order = ['light', 'dark', 'system']
    const i = order.indexOf(settings.uiState.ui.theme)
    settings.uiState.ui.theme = order[(i + 1 + order.length) % order.length]
  },
  openConfig,
  toggleKiosk: () => { activePage.value === 'kiosk' ? (activePage.value = 'main') : enterKiosk() },
  showHotkeyHelp: () => { showHotkeyHelp.value = !showHotkeyHelp.value }
}

useHotkeys({
  getBindings: () => settings.uiState.hotkeys,
  handlers: hotkeyHandlers,
  isEnabled: () => activePage.value === 'main' && !showHotkeyHelp.value
})

const hotkeyHelpGroups = computed(() => groupedHotkeyActions().map(g => ({
  id: g.id,
  label: g.label,
  items: g.items.map(a => ({
    id: a.id,
    label: a.label,
    combo: formatCombo(settings.uiState.hotkeys[a.id] || a.default)
  }))
})))

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
      if (config.view.layout) settings.uiState.view.layout = config.view.layout
      if (config.view.colorMode) settings.uiState.view.viewMode = config.view.colorMode
      if (config.view.grouping) settings.uiState.view.groupingMode = config.view.grouping
      if (config.view.linkMode) settings.uiState.view.linkMode = config.view.linkMode
      if (config.view.dueSoonDays != null) settings.uiState.view.dueSoonDays = config.view.dueSoonDays
      if (config.view.issueOpenTarget) settings.uiState.view.issueOpenTarget = config.view.issueOpenTarget
      if (config.view.colorOverrides) settings.uiState.view.colorOverrides = config.view.colorOverrides
      // List-view column state — merge the URL-provided pieces over the
      // existing saved state so a partial URL (just `sort=…` for example)
      // doesn't wipe widths/order the user customised previously.
      if (config.view.listColumns && typeof config.view.listColumns === 'object') {
        const cur = settings.uiState.view.listColumns || {}
        const incoming = config.view.listColumns
        settings.uiState.view.listColumns = {
          order: Array.isArray(incoming.order) ? incoming.order : (cur.order || []),
          hidden: Array.isArray(incoming.hidden) ? incoming.hidden : (cur.hidden || []),
          widths: (incoming.widths && typeof incoming.widths === 'object') ? incoming.widths : (cur.widths || {}),
          sortBy: Array.isArray(incoming.sortBy) && incoming.sortBy.length ? incoming.sortBy : (cur.sortBy || [{ key: 'updatedAt', order: 'desc' }]),
          closedGroups: Array.isArray(incoming.closedGroups) ? incoming.closedGroups : (cur.closedGroups || [])
        }
      }
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

// --- URL view sharing -------------------------------------------------------
// Suppress the encode-from-state watcher while we are applying a decoded view
// from the URL (otherwise we'd ping-pong: hash → state → hash).
let isApplyingViewFromUrl = false
let viewWriteTimer = null

const applyViewFromParam = (param) => {
  const { snapshot, warnings } = decodeView(param)
  if (warnings && warnings.length) {
    console.warn('[ShareURL] ' + warnings.join(' '))
    // Surface the first warning prominently; rest are in the console.
    snackbarText.value = `Share URL: ${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}`
    snackbar.value = true
  }
  if (!snapshot) return false
  isApplyingViewFromUrl = true
  try { applyConfiguration(snapshot) } finally {
    setTimeout(() => { isApplyingViewFromUrl = false }, 0)
  }
  return true
}

// Hashchange (back/forward, paste-in): keep state in sync with URL.
watch(viewParam, (v) => {
  if (isApplyingViewFromUrl) return
  // Kiosk uses viewParam for its own kv args (paused / cycle / refresh) which aren't
  // valid share-codec keys — feeding them into decodeView triggers spurious warnings.
  if (activePage.value !== 'main') return
  const cur = encodeView(getCurrentConfigSnapshot())
  if (v === cur) return // already in sync
  if (v) applyViewFromParam(v)
})

// State changes: encode + push to URL (debounced, replaceState only). Only writes
// when on the main page — kiosk owns viewParam there for its own kv args.
watch(
  () => [settings.uiState.filters, settings.uiState.view],
  () => {
    if (isApplyingViewFromUrl) return
    if (activePage.value !== 'main') return
    if (viewWriteTimer) clearTimeout(viewWriteTimer)
    viewWriteTimer = setTimeout(() => {
      if (activePage.value !== 'main') return
      setView(encodeView(getCurrentConfigSnapshot()))
    }, 250)
  },
  { deep: true }
)

// Page-transition republish: the routing watcher in useHashRouting clears
// `viewParam` when activePage changes (each page owns its own keyspace).
// The deep-watch above only fires on filter/view CHANGE, so a kiosk → main
// transition with unchanged filters would leave the URL empty even though
// filters are still applied. Re-encode the current snapshot on arrival so
// the URL always matches what's displayed. `nextTick` defers our write past
// the routing watcher's reset (registration order would otherwise clobber us).
watch(activePage, (p) => {
  if (p !== 'main' || isApplyingViewFromUrl) return
  nextTick(() => {
    if (activePage.value !== 'main') return
    setView(encodeView(getCurrentConfigSnapshot()))
  })
})

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

.token-banner {
  cursor: pointer;
}


.focus-exit-btn {
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 30;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.15s ease, background 0.15s ease;
  backdrop-filter: blur(4px);
}
.focus-exit-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.6);
}

.hotkey-help-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hotkey-help-group + .hotkey-help-group { margin-top: 12px; }
.hotkey-help-group-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 4px;
}
.hotkey-help-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}
.hotkey-help-row + .hotkey-help-row {
  border-top: 1px dashed rgba(127, 127, 127, 0.2);
}
.hotkey-help-label {
  flex: 1 1 auto;
  min-width: 0;
  opacity: 0.9;
}
.hotkey-help-combo {
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  background: rgba(127, 127, 127, 0.08);
}

.token-expired-overlay {
  z-index: 5;
  background: rgba(var(--v-theme-background), 0.96);
}

.token-expired-title {
  font-size: clamp(40px, 7vw, 88px);
  font-weight: 900;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-error));
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
