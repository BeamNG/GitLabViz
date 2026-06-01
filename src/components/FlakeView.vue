<template>
  <v-app-bar density="compact" elevation="1">
    <v-app-bar-nav-icon @click="$emit('close')" title="Back" icon="mdi-arrow-left" />
    <v-app-bar-title>Flake History</v-app-bar-title>
    <v-spacer />
    <v-text-field
      v-if="bundle"
      v-model="searchQuery"
      density="compact" hide-details variant="outlined"
      placeholder="Search tests..."
      prepend-inner-icon="mdi-magnify"
      clearable
      style="max-width: 280px"
      class="mr-2"
    />
    <v-tooltip :text="`Theme: ${currentTheme} (click to cycle)`" location="bottom">
      <template #activator="{ props: tipProps }">
        <v-btn icon v-bind="tipProps" @click="cycleTheme">
          <v-icon :icon="themeIcon" />
        </v-btn>
      </template>
    </v-tooltip>
    <v-tooltip text="What do the classifications mean?" location="bottom">
      <template #activator="{ props: tipProps }">
        <v-btn icon v-bind="tipProps" @click="infoDialog = true">
          <v-icon icon="mdi-information-outline" />
        </v-btn>
      </template>
    </v-tooltip>
    <v-btn icon @click="reload" :loading="loading" title="Refresh now" class="mr-2">
      <v-icon icon="mdi-refresh" />
    </v-btn>
  </v-app-bar>

  <v-toolbar v-if="bundle" density="compact" elevation="0" color="surface" class="flake-subtoolbar">
    <v-select
      v-if="filterOptions.suites.length > 1"
      v-model="suiteFilter"
      :items="['(all)', ...filterOptions.suites]"
      density="compact" hide-details variant="underlined"
      style="max-width: 160px"
      label="Suite"
      class="ml-2"
    />
    <v-select
      v-if="filterOptions.gfxApis.length > 1"
      v-model="gfxFilter"
      :items="['(all)', ...filterOptions.gfxApis]"
      density="compact" hide-details variant="underlined"
      style="max-width: 140px"
      label="Gfx"
      class="ml-2"
    />
    <v-slider
      v-model="lastNRuns"
      :min="5" :max="100" :step="1"
      hide-details density="compact"
      style="max-width: 220px; min-width: 160px"
      :label="`Last ${lastNRuns} runs`"
      class="ml-4"
    />
    <v-spacer />
    <v-switch
      v-model="showAllTests"
      density="compact" hide-details color="primary"
      :label="showAllTests ? 'All tests' : 'Top 100 flaky'"
      class="mr-4"
    />
  </v-toolbar>

  <v-main class="flake-main">
    <!-- Loading -->
    <v-overlay v-if="loading && !bundle" persistent contained class="d-flex align-center justify-center">
      <v-progress-circular indeterminate />
    </v-overlay>

    <!-- Not configured: inline settings form -->
    <v-container v-if="errorKind === 'not_configured'" class="flake-empty">
      <v-card max-width="640" class="mx-auto pa-4">
        <v-card-title>Flake history is not configured</v-card-title>
        <v-card-text>
          <p class="mb-3">
            Point at a GitLab project that publishes a
            <a href="https://github.com/BeamNG/GitLabViz/blob/main/docs/flake-history-integration.md" target="_blank" rel="noopener">flake-history bundle</a>
            to its Generic Package Registry. The viewer downloads the newest published version.
          </p>
          <v-text-field
            v-model="form.projectId"
            label="GitLab project ID or path"
            placeholder="123  or  mygroup/myproj"
            density="compact"
            hint="Numeric ID or 'group/project' — same project that publishes the bundle"
            persistent-hint
          />
          <v-text-field
            v-model="form.packageName"
            label="Package name"
            placeholder="flake-history"
            density="compact"
            class="mt-3"
          />
          <v-text-field
            v-model.number="form.refreshMinutes"
            type="number"
            label="Refresh interval (minutes; 0 = manual)"
            min="0"
            density="compact"
            class="mt-3"
          />
          <v-alert
            v-if="!hasGitlabConfigured"
            type="warning" variant="tonal" density="compact" class="mt-4"
          >
            Set the GitLab base URL and token in the main settings panel first — those values are reused here.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="saveForm" :disabled="!hasGitlabConfigured || !form.projectId">Save and load</v-btn>
        </v-card-actions>
      </v-card>
    </v-container>

    <!-- Schema mismatch -->
    <v-alert v-else-if="errorKind === 'unsupported_schema'" type="error" class="ma-4">
      <strong>Unsupported bundle version.</strong>
      This GitLabViz reads up to schema_version {{ supportedSchemaVersion }}; the published bundle is newer. Upgrade GitLabViz to read it.
    </v-alert>

    <!-- No package yet -->
    <v-alert v-else-if="errorKind === 'not_found'" type="info" class="ma-4">
      No bundle has been published under
      <code>{{ flakeSettings.packageName }}</code> in this project yet. Has your bundler pipeline run?
    </v-alert>

    <!-- Generic error -->
    <v-alert v-else-if="errorKind === 'error'" type="error" class="ma-4">
      Failed to load flake history: {{ errorMessage }}
    </v-alert>

    <!-- Loaded: leaderboard + heatmap -->
    <div v-else-if="bundle" class="flake-grid">
      <section class="flake-section flake-leaderboard">
        <header class="flake-section-header">
          <h3 class="text-subtitle-1">
            Leaderboard
            <span class="text-caption text-medium-emphasis">({{ leaderboard.length }} {{ leaderboard.length === 1 ? 'test' : 'tests' }}, most flaky first)</span>
          </h3>
        </header>
        <v-data-table
          :headers="leaderboardHeaders"
          :items="leaderboard"
          :items-per-page="50"
          density="compact"
          item-value="test_id"
          v-model:selected="selectedTestIds"
          @click:row="onRowClick"
          class="flake-table"
        >
          <template #item.runs="{ item }">
            {{ item.pass_count }}/{{ item.pass_count + item.fail_count }}
          </template>
          <template #item.pass_rate="{ value }">
            {{ value === null ? '—' : (value * 100).toFixed(1) + '%' }}
          </template>
          <template #item.flake_classification="{ value }">
            <v-chip :color="classColor(value)" size="small" variant="tonal">{{ value || '—' }}</v-chip>
          </template>
        </v-data-table>
      </section>

      <section class="flake-section flake-heatmap">
        <header class="flake-section-header">
          <h3 class="text-subtitle-1">
            Heatmap
            <span class="text-caption text-medium-emphasis">(rightmost = most recent)</span>
          </h3>
        </header>
        <div class="flake-cells-hint">
          <v-icon icon="mdi-cursor-default-click-outline" size="14" class="mr-1" />
          Click any cell to download that run's artifacts — or open its pipeline when artifacts have expired.
        </div>
        <div class="flake-legend" aria-label="Heatmap legend">
          <span class="flake-legend-item"><i class="flake-cell flake-cell--pass" />Pass · artifacts live</span>
          <span class="flake-legend-item"><i class="flake-cell flake-cell--pass flake-cell--expired" />Pass · expired</span>
          <span class="flake-legend-item"><i class="flake-cell flake-cell--fail" />Fail · artifacts live</span>
          <span class="flake-legend-item"><i class="flake-cell flake-cell--fail flake-cell--expired" />Fail · expired</span>
          <span class="flake-legend-item"><i class="flake-cell flake-cell--not_run" />Not run</span>
          <span class="flake-legend-item"><i class="flake-cell flake-cell--fail flake-cell--interrupted" />Interrupted run</span>
        </div>
        <div class="flake-heatmap-scroll">
          <table class="flake-heatmap-table">
            <thead>
              <tr>
                <th class="flake-heatmap-test-col">Test</th>
                <th
                  v-for="r in heatmap.runs" :key="r.run_id"
                  class="flake-heatmap-run-col"
                  :title="runTooltip(r)"
                >{{ formatTickLabel(r.started_at) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in heatmap.tests"
                :key="t.test_id"
                :class="{ selected: isRowSelected(t) }"
                @click="selectedTestIds = t.member_ids"
              >
                <td class="flake-heatmap-test-col">
                  <span :title="t.member_ids.join('\n')">{{ t.name }}</span>
                </td>
                <td
                  v-for="(cell, i) in heatmap.cells[t.test_id]" :key="i"
                  class="flake-cell-td"
                  :title="cellTooltip(t, heatmap.runs[i], cell)"
                  @click.stop="openArtifactOrPipeline(heatmap.runs[i], heatmap.expiredRunIds.has(heatmap.runs[i].run_id))"
                >
                  <div
                    :class="['flake-cell', `flake-cell--${cell}`,
                             heatmap.expiredRunIds.has(heatmap.runs[i].run_id) ? 'flake-cell--expired' : '',
                             heatmap.interruptedRunIds.has(heatmap.runs[i].run_id) ? 'flake-cell--interrupted' : '']"
                  ></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </v-main>

  <v-dialog v-model="infoDialog" max-width="560">
    <v-card>
      <v-card-title>Flake classifications</v-card-title>
      <v-card-text>
        <p class="mb-4 text-body-2">
          Each test is bucketed by its pass rate across all retained runs in the bundle.
          The bundler computes the label; the viewer just displays it.
        </p>
        <div class="flake-class-row">
          <v-chip color="success" size="small" variant="tonal">stable</v-chip>
          <span>Pass rate <strong>≥ 95%</strong>, or zero failures observed.</span>
        </div>
        <div class="flake-class-row">
          <v-chip color="warning" size="small" variant="tonal">intermittent</v-chip>
          <span>Pass rate <strong>≥ 50%</strong> and <strong>&lt; 95%</strong>.</span>
        </div>
        <div class="flake-class-row">
          <v-chip color="error" size="small" variant="tonal">actively_flaky</v-chip>
          <span>Pass rate <strong>&lt; 50%</strong>, still passing sometimes.</span>
        </div>
        <div class="flake-class-row">
          <v-chip color="error" size="small" variant="tonal">broken</v-chip>
          <span>Zero passes observed across the window.</span>
        </div>
        <v-alert density="compact" variant="tonal" type="info" class="mt-5">
          Thresholds live in <code>bundle_flake_history.py</code> (<code>_flake_classification</code>) and
          can be tuned in one place if the studio team's intuition differs.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="infoDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  fetchLatestBundle, selectFlakeLeaderboard, selectHeatmapMatrix,
  FlakeNotConfiguredError, FlakeBundleNotFoundError, UnsupportedSchemaVersionError,
  SUPPORTED_SCHEMA_VERSION,
} from '../services/flake'
import { decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

const props = defineProps({
  settings: { type: Object, required: true },
})
defineEmits(['close'])

const supportedSchemaVersion = SUPPORTED_SCHEMA_VERSION
const flakeSettings = computed(() => props.settings.config.flakeHistory || {})
const hasGitlabConfigured = computed(() => Boolean(props.settings.config.gitlabApiBaseUrl))

const bundle = ref(null)
const loading = ref(false)
const errorKind = ref(null) // 'not_configured' | 'not_found' | 'unsupported_schema' | 'error' | null
const errorMessage = ref('')

const suiteFilter = ref('(all)')
const gfxFilter = ref('(all)')
const lastNRuns = ref(30)
const selectedTestIds = ref([])
const searchQuery = ref('')
const showAllTests = ref(false)
const infoDialog = ref(false)

const form = ref({
  projectId: flakeSettings.value.projectId || '',
  packageName: flakeSettings.value.packageName || 'flake-history',
  refreshMinutes: flakeSettings.value.refreshMinutes ?? 60,
})

const filterOptions = computed(() => ({
  suites: [...new Set((bundle.value?.runs || []).map(r => r.suite).filter(Boolean))].sort(),
  gfxApis: [...new Set((bundle.value?.runs || []).map(r => r.gfx_api).filter(Boolean))].sort(),
}))

const facet = computed(() => ({
  suite: suiteFilter.value === '(all)' ? null : suiteFilter.value,
  gfxApi: gfxFilter.value === '(all)' ? null : gfxFilter.value,
}))

const leaderboardLimit = computed(() => showAllTests.value ? Infinity : 100)

const matchesSearch = (t) => {
  const q = (searchQuery.value || '').trim().toLowerCase()
  if (!q) return true
  return (
    (t.name   || '').toLowerCase().includes(q) ||
    (t.module || '').toLowerCase().includes(q) ||
    (t.test_id || '').toLowerCase().includes(q)
  )
}

const leaderboard = computed(() => {
  if (!bundle.value) return []
  const rows = selectFlakeLeaderboard(bundle.value, {
    ...facet.value,
    limit: leaderboardLimit.value,
    excludeStable: !showAllTests.value,
  })
  return rows.filter(matchesSearch)
})

const heatmap = computed(() => {
  if (!bundle.value) return { runs: [], tests: [], cells: {}, interruptedRunIds: new Set(), expiredRunIds: new Set() }
  const raw = selectHeatmapMatrix(bundle.value, { ...facet.value, lastNRuns: lastNRuns.value })
  return { ...raw, tests: raw.tests.filter(matchesSearch) }
})

// A grouped heatmap row is selected when any of its member test_ids (the
// original per-suite ids the leaderboard still emits) is in the selection.
const isRowSelected = (t) => (t.member_ids || []).some(id => selectedTestIds.value.includes(id))

const leaderboardHeaders = [
  { title: 'Test', key: 'name' },
  { title: 'Runs', key: 'runs', align: 'end', sortable: false },
  { title: 'Pass rate', key: 'pass_rate', align: 'end' },
  { title: 'Last', key: 'last_status', align: 'center' },
  { title: 'Class', key: 'flake_classification' },
]

const classColor = (c) => ({
  stable: 'success',
  intermittent: 'warning',
  actively_flaky: 'error',
  broken: 'error',
}[c] || undefined)

const onRowClick = (_e, { item }) => { selectedTestIds.value = [item.test_id] }

const formatTickLabel = (iso) => {
  if (!iso) return ''
  return iso.slice(5, 10) // MM-DD
}
const runTooltip = (r) => `${r.suite || '?'} • ${r.gfx_api || '?'} • ${r.runner_id || '?'} • ${r.started_at || ''} • status=${r.status}`
const cellTooltip = (t, r, cell) => {
  const expired = heatmap.value.expiredRunIds.has(r.run_id)
  const artifacts = expired ? 'artifacts expired' : (r.artifacts_url ? 'artifacts available' : 'artifacts unknown')
  return `${t.name}\nrun: ${r.run_id}\n${cell} • ${artifacts}${r.status === 'interrupted' ? ' (run was interrupted)' : ''}`
}

const openPipeline = (r) => {
  if (r?.pipeline_url) window.open(r.pipeline_url, '_blank', 'noopener')
}

// Relative path of the local results viewer inside a game install.
const VIEWER_REL = 'game/test_viewer.html'

// Build a file:// URL to the local test viewer from the game install ROOT.
// Pure + unit-tested: tolerates backslashes and a trailing separator, preserves
// a Windows drive letter (D:), and URI-encodes the remaining segments. Returns
// '' when no root is configured.
const buildViewerFileUrl = (root) => {
  const r = String(root || '').trim()
  if (!r) return ''
  const norm = r.replace(/\\/g, '/').replace(/\/+$/, '')
  const encoded = `${norm}/${VIEWER_REL}`
    .split('/')
    .map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg)) ? seg : encodeURIComponent(seg))
    .join('/')
  return `file:///${encoded}`
}

