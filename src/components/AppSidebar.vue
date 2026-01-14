<template>
  <v-navigation-drawer
    width="300"
    :rail="!settings.uiState.ui.isDrawerExpanded"
    permanent
    location="left"
    @click="settings.uiState.ui.isDrawerExpanded = true"
  >
    <div
      class="d-flex align-center pl-4 pr-3 py-2 font-weight-bold app-titlebar"
      @click.stop="settings.uiState.ui.isDrawerExpanded = !settings.uiState.ui.isDrawerExpanded"
      style="cursor: pointer; height: 48px;"
    >
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
          @click.stop="onOpenChangelog"
        >v{{ appVersion }}</span></span>
      </div>

      <!-- Config & Update buttons in title bar -->
      <div v-if="settings.uiState.ui.isDrawerExpanded" class="d-flex ga-1 flex-shrink-0">
        <v-btn
          id="glv-toggle-physics-btn"
          icon
          variant="text"
          size="small"
          density="compact"
          @click.stop="onTogglePhysics"
          :title="physicsPaused ? 'Resume physics (unlock positions)' : 'Pause physics (freeze positions)'"
        >
          <v-icon :icon="physicsPaused ? 'mdi-play' : 'mdi-stop'"></v-icon>
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="small"
          density="compact"
          @click.stop="onOpenConfig"
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
          @click.stop="onRefreshClick"
          :loading="loading"
          title="Update Data (Ctrl+Click = full clean update)"
        >
          <v-icon icon="mdi-refresh"></v-icon>
        </v-btn>
      </div>
    </div>

    <div
      class="pa-2 d-flex flex-column h-100"
      v-if="settings.uiState.ui.isDrawerExpanded"
      style="overflow: hidden; max-height: 100vh;"
    >
      <!-- Scrollable Filters Section -->
      <div class="d-flex flex-column flex-grow-1" style="min-height: 0; overflow: hidden; position: relative;">
        <!-- Fixed Header -->
        <div class="d-flex align-center justify-space-between mb-2 flex-shrink-0">
          <div class="d-flex flex-grow-1 justify-end">
            <v-select
              v-if="vizModeOptions.length > 1"
              v-model="vizModeProxy"
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
              @click="onCreatePreset"
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
              @click="onRefocusGraph"
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
              @click="onFitGraph"
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
              @click="onReflowGraph"
              title="Reflow Graph"
              class="mr-1"
            >
              <v-icon icon="mdi-refresh" size="small"></v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div style="overflow-y: auto; overflow-x: hidden;" class="flex-grow-1 pr-1">
          <div v-if="canUseSvn && vizModeProxy === 'svn'" class="px-1 mb-2">
            <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1">SVN Tree</div>
            <v-select
              v-model="svnVizLimitProxy"
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
          <div
            class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none"
            @click="settings.uiState.ui.showTemplates = !settings.uiState.ui.showTemplates"
          >
            <div class="d-flex align-center ga-2">
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
                  @click="onApplyPreset(preset)"
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
                  @click="onApplyPreset(preset)"
                >
                  <div class="text-truncate w-100 text-left">{{ preset.name }}</div>
                </v-btn>
              </div>
            </div>
          </v-expand-transition>
          <v-divider class="mb-2"></v-divider>

          <SidebarFilterControls
            :state="settings.uiState"
            :all-statuses="allStatuses"
            :all-labels="allLabels"
            :all-authors="allAuthors"
            :all-assignees="allAssignees"
            :all-participants="allParticipants"
            :user-state-by-name="userStateByName"
            :me-name="meName"
            :all-milestones="allMilestones"
            :all-priorities="allPriorities"
            :all-types="allTypes"
            :date-filter-modes="dateFilterModes"
            :grouping-mode-options="groupingModeOptions"
            :view-mode-options="viewModeOptions"
            :link-mode-options="linkModeOptions"
            @reset-filters="onResetFilters"
          />
          <SidebarSimulationControls :state="settings.uiState" />
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
            @click="onShowSvnLog"
            title="Show SVN log"
          >
            {{ svnCommitCountLabel.toLocaleString() }} commits
          </v-btn>
        </div>
        <div v-else-if="canUseSvn && svnRecentCommits.length" class="d-flex justify-space-between align-center mb-1">
          <div class="text-caption text-medium-emphasis">SVN</div>
          <div class="text-caption text-medium-emphasis">
            Loaded: {{ svnRecentCommits.length.toLocaleString() }}
          </div>
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

    <div v-else class="d-flex flex-column align-center mt-2 ga-2">
      <!-- Mini Toolbar -->
      <v-tooltip :text="physicsPaused ? 'Resume physics (unlock positions)' : 'Pause physics (freeze positions)'" location="right">
        <template v-slot:activator="{ props }">
          <v-btn
            id="glv-toggle-physics-btn-mini"
            :icon="physicsPaused ? 'mdi-play' : 'mdi-stop'"
            variant="text"
            size="small"
            v-bind="props"
            @click.stop="onTogglePhysics"
          ></v-btn>
        </template>
      </v-tooltip>

      <v-tooltip text="Recenter Graph" location="right">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-crosshairs-gps" variant="text" size="small" v-bind="props" @click.stop="onRefocusGraph"></v-btn>
        </template>
      </v-tooltip>

      <v-tooltip text="Fit Graph to Screen" location="right">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-fit-to-screen" variant="text" size="small" v-bind="props" @click.stop="onFitGraph"></v-btn>
        </template>
      </v-tooltip>

      <v-tooltip text="Reset Filters" location="right">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-filter-off" variant="text" size="small" color="medium-emphasis" v-bind="props" @click.stop="onResetFilters"></v-btn>
        </template>
      </v-tooltip>

      <v-divider class="w-75 my-2"></v-divider>

      <v-tooltip text="Update Issues" location="right">
        <template v-slot:activator="{ props }">
          <v-btn
            icon="mdi-refresh"
            variant="text"
            size="small"
            :color="isDataStale ? 'error' : 'secondary'"
            v-bind="props"
            @click.stop="onRefreshClick"
            :loading="loading"
          ></v-btn>
        </template>
      </v-tooltip>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue'
