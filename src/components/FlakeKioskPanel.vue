<template>
  <div class="flake-kiosk">
    <div v-if="errorKind" class="flake-kiosk-error">
      <h2>Flake history</h2>
      <p v-if="errorKind === 'not_configured'">Configure flake history in the main panel first.</p>
      <p v-else-if="errorKind === 'not_found'">No bundle published yet under <code>{{ packageName }}</code>.</p>
      <p v-else-if="errorKind === 'unsupported_schema'">Bundle schema is newer than this viewer. Upgrade.</p>
      <p v-else>Failed to load: {{ errorMessage }}</p>
    </div>

    <template v-else>
      <section class="flake-kiosk-broken">
        <h2 class="flake-kiosk-h">Currently broken</h2>
        <div v-if="brokenList.length === 0" class="flake-kiosk-allgood">
          <div class="flake-kiosk-check">✓</div>
          <div>Nothing failing</div>
        </div>
        <ul v-else>
          <li v-for="t in brokenList" :key="t.test_id">
            <span class="flake-kiosk-broken-name">{{ t.name }}</span>
            <span class="flake-kiosk-broken-meta">{{ t.module }} · {{ formatAgo(t.last_failure_at) }}</span>
          </li>
        </ul>
      </section>

      <section class="flake-kiosk-flaky">
        <h2 class="flake-kiosk-h">Top flaky</h2>
        <ul v-if="flakyList.length">
          <li v-for="t in flakyList" :key="t.test_id">
            <div class="flake-kiosk-flaky-row">
              <span class="flake-kiosk-flaky-name">{{ t.name }}</span>
              <span class="flake-kiosk-flaky-rate">{{ (t.pass_rate * 100).toFixed(0) }}%</span>
            </div>
            <div class="flake-kiosk-sparkline" :title="`Last ${t.sparkline.length} runs`">
              <span
                v-for="(s, i) in t.sparkline" :key="i"
                :class="['flake-kiosk-dot', `flake-kiosk-dot--${s}`]"
              >{{ s === 'pass' ? '●' : s === 'fail' ? '○' : '·' }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="flake-kiosk-allgood-sm">No flaky tests in the current window.</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  fetchLatestBundle, selectFlakeLeaderboard,
  FlakeNotConfiguredError, FlakeBundleNotFoundError, UnsupportedSchemaVersionError,
} from '../services/flake'
import { decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

const props = defineProps({
  settings: { type: Object, required: true },
})

const flakeSettings = computed(() => props.settings.config.flakeHistory || {})
const packageName = computed(() => flakeSettings.value.packageName || 'flake-history')

const bundle = ref(null)
const errorKind = ref(null)
const errorMessage = ref('')

const brokenList = computed(() => {
  if (!bundle.value) return []
  // "Currently broken" = tests whose most-recent observation is a fail.
  // Reuse leaderboard for the join-against-runs logic, then filter.
  const rows = selectFlakeLeaderboard(bundle.value, { limit: 500 })
  return rows
    .filter(r => r.last_status === 'fail')
    .sort((a, b) => (b.last_failure_at || '').localeCompare(a.last_failure_at || ''))
    .slice(0, 8)
})

const flakyList = computed(() => {
  if (!bundle.value) return []
  // Top 10 by intermittent/actively_flaky classification, with a sparkline
  // for the last 5 runs across any context.
  const runsByStart = (bundle.value.runs || [])
    .slice()
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
  const recentRunIds = runsByStart.slice(0, 5).map(r => r.run_id)
  const sparklineFor = (t) => {
    const passing = new Set()
    const failing = new Set()
    for (const ctx of t.results_by_context || []) {
      for (const rid of ctx.passing_run_ids || []) passing.add(rid)
      for (const rid of ctx.failing_run_ids || []) failing.add(rid)
    }
    return recentRunIds.map(rid => (
      failing.has(rid) ? 'fail' : passing.has(rid) ? 'pass' : 'none'
    ))
  }
  return (bundle.value.tests || [])
    .filter(t => ['actively_flaky', 'intermittent'].includes(t.overall?.flake_classification))
    .sort((a, b) => (a.overall.pass_rate ?? 1) - (b.overall.pass_rate ?? 1))
    .slice(0, 10)
    .map(t => ({
      test_id: t.test_id,
      name: t.name,
      module: t.module,
      pass_rate: t.overall.pass_rate ?? 0,
      sparkline: sparklineFor(t),
    }))
})

const formatAgo = (iso) => {
  if (!iso) return ''
  const dt = Date.parse(iso)
  if (!Number.isFinite(dt)) return ''
  const mins = Math.max(0, Math.round((Date.now() - dt) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

const isConfigured = () => Boolean(
  props.settings.config.gitlabApiBaseUrl && flakeSettings.value.projectId
)

const reload = async () => {
  if (!isConfigured()) { errorKind.value = 'not_configured'; return }
  errorKind.value = null
  errorMessage.value = ''
  try {
    const token = decodeGitLabTokenFromStorage(props.settings.config.token)
    bundle.value = await fetchLatestBundle({
      gitlabUrl: props.settings.config.gitlabApiBaseUrl,
      projectIdOrPath: flakeSettings.value.projectId,
      packageName: packageName.value,
      token,
    })
  } catch (e) {
    if (e instanceof FlakeNotConfiguredError)        errorKind.value = 'not_configured'
    else if (e instanceof FlakeBundleNotFoundError)  errorKind.value = 'not_found'
    else if (e instanceof UnsupportedSchemaVersionError) errorKind.value = 'unsupported_schema'
    else { errorKind.value = 'error'; errorMessage.value = e?.message || String(e) }
  }
}

let timer = null
const scheduleRefresh = () => {
  if (timer) { clearInterval(timer); timer = null }
  const mins = Number(flakeSettings.value.refreshMinutes) || 0
  if (mins > 0) timer = setInterval(reload, mins * 60_000)
}
watch(() => flakeSettings.value.refreshMinutes, scheduleRefresh)

onMounted(() => { reload(); scheduleRefresh() })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

defineExpose({ reload })
</script>

<style scoped>
.flake-kiosk { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 24px; height: 100%; }
.flake-kiosk-h { font-size: 2.4rem; margin: 0 0 12px; font-weight: 600; }
.flake-kiosk-broken ul, .flake-kiosk-flaky ul { list-style: none; padding: 0; margin: 0; }
.flake-kiosk-broken li {
  font-size: 1.6rem; color: #f44336;
  padding: 10px 0;
  border-bottom: 1px solid rgba(244, 67, 54, 0.15);
}
.flake-kiosk-broken-name { font-weight: 600; }
.flake-kiosk-broken-meta { display: block; font-size: 0.95rem; opacity: 0.7; }
.flake-kiosk-allgood {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 70%; color: #4caf50;
}
.flake-kiosk-check { font-size: 6rem; line-height: 1; }
.flake-kiosk-allgood-sm { opacity: 0.6; font-size: 1.2rem; }
.flake-kiosk-flaky li { padding: 10px 0; border-bottom: 1px solid rgba(127,127,127,0.15); }
.flake-kiosk-flaky-row { display: flex; justify-content: space-between; font-size: 1.4rem; }
.flake-kiosk-flaky-name { font-weight: 500; }
.flake-kiosk-flaky-rate { font-variant-numeric: tabular-nums; opacity: 0.7; }
.flake-kiosk-sparkline { font-size: 1.4rem; letter-spacing: 2px; margin-top: 4px; }
.flake-kiosk-dot--pass { color: #4caf50; }
.flake-kiosk-dot--fail { color: #f44336; }
.flake-kiosk-dot--none { color: #555; opacity: 0.4; }
.flake-kiosk-error { padding: 48px; text-align: center; opacity: 0.7; }
</style>