// Open the local results viewer for the configured game install. Best-effort:
// real open via Electron's shell.openPath; in the browser we attempt a file://
// URL (commonly blocked — that's fine). Never throws so it can't break the
// artifact download it accompanies. No-op when gameInstallPath is unset.
const openTestViewer = () => {
  const root = (flakeSettings.value.gameInstallPath || '').trim()
  if (!root) return
  try {
    if (window.electronAPI?.openPath) { window.electronAPI.openPath(root); return }
    const url = buildViewerFileUrl(root)
    if (url) window.open(url, '_blank', 'noopener')
  } catch { /* opening the viewer is best-effort; never break the download */ }
}

// Click priority: download the run's artifacts when the producer supplied a
// direct URL AND we estimate they still exist. On that download branch we also
// open the local test viewer (if configured) so results are one click away.
// Once a run's artifacts have expired (per-suite window) the URL would 404, so
// we fall back to opening the pipeline — the old behavior, and where runs
// without any URL land too; no viewer there since nothing was downloaded.
const openArtifactOrPipeline = (r, expired = false) => {
  if (r?.artifacts_url && !expired) {
    window.open(r.artifacts_url, '_blank', 'noopener')
    openTestViewer()
    return
  }
  openPipeline(r)
}

const isConfigured = () => Boolean(
  props.settings.config.gitlabApiBaseUrl && flakeSettings.value.projectId
)

