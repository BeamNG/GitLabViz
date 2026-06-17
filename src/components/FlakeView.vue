<template>
  <v-app-bar density="compact" elevation="1">
    <v-app-bar-nav-icon @click="$emit('close')" title="Back" icon="mdi-arrow-left" />
    <v-app-bar-title>Flake History</v-app-bar-title>
    <v-spacer />
    <v-text-field
      v-if="bundle"
      v-model="searchQuery"
      density="compact" hide-details variant="outlined"
      placeholder="Search tests… or r177518...r177600"
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
    <v-tooltip :text="openViewerOnClick ? 'Open viewer on click: on' : 'Open viewer on click: off'" location="bottom">
      <template #activator="{ props: tipProps }">
        <v-btn icon v-bind="tipProps" @click="openViewerOnClick = !openViewerOnClick"
               :color="openViewerOnClick ? 'primary' : undefined">
          <v-icon :icon="openViewerOnClick ? 'mdi-monitor' : 'mdi-monitor-off'" />
        </v-btn>
      </template>
    </v-tooltip>
    <v-tooltip text="Flake history settings" location="bottom">
      <template #activator="{ props: tipProps }">
        <v-btn icon v-bind="tipProps" @click="openConfigDialog">
          <v-icon icon="mdi-cog" />
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
          <v-text-field
            v-model="form.gameInstallPath"
            label="Game install folder (optional)"
            placeholder="D:\BeamNG.drive"
            density="compact"
            class="mt-3"
            hint="Path to your BeamNG install — clicking an artifact also opens the viewer"
            persistent-hint
          />
          <v-switch
            v-model="form.useCommandListener"
            density="compact" hide-details color="primary"
            label="Use command listener trigger"
            class="mt-3"
          />
          <v-text-field
            v-model="form.commandListenerCall"
            label="Command listener call"
            placeholder="command:v1/run_custom_command"
            density="compact"
            class="mt-2"
            hint="Scheme URL fired to open the viewer when the toggle above is on"
            persistent-hint
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

      <div class="flake-right">
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
        <div v-if="facet.revisionRange && heatmap.runs.length === 0" class="flake-cells-hint">
          <v-icon icon="mdi-alert-circle-outline" size="14" class="mr-1" />
          No runs match this revision range.
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
                >{{ formatTickLabel(r.started_at)
                  }}<span v-if="formatPipelineLabel(r)" class="flake-run-pid">{{ formatPipelineLabel(r) }}</span></th>
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
                  @contextmenu.prevent.stop="openCellMenu($event, heatmap.runs[i], heatmap.expiredRunIds.has(heatmap.runs[i].run_id))"
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

      <section class="flake-section flake-cards">
        <header class="flake-section-header">
          <h3 class="text-subtitle-1">
            Build health
            <span class="text-caption text-medium-emphasis">(most recent build per suite, all gfx)</span>
          </h3>
        </header>
        <div class="flake-cards-row">
          <div
            v-for="card in incidentCards" :key="card.suite"
            class="flake-incident-card"
            :class="`flake-incident--${card.status}`"
          >
            <div class="flake-incident-title">Days without {{ titleCase(card.suite) }} failures</div>
            <div class="flake-incident-number">{{ card.status === 'none' ? '—' : card.daysWithoutFailure }}</div>
            <div class="flake-incident-sub">{{ gfxLine(card) }}</div>
          </div>
        </div>
      </section>
      </div>
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

  <v-menu
    v-model="cellMenu.open"
    :target="[cellMenu.x, cellMenu.y]"
    location="bottom start"
  >
    <v-list density="compact">
      <v-list-item :disabled="!cellMenuCanDownload" @click="onMenuDownload">
        <template #prepend><v-icon icon="mdi-download" /></template>
        <v-list-item-title>Download artifact</v-list-item-title>
      </v-list-item>
      <v-list-item :disabled="!cellMenuCanPipeline" @click="onMenuPipeline">
        <template #prepend><v-icon icon="mdi-source-branch" /></template>
        <v-list-item-title>Go to pipeline</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>

  <v-dialog v-model="configDialog" max-width="560">
    <v-card>
      <v-card-title>Flake history settings</v-card-title>
      <v-card-text>
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
        <v-text-field
          v-model="form.gameInstallPath"
          label="Game install folder (optional)"
          placeholder="D:\BeamNG.drive"
          density="compact"
          class="mt-3"
          hint="Path to your BeamNG install — clicking an artifact also opens the viewer file below"
          persistent-hint
        />
        <v-text-field
          v-model="form.viewerRelPath"
          label="Viewer file (relative to install folder, optional)"
          placeholder="game/test-viewer.html"
          density="compact"
          class="mt-3"
          hint="Joined to the install folder on artifact click. Default: game/test-viewer.html"
          persistent-hint
        />
        <v-switch
          v-model="form.useCommandListener"
          density="compact" hide-details color="primary"
          label="Use command listener trigger"
          class="mt-3"
        />
        <v-text-field
          v-model="form.commandListenerCall"
          label="Command listener call"
          placeholder="command:v1/run_custom_command"
          density="compact"
          class="mt-2"
          hint="Scheme URL fired to open the viewer when the toggle above is on"
          persistent-hint
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="configDialog = false">Cancel</v-btn>
        <v-btn color="primary" @click="saveForm" :disabled="!form.projectId">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  fetchLatestBundle, selectFlakeLeaderboard, selectHeatmapMatrix, selectSuiteIncidentCards,
  parseRevisionRange,
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

