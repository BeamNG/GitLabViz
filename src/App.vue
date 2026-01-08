<template>
  <v-app>
    <v-navigation-drawer
      v-if="activePage === 'main'"
      width="300"
      :rail="!settings.uiState.ui.isDrawerExpanded"
      permanent
      location="left"
      @click="settings.uiState.ui.isDrawerExpanded = true"
    >
      <div class="d-flex align-center pl-4 pr-3 py-2 font-weight-bold app-titlebar" @click.stop="settings.uiState.ui.isDrawerExpanded = !settings.uiState.ui.isDrawerExpanded" style="cursor: pointer; height: 48px;">
        <div class="d-flex align-center flex-grow-1" style="min-width: 0;">
            <v-icon icon="mdi-gitlab" class="mr-2 flex-shrink-0" v-if="settings.uiState.ui.isDrawerExpanded"></v-icon>
            <v-icon icon="mdi-menu" v-else class="flex-shrink-0"></v-icon>
            <span
              class="text-h6 d-none d-sm-block mr-2 text-truncate"
              v-if="settings.uiState.ui.isDrawerExpanded"
              style="opacity: 1; transition: opacity 0.2s;"
              :title="buildTitle"
            >GitLab Viz <span 
                class="app-version" 
                style="cursor: pointer" 
                @click.stop="configInitialTab = 'changelog'; activePage = 'config'"
              >v{{ appVersion }}</span></span>
        </div>
        
        <!-- Config & Update buttons in title bar -->
        <div v-if="settings.uiState.ui.isDrawerExpanded" class="d-flex gap-1 flex-shrink-0">
          <v-btn 
            icon 
            variant="text" 
            size="small" 
            density="compact"
            @click.stop="configInitialTab = 'gitlab'; activePage = 'config'"
            title="Configuration"
          >
            <v-icon icon="mdi-cog"></v-icon>
          </v-btn>
           <v-btn
            id="glv-refresh-data-btn"
            icon 
            variant="text" 
            size="small" 
            density="compact"
            :color="isDataStale ? 'error' : null"
            @click.stop="loadData" 
            :loading="loading" 
            title="Update Data"
          >
            <v-icon icon="mdi-refresh"></v-icon>
          </v-btn>
        </div>
      </div>

      <div class="pa-2 d-flex flex-column h-100" v-if="settings.uiState.ui.isDrawerExpanded" style="overflow: hidden; max-height: 100vh;">
        
        <!-- Scrollable Filters Section -->
        <div class="d-flex flex-column flex-grow-1" style="min-height: 0; overflow: hidden; position: relative;">
          
          <!-- Fixed Header -->
          <div class="d-flex align-center justify-space-between mb-2 flex-shrink-0">
             <div class="d-flex flex-grow-1 justify-end">
                 <v-select
                  v-if="vizModeOptions.length > 1"
                  v-model="vizMode"
                  :items="vizModeOptions"
                  item-title="title"
                  item-value="value"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="compact-input mr-2"
                  style="max-width: 170px; font-size: 12px"
                  title="Visualization mode"
                ></v-select>
                <v-btn 
                  icon 
                  variant="text" 
                  size="x-small" 
                  color="medium-emphasis"
                  @click="createPreset"
                  title="Create preset"
                  class="mr-1"
                >
                  <v-icon icon="mdi-plus" size="small"></v-icon>
                </v-btn>
                 <v-btn 
                  icon 
                  variant="text" 
                  size="x-small" 
                  color="medium-emphasis"
                  @click="refocusGraph"
                  title="Recenter Graph"
                  class="mr-1"
                >
                  <v-icon icon="mdi-crosshairs-gps" size="small"></v-icon>
                </v-btn>
                <v-btn 
                  icon 
                  variant="text" 
                  size="x-small" 
                  color="medium-emphasis"
                  @click="fitGraph"
                  title="Fit Graph to Screen"
                  class="mr-1"
                >
                  <v-icon icon="mdi-fit-to-screen" size="small"></v-icon>
                </v-btn>
                <v-btn 
                  icon 
                  variant="text" 
                  size="x-small" 
                  color="medium-emphasis"
                  @click="reflowGraph"
                  title="Reflow Graph"
                  class="mr-1"
                >
                  <v-icon icon="mdi-refresh" size="small"></v-icon>
                </v-btn>
            </div>
          </div>

          <!-- Scrollable Content -->
          <div style="overflow-y: auto; overflow-x: hidden;" class="flex-grow-1 pr-1">
            <div v-if="isElectron && vizMode === 'svn'" class="px-1 mb-2">
              <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1">SVN Tree</div>
              <v-select
                v-model="svnVizLimit"
                :items="[500, 1000, 2000, 3000, 5000]"
                label="Revisions (most recent)"
                density="compact"
                variant="outlined"
                hide-details
                class="compact-input"
                style="font-size: 12px"
              ></v-select>
              <div class="text-caption text-medium-emphasis mt-1">
                Shows a revision chain + copy-from links (if present). Uses full SVN log as source.
              </div>
              <v-divider class="my-2"></v-divider>
            </div>
            
            <!-- Presets Section -->
            <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="settings.uiState.ui.showTemplates = !settings.uiState.ui.showTemplates">
              <div class="d-flex align-center gap-2">
                  <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Presets</div>
                  <v-chip v-if="settings.uiState.ui.currentTemplateName" size="x-small" color="medium-emphasis" variant="tonal" class="px-2 ml-2">{{ settings.uiState.ui.currentTemplateName }}</v-chip>
              </div>
              <v-icon :icon="settings.uiState.ui.showTemplates ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis"></v-icon>
            </div>
             <v-expand-transition>
               <div v-show="settings.uiState.ui.showTemplates" class="px-1 mb-2">
                 <div v-if="GLOBAL_PRESETS.length === 0" class="text-caption text-medium-emphasis">No presets available.</div>
                 <div v-else class="d-grid mb-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <v-btn
                        v-for="preset in GLOBAL_PRESETS"
                        :key="preset.name"
                        variant="tonal"
                        density="compact"
                        size="small"
                        color="secondary"
                        class="justify-start text-none px-2"
                        style="min-width: 0;"
                        @click="applyPreset(preset)"
                    >
                        <div class="text-truncate w-100 text-left">{{ preset.name }}</div>
                    </v-btn>
                 </div>
                 <div v-if="customPresets.length" class="d-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                   <v-btn
                     v-for="preset in customPresets"
                     :key="preset.name"
                     variant="tonal"
                     density="compact"
                     size="small"
                     color="primary"
                     class="justify-start text-none px-2 custom-preset-btn"
                     style="min-width: 0;"
                     @click="applyPreset(preset)"
                   >
                     <div class="text-truncate w-100 text-left">{{ preset.name }}</div>
                   </v-btn>
                 </div>
               </div>
            </v-expand-transition>
            <v-divider class="mb-2"></v-divider>

            <SidebarFilterControls
              :state="settings.uiState"
              :all-labels="allLabels"
              :all-authors="allAuthors"
              :all-assignees="allAssignees"
              :all-milestones="allMilestones"
              :all-priorities="allPriorities"
              :all-types="allTypes"
              :date-filter-modes="dateFilterModes"
              :grouping-mode-options="groupingModeOptions"
              :view-mode-options="viewModeOptions"
              :link-mode-options="linkModeOptions"
              @reset-filters="resetFilters"
            />
            <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="settings.uiState.ui.showAdvancedSim = !settings.uiState.ui.showAdvancedSim">
              <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Simulation</div>
              <v-icon :icon="settings.uiState.ui.showAdvancedSim ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis"></v-icon>
            </div>

            <v-expand-transition>
            <div v-show="settings.uiState.ui.showAdvancedSim" class="px-1" style="overflow: visible;">
                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Group Gravity</span>
                    <span>{{ settings.uiState.simulation.groupGravity }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.groupGravity"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                ></v-slider>

                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Repulsion</span>
                    <span>{{ settings.uiState.simulation.repulsion }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.repulsion"
                    :min="50"
                    :max="1000"
                    :step="10"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                    class="mb-1"
                ></v-slider>

                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Link Force</span>
                    <span>{{ settings.uiState.simulation.linkStrength }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.linkStrength"
                    :min="0"
                    :max="2"
                    :step="0.1"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                    class="mb-1"
                ></v-slider>

                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Link Distance</span>
                    <span>{{ settings.uiState.simulation.linkDistance }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.linkDistance"
                    :min="50"
                    :max="600"
                    :step="10"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                    class="mb-1"
                ></v-slider>

                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Friction</span>
                    <span>{{ settings.uiState.simulation.friction }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.friction"
                    :min="0.1"
                    :max="0.95"
                    :step="0.05"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                    class="mb-1"
                ></v-slider>
                
                <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Center Gravity</span>
                    <span>{{ settings.uiState.simulation.centerGravity }}</span>
                    </div>
                    <v-slider
                    v-model="settings.uiState.simulation.centerGravity"
                    :min="0"
                    :max="0.5"
                    :step="0.01"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                ></v-slider>

                <div class="mt-2">
                  <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Grid Magnet Strength</span>
                    <span>{{ settings.uiState.simulation.gridStrength }}</span>
                  </div>
                  <v-slider
                    v-model="settings.uiState.simulation.gridStrength"
                    :min="0"
                    :max="0.3"
                    :step="0.01"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                    class="mb-1"
                  ></v-slider>

                  <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
                    <span>Grid Spacing</span>
                    <span>{{ settings.uiState.simulation.gridSpacing }}</span>
                  </div>
                  <v-slider
                    v-model="settings.uiState.simulation.gridSpacing"
                    :min="1.1"
                    :max="3"
                    :step="0.1"
                    density="compact"
                    thumb-size="12"
                    track-size="2"
                    hide-details
                  ></v-slider>
                </div>
            </div>
            </v-expand-transition>
          </div>
        </div>
        
        <!-- Stats Footer -->
        <div class="mt-auto pt-2 border-t flex-shrink-0">
            <div v-if="isElectron && svnCommitCountLabel" class="d-flex justify-space-between align-center mb-1">
              <div class="text-caption text-medium-emphasis">SVN</div>
              <v-btn
                size="x-small"
                variant="text"
                class="text-none px-1"
                @click="showSvnLog = true"
                title="Show SVN log"
              >
                {{ svnCommitCountLabel.toLocaleString() }} commits
              </v-btn>
            </div>
            <div v-if="loading" class="text-caption text-medium-emphasis text-truncate">
              {{ loadingMessage }}
            </div>
            <div v-else-if="hasData" class="d-flex flex-column text-caption text-medium-emphasis">
               <div class="d-flex justify-space-between align-baseline">
                   <div class="font-weight-bold text-truncate mr-2">{{ statsText }}</div>
                   <div 
                     v-if="dataAge" 
                     class="flex-shrink-0" 
                     style="font-size: 10px; cursor: help;" 
                     :class="{'text-error font-weight-bold': isDataStale}"
                     :title="lastUpdatedDate"
                   >
                     {{ dataAge }}
                   </div>
               </div>
               <div v-if="groupStatsText">{{ groupStatsText }}</div>
            </div>
        </div>
      </div>
      <div v-else class="d-flex flex-column align-center mt-2 gap-2">
         <!-- Mini Toolbar -->
         <v-tooltip text="Recenter Graph" location="right">
           <template v-slot:activator="{ props }">
             <v-btn icon="mdi-crosshairs-gps" variant="text" size="small" v-bind="props" @click.stop="refocusGraph"></v-btn>
           </template>
         </v-tooltip>

         <v-tooltip text="Fit Graph to Screen" location="right">
           <template v-slot:activator="{ props }">
             <v-btn icon="mdi-fit-to-screen" variant="text" size="small" v-bind="props" @click.stop="fitGraph"></v-btn>
           </template>
         </v-tooltip>

         <v-tooltip text="Reset Filters" location="right">
           <template v-slot:activator="{ props }">
             <v-btn icon="mdi-filter-off" variant="text" size="small" color="medium-emphasis" v-bind="props" @click.stop="resetFilters"></v-btn>
           </template>
         </v-tooltip>
         
         <v-divider class="w-75 my-2"></v-divider>

         <v-tooltip text="Update Issues" location="right">
            <template v-slot:activator="{ props }">
               <v-btn icon="mdi-refresh" variant="text" size="small" :color="isDataStale ? 'error' : 'secondary'" v-bind="props" @click.stop="loadData" :loading="loading"></v-btn>
            </template>
         </v-tooltip>
      </div>
    </v-navigation-drawer>

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
import { ref, reactive, computed, onMounted, onUnmounted, watch, toRaw, nextTick } from 'vue'
import { useTheme } from 'vuetify'
import IssueGraph from './components/IssueGraph.vue'
import ConfigPage from './components/ConfigPage.vue'
import ChatToolsPage from './components/ChatToolsPage.vue'
import SvnLogDialog from './components/SvnLogDialog.vue'
import SidebarFilterControls from './components/SidebarFilterControls.vue'
import { createGitLabClient, fetchProjectIssues, fetchIssueLinks, fetchTokenScopes, normalizeGitLabApiBaseUrl, updateIssue } from './services/gitlab'
import { createSvnClient, fetchSvnLog } from './services/svn'
import { svnCacheGetMeta, svnCacheClear, normalizeRepoUrl } from './services/cache'
import { useSettingsStore } from './composables/useSettingsStore'
import { MattermostClient } from './chatTools/mmClient'
import { GLOBAL_PRESETS } from './presets'
import localforage from 'localforage'

// Configure localforage
localforage.config({
  name: 'gitlab-viz'
})

const { settings, init: initSettings } = useSettingsStore()

const isElectron = computed(() => !!window.electronAPI)

const vuetifyTheme = useTheme()
const systemPrefersDark = ref(false)
let systemMql = null

const getEffectiveThemeName = () => {
  const pref = (settings.uiState && settings.uiState.ui && settings.uiState.ui.theme) ? settings.uiState.ui.theme : 'system'
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return systemPrefersDark.value ? 'dark' : 'light'
}

const applyTheme = () => {
  const name = getEffectiveThemeName()
  if (vuetifyTheme && typeof vuetifyTheme.change === 'function') vuetifyTheme.change(name)
  else vuetifyTheme.global.name.value = name
  document.documentElement.dataset.theme = name
  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme: name } }))
}

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
const loading = ref(false)
const loadingMessage = ref('')
const error = ref('')

// Hash routing (works for hosted + file://):
// Examples:
// - (no hash)            -> main
// - #/config/gitlab
// - #/config/display
// - #/config             -> config (default tab)
// - #/chattools
let isApplyingHash = false

const parseHash = () => {
  const raw = String(window.location.hash || '')
  const h = raw.startsWith('#') ? raw.slice(1) : raw
  const [pathRaw] = h.split('?')
  const path = (pathRaw || '').replace(/^\/+/, '')
  const parts = path.split('/').filter(Boolean)

  const page = (parts[0] === 'config' || parts[0] === 'chattools') ? parts[0] : 'main'
  const tab = page === 'config' && parts[1] ? String(parts[1]).trim() : ''
  return { page, tab }
}

const syncStateFromHash = () => {
  const { page, tab } = parseHash()
  isApplyingHash = true
  try {
    if (page === 'config') {
      if (tab) configInitialTab.value = tab
      activePage.value = 'config'
    } else if (page === 'chattools') {
      activePage.value = 'chattools'
    } else {
      activePage.value = 'main'
    }
  } finally {
    isApplyingHash = false
  }

  // KISS: don't keep "#/main" in the URL.
  if (page === 'main') {
    const raw = String(window.location.hash || '')
    if (raw === '#/main' || raw === '#main' || raw === '#/') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }
}

const setHash = (page, tab, { replace } = {}) => {
  const p = page === 'config' ? 'config' : (page === 'chattools' ? 'chattools' : 'main')
  const t = String(tab || '').trim()
  if (p === 'main') {
    // Main view: no hash at all.
    const nextUrl = window.location.pathname + window.location.search
    if (replace) history.replaceState(null, '', nextUrl)
    else history.pushState(null, '', nextUrl)
    return
  }

  const next = p === 'config'
    ? `#/config${t ? `/${encodeURIComponent(t)}` : ''}`
    : `#/${p}`

  if (window.location.hash === next) return
  if (replace) history.replaceState(null, '', next)
  else window.location.hash = next
}

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

const vizMode = ref('issues') // 'issues' | 'svn' | 'chattools' (action)
const lastGraphVizMode = ref('issues')
const svnVizLimit = ref(2000)

const showSvnLog = ref(false)
const svnRecentCommits = ref([])
const svnCommitCount = ref(0)

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

// Snapshot of the "issues" graph so we can switch modes without refetching
const issueGraphSnapshot = reactive({
  nodes: {},
  edges: {}
})

const issueModePrefs = reactive({
  viewMode: 'state',
  groupingMode: 'none',
  linkMode: 'none'
})

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
    dateFilters: { ...settings.uiState.filters.dateFilters }
  },
  view: {
    colorMode: settings.uiState.view.viewMode,
    grouping: settings.uiState.view.groupingMode,
    linkMode: settings.uiState.view.linkMode,
    issueOpenTarget: settings.uiState.view.issueOpenTarget
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

    console.log('[App] Creating preset:', name)
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
    
    console.log('[App] Updating settings.uiState.presets.custom with list:', list)
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
      const idx = l.indexOf('::')
      if (idx > 0) scopedPrefixes.add(l.slice(0, idx))
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

  if (isElectron.value) {
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

// Helper to extract scoped label value (e.g. "Priority::High" -> "High")
function getScopedLabelValue(labels, prefix) {
  if (!labels) return null
  const label = labels.find(l => l.startsWith(prefix + '::'))
  return label ? label.substring(prefix.length + 2) : null
}

const allLabels = computed(() => {
  const labels = new Set()
  Object.values(nodes).forEach(node => {
    if (node._raw.labels) {
      node._raw.labels.forEach(l => labels.add(l))
    }
  })
  return Array.from(labels).sort()
})

const allAuthors = computed(() => {
  const authors = new Set()
  Object.values(nodes).forEach(node => {
    const name = node._raw.author?.name
    if (name) authors.add(name)
  })
  return Array.from(authors).sort()
})

const allAssignees = computed(() => {
  const assignees = new Set()
  Object.values(nodes).forEach(node => {
    if (node._raw.assignee) {
      assignees.add(node._raw.assignee.name)
    }
  })
  return Array.from(assignees).sort()
})

const allMilestones = computed(() => {
  const milestones = new Set()
  Object.values(nodes).forEach(node => {
    if (node._raw.milestone) {
      milestones.add(node._raw.milestone.title)
    }
  })
  return Array.from(milestones).sort()
})

const allPriorities = computed(() => {
  const priorities = new Set()
  Object.values(nodes).forEach(node => {
    const p = getScopedLabelValue(node._raw.labels, 'Priority')
    if (p) priorities.add(p)
  })
  return Array.from(priorities).sort()
})

const allTypes = computed(() => {
  const types = new Set()
  Object.values(nodes).forEach(node => {
    const t = getScopedLabelValue(node._raw.labels, 'Type')
    if (t) types.add(t)
  })
  return Array.from(types).sort()
})

const filteredNodes = computed(() => {
  if (settings.uiState.filters.selectedLabels?.length === 0 && 
      settings.uiState.filters.excludedLabels?.length === 0 && 
      settings.uiState.filters.selectedAuthors?.length === 0 &&
      (settings.uiState.filters.selectedAssignees?.length || 0) === 0 && 
      (settings.uiState.filters.selectedMilestones?.length || 0) === 0 &&
      (settings.uiState.filters.selectedPriorities?.length || 0) === 0 &&
      (settings.uiState.filters.selectedTypes?.length || 0) === 0 &&
      (settings.uiState.filters.selectedStatuses?.length || 0) === 0 &&
      !settings.uiState.filters.selectedSubscription &&
      settings.uiState.filters.includeClosed &&
      !settings.uiState.filters.searchQuery &&
      settings.uiState.filters.dateFilters.createdMode === 'none' &&
      settings.uiState.filters.dateFilters.updatedMode === 'none' &&
      settings.uiState.filters.dateFilters.dueDateMode === 'none'
  ) return nodes
  
  const result = {}
  Object.values(nodes).forEach(node => {
    // Keep user-updated issues visible even if filters would exclude them.
    if (node && node._uiForceShow) {
      result[node.id] = node
      return
    }

    const nodeLabels = node._raw.labels || []
    const authorName = node._raw.author ? node._raw.author.name : null
    const assigneeName = node._raw.assignee ? node._raw.assignee.name : null
    const milestoneTitle = node._raw.milestone ? node._raw.milestone.title : null
    const priority = getScopedLabelValue(nodeLabels, 'Priority')
    const type = getScopedLabelValue(nodeLabels, 'Type')

    // -1. Closed Filter (separate from Status labels)
    if (!settings.uiState.filters.includeClosed && node._raw?.state === 'closed') return false

    // 0. Status Filter
    let statusMatch = true
    if (settings.uiState.filters.selectedStatuses?.length > 0) {
        // Map common GitLab states to our status list if the specific label is missing
        let currentStatus = getScopedLabelValue(nodeLabels, 'Status')
        if (!currentStatus) {
            currentStatus = 'To do'
        }
        
        statusMatch = settings.uiState.filters.selectedStatuses.includes(currentStatus)
    }

    if (!statusMatch) return false

    // 0b. Subscription Filter
    if (settings.uiState.filters.selectedSubscription) {
        const isSubscribed = !!node._raw?.subscribed
        if (settings.uiState.filters.selectedSubscription === 'subscribed' && !isSubscribed) return false
        if (settings.uiState.filters.selectedSubscription === 'unsubscribed' && isSubscribed) return false
    }
    
    // 1. Label Filter
    let labelMatch = true
    if (settings.uiState.filters.selectedLabels?.length > 0) {
        labelMatch = settings.uiState.filters.selectedLabels.some(tag => nodeLabels.includes(tag))
    }
    
    // 1b. Exclude Labels
    if (settings.uiState.filters.excludedLabels?.length > 0) {
        if (settings.uiState.filters.excludedLabels.some(tag => nodeLabels.includes(tag))) {
            labelMatch = false
        }
    }

    // 1c. Author Filter
    let authorMatch = true
    if (settings.uiState.filters.selectedAuthors?.length > 0) {
        authorMatch = authorName && settings.uiState.filters.selectedAuthors.includes(authorName)
    }

    // 2. Assignee Filter
    let assigneeMatch = true
    if ((settings.uiState.filters.selectedAssignees?.length || 0) > 0) {
        assigneeMatch = assigneeName && settings.uiState.filters.selectedAssignees.includes(assigneeName)
    }

    // Logic: AND between different filters
    if (!labelMatch || !authorMatch || !assigneeMatch) return false

    // 3. Milestone Filter
    let milestoneMatch = true
    if ((settings.uiState.filters.selectedMilestones?.length || 0) > 0) {
        milestoneMatch = milestoneTitle && settings.uiState.filters.selectedMilestones.includes(milestoneTitle)
    }

    // 4. Priority Filter
    let priorityMatch = true
    if ((settings.uiState.filters.selectedPriorities?.length || 0) > 0) {
        priorityMatch = priority && settings.uiState.filters.selectedPriorities.includes(priority)
    }

    // 5. Type Filter
    let typeMatch = true
    if ((settings.uiState.filters.selectedTypes?.length || 0) > 0) {
        typeMatch = type && settings.uiState.filters.selectedTypes.includes(type)
    }

    // 6. Search Filter
    let searchMatch = true
    if (settings.uiState.filters.searchQuery) {
        const query = String(settings.uiState.filters.searchQuery || '').trim().toLowerCase()
        const raw = node._raw || {}

        // Exact issue-id shortcut:
        // - "#123" or "123" matches ONLY that issue iid (prevents accidental matches on references in descriptions).
        const m = query.match(/^#?(\d+)$/)
        if (m && m[1]) {
          searchMatch = String(node.id) === String(m[1])
        } else {
          // Extract JIRA ID if present in title
          const jiraMatch = raw.title ? raw.title.match(/^\[([A-Z]+-\d+)\]/) : null
          const jiraId = jiraMatch ? jiraMatch[1] : ''

          const searchableText = [
              raw.title,
              raw.description,
              String(node.id),
              `#${node.id}`,
              jiraId,
              raw.author?.name,
              raw.assignee?.name,
              ...(raw.assignees || []).map(a => a.name),
              raw.milestone?.title,
              ...(raw.labels || [])
          ].filter(Boolean).join(' ').toLowerCase()

          searchMatch = searchableText.includes(query)
        }
    }

    // 7. Date Filters
    let dateMatch = true
    const raw = node._raw || {}
    
    // SVN date normalize
    let createdAt = raw.created_at || raw.date; // SVN uses date
    let updatedAt = raw.updated_at || raw.date;
    
    if (settings.uiState.filters.dateFilters.createdMode !== 'none') {
        if (settings.uiState.filters.dateFilters.createdMode === 'after' || settings.uiState.filters.dateFilters.createdMode === 'between') {
             if (settings.uiState.filters.dateFilters.createdAfter && (!createdAt || new Date(createdAt) < new Date(settings.uiState.filters.dateFilters.createdAfter))) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.createdMode === 'before' || settings.uiState.filters.dateFilters.createdMode === 'between')) {
             if (settings.uiState.filters.dateFilters.createdBefore) {
                const d = new Date(settings.uiState.filters.dateFilters.createdBefore)
                d.setDate(d.getDate() + 1)
                if (!createdAt || new Date(createdAt) >= d) dateMatch = false
             }
        }
        if (dateMatch && settings.uiState.filters.dateFilters.createdMode === 'last_x_days') {
             if (settings.uiState.filters.dateFilters.createdDays && settings.uiState.filters.dateFilters.createdDays > 0) {
                 const cutoff = new Date()
                 cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.createdDays)
                 if (!createdAt || new Date(createdAt) < cutoff) dateMatch = false
             }
        }
    }

    if (dateMatch && settings.uiState.filters.dateFilters.updatedMode !== 'none') {
        if (settings.uiState.filters.dateFilters.updatedMode === 'after' || settings.uiState.filters.dateFilters.updatedMode === 'between') {
            if (settings.uiState.filters.dateFilters.updatedAfter && (!updatedAt || new Date(updatedAt) < new Date(settings.uiState.filters.dateFilters.updatedAfter))) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.updatedMode === 'before' || settings.uiState.filters.dateFilters.updatedMode === 'between')) {
            if (settings.uiState.filters.dateFilters.updatedBefore) {
                const d = new Date(settings.uiState.filters.dateFilters.updatedBefore)
                d.setDate(d.getDate() + 1)
                if (!updatedAt || new Date(updatedAt) >= d) dateMatch = false
            }
        }
        if (dateMatch && settings.uiState.filters.dateFilters.updatedMode === 'last_x_days') {
             if (settings.uiState.filters.dateFilters.updatedDays && settings.uiState.filters.dateFilters.updatedDays > 0) {
                 const cutoff = new Date()
                 cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.updatedDays)
                 if (!updatedAt || new Date(updatedAt) < cutoff) dateMatch = false
             }
        }
    }

    if (dateMatch && settings.uiState.filters.dateFilters.dueDateMode !== 'none') {
        if (settings.uiState.filters.dateFilters.dueDateMode === 'after' || settings.uiState.filters.dateFilters.dueDateMode === 'between') {
            if (settings.uiState.filters.dateFilters.dueDateAfter && (!raw.due_date || raw.due_date < settings.uiState.filters.dateFilters.dueDateAfter)) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.dueDateMode === 'before' || settings.uiState.filters.dateFilters.dueDateMode === 'between')) {
            if (settings.uiState.filters.dateFilters.dueDateBefore && (!raw.due_date || raw.due_date > settings.uiState.filters.dateFilters.dueDateBefore)) dateMatch = false
        }
        if (dateMatch && settings.uiState.filters.dateFilters.dueDateMode === 'last_x_days') {
             if (settings.uiState.filters.dateFilters.dueDateDays && settings.uiState.filters.dateFilters.dueDateDays > 0) {
                 // due_date is YYYY-MM-DD
                 const cutoff = new Date()
                 cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.dueDateDays)
                 const cutoffStr = cutoff.toISOString().split('T')[0]
                 if (!raw.due_date || raw.due_date < cutoffStr) dateMatch = false
             }
        }
    }

    if (labelMatch && assigneeMatch && milestoneMatch && priorityMatch && typeMatch && searchMatch && dateMatch) {
      result[node.id] = node
    }
  })
  return result
})