// Theme — reuses settings.uiState.ui.theme and the same cycle order used by
// the app-wide hotkey so all toggles agree on what "next" means.
const THEME_ORDER = ['light', 'dark', 'system', 'schedule']
const currentTheme = computed(() => props.settings?.uiState?.ui?.theme || 'system')
const themeIcon = computed(() => ({
  light: 'mdi-weather-sunny',
  dark: 'mdi-weather-night',
  system: 'mdi-theme-light-dark',
  schedule: 'mdi-calendar-clock',
}[currentTheme.value] || 'mdi-theme-light-dark'))
const cycleTheme = () => {
  const ui = props.settings?.uiState?.ui
  if (!ui) return
  const i = THEME_ORDER.indexOf(ui.theme || 'system')
  ui.theme = THEME_ORDER[(i + 1) % THEME_ORDER.length]
}

const reload = async () => {
  if (!isConfigured()) {
    errorKind.value = 'not_configured'
    return
  }
  loading.value = true
  errorKind.value = null
  errorMessage.value = ''
  try {
    const token = decodeGitLabTokenFromStorage(props.settings.config.token)
    bundle.value = await fetchLatestBundle({
      gitlabUrl: props.settings.config.gitlabApiBaseUrl,
      projectIdOrPath: flakeSettings.value.projectId,
      packageName: flakeSettings.value.packageName || 'flake-history',
      token,
    })
  } catch (e) {
    if (e instanceof FlakeNotConfiguredError)        errorKind.value = 'not_configured'
    else if (e instanceof FlakeBundleNotFoundError)  errorKind.value = 'not_found'
    else if (e instanceof UnsupportedSchemaVersionError) errorKind.value = 'unsupported_schema'
    else { errorKind.value = 'error'; errorMessage.value = e?.message || String(e) }
  } finally {
    loading.value = false
  }
}