// Ephemeral, per-session: gates whether a left-click also opens the viewer.
// Deliberately NOT persisted — resets to ON on every mount so users are nudged
// toward opening the viewer. The config (useCommandListener) decides HOW it opens.
const openViewerOnClick = ref(true)

// Right-click context menu state (cursor-anchored). run/expired identify the
// cell the menu was opened over; open toggles the v-menu.
const cellMenu = ref({ open: false, x: 0, y: 0, run: null, expired: false })

const form = ref({
  projectId: flakeSettings.value.projectId || '',
  packageName: flakeSettings.value.packageName || 'flake-history',
  refreshMinutes: flakeSettings.value.refreshMinutes ?? 60,
  gameInstallPath: flakeSettings.value.gameInstallPath || '',
  viewerRelPath: flakeSettings.value.viewerRelPath || '',
  useCommandListener: flakeSettings.value.useCommandListener ?? false,
  commandListenerCall: flakeSettings.value.commandListenerCall || 'command:v1/run_custom_command',
})

// Settings dialog (gear button in the app bar). Reseeds the shared form from
// the live settings each open so it reflects edits made via the inline form.
const configDialog = ref(false)
const openConfigDialog = () => {
  form.value = {
    projectId: flakeSettings.value.projectId || '',
    packageName: flakeSettings.value.packageName || 'flake-history',
    refreshMinutes: flakeSettings.value.refreshMinutes ?? 60,
    gameInstallPath: flakeSettings.value.gameInstallPath || '',
    viewerRelPath: flakeSettings.value.viewerRelPath || '',
    useCommandListener: flakeSettings.value.useCommandListener ?? false,
    commandListenerCall: flakeSettings.value.commandListenerCall || 'command:v1/run_custom_command',
  }
  configDialog.value = true
}

const filterOptions = computed(() => ({
  suites: [...new Set((bundle.value?.runs || []).map(r => r.suite).filter(Boolean))].sort(),
  gfxApis: [...new Set((bundle.value?.runs || []).map(r => r.gfx_api).filter(Boolean))].sort(),
}))

const facet = computed(() => ({
  suite: suiteFilter.value === '(all)' ? null : suiteFilter.value,
  gfxApi: gfxFilter.value === '(all)' ? null : gfxFilter.value,
  revisionRange: parseRevisionRange(searchQuery.value),
}))

const leaderboardLimit = computed(() => showAllTests.value ? Infinity : 100)