const filteredEdges = computed(() => {
  // If links are hidden (none), return empty object to "kill" them from graph
  if (settings.uiState.view.linkMode === 'none') return {}

  const result = {}
  const nodeIds = new Set(Object.keys(filteredNodes.value))
  
  if (settings.uiState.view.linkMode === 'dependency') {
      // Standard dependency links
      Object.entries(edges).forEach(([key, edge]) => {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
          result[key] = edge
        }
      })
  } else if (settings.uiState.view.linkMode === 'group') {
      // Group links: Create edges between nodes that share the same group value
      // This is dynamic based on current groupingMode
      // WARNING: This can create N^2 edges if groups are large!
      // To prevent explosion, maybe only link adjacent nodes in sort order or some MST?
      // Or literally all-to-all?
      
      // Let's implement a "Sequence" style link or just simple chain for now to avoid mess?
      // Or maybe the user means "Show links ONLY if they are within the same group"?
      // "allow link mode as in : issue dependency, and group that is selected"
      
      // Interpretation A: Link nodes that belong to the same group (e.g. same Assignee)
      // Interpretation B: Filter dependency links to only those within same group
      
      // Given "recreate the nodes without links", user likely wants DIFFERENT links.
      // Let's assume Interpretation A: Artificial links based on grouping.
      
      // Actually, "group that is selected" might mean the groupingMode.
      
      if (settings.uiState.view.groupingMode === 'none') return {} // No groups to link
      
      // We need to generate edges on the fly
      // 1. Group nodes
      const groups = {}
      Object.values(filteredNodes.value).forEach(node => {
          let key = 'default'
          const n = node._raw
          if (node.type === 'svn_commit') {
              // Special grouping for SVN?
              if (settings.uiState.view.groupingMode === 'author') key = n.author || 'Unknown'
              else key = 'SVN Commits' // Default for other groupings
          } else {
              if (settings.uiState.view.groupingMode === 'tag') key = node.tag || '_no_tag_'
              else if (settings.uiState.view.groupingMode === 'author') key = n.author ? n.author.name : 'Unknown'
              else if (settings.uiState.view.groupingMode === 'state') key = n.state
              else if (settings.uiState.view.groupingMode === 'assignee') key = n.assignee ? n.assignee.name : 'Unassigned'
              else if (settings.uiState.view.groupingMode === 'milestone') key = n.milestone ? n.milestone.title : 'No Milestone'
              else if (settings.uiState.view.groupingMode === 'priority') key = getScopedLabelValue(n.labels, 'Priority') || 'No Priority'
              else if (settings.uiState.view.groupingMode === 'type') key = getScopedLabelValue(n.labels, 'Type') || 'No Type'
          }
          
          if (!groups[key]) groups[key] = []
          groups[key].push(node.id)
      })
      
      // 2. Create chain links within groups to keep them together visually
      // (Full mesh is too heavy, chain is enough for force directed)
      let edgeCount = 0
      Object.values(groups).forEach(ids => {
          if (ids.length < 2) return
          // Sort by ID to be deterministic
          ids.sort()
          for (let i = 0; i < ids.length - 1; i++) {
             const source = ids[i]
             const target = ids[i+1]
             const key = `group-${source}-${target}`
             result[key] = { source, target, label: 'group' }
             edgeCount++
          }
          // Close the loop for better clustering?
          if (ids.length > 2) {
              const source = ids[ids.length-1]
              const target = ids[0]
              const key = `group-${source}-${target}`
              result[key] = { source, target, label: 'group' }
          }
      })
  }

  return result
})

