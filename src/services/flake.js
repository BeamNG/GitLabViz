import axios from 'axios'
import localforage from 'localforage'
import { normalizeGitLabApiBaseUrl } from './gitlab'

// Highest schema_version this build can read. Bundles with a higher major
// version are rejected with a "please upgrade" error so a v2 producer never
// silently displays as v1.
export const SUPPORTED_SCHEMA_VERSION = 1
export const DEFAULT_PACKAGE_NAME = 'flake-history'

// How long CI keeps each suite's job artifacts before they expire. The bundle
// does not carry a per-run expiry, so the heatmap derives "are the artifacts
// still downloadable?" from run age: a run older than its suite's window has
// dead artifacts and is rendered in a darker shade. Keep these in sync with the
// per-suite artifact:expire_in values in testing-ci/.gitlab-ci.yml — this is
// the single place the viewer assumes them.
export const ARTIFACT_RETENTION_HOURS = {
  smoketest: 48,
  continuous: 96,
  nightly: 336, // 2 weeks
}
// Fallback for runs whose suite has no entry above (mirrors .test_suite_base's
// 24h default). Undated runs are treated as expired regardless.
export const DEFAULT_ARTIFACT_RETENTION_HOURS = 24
const BUNDLE_FILENAME = 'bundle.json'
const CACHE_KEY = 'flake_bundle'
const DEFAULT_TIMEOUT_MS = 30_000

export class FlakeNotConfiguredError extends Error {
  constructor (message = 'Flake history source is not configured') {
    super(message)
    this.name = 'FlakeNotConfiguredError'
  }
}

export class UnsupportedSchemaVersionError extends Error {
  constructor (got, supported = SUPPORTED_SCHEMA_VERSION) {
    super(`flake-history bundle schema_version=${got} is not supported; this build reads up to ${supported}. Upgrade GitLabViz.`)
    this.name = 'UnsupportedSchemaVersionError'
    this.got = got
    this.supported = supported
  }
}

export class FlakeBundleNotFoundError extends Error {
  constructor (packageName) {
    super(`No bundle published under package "${packageName}" yet. Has your bundler pipeline run?`)
    this.name = 'FlakeBundleNotFoundError'
    this.packageName = packageName
  }
}

const projectPathSegment = (idOrPath) => {
  const v = String(idOrPath || '').trim()
  if (!v) return ''
  if (/^\d+$/.test(v)) return v
  return encodeURIComponent(v)
}

export const createFlakeClient = (gitlabUrl, token) => axios.create({
  baseURL: normalizeGitLabApiBaseUrl(gitlabUrl),
  timeout: DEFAULT_TIMEOUT_MS,
  headers: token ? { 'PRIVATE-TOKEN': token } : {},
})

/**
 * Fetch the newest published bundle, validate its schema_version, and cache.
 * @throws FlakeNotConfiguredError when required arguments are missing.
 * @throws FlakeBundleNotFoundError when no package version exists yet.
 * @throws UnsupportedSchemaVersionError when bundle.schema_version > SUPPORTED_SCHEMA_VERSION.
 */
export const fetchLatestBundle = async ({
  gitlabUrl,
  projectIdOrPath,
  packageName = DEFAULT_PACKAGE_NAME,
  token,
  client,
} = {}) => {
  if (!gitlabUrl || !projectIdOrPath) {
    throw new FlakeNotConfiguredError()
  }

  const c = client || createFlakeClient(gitlabUrl, token)
  const project = projectPathSegment(projectIdOrPath)

  // 1. Resolve newest package version by created_at desc.
  const list = await c.get(`/projects/${project}/packages`, {
    params: { package_name: packageName, order_by: 'created_at', sort: 'desc', per_page: 1 },
  })
  const newest = Array.isArray(list?.data) ? list.data[0] : null
  if (!newest) {
    throw new FlakeBundleNotFoundError(packageName)
  }
  const version = encodeURIComponent(String(newest.version))
  const pkg = encodeURIComponent(packageName)

  // 2. Download bundle.json for that version.
  const bundleResp = await c.get(
    `/projects/${project}/packages/generic/${pkg}/${version}/${BUNDLE_FILENAME}`,
    { responseType: 'json' },
  )
  const bundle = bundleResp?.data
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('flake-history bundle download returned empty / non-JSON body')
  }

  // 3. Schema gate. Reject anything we can't read.
  const sv = Number(bundle.schema_version)
  if (!Number.isFinite(sv) || sv > SUPPORTED_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(bundle.schema_version)
  }

  // 4. Cache for offline / kiosk continuity. Best-effort.
  try {
    await localforage.setItem(CACHE_KEY, { bundle, fetched_at: Date.now() })
  } catch (_) { /* localforage unavailable in tests; ignore */ }

  return bundle
}