const saveForm = () => {
  props.settings.config.flakeHistory = {
    projectId: form.value.projectId.trim(),
    packageName: (form.value.packageName || 'flake-history').trim(),
    refreshMinutes: Math.max(0, Number(form.value.refreshMinutes) || 0),
  }
  reload()
}

let refreshTimer = null
const scheduleRefresh = () => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  const mins = Number(flakeSettings.value.refreshMinutes) || 0
  if (mins > 0) refreshTimer = setInterval(reload, mins * 60_000)
}
watch(() => flakeSettings.value.refreshMinutes, scheduleRefresh)

onMounted(() => { reload(); scheduleRefresh() })
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<style scoped>
.flake-main { padding: 0; background: rgb(var(--v-theme-background)); }

.flake-subtoolbar {
  border-bottom: 1px solid rgba(127, 127, 127, 0.18);
}

.flake-grid {
  display: grid;
  grid-template-columns: 32% 68%;
  gap: 12px;
  padding: 12px;
  height: calc(100vh - 112px); /* app-bar + subtoolbar */
  overflow: hidden;
}
.flake-section {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.flake-section-header {
  padding: 8px 12px 4px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.12);
}
.flake-leaderboard, .flake-heatmap { overflow: hidden; }
.flake-table { flex: 1; overflow: auto; }
.flake-heatmap-scroll { flex: 1; overflow: auto; }