// Auto-set grouping when switching color mode (optional, maybe better not to enforce)
watch(() => settings.uiState.view.viewMode, (v) => {
  if (v === 'state' && settings.uiState.view.groupingMode === 'none') {
      // Do nothing, let user decide
  }
})

// Dependency mode: default to hiding unlinked nodes when switching into it.
watch(() => settings.uiState.view.linkMode, (v, old) => {
  if (v === 'dependency' && old !== 'dependency' && settings.uiState.view.hideUnlinked !== true) {
    settings.uiState.view.hideUnlinked = true
  }
})

const hasData = computed(() => Object.keys(nodes).length > 0)
const isMockGraph = computed(() => {
  try {
    return Object.values(nodes).some(n => n && n._raw && n._raw.__mock)
  } catch {
    return false
  }
})
const statsText = computed(() => {
  const nodesArr = Object.values(filteredNodes.value)
  const openCount = nodesArr.filter(n => n._raw?.state === 'opened').length
  const closedCount = nodesArr.filter(n => n._raw?.state === 'closed').length
  const edgeCount = Object.keys(filteredEdges.value).length
  
  const parts = []
  if (openCount > 0) parts.push(`${openCount} Open`)
  if (closedCount > 0) parts.push(`${closedCount} Closed`)
  if (edgeCount > 0) parts.push(`${edgeCount} Link${edgeCount === 1 ? '' : 's'}`)
  
  return parts.join(', ') || 'No issues found'
})

