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

/**
 * Parse a revision-range expression typed into the search box.
 *   "r123...r456" -> { min: 123, max: 456 }   (inclusive both ends)
 *   "r123..."     -> { min: 123, max: null }
 *   "...r456"     -> { min: null, max: 456 }
 *   "r123"        -> { min: 123, max: 123 }    (exact single revision)
 * Returns null when the string is not a revision expression (so the caller
 * treats it as an ordinary test-name search). The '...' marker is required for
 * a range; the leading 'r' is optional on range endpoints but mandatory on a
 * bare single revision, so numeric name searches like "800" are not hijacked.
 * Case-insensitive; whitespace around '...' tolerated. A Unicode ellipsis (…,
 * U+2026) is accepted as an alternative to '...' for OS autocorrect compatibility.
 */
export const parseRevisionRange = (query) => {
  const s = String(query || '').trim()
  const m = s.match(/^r?(\d+)?\s*(?:\.\.\.|…)\s*r?(\d+)?$/i)
  if (m && (m[1] || m[2])) {
    return { min: m[1] ? Number(m[1]) : null, max: m[2] ? Number(m[2]) : null }
  }
  const one = s.match(/^r(\d+)$/i)
  if (one) return { min: Number(one[1]), max: Number(one[1]) }
  return null
}

// True when run.source_revision (numeric) falls in [min, max], either end
// nullable/open. A null or non-numeric revision can't be placed on the numeric
// axis, so it is excluded whenever a range is active.
const inRevisionRange = (run, range) => {
  if (!range) return true
  const raw = run.source_revision
  // Exclude null / empty / non-numeric revisions: they can't be placed on the
  // numeric axis. (Number(null) is 0, which is finite — guard it explicitly.)
  if (raw == null || raw === '') return false
  const rev = Number(raw)
  if (!Number.isFinite(rev)) return false
  if (range.min != null && rev < range.min) return false
  if (range.max != null && rev > range.max) return false
  return true
}