export const getCachedBundle = async () => {
  try {
    const v = await localforage.getItem(CACHE_KEY)
    if (v && v.bundle) return v
  } catch (_) {}
  return null
}

// ---- pure selectors (no I/O; trivially unit-testable) ---------------------

const matchesFacet = (run, { suite, gfxApi, quality } = {}) => (
  (!suite || run.suite === suite) &&
  (!gfxApi || run.gfx_api === gfxApi) &&
  (!quality || run.quality === quality)
)

/**
 * Mirror of bundle_flake_history.py:_flake_classification. Keep the thresholds
 * in sync with the bundler so the per-scope label the viewer computes here
 * agrees with the overall label the bundler computes server-side.
 */
export const classifyFromCounts = (pass, fail) => {
  const p = Number(pass) || 0
  const f = Number(fail) || 0
  if (p <= 0 && f <= 0) return null
  if (p <= 0) return 'broken'
  if (f === 0) return 'stable'
  const rate = p / (p + f)
  if (rate >= 0.95) return 'stable'
  if (rate >= 0.5) return 'intermittent'
  return 'actively_flaky'
}

/**
 * Top-N tests sorted by ascending pass_rate (most-flaky first), restricted to
 * runs matching the facet filter. Tests with no runs in the filtered set are
 * dropped. Stable-pass tests sink to the bottom; ties broken by recency of
 * the last failure across the test's contexts.
 */
export const selectFlakeLeaderboard = (bundle, {
  suite = null,
  gfxApi = null,
  quality = null,
  limit = 20,
  excludeStable = true,
} = {}) => {
  if (!bundle || !Array.isArray(bundle.tests)) return []

  const runsById = new Map((bundle.runs || []).map(r => [r.run_id, r]))
  const facet = { suite, gfxApi, quality }

  const rows = []
  for (const t of bundle.tests) {
    let pass = 0
    let fail = 0
    let lastFailureAt = ''
    let lastRunAt = ''
    let lastStatus = null
    for (const ctx of t.results_by_context || []) {
      for (const rid of ctx.passing_run_ids || []) {
        const run = runsById.get(rid)
        if (!run || !matchesFacet(run, facet)) continue
        pass += 1
        if ((run.started_at || '') > lastRunAt) {
          lastRunAt = run.started_at || ''
          lastStatus = 'pass'
        }
      }
      for (const rid of ctx.failing_run_ids || []) {
        const run = runsById.get(rid)
        if (!run || !matchesFacet(run, facet)) continue
        fail += 1
        const at = run.started_at || ''
        if (at > lastFailureAt) lastFailureAt = at
        if (at > lastRunAt) {
          lastRunAt = at
          lastStatus = 'fail'
        }
      }
    }
    const total = pass + fail
    if (total === 0) continue
    // Per-scope classification: when the user filters to e.g. suite=smoketest,
    // the row's label should reflect that scope's pass rate, not the bundler's
    // across-all-suites overall label.
    const scopedClassification = classifyFromCounts(pass, fail)
    if (excludeStable && scopedClassification === 'stable') continue
    rows.push({
      test_id: t.test_id,
      name: t.name,
      module: t.module,
      suite: t.suite,
      pass_count: pass,
      fail_count: fail,
      pass_rate: total ? Number((pass / total).toFixed(4)) : null,
      last_status: lastStatus,
      last_failure_at: lastFailureAt || null,
      flake_classification: scopedClassification,
    })
  }

  rows.sort((a, b) => {
    if (a.pass_rate !== b.pass_rate) return a.pass_rate - b.pass_rate
    // Recent failures beat older ones in the tie-break.
    return (b.last_failure_at || '').localeCompare(a.last_failure_at || '')
  })

  return rows.slice(0, limit)
}