const matchesSearch = (t) => {
  const q = (searchQuery.value || '').trim().toLowerCase()
  if (!q) return true
  // A revision-range query is handled by the facet, not by name — otherwise it
  // would never match a test name and blank every row.
  if (parseRevisionRange(q)) return true
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

// Suite "days without incident" cards — a fixed status dashboard, intentionally
// independent of the suite/gfx/search facets that filter the heatmap above.
const incidentCards = computed(() => (bundle.value ? selectSuiteIncidentCards(bundle.value) : []))
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const gfxLine = (card) => card.gfx.map(g => `${g.gfx_api}: ${g.passed}/${g.total}`).join(', ')

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
// "#12347" when the run carries a pipeline id, "" otherwise (schema allows null).
// Shown as a dimmer second line under the date so columns of one pipeline line up.
const formatPipelineLabel = (r) => (r?.pipeline_id != null ? `#${r.pipeline_id}` : '')
const runTooltip = (r) => `${r.suite || '?'} • ${r.gfx_api || '?'} • ${r.runner_id || '?'} • ${r.started_at || ''} • status=${r.status}`
const cellTooltip = (t, r, cell) => {
  const expired = heatmap.value.expiredRunIds.has(r.run_id)
  const artifacts = expired ? 'artifacts expired' : (r.artifacts_url ? 'artifacts available' : 'artifacts unknown')
  // Context line: revision under test, suite flavour, gfx target — same
  // '?'-fallback convention as runTooltip. The revision label is a bare
  // r<rev> (this CI publishes SVN revisions).
  const context = `r${r.source_revision || '?'} · ${r.suite || '?'} · ${r.gfx_api || '?'}`
  return `${t.name}\nrun: ${r.run_id}\n${cell} • ${artifacts}${r.status === 'interrupted' ? ' (run was interrupted)' : ''}\n${context}`
}

const openPipeline = (r) => {
  if (r?.pipeline_url) window.open(r.pipeline_url, '_blank', 'noopener')
}

// Default viewer file, relative to the install root. Overridable per-user via
// config.flakeHistory.viewerRelPath.
// NOTE: keep the default in sync with the main-process handler in electron/main.cjs.
const VIEWER_REL = 'game/test-viewer.html'

// Build a file:// URL to the local test viewer from the game install ROOT and a
// relative viewer path (defaults to VIEWER_REL). Pure + unit-tested: tolerates
// backslashes and a trailing separator on the root, normalizes the relative
// path (backslashes + leading separators), preserves a Windows drive letter
// (D:), and URI-encodes the remaining segments. Returns '' when no root is set.
const buildViewerFileUrl = (root, rel = VIEWER_REL) => {
  const r = String(root || '').trim()
  if (!r) return ''
  const norm = r.replace(/\\/g, '/').replace(/\/+$/, '')
  const relNorm = String(rel || VIEWER_REL).replace(/\\/g, '/').replace(/^\/+/, '')
  const encoded = `${norm}/${relNorm}`
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
  const rel = (flakeSettings.value.viewerRelPath || '').trim() || VIEWER_REL
  try {
    if (window.electronAPI?.openPath) { window.electronAPI.openPath(root, rel).catch(() => {}); return }
    const url = buildViewerFileUrl(root, rel)
    if (url) window.open(url, '_blank', 'noopener')
  } catch { /* opening the viewer is best-effort; never break the download */ }
}

const downloadArtifact = (r) => {
  if (r?.artifacts_url) window.open(r.artifacts_url, '_blank', 'noopener')
}

// Fire the configured custom scheme command (verbatim, no per-build arg).
// Electron routes via shell.openExternal; the browser falls back to an anchor
// click (the conventional way to hand a custom-scheme URL to the OS handler).
// Best-effort: never throws, so it can't break the download it accompanies.
const triggerCommandListener = () => {
  const cmd = (flakeSettings.value.commandListenerCall || '').trim()
  if (!cmd) return
  try {
    if (window.electronAPI?.openExternal) { window.electronAPI.openExternal(cmd).catch(() => {}); return }
    const a = document.createElement('a')
    a.href = cmd
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch { /* opening the viewer is best-effort */ }
}

// Open the results viewer using whichever mechanism the user configured:
// the custom scheme command, or the local file via openPath/file://.
const openViewer = () => {
  if (flakeSettings.value.useCommandListener) triggerCommandListener()
  else openTestViewer()
}

// Click priority: download the run's artifacts when the producer supplied a
// direct URL AND we estimate they still exist. On that branch we also open the
// viewer — but only when the per-session openViewerOnClick toggle is on.
// Once a run's artifacts have expired (or no URL exists) we fall back to the
// pipeline; no viewer there since nothing was downloaded.
const openArtifactOrPipeline = (r, expired = false) => {
  if (r?.artifacts_url && !expired) {
    downloadArtifact(r)
    if (openViewerOnClick.value) openViewer()
    return
  }
  openPipeline(r)
}

const openCellMenu = (e, r, expired = false) => {
  cellMenu.value = { open: true, x: e?.clientX ?? 0, y: e?.clientY ?? 0, run: r, expired }
}
const cellMenuCanDownload = computed(() => !!cellMenu.value.run?.artifacts_url && !cellMenu.value.expired)
const cellMenuCanPipeline = computed(() => !!cellMenu.value.run?.pipeline_url)
const onMenuDownload = () => { downloadArtifact(cellMenu.value.run); cellMenu.value.open = false }
const onMenuPipeline = () => { openPipeline(cellMenu.value.run); cellMenu.value.open = false }

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
    gameInstallPath: (form.value.gameInstallPath || '').trim(),
    viewerRelPath: (form.value.viewerRelPath || '').trim(),
    useCommandListener: !!form.value.useCommandListener,
    commandListenerCall: (form.value.commandListenerCall || '').trim() || 'command:v1/run_custom_command',
  }
  configDialog.value = false
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

/* Right column: heatmap on top (2/3), build-health cards below (1/3). */
.flake-right {
  display: grid;
  grid-template-rows: 2fr 1fr;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}
.flake-right > .flake-section { min-height: 0; }

.flake-cards { overflow: hidden; }
.flake-cards-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
  overflow: auto;
}
.flake-incident-card {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 8px;
  text-align: center;
}
.flake-incident-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.flake-incident-number { font-size: 40px; font-weight: 700; line-height: 1; }
.flake-incident-sub {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  word-break: break-word;
}
.flake-incident--pass { border-color: rgba(76, 175, 80, 0.5);  background: rgba(76, 175, 80, 0.08); }
.flake-incident--warn { border-color: rgba(255, 152, 0, 0.5);  background: rgba(255, 152, 0, 0.08); }
.flake-incident--fail { border-color: rgba(244, 67, 54, 0.5);  background: rgba(244, 67, 54, 0.10); }
.flake-incident--none { border-color: rgba(127, 127, 127, 0.3); }
.flake-incident--pass .flake-incident-number { color: #4caf50; }
.flake-incident--warn .flake-incident-number { color: #ff9800; }
.flake-incident--fail .flake-incident-number { color: #f44336; }
.flake-incident--none .flake-incident-number { color: rgba(127, 127, 127, 0.6); }

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
.flake-run-pid {
  display: block;
  font-size: 0.85em;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
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