const groupStatsText = computed(() => {
    if (settings.uiState.view.groupingMode === 'none') return null
    
    // Count unique groups
    const groups = new Set()
    Object.values(filteredNodes.value).forEach(node => {
         let key = 'default'
         const n = node._raw
         if (settings.uiState.view.groupingMode === 'tag') key = node.tag || '_no_tag_'
         else if (settings.uiState.view.groupingMode === 'author') key = n.author ? n.author.name : 'Unknown'
         else if (settings.uiState.view.groupingMode === 'state') {
             key = getScopedLabelValue(node._raw.labels, 'Status') || (n.state === 'closed' ? 'Done' : 'To do')
         }
         else if (settings.uiState.view.groupingMode === 'assignee') key = n.assignee ? n.assignee.name : 'Unassigned'
         else if (settings.uiState.view.groupingMode === 'milestone') key = n.milestone ? n.milestone.title : 'No Milestone'
         else if (settings.uiState.view.groupingMode === 'priority') key = getScopedLabelValue(n.labels, 'Priority') || 'No Priority'
         else if (settings.uiState.view.groupingMode === 'type') key = getScopedLabelValue(n.labels, 'Type') || 'No Type'
         
         groups.add(key)
    })
    
    return `${groups.size} Groups`
})

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


const vizModeOptions = computed(() => {
  const base = [
    { title: 'Git tickets', value: 'issues' }
  ]
  if (isElectron.value) {
    base.push({ title: 'SVN rev tree', value: 'svn' })
    base.push({ title: 'Chat tools', value: 'chattools' })
  }
  return base
})