.flake-cells-hint {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  border-bottom: 1px solid rgba(127, 127, 127, 0.12);
}

.flake-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  padding: 6px 12px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  border-bottom: 1px solid rgba(127, 127, 127, 0.12);
}
.flake-legend-item { display: inline-flex; align-items: center; }
.flake-legend-item .flake-cell {
  width: 12px; height: 12px;
  margin-right: 5px;
  flex: 0 0 auto;
  transition: none;
}

.flake-heatmap-table { border-collapse: separate; border-spacing: 0; font-size: 11px; }
.flake-heatmap-table th, .flake-heatmap-table td {
  padding: 0;
  white-space: nowrap;
}
.flake-heatmap-table th {
  padding: 2px 4px;
  font-weight: 500;
}
.flake-heatmap-test-col {
  min-width: 240px; max-width: 360px;
  padding: 2px 8px !important;
  overflow: hidden; text-overflow: ellipsis;
  position: sticky; left: 0;
  background: rgb(var(--v-theme-surface));
  z-index: 1;
  border-right: 1px solid rgba(127, 127, 127, 0.18);
}
.flake-heatmap-run-col {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  padding-bottom: 6px !important;
  border-bottom: 1px solid rgba(127, 127, 127, 0.18);
}

/* Cells: padded td + inner colored div = visually distinct tiles rather than
   a fused band. Hover lifts the tile to advertise clickability. */
.flake-cell-td {
  width: 16px;
  height: 16px;
  padding: 1px !important;
  cursor: pointer;
  position: relative;
}
.flake-cell {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.flake-cell--pass    { background: #4caf50; }
.flake-cell--fail    { background: #f44336; }
.flake-cell--not_run { background: rgba(127, 127, 127, 0.25); }
/* Expired artifacts: same hue, darker — the result still counts, but the
   pipeline's downloadable artifacts are gone. */
.flake-cell--pass.flake-cell--expired { background: #1b5e20; }
.flake-cell--fail.flake-cell--expired { background: #7f1d1d; }
.flake-cell--interrupted {
  box-shadow: inset 0 0 0 2px #f44336;
  background: rgba(244, 67, 54, 0.12);
}
.flake-cell-td:hover { z-index: 2; }
.flake-cell-td:hover .flake-cell {
  transform: scale(1.45);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
}
.flake-cell-td:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -1px; }

tr.selected td { background: rgba(var(--v-theme-primary), 0.12); }

.flake-empty { padding-top: 48px; }

.flake-class-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
</style>