const matchesFacet = (run, { suite, gfxApi, quality, revisionRange } = {}) => (
  (!suite || run.suite === suite) &&
  (!gfxApi || run.gfx_api === gfxApi) &&
  (!quality || run.quality === quality) &&
  inRevisionRange(run, revisionRange)
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
  revisionRange = null,
  limit = 20,
  excludeStable = true,
} = {}) => {
  if (!bundle || !Array.isArray(bundle.tests)) return []

  const runsById = new Map((bundle.runs || []).map(r => [r.run_id, r]))
  const facet = { suite, gfxApi, quality, revisionRange }

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

// Fixed gfx column order within a pipeline so trios read dx11 → dx12 → vulkan.
const GFX_ORDER = { dx11: 0, dx12: 1, vulkan: 2 }
const gfxRank = (g) => (g in GFX_ORDER ? GFX_ORDER[g] : 99)

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
  revisionRange = null,
  lastNPipelines = 30,
  now = Date.now(),
  artifactRetentionHours = ARTIFACT_RETENTION_HOURS,
  defaultRetentionHours = DEFAULT_ARTIFACT_RETENTION_HOURS,
} = {}) => {
  if (!bundle) return { runs: [], tests: [], cells: {}, interruptedRunIds: new Set(), expiredRunIds: new Set() }
  const facet = { suite, gfxApi, quality, revisionRange }

  // Group runs by pipeline (null pipeline_id => its own singleton group, keyed
  // by run_id so local/CI-less runs never merge). Order groups by pipeline
  // number ascending (nulls last, by time), keep the most-recent N pipelines,
  // then flatten with a fixed gfx order so each pipeline's trio is contiguous.
  const matched = (bundle.runs || []).filter(r => matchesFacet(r, facet))
  const pipelineGroups = new Map() // gkey -> { pid, repAt, runs: [] }
  for (const r of matched) {
    const gkey = r.pipeline_id != null ? `p${r.pipeline_id}` : `r${r.run_id}`
    let g = pipelineGroups.get(gkey)
    if (!g) { g = { pid: r.pipeline_id != null ? r.pipeline_id : null, repAt: r.started_at || '', runs: [] }; pipelineGroups.set(gkey, g) }
    g.runs.push(r)
    if (!g.repAt || (r.started_at && r.started_at < g.repAt)) g.repAt = r.started_at || g.repAt
  }
  const orderedGroups = [...pipelineGroups.values()].sort((a, b) => {
    const ap = a.pid == null ? Infinity : a.pid
    const bp = b.pid == null ? Infinity : b.pid
    if (ap !== bp) return ap - bp
    return (a.repAt || '').localeCompare(b.repAt || '')
  }).slice(-lastNPipelines)
  const filteredRuns = orderedGroups.flatMap(g => g.runs.slice().sort((a, b) => {
    const rk = gfxRank(a.gfx_api) - gfxRank(b.gfx_api)
    return rk !== 0 ? rk : (a.started_at || '').localeCompare(b.started_at || '')
  }))

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

// Preferred left-to-right card order; suites outside this list sort after it,
// alphabetically. Keeps the common smoketest → continuous → nightly cadence
// stable while still rendering whatever suites the bundle actually contains.
const SUITE_CARD_ORDER = ['smoketest', 'continuous', 'nightly']

/**
 * "Days without incident" summary cards, one per suite present in the bundle.
 *
 * A build (run) is *broken* when any test failed in it (its run_id appears in a
 * test's failing_run_ids) — run.status only distinguishes complete/interrupted,
 * not pass/fail. Per card:
 *   - gfx[]: for each gfx_api, the passed/total test counts of that suite+gfx's
 *     MOST RECENT run (latest started_at). total = tests observed in that run.
 *   - status: 'pass' (no gfx failing), 'fail' (all gfx with data failing),
 *     'warn' (some but not all failing), 'none' (no test data at all).
 *   - daysWithoutFailure: whole days from the suite's last broken build to
 *     `bundle.generated_at` (stable per published bundle, not wall-clock); 0 if
 *     the latest build is itself broken; full observed streak when the window
 *     has no failures.
 *
 * Independent of the heatmap's facet/search filters by design — a fixed status
 * dashboard. `now` is only a fallback when generated_at is unparseable.
 */
export const selectSuiteIncidentCards = (bundle, { now = Date.now() } = {}) => {
  if (!bundle || !Array.isArray(bundle.runs) || !Array.isArray(bundle.tests)) return []

  // run_id -> { passed, failed } across all tests/contexts.
  const perRun = new Map()
  const bump = (rid, key) => {
    let e = perRun.get(rid)
    if (!e) { e = { passed: 0, failed: 0 }; perRun.set(rid, e) }
    e[key] += 1
  }
  for (const t of bundle.tests) {
    for (const ctx of t.results_by_context || []) {
      for (const rid of ctx.passing_run_ids || []) bump(rid, 'passed')
      for (const rid of ctx.failing_run_ids || []) bump(rid, 'failed')
    }
  }

  const DAY_MS = 86_400_000
  const parsedGenerated = Date.parse(bundle.generated_at)
  const refMs = Number.isFinite(parsedGenerated) ? parsedGenerated : now

  // suite -> runs[]
  const bySuite = new Map()
  for (const r of bundle.runs) {
    if (!r || !r.suite) continue
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, [])
    bySuite.get(r.suite).push(r)
  }

  const cards = []
  for (const [suite, runs] of bySuite) {
    const sorted = runs.slice().sort((a, b) => (a.started_at || '').localeCompare(b.started_at || ''))

    // Latest run per gfx_api (sorted ascending, so the last write wins).
    const latestByGfx = new Map()
    for (const r of sorted) latestByGfx.set(r.gfx_api, r)

    const gfx = []
    let gfxWithData = 0
    let gfxFailing = 0
    for (const [gfx_api, run] of latestByGfx) {
      const c = perRun.get(run.run_id) || { passed: 0, failed: 0 }
      const total = c.passed + c.failed
      gfx.push({ gfx_api, passed: c.passed, total })
      if (total > 0) {
        gfxWithData += 1
        if (c.passed < total) gfxFailing += 1
      }
    }
    gfx.sort((a, b) => String(a.gfx_api).localeCompare(String(b.gfx_api)))

    let status
    if (gfxWithData === 0) status = 'none'
    else if (gfxFailing === 0) status = 'pass'
    else if (gfxFailing === gfxWithData) status = 'fail'
    else status = 'warn'

    // Most recent broken build's timestamp.
    let lastFailMs = null
    for (const r of sorted) {
      const c = perRun.get(r.run_id)
      if (c && c.failed > 0) {
        const ms = Date.parse(r.started_at)
        if (Number.isFinite(ms) && (lastFailMs === null || ms > lastFailMs)) lastFailMs = ms
      }
    }

    let daysWithoutFailure
    if (lastFailMs !== null) {
      daysWithoutFailure = Math.max(0, Math.floor((refMs - lastFailMs) / DAY_MS))
    } else {
      const firstMs = sorted.length ? Date.parse(sorted[0].started_at) : NaN
      daysWithoutFailure = Number.isFinite(firstMs) ? Math.max(0, Math.floor((refMs - firstMs) / DAY_MS)) : 0
    }

    cards.push({ suite, daysWithoutFailure, status, gfx })
  }

  cards.sort((a, b) => {
    const ia = SUITE_CARD_ORDER.indexOf(a.suite)
    const ib = SUITE_CARD_ORDER.indexOf(b.suite)
    const ra = ia === -1 ? SUITE_CARD_ORDER.length : ia
    const rb = ib === -1 ? SUITE_CARD_ORDER.length : ib
    if (ra !== rb) return ra - rb
    return a.suite.localeCompare(b.suite)
  })

  return cards
}