const buildSvnVizGraph = () => {
  // Clear current graph data
  for (const k in nodes) delete nodes[k]
  for (const k in edges) delete edges[k]

  const limit = Math.max(100, Math.min(Number(svnVizLimit.value) || 2000, 5000))
  // Use most recent N revisions (svnRecentCommits is newest-first), but order them old -> new for left-to-right layout.
  let list = (svnRecentCommits.value || [])
    .slice(0, limit)
    .slice()
    .sort((a, b) => Number(a.revision) - Number(b.revision))

  // If no SVN data is present, show a small sample timeline.
  if (!list.length) {
    const baseRev = 1000
    list = Array.from({ length: 12 }).map((_, i) => {
      const rev = baseRev + i
      return {
        revision: rev,
        author: i % 3 === 0 ? 'alice' : (i % 3 === 1 ? 'bob' : 'carol'),
        date: new Date(Date.now() - (12 - i) * 3600 * 1000).toISOString(),
        message: `Sample commit r${rev} (mock)`,
        paths: [],
        __mock: true
      }
    })
  }

  // Build nodes
  list.forEach(commit => {
    const rev = String(commit.revision)
    const id = `svn-${rev}`
    const raw = {
      ...commit,
      title: commit.message || `r${rev}`,
      author: { name: commit.author || 'Unknown' },
      created_at: commit.date,
      updated_at: commit.date,
      state: 'svn',
      labels: [],
      __mock: !!commit.__mock
    }

    nodes[id] = {
      id,
      name: `r${rev} ${commit.author || 'Unknown'}`,
      color: '#6f42c1',
      updatedAt: commit.date,
      createdAt: commit.date,
      author: { name: commit.author || 'Unknown' },
      webUrl: '',
      type: 'svn_commit',
      _raw: raw
    }
  })

  // Build edges: sequential chain + copy-from edges if available
  for (let i = 0; i < list.length - 1; i++) {
    const a = `svn-${list[i].revision}`
    const b = `svn-${list[i + 1].revision}`
    edges[`rev-${a}-${b}`] = { source: a, target: b, label: 'prev' }
  }

  list.forEach(commit => {
    const to = `svn-${commit.revision}`
    ;(commit.paths || []).forEach(p => {
      if (!p || !p.copyFromRev) return
      const from = `svn-${p.copyFromRev}`
      if (nodes[from]) {
        const key = `copy-${from}-${to}-${p.path || ''}`
        edges[key] = { source: from, target: to, label: 'copy' }
      }
    })
  })
}

const applyVizMode = () => {
  if (vizMode.value === 'svn') {
    // Save current issues-mode prefs
    issueModePrefs.viewMode = settings.uiState.view.viewMode
    issueModePrefs.groupingMode = settings.uiState.view.groupingMode
    issueModePrefs.linkMode = settings.uiState.view.linkMode

    // Defaults for SVN tree
    settings.uiState.view.viewMode = 'author'
    settings.uiState.view.groupingMode = 'svn_revision'
    settings.uiState.view.linkMode = 'none'

    buildSvnVizGraph()
    return
  }

  // issues mode: restore snapshot
  for (const k in nodes) delete nodes[k]
  for (const k in edges) delete edges[k]
  Object.assign(nodes, issueGraphSnapshot.nodes)
  Object.assign(edges, issueGraphSnapshot.edges)

  // Restore user prefs for issues mode
  settings.uiState.view.viewMode = issueModePrefs.viewMode
  settings.uiState.view.groupingMode = issueModePrefs.groupingMode
  settings.uiState.view.linkMode = issueModePrefs.linkMode
}

watch(vizMode, async (v, old) => {
  // Special-case: "chattools" is a navigation action, not a persistent graph mode.
  if (v === 'chattools') {
    if (!isElectron.value) {
      await nextTick()
      vizMode.value = lastGraphVizMode.value || 'issues'
      return
    }
    activePage.value = 'chattools'
    // Snap back to the last graph mode so returning from ChatTools doesn't immediately re-open it.
    await nextTick()
    vizMode.value = lastGraphVizMode.value || 'issues'
    return
  }

  if (v === 'issues' || v === 'svn') lastGraphVizMode.value = v
  applyVizMode()
})

watch(svnVizLimit, () => {
  if (vizMode.value === 'svn') buildSvnVizGraph()
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

  // Restore page/tab from hash (supports refresh + back/forward).
  syncStateFromHash()
  window.addEventListener('hashchange', syncStateFromHash)

  // Keep URL hash in sync with UI state.
  watch(activePage, (p) => {
    if (isApplyingHash) return
    setHash(p, configInitialTab.value, { replace: false })
  })
  watch(configInitialTab, (t) => {
    if (isApplyingHash) return
    if (activePage.value !== 'config') return
    // Tab switching shouldn't spam browser history.
    setHash('config', t, { replace: true })
  })

  // Keep sidebar "data age" fresh.
  nowTick.value = Date.now()
  nowTickInterval = setInterval(() => { nowTick.value = Date.now() }, 10 * 60 * 1000)

  // Theme (system/dark/light)
  systemMql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  systemPrefersDark.value = !!(systemMql && systemMql.matches)
  if (systemMql && systemMql.addEventListener) {
    systemMql.addEventListener('change', (e) => {
      systemPrefersDark.value = !!e.matches
    })
  }
  applyTheme()
  watch(() => settings.uiState.ui.theme, () => applyTheme())
  watch(systemPrefersDark, () => applyTheme())

  // Try to load cached data
  try {
    const cachedMeta = await localforage.getItem('gitlab_meta')
    if (cachedMeta && typeof cachedMeta === 'object') {
      gitlabCacheMeta.value = {
        nodes: cachedMeta.nodes || 0,
        edges: cachedMeta.edges || 0,
        updatedAt: cachedMeta.updatedAt || null
      }
    }
    const cachedNodes = await localforage.getItem('gitlab_nodes')
    const cachedEdges = await localforage.getItem('gitlab_edges')
    
    // Load lastUpdated from settings
    if (settings.meta && settings.meta.lastUpdated) lastUpdated.value = settings.meta.lastUpdated

    if (cachedNodes && cachedEdges) {
      // localforage handles JSON parsing automatically
      // Important: Do NOT load massive SVN commit nodes into the graph on startup.
      // The force-directed graph cannot handle tens/hundreds of thousands of nodes and will freeze the UI.
      const filteredCachedNodes = {}
      Object.entries(cachedNodes).forEach(([id, n]) => {
        const isSvn = (n && (n.type === 'svn_commit' || String(id).startsWith('svn-')))
        if (!isSvn) filteredCachedNodes[id] = n
      })

      const filteredCachedEdges = {}
      Object.entries(cachedEdges).forEach(([id, e]) => {
        const source = e && e.source ? String(e.source) : ''
        const target = e && e.target ? String(e.target) : ''
        const isSvnEdge = source.startsWith('svn-') || target.startsWith('svn-')
        if (!isSvnEdge) filteredCachedEdges[id] = e
      })

      Object.assign(nodes, filteredCachedNodes)
      Object.assign(edges, filteredCachedEdges)

      // Keep a snapshot so mode switching works without refetch
      Object.assign(issueGraphSnapshot.nodes, filteredCachedNodes)
      Object.assign(issueGraphSnapshot.edges, filteredCachedEdges)

      /*
      console.log('--- Cached Data Loaded (First 3 Nodes) ---')
      const keys = Object.keys(nodes).slice(0, 3)
      keys.forEach(key => console.log(toRaw(nodes[key])))
      console.log('------------------------------------------')
      */
    }
    // If no cached data exists at all, populate a small sample graph so the UI isn't empty.
    if (Object.keys(nodes).length === 0 && Object.keys(edges).length === 0) {
      const mock = createMockIssuesGraph()
      Object.assign(nodes, mock.nodes)
      Object.assign(edges, mock.edges)
      Object.assign(issueGraphSnapshot.nodes, mock.nodes)
      Object.assign(issueGraphSnapshot.edges, mock.edges)
    }
  } catch (e) {
    console.error('Failed to load cached data:', e)
  }
})