import SidebarFilterControls from './SidebarFilterControls.vue'
import SidebarSimulationControls from './sidebar/SidebarSimulationControls.vue'

const props = defineProps({
  settings: { type: Object, required: true },
  buildTitle: { type: String, default: '' },
  appVersion: { type: String, default: '' },
  physicsPaused: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingMessage: { type: String, default: '' },
  isDataStale: { type: Boolean, default: false },
  canUseSvn: { type: Boolean, default: false },
  isElectron: { type: Boolean, default: false },

  vizModeOptions: { type: Array, default: () => [] },
  vizMode: { type: String, default: 'issues' },
  svnVizLimit: { type: Number, default: 2000 },

  GLOBAL_PRESETS: { type: Array, default: () => [] },
  customPresets: { type: Array, default: () => [] },

  allStatuses: { type: Array, default: () => [] },
  allLabels: { type: Array, default: () => [] },
  allAuthors: { type: Array, default: () => [] },
  allAssignees: { type: Array, default: () => [] },
  allParticipants: { type: Array, default: () => [] },
  userStateByName: { type: Object, default: () => ({}) },
  meName: { type: String, default: '' },
  allMilestones: { type: Array, default: () => [] },
  allPriorities: { type: Array, default: () => [] },
  allTypes: { type: Array, default: () => [] },
  dateFilterModes: { type: Array, default: () => [] },
  groupingModeOptions: { type: [Array, Object], default: () => [] },
  viewModeOptions: { type: Array, default: () => [] },
  linkModeOptions: { type: Array, default: () => [] },

  svnRecentCommits: { type: Array, default: () => [] },
  svnCommitCountLabel: { type: Number, default: 0 },
  hasData: { type: Boolean, default: false },
  statsText: { type: String, default: '' },
  dataAge: { type: String, default: null },
  lastUpdatedDate: { type: String, default: '' },
  groupStatsText: { type: String, default: null },

  onTogglePhysics: { type: Function, required: true },
  onOpenConfig: { type: Function, required: true },
  onOpenChangelog: { type: Function, required: true },
  onRefreshClick: { type: Function, required: true },
  onCreatePreset: { type: Function, required: true },
  onApplyPreset: { type: Function, required: true },
  onRefocusGraph: { type: Function, required: true },
  onFitGraph: { type: Function, required: true },
  onReflowGraph: { type: Function, required: true },
  onResetFilters: { type: Function, required: true },
  onShowSvnLog: { type: Function, required: true }
})

const emit = defineEmits(['update:vizMode', 'update:svnVizLimit'])

const vizModeProxy = computed({
  get: () => props.vizMode,
  set: (v) => emit('update:vizMode', v)
})

const svnVizLimitProxy = computed({
  get: () => props.svnVizLimit,
  set: (v) => emit('update:svnVizLimit', v)
})
</script>