/**
 * Suite-independent grouping key for a test. The same test (e.g.
 * test_level[west_coast_usa]) is run by several flavours — smoketest,
 * continuous, nightly — and the producer encodes the flavour into the
 * test_id (<suite>::<module>::<name>), so it arrives as several distinct
 * tests[] entries. They are the *same* test; the heatmap collapses them onto
 * one row keyed by (module, name) so the flavours line up column-for-column
 * instead of stacking three near-identical rows.
 */
const heatmapGroupKey = (t) => `${t.module || ''}::${t.name || ''}`

/**
 * True when a run's CI artifacts have almost certainly expired, based on run
 * age vs its suite's retention window (retentionHours[suite], falling back to
 * defaultHours). A run with no parseable timestamp is treated as expired (we
 * can't prove the artifacts are alive). Used to dim heatmap cells whose
 * pipeline artifacts can no longer be downloaded.
 */
const runArtifactsExpired = (run, now, retentionHours, defaultHours) => {
  const base = run.finished_at || run.started_at
  const t = base ? Date.parse(base) : NaN
  if (!Number.isFinite(t)) return true
  const hours = retentionHours[run.suite] ?? defaultHours
  return (now - t) > hours * 3_600_000
}

/**
 * Heatmap projection: tests × runs (most recent rightmost), cells = 'pass' |
 * 'fail' | 'not_run'. Runs filtered to the facet; tests with no observation
 * in the filtered run window are dropped.
 *
 * Same-test rows are grouped across suites (see heatmapGroupKey). Each row's
 * test_id is the group key and carries member_ids — the original per-suite
 * test_ids — so leaderboard↔heatmap selection still cross-links.
 *
 * `now` is injectable so artifact-expiry derivation is deterministic in tests.
 */
export const selectHeatmapMatrix = (bundle, {
  suite = null,
  gfxApi = null,
  quality = null,
  lastNRuns = 30,
  now = Date.now(),
  artifactRetentionHours = ARTIFACT_RETENTION_HOURS,
  defaultRetentionHours = DEFAULT_ARTIFACT_RETENTION_HOURS,
} = {}) => {
  if (!bundle) return { runs: [], tests: [], cells: {}, interruptedRunIds: new Set(), expiredRunIds: new Set() }
  const facet = { suite, gfxApi, quality }
  const filteredRuns = (bundle.runs || [])
    .filter(r => matchesFacet(r, facet))
    .sort((a, b) => (a.started_at || '').localeCompare(b.started_at || ''))
    .slice(-lastNRuns)

  const runIds = new Set(filteredRuns.map(r => r.run_id))
  const interruptedRunIds = new Set(filteredRuns
    .filter(r => r.status === 'interrupted').map(r => r.run_id))
  const expiredRunIds = new Set(filteredRuns
    .filter(r => runArtifactsExpired(r, now, artifactRetentionHours, defaultRetentionHours))
    .map(r => r.run_id))
  const runIdToIdx = new Map(filteredRuns.map((r, i) => [r.run_id, i]))

  // group_key -> { meta, row, members, touched }
  const groups = new Map()
  for (const t of bundle.tests || []) {
    const key = heatmapGroupKey(t)
    let g = groups.get(key)
    if (!g) {
      g = {
        test_id: key,
        name: t.name,
        module: t.module,
        member_ids: [],
        row: new Array(filteredRuns.length).fill('not_run'),
        touched: false,
      }
      groups.set(key, g)
    }
    if (t.test_id && !g.member_ids.includes(t.test_id)) g.member_ids.push(t.test_id)
    for (const ctx of t.results_by_context || []) {
      for (const rid of ctx.passing_run_ids || []) {
        if (!runIds.has(rid)) continue
        g.row[runIdToIdx.get(rid)] = 'pass'
        g.touched = true
      }
      // Failing after passing: a fail in any member wins for that column.
      for (const rid of ctx.failing_run_ids || []) {
        if (!runIds.has(rid)) continue
        g.row[runIdToIdx.get(rid)] = 'fail'
        g.touched = true
      }
    }
  }

  const tests = []
  const cells = {} // group_key -> Array<'pass'|'fail'|'not_run'>
  for (const g of groups.values()) {
    if (!g.touched) continue
    tests.push({ test_id: g.test_id, name: g.name, module: g.module, member_ids: g.member_ids })
    cells[g.test_id] = g.row
  }

  return { runs: filteredRuns, tests, cells, interruptedRunIds, expiredRunIds }
}