onUnmounted(() => {
  if (nowTickInterval) clearInterval(nowTickInterval)
  nowTickInterval = null
  window.removeEventListener('hashchange', syncStateFromHash)
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
    mk(105, 'Mock: Refactor networking', ['Type::Chore', 'Priority::Low'], 'dan', 'alice')
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

const updateAllSvnCaches = async (override) => {
  const repos = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
  const urlsFromSettings = repos.map(r => normalizeRepoUrl(r && r.url)).filter(Boolean)
  const urlsFromOverride = override && Array.isArray(override.urls) ? override.urls.map(u => normalizeRepoUrl(u)).filter(Boolean) : []
  const urls = urlsFromOverride.length ? urlsFromOverride : urlsFromSettings
  if (urls.length === 0) return

  const username = (override && typeof override.username === 'string') ? override.username : (settings.config.svnUsername || '')
  const password = (override && typeof override.password === 'string') ? override.password : (settings.config.svnPassword || '')

  updateStatus.value = { loading: true, source: 'svn', message: `Updating ${urls.length} repos...` }
  loadingMessage.value = `SVN: updating ${urls.length} repos...`

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const prefix = `SVN (${i + 1}/${urls.length})`
    updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: starting...` }
    loadingMessage.value = `${prefix}: starting...`

    const svnClient = createSvnClient(url, username, password)
    await fetchSvnLog(svnClient, 0, {
      pageSize: 2000,
      cacheRepoUrl: url,
      onProgress: (msg) => {
        loadingMessage.value = `${prefix}: ${msg}`
        updateStatus.value = { loading: true, source: 'svn', message: `${prefix}: ${msg}` }
      }
    })
  }

  // Update footer counter based on the first repo (keeps existing UI semantics)
  const meta = await svnCacheGetMeta(urls[0])
  if (meta && meta.totalCount != null) svnCommitCount.value = meta.totalCount
}

const handleUpdateSource = async (payload) => {
  // run update without leaving the config page
  if (typeof payload === 'string') {
    if (payload === 'svn') {
      try {
        error.value = ''
        loading.value = true
        await updateAllSvnCaches()
      } catch (e) {
        error.value = `SVN Error: ${e?.message || String(e)}`
      } finally {
        loading.value = false
        updateStatus.value = { loading: false, source: 'svn', message: 'Done' }
      }
      return
    }
    await loadData({ only: payload })
    return
  }
  if (payload && typeof payload === 'object' && payload.source === 'svn' && payload.mode === 'all') {
    try {
      error.value = ''
      loading.value = true
      await updateAllSvnCaches(payload)
    } catch (e) {
      error.value = `SVN Error: ${e?.message || String(e)}`
    } finally {
      loading.value = false
      updateStatus.value = { loading: false, source: 'svn', message: 'Done' }
    }
    return
  }
}

const handleClearSource = async (payload) => {
  if (payload === 'svn' || (payload && typeof payload === 'object' && payload.source === 'svn' && payload.mode === 'all')) {
    const urls = (payload && typeof payload === 'object' && Array.isArray(payload.urls))
      ? payload.urls.map(u => normalizeRepoUrl(u)).filter(Boolean)
      : (Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos.map(r => normalizeRepoUrl(r && r.url)).filter(Boolean) : [])
    if (urls.length === 0) return
    if (!confirm(`Delete SVN cache for ALL repos (${urls.length})?`)) return
    for (const url of urls) {
      await svnCacheClear(url)
    }
    svnCommitCount.value = 0
    svnRecentCommits.value = []
    return
  }

  const source = payload
  if (source === 'gitlab') {
    if (!confirm('Delete GitLab cache (nodes/edges)?')) return
    await localforage.removeItem('gitlab_nodes')
    await localforage.removeItem('gitlab_edges')
    await localforage.removeItem('gitlab_meta')
    gitlabCacheMeta.value = { nodes: 0, edges: 0, updatedAt: null }
    for (const k in nodes) delete nodes[k]
    for (const k in edges) delete edges[k]
  }
}

const resolveGitLabApiBaseUrl = () => {
  const raw = String(settings.config.gitlabApiBaseUrl || '').trim()
  if (!raw) return ''

  const direct = normalizeGitLabApiBaseUrl(raw)
  if (!direct) return ''

  // In dev (web), use Vite proxy if configured and the URL matches that proxy target.
  if (!window.electronAPI && import.meta.env.DEV) {
    const proxyTarget = String(import.meta.env.VITE_GITLAB_PROXY_TARGET || '').trim().replace(/\/+$/, '')
    const host = String(raw || '').trim().replace(/\/+$/, '')
    if (proxyTarget && host.startsWith(proxyTarget)) return '/gitlab/api/v4'
  }

  return direct
}

const loadData = async (opts = {}) => {
  // Do not start another fetch while one is already running (no queueing).
  if (loading.value) return

  // Check for app updates (hosted builds) before re-fetching data.
  try {
    if (typeof window.__glvCheckForUpdate === 'function') {
      const didReload = await window.__glvCheckForUpdate()
      if (didReload) return
    }
  } catch {}

  const only = opts.only || 'both' // 'gitlab' | 'svn' | 'mattermost' | 'both'
  const doGitLab = (only === 'both' || only === 'gitlab') && settings.config.enableGitLab
  const doSvn = isElectron.value && (only === 'both' || only === 'svn') && settings.config.enableSvn
  const doMattermost = isElectron.value && (only === 'both' || only === 'mattermost') && !!settings.config.mattermostUrl && !!settings.config.mattermostToken

  const gitlabApiBaseUrl = resolveGitLabApiBaseUrl()

  if (doGitLab && (!settings.config.token || !settings.config.projectId || !gitlabApiBaseUrl)) {
    error.value = 'Please provide GitLab URL, Token, and Project ID'
    return
  }
  
  if (doSvn && !svnUrl.value) {
    error.value = 'Please provide SVN URL'
    return
  }

  if (only === 'mattermost' && (!settings.config.mattermostUrl || !settings.config.mattermostToken)) {
    error.value = 'Please configure Mattermost URL and login token in Configuration → Mattermost'
    return
  }

  if (!doGitLab && !doSvn && !doMattermost) {
    error.value = 'Please enable at least one data source (GitLab / SVN) or log into Mattermost'
    return
  }
  
  loading.value = true
  error.value = ''
  loadingMessage.value = 'Starting...'
  updateStatus.value = { loading: true, source: only === 'both' ? '' : only, message: 'Starting...' }
  
  // Clear previous data only if we're updating GitLab (otherwise keep the graph stable)
  if (doGitLab) {
    for (const key in nodes) delete nodes[key]
    for (const key in edges) delete edges[key]
  }

  const client = doGitLab ? createGitLabClient(gitlabApiBaseUrl, settings.config.token) : null

  try {
    // 0. Refresh Mattermost (ChatTools) session data (lightweight)
    if (doMattermost) {
      loadingMessage.value = 'Mattermost: validating login...'
      updateStatus.value = { loading: true, source: 'mattermost', message: 'Validating login...' }
      try {
        const api = new MattermostClient({ baseUrl: settings.config.mattermostUrl, token: settings.config.mattermostToken })
        const me = await api.me()
        settings.config.mattermostUser = me || null
        updateStatus.value = { loading: true, source: 'mattermost', message: 'Fetching teams...' }
        const teams = await api.teams()
        const now = Date.now()
        mattermostMeta.value = { teams: Array.isArray(teams) ? teams.length : 0, updatedAt: now }
      } catch (mmErr) {
        // Do not hard-fail GitLab/SVN updates if Mattermost refresh fails.
        if (only === 'mattermost') throw mmErr
        console.error('Mattermost update failed:', mmErr)
      }
    }

    // 1. Fetch GitLab Data
    let issues = []
    if (doGitLab) {
        loadingMessage.value = 'Fetching issues...'
        updateStatus.value = { loading: true, source: 'gitlab', message: 'Fetching issues...' }
        try {
            // Cache "me" for dynamic presets (By me / Assigned to me)
            try {
                const me = await client.get('/user')
                settings.meta.gitlabMeName = me?.data?.name || ''
                settings.meta.gitlabMeId = me?.data?.id || null
            } catch (e) {
                console.warn('[GitLab] Failed to fetch /user for presets:', e)
                settings.meta.gitlabMeName = ''
                settings.meta.gitlabMeId = null
            }

            // Best-effort: detect scopes to enable/disable write features in UI.
            try {
              const scopes = await fetchTokenScopes(client)
              settings.meta.gitlabTokenScopes = scopes
              settings.meta.gitlabCanWrite = Array.isArray(scopes) ? scopes.includes('api') : false
            } catch (e) {
              console.warn('[GitLab] Failed to detect token scopes:', e)
              settings.meta.gitlabTokenScopes = null
              settings.meta.gitlabCanWrite = false
            }

            // Fetch opened issues
            issues = await fetchProjectIssues(client, settings.config.projectId, (msg) => {
                loadingMessage.value = msg
                updateStatus.value = { loading: true, source: 'gitlab', message: msg }
            })

            // Fetch closed issues if requested
            if (settings.config.gitlabClosedDays > 0) {
                const closedAfter = new Date();
                closedAfter.setDate(closedAfter.getDate() - settings.config.gitlabClosedDays);
                
                const closedIssues = await fetchProjectIssues(client, settings.config.projectId, (msg) => {
                    loadingMessage.value = msg
                    updateStatus.value = { loading: true, source: 'gitlab', message: msg }
                }, { 
                    state: 'closed', 
                    params: { 
                        updated_after: closedAfter.toISOString()
                    } 
                });
                
                // Filter to ensure they were actually closed after the date (updated_after is broader)
                const actuallyClosed = closedIssues.filter(i => i.closed_at && new Date(i.closed_at) >= closedAfter);
                issues = [...issues, ...actuallyClosed];
            }
            
            // Create nodes
            loadingMessage.value = 'Creating nodes...'
            
            issues.forEach(issue => {
                const id = String(issue.iid)
                
                // Calculate time spent ratio if available
                let timeSpentRatio = 0
                if (issue.time_stats && issue.time_stats.time_estimate > 0) {
                    timeSpentRatio = issue.time_stats.total_time_spent / issue.time_stats.time_estimate
                }
                
                // Determine color based on status label or state
                const status = getScopedLabelValue(issue.labels, 'Status')
                let color = issue.state === 'opened' ? '#28a745' : '#dc3545' // defaults
                
                if (status === 'To do') color = '#6c757d'
                else if (status === 'In progress') color = '#007bff'
                else if (status === 'Ready for Review') color = '#fd7e14'
                else if (status === 'Done') color = '#28a745'
                else if (status === 'Won\'t do' || status === 'Duplicate') color = '#dc3545'

                nodes[id] = {
                    id,
                    name: `#${id} ${issue.title.length > 20 ? issue.title.substring(0, 20) + '...' : issue.title}`,
                    color,
                    commentsCount: issue.user_notes_count,
                    updatedAt: issue.updated_at,
                    createdAt: issue.created_at,
                    closedAt: issue.closed_at,
                    dueDate: issue.due_date,
                    confidential: issue.confidential,
                    webUrl: issue.web_url,
                    weight: issue.weight,
                    timeEstimate: issue.time_stats ? issue.time_stats.time_estimate : 0,
                    timeSpent: issue.time_stats ? issue.time_stats.total_time_spent : 0,
                    timeSpentRatio,
                    upvotes: issue.upvotes,
                    downvotes: issue.downvotes,
                    mergeRequestsCount: issue.merge_requests_count,
                    hasTasks: issue.has_tasks,
                    taskStatus: issue.task_status,
                    type: 'gitlab_issue',
                    _raw: issue 
                }
            })
        } catch (e) {
            console.error(e)
            error.value = `GitLab Error: ${e.message}`
            // If SVN is enabled, continue?
            if (!settings.config.enableSvn) throw e;
        }
    }

    // Update snapshot after GitLab (and before SVN potentially adds edges)
    // We'll finalize snapshot at end of loadData.

    // 2. Fetch SVN Data if configured
    if (doSvn && svnUrl.value) {
        try {
            loadingMessage.value = 'Fetching SVN log...'
            updateStatus.value = { loading: true, source: 'svn', message: 'Fetching SVN log...' }
            
            // Adjust URL to use proxy in DEV mode if it matches our configured proxy target
            let targetUrl = svnUrl.value
            if (!window.electronAPI && import.meta.env.DEV) {
                const proxyTarget = String(import.meta.env.VITE_SVN_PROXY_TARGET || '').trim().replace(/\/+$/, '')
                if (proxyTarget && targetUrl.startsWith(proxyTarget)) {
                    // Proxy: /svn -> VITE_SVN_PROXY_TARGET
                    targetUrl = targetUrl.replace(proxyTarget, '/svn')
                }
            }

            const svnClient = createSvnClient(targetUrl, settings.config.svnUsername, settings.config.svnPassword)

            // Stream SVN log into disk cache (chunked) and only keep a small in-memory slice.
            svnRecentCommits.value = []
            const maxKeep = Math.max(5000, Math.max(100, Math.min(Number(svnVizLimit.value) || 2000, 5000)))

            // IMPORTANT: Do not create a node for every SVN revision (can be 100k+ and will freeze graph).
            // Only create SVN nodes that actually reference existing GitLab issues (high-signal + keeps graph small).
            const MAX_SVN_NODES = 5000
            let svnNodeCount = 0

            const cacheKeyUrl = normalizeRepoUrl(svnUrl.value)
            await fetchSvnLog(svnClient, 0, {
              pageSize: 2000,
              cacheRepoUrl: cacheKeyUrl,
              onProgress: (msg) => { loadingMessage.value = msg },
              onPage: async (pageCommits) => {
                // keep a small slice in memory for SVN tree
                for (const c of pageCommits) {
                  if (svnRecentCommits.value.length >= maxKeep) break
                  svnRecentCommits.value.push(c)
                }

                // issue linking (bounded)
                if (svnNodeCount >= MAX_SVN_NODES) return
                for (const commit of pageCommits) {
                  if (!commit || !commit.message) continue
                  const issueMatches = commit.message.matchAll(/(?:refs?|issues?|tickets?|^)?\s*#(\d+)/gim)

                  let shouldCreateNode = false
                  const matchedIssueIds = []
                  for (const match of issueMatches) {
                    const issueId = match[1]
                    if (nodes[issueId]) {
                      shouldCreateNode = true
                      matchedIssueIds.push(issueId)
                    }
                  }

                  if (!shouldCreateNode) continue
                  if (svnNodeCount >= MAX_SVN_NODES) break

                  const id = `svn-${commit.revision}`
                  if (!nodes[id]) {
                    nodes[id] = {
                      id,
                      name: `r${commit.revision} ${commit.author}`,
                      color: '#6f42c1',
                      updatedAt: commit.date,
                      createdAt: commit.date,
                      author: { name: commit.author },
                      webUrl: '',
                      type: 'svn_commit',
                      _raw: commit
                    }
                    svnNodeCount++
                  }

                  for (const issueId of matchedIssueIds) {
                    const edgeId = `${id}-${issueId}`
                    edges[edgeId] = {
                      source: id,
                      target: issueId,
                      label: 'referenced'
                    }
                  }
                }
              }
            })

            const meta = await svnCacheGetMeta(cacheKeyUrl)
            if (meta && meta.totalCount != null) svnCommitCount.value = meta.totalCount
            updateStatus.value = { loading: true, source: 'svn', message: `SVN: cached ${svnCommitCount.value.toLocaleString()} commits` }

        } catch (svnErr) {
            console.error('SVN Error:', svnErr)
            // Don't fail completely if SVN fails
            error.value = `GitLab loaded, but SVN failed: ${svnErr.message}`
            // Keep going to show GitLab data
        }
    }

    // Fetch links for each issue with concurrency limit
    if (settings.config.enableGitLab && issues.length > 0) {
        loadingMessage.value = 'Fetching issue links...'
        let completedLinks = 0;
        const CONCURRENCY_LIMIT = 20;
        const linksResults = new Array(issues.length);
        let nextIssueIndex = 0;

        const fetchWorker = async () => {
        while (nextIssueIndex < issues.length) {
            const index = nextIssueIndex++;
            const issue = issues[index];
            try {
            linksResults[index] = await fetchIssueLinks(client, settings.config.projectId, issue.iid);
            } catch (e) {
            linksResults[index] = [];
            }
            completedLinks++;
            if (completedLinks % 10 === 0 || completedLinks === issues.length) {
            loadingMessage.value = `Fetching links: ${completedLinks} / ${issues.length}`;
            }
        }
        };

        await Promise.all(Array.from({ length: CONCURRENCY_LIMIT }, fetchWorker));

        loadingMessage.value = 'Processing links...'
        linksResults.forEach((links, index) => {
        const sourceIssue = issues[index]
        const sourceId = String(sourceIssue.iid)
        
        if (links && links.length > 0) {
            links.forEach(link => {
                const targetId = String(link.iid)
                
                // Avoid duplicate edges (A->B and B->A)
                const rawType = String(link.link_type || 'related')
                const t = rawType.toLowerCase()
                let a = sourceId
                let b = targetId
                let label = rawType

                // Normalize direction so arrows can be meaningful:
                // - blocks: blocker -> blocked
                // - is_blocked_by: flip to blocker -> blocked, but keep a readable label
                if (t === 'is_blocked_by' || t === 'blocked_by') {
                  a = targetId
                  b = sourceId
                  label = 'blocks'
                } else if (t === 'blocks') {
                  a = sourceId
                  b = targetId
                  label = 'blocks'
                } else if (t === 'relates' || t === 'relates_to' || t === 'related') {
                  // undirected-ish: keep stable ordering
                  if (a > b) { const tmp = a; a = b; b = tmp }
                  label = 'relates'
                }

                const edgeId = `${a}-${b}-${label}`

                if (nodes[b] && !edges[edgeId]) {
                  edges[edgeId] = { source: a, target: b, label }
                }
            })
        }
        })
    }
    
    // Save to cache (IndexedDB via localforage)
    try {
      // Persist current "issues" view snapshot (never persist SVN rev-tree)
      for (const k in issueGraphSnapshot.nodes) delete issueGraphSnapshot.nodes[k]
      for (const k in issueGraphSnapshot.edges) delete issueGraphSnapshot.edges[k]
      Object.assign(issueGraphSnapshot.nodes, toRaw(nodes))
      Object.assign(issueGraphSnapshot.edges, toRaw(edges))

      if (doGitLab) {
        await localforage.setItem('gitlab_nodes', toRaw(nodes))
        await localforage.setItem('gitlab_edges', toRaw(edges))
        const now = Date.now()
        await localforage.setItem('gitlab_meta', { nodes: Object.keys(nodes).length, edges: Object.keys(edges).length, updatedAt: now })
        gitlabCacheMeta.value = { nodes: Object.keys(nodes).length, edges: Object.keys(edges).length, updatedAt: now }
      }
      const now = Date.now()
      lastUpdated.value = now
      settings.meta.lastUpdated = now
    } catch (e) {
      console.error('Failed to save to cache:', e)
      error.value = 'Failed to save to cache: ' + e.message
    }

  } catch (err) {
    error.value = err.message || 'Failed to load data'
    console.error(err)
  } finally {
    loading.value = false
    updateStatus.value = { loading: false, source: updateStatus.value.source || '', message: loadingMessage.value }
  }

  // If user is currently in SVN mode, rebuild SVN graph now that we have commits.
  if (vizMode.value === 'svn') {
    buildSvnVizGraph()
  }
}

const onIssueStateChange = async ({ iid, state_event } = {}) => {
  const issueIid = String(iid || '').trim()
  const ev = String(state_event || '').trim()
  if (!issueIid || (ev !== 'close' && ev !== 'reopen')) return

  if (!settings.meta.gitlabCanWrite) {
    alert('Write is disabled for this token (needs api scope).')
    return
  }
  if (!settings.config.enableGitLab) return

  const baseUrl = resolveGitLabApiBaseUrl()
  if (!baseUrl || !settings.config.projectId || !settings.config.token) {
    alert('Missing GitLab URL / Project / Token.')
    return
  }

  try {
    const client = createGitLabClient(baseUrl, settings.config.token)
    const updated = await updateIssue(client, settings.config.projectId, issueIid, { state_event: ev })
    if (nodes[issueIid]) nodes[issueIid]._raw = updated
    nodes[issueIid]._uiForceShow = true
    snackbarText.value = ev === 'close' ? `Closed #${issueIid}` : `Reopened #${issueIid}`
    snackbar.value = true
  } catch (e) {
    const status = e?.response?.status
    const msg = status ? `GitLab error ${status}: ${e?.message || String(e)}` : (e?.message || String(e))
    alert(msg)
  }
}

const onIssueAssigneeChange = async ({ iid, assignee_ids } = {}) => {
  const issueIid = String(iid || '').trim()
  const list = Array.isArray(assignee_ids) ? assignee_ids : null
  if (!issueIid || !list) return

  if (!settings.meta.gitlabCanWrite) {
    alert('Write is disabled for this token (needs api scope).')
    return
  }
  if (!settings.config.enableGitLab) return

  const baseUrl = resolveGitLabApiBaseUrl()
  if (!baseUrl || !settings.config.projectId || !settings.config.token) {
    alert('Missing GitLab URL / Project / Token.')
    return
  }

  try {
    const client = createGitLabClient(baseUrl, settings.config.token)
    const updated = await updateIssue(client, settings.config.projectId, issueIid, { assignee_ids: list })

    // Keep the rest of the app consistent (some parts use _raw.assignee directly).
    if (updated) {
      if (!updated.assignee && Array.isArray(updated.assignees) && updated.assignees.length) updated.assignee = updated.assignees[0]
      if (Array.isArray(updated.assignees) && updated.assignees.length === 0) updated.assignee = null
    }

    if (nodes[issueIid]) nodes[issueIid]._raw = updated
    nodes[issueIid]._uiForceShow = true
    snackbarText.value = list.length ? `Assigned #${issueIid}` : `Unassigned #${issueIid}`
    snackbar.value = true
  } catch (e) {
    const status = e?.response?.status
    const msg = status ? `GitLab error ${status}: ${e?.message || String(e)}` : (e?.message || String(e))
    alert(msg)
  }
}

const clearData = async () => {
  if (confirm('Are you sure you want to clear all data and cache?')) {
    // Clear in-memory
    for (const key in nodes) delete nodes[key]
    for (const key in edges) delete edges[key]
    svnRecentCommits.value = []
    svnCommitCount.value = 0
    
    // Clear storage
    await localforage.clear()
    
    resetFilters()
  }
}

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
      if (config.view.issueOpenTarget) settings.uiState.view.issueOpenTarget = config.view.issueOpenTarget
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
