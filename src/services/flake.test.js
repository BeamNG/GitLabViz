import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchLatestBundle,
  selectFlakeLeaderboard,
  selectHeatmapMatrix,
  selectSuiteIncidentCards,
  classifyFromCounts,
  FlakeNotConfiguredError,
  FlakeBundleNotFoundError,
  UnsupportedSchemaVersionError,
  SUPPORTED_SCHEMA_VERSION,
  DEFAULT_PACKAGE_NAME,
  parseRevisionRange,
} from './flake'

import sampleBundle from '../../fixtures/flake-history-bundle-sample.json'

// localforage is touched only as a best-effort cache; stub it out so tests
// don't depend on IndexedDB shims being present in jsdom.
vi.mock('localforage', () => ({
  default: {
    setItem: vi.fn(() => Promise.resolve()),
    getItem: vi.fn(() => Promise.resolve(null)),
  },
}))

const mkClient = (handlers) => {
  const get = vi.fn(async (url, config) => {
    for (const h of handlers) {
      if (h.match(url, config)) return h.respond(url, config)
    }
    throw new Error(`unexpected GET ${url}`)
  })
  return { get }
}

describe('fetchLatestBundle', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws FlakeNotConfiguredError when required args are missing', async () => {
    await expect(fetchLatestBundle({})).rejects.toBeInstanceOf(FlakeNotConfiguredError)
    await expect(fetchLatestBundle({ gitlabUrl: 'x' })).rejects.toBeInstanceOf(FlakeNotConfiguredError)
    await expect(fetchLatestBundle({ projectIdOrPath: '123' })).rejects.toBeInstanceOf(FlakeNotConfiguredError)
  })

  it('throws FlakeBundleNotFoundError when no package versions exist', async () => {
    const client = mkClient([
      { match: u => u.includes('/packages'), respond: () => ({ data: [] }) },
    ])
    await expect(fetchLatestBundle({
      gitlabUrl: 'https://gl.example.com', projectIdOrPath: '12', client,
    })).rejects.toBeInstanceOf(FlakeBundleNotFoundError)
  })

  it('hits the right URLs and returns the bundle on the happy path', async () => {
    const client = mkClient([
      {
        match: u => u.endsWith('/packages'),
        respond: () => ({ data: [{ version: '1700000000', id: 99 }] }),
      },
      {
        match: u => u.endsWith('/bundle.json'),
        respond: (url) => {
          expect(url).toContain(`/packages/generic/${DEFAULT_PACKAGE_NAME}/`)
          expect(url).toContain('1700000000/bundle.json')
          return { data: sampleBundle }
        },
      },
    ])
    const got = await fetchLatestBundle({
      gitlabUrl: 'https://gl.example.com',
      projectIdOrPath: 'mygroup/myproj',
      client,
    })
    expect(got.schema_version).toBe(1)
    expect(got.runs.length).toBe(4)
    expect(got.tests.length).toBe(6)
    // path-form project id gets encoded; numeric stays bare
    expect(client.get.mock.calls[0][0]).toContain('/projects/mygroup%2Fmyproj/packages')
  })

  it('rejects unsupported schema_version', async () => {
    const newer = { ...sampleBundle, schema_version: SUPPORTED_SCHEMA_VERSION + 1 }
    const client = mkClient([
      { match: u => u.endsWith('/packages'), respond: () => ({ data: [{ version: 'v' }] }) },
      { match: u => u.endsWith('/bundle.json'), respond: () => ({ data: newer }) },
    ])
    await expect(fetchLatestBundle({
      gitlabUrl: 'https://gl.example.com', projectIdOrPath: '12', client,
    })).rejects.toBeInstanceOf(UnsupportedSchemaVersionError)
  })
})

describe('selectFlakeLeaderboard', () => {
  it('returns empty for empty/missing bundle', () => {
    expect(selectFlakeLeaderboard(null)).toEqual([])
    expect(selectFlakeLeaderboard({})).toEqual([])
  })

  it('orders rows by ascending pass_rate', () => {
    // excludeStable:false here because this assertion specifically checks that
    // a known-stable test is positioned below known-flaky ones in the ordering.
    const rows = selectFlakeLeaderboard(sampleBundle, { limit: 10, excludeStable: false })
    expect(rows.length).toBeGreaterThan(0)
    // pass_rate must be non-decreasing across the leaderboard
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].pass_rate).toBeGreaterThanOrEqual(rows[i - 1].pass_rate)
    }
    // Most-flaky-by-pass-rate in the sample is test_mission[city_chase] (0/2),
    // followed by test_drift[scintilla] (1/3). Both must appear above the stable rows.
    const names = rows.map(r => r.name)
    const cityIdx  = names.indexOf('test_mission[city_chase]')
    const driftIdx = names.indexOf('test_drift[scintilla]')
    const stableIdx = names.indexOf('test_handbrake[etk800]')
    expect(cityIdx).toBeLessThan(driftIdx)
    expect(driftIdx).toBeLessThan(stableIdx)
    expect(rows[0].last_status).toMatch(/^(pass|fail)$/)
  })

  it('respects the suite facet by joining against matching runs only', () => {
    // Filter by suite=smoketest: only rows whose passing/failing run set
    // contains at least one smoketest run should appear. The row's own
    // `suite` field reflects the test's declared suite (may be nightly even
    // when its history includes smoketest runs — that's a valid cross-suite
    // observation), so we assert on row count instead.
    const all = selectFlakeLeaderboard(sampleBundle, { limit: 50 })
    const onlySmoketest = selectFlakeLeaderboard(sampleBundle, { suite: 'smoketest', limit: 50 })
    expect(onlySmoketest.length).toBeGreaterThan(0)
    expect(onlySmoketest.length).toBeLessThanOrEqual(all.length)
  })

  it('drops tests with no runs in the filter', () => {
    // Filter by an impossible gfx; nothing should match.
    const rows = selectFlakeLeaderboard(sampleBundle, { gfxApi: 'metal' })
    expect(rows).toEqual([])
  })

  it('honours limit', () => {
    expect(selectFlakeLeaderboard(sampleBundle, { limit: 2 }).length).toBeLessThanOrEqual(2)
  })

  it('excludes stable tests by default and includes them when excludeStable:false', () => {
    const withStable = selectFlakeLeaderboard(sampleBundle, { limit: 50, excludeStable: false })
    const flakyOnly  = selectFlakeLeaderboard(sampleBundle, { limit: 50 }) // default true
    const stableInWithStable = withStable.some(r => r.flake_classification === 'stable')
    const stableInFlakyOnly  = flakyOnly.some(r => r.flake_classification === 'stable')
    expect(stableInWithStable).toBe(true)
    expect(stableInFlakyOnly).toBe(false)
  })

  it('classifies per-scope: a row stable overall can be intermittent under a facet', () => {
    // Build a tiny synthetic bundle where one test is 5/5 in continuous and
    // 1/2 in nightly. Overall is 6/7 (stable); under nightly it's 1/2
    // (intermittent). The leaderboard's flake_classification must reflect the
    // facet, not the overall.
    const bundle = {
      schema_version: 1,
      runs: [
        { run_id: 'c1', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T00:00:00Z' },
        { run_id: 'c2', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T01:00:00Z' },
        { run_id: 'c3', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T02:00:00Z' },
        { run_id: 'c4', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T03:00:00Z' },
        { run_id: 'c5', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T04:00:00Z' },
        { run_id: 'n1', suite: 'nightly',    gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T05:00:00Z' },
        { run_id: 'n2', suite: 'nightly',    gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T06:00:00Z' },
      ],
      tests: [{
        test_id: 'test_vehicle[a,b]', name: 'test_vehicle[a,b]', module: 'mod', suite: 'continuous',
        overall: { flake_classification: 'stable' },
        results_by_context: [{
          context: 'continuous_results',
          passing_run_ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'n1'],
          failing_run_ids: ['n2'],
        }],
      }],
    }
    const nightly = selectFlakeLeaderboard(bundle, { suite: 'nightly', excludeStable: false })
    expect(nightly.length).toBe(1)
    expect(nightly[0].pass_count).toBe(1)
    expect(nightly[0].fail_count).toBe(1)
    expect(nightly[0].flake_classification).toBe('intermittent')

    // Continuous: 5/5 -> stable, excluded by default.
    const continuousDefault = selectFlakeLeaderboard(bundle, { suite: 'continuous' })
    expect(continuousDefault.length).toBe(0)
  })
})

describe('classifyFromCounts', () => {
  it('returns null when there are no runs', () => {
    expect(classifyFromCounts(0, 0)).toBe(null)
  })
  it('returns broken when pass=0 and there are fails', () => {
    expect(classifyFromCounts(0, 3)).toBe('broken')
  })
  it('returns stable when there are no fails', () => {
    expect(classifyFromCounts(5, 0)).toBe('stable')
  })
  it('returns stable at pass_rate >= 0.95', () => {
    expect(classifyFromCounts(19, 1)).toBe('stable')   // 95%
    expect(classifyFromCounts(95, 5)).toBe('stable')   // 95%
  })
  it('returns intermittent in [0.5, 0.95)', () => {
    expect(classifyFromCounts(1, 1)).toBe('intermittent')   // 50%
    expect(classifyFromCounts(94, 6)).toBe('intermittent')  // 94%
    expect(classifyFromCounts(6, 4)).toBe('intermittent')   // 60%
  })
  it('returns actively_flaky below 0.5', () => {
    expect(classifyFromCounts(1, 2)).toBe('actively_flaky') // ~33%
    expect(classifyFromCounts(1, 9)).toBe('actively_flaky') // 10%
  })
})

describe('parseRevisionRange', () => {
  it('parses closed, open-ended and single revisions (inclusive, nullable ends)', () => {
    expect(parseRevisionRange('r100...r200')).toEqual({ min: 100, max: 200 })
    expect(parseRevisionRange('r100...')).toEqual({ min: 100, max: null })
    expect(parseRevisionRange('...r200')).toEqual({ min: null, max: 200 })
    expect(parseRevisionRange('r100')).toEqual({ min: 100, max: 100 })
  })

  it('tolerates a missing r on range endpoints, casing, and whitespace', () => {
    expect(parseRevisionRange('100...200')).toEqual({ min: 100, max: 200 })
    expect(parseRevisionRange('R100...R200')).toEqual({ min: 100, max: 200 })
    expect(parseRevisionRange('  r100  ...  r200 ')).toEqual({ min: 100, max: 200 })
  })

  it('returns null for non-revision input so name search is unaffected', () => {
    expect(parseRevisionRange('')).toBe(null)
    expect(parseRevisionRange(null)).toBe(null)
    expect(parseRevisionRange('177518')).toBe(null)   // bare number -> name search
    expect(parseRevisionRange('...')).toBe(null)        // no digits
    expect(parseRevisionRange('test_handbrake[etk800]')).toBe(null)
    expect(parseRevisionRange('r1...r2...r3')).toBe(null)  // malformed: more than one range marker
  })
})

describe('revisionRange filtering in selectors', () => {
  it('selectHeatmapMatrix keeps only runs inside the range (inclusive ends)', () => {
    const only518 = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10, revisionRange: { min: 175518, max: 175518 } })
    expect(only518.runs.map(r => r.run_id).sort()).toEqual(['38cb3117', 'a882cfbe', 'f5354954'])

    const upTo500 = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10, revisionRange: { min: null, max: 175500 } })
    expect(upTo500.runs.map(r => r.run_id)).toEqual(['5cb34a1f'])

    const from518 = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10, revisionRange: { min: 175518, max: null } })
    expect(from518.runs.every(r => r.source_revision === '175518')).toBe(true)

    const whole = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10, revisionRange: { min: 175500, max: 175518 } })
    expect(whole.runs.length).toBe(4)
  })

  it('excludes runs whose source_revision is null or non-numeric while a range is active', () => {
    const bundle = {
      schema_version: 1,
      runs: [
        { run_id: 'num',  suite: 's', gfx_api: 'v', status: 'complete', source_revision: '500', started_at: '2026-05-20T00:00:00Z' },
        { run_id: 'nul',  suite: 's', gfx_api: 'v', status: 'complete', source_revision: null,  started_at: '2026-05-20T01:00:00Z' },
        { run_id: 'word', suite: 's', gfx_api: 'v', status: 'complete', source_revision: 'abc', started_at: '2026-05-20T02:00:00Z' },
      ],
      tests: [{
        test_id: 's::m.py::t', name: 't', module: 'm.py', suite: 's', overall: {},
        results_by_context: [{ passing_run_ids: ['num', 'nul', 'word'], failing_run_ids: [] }],
      }],
    }
    const m = selectHeatmapMatrix(bundle, { lastNRuns: 10, now: Date.parse('2026-05-21T00:00:00Z'), revisionRange: { min: 100, max: 1000 } })
    expect(m.runs.map(r => r.run_id)).toEqual(['num'])

    // Open lower bound must still drop null/non-numeric revisions (Number(null)===0
    // would otherwise sneak the 'nul' run past a `max`-only range).
    const openMax = selectHeatmapMatrix(bundle, { lastNRuns: 10, now: Date.parse('2026-05-21T00:00:00Z'), revisionRange: { min: null, max: 1000 } })
    expect(openMax.runs.map(r => r.run_id)).toEqual(['num'])
  })

  it('selectFlakeLeaderboard honours revisionRange', () => {
    const all    = selectFlakeLeaderboard(sampleBundle, { limit: 50, excludeStable: false })
    const only500 = selectFlakeLeaderboard(sampleBundle, { limit: 50, excludeStable: false, revisionRange: { min: 175500, max: 175500 } })
    expect(only500.length).toBeGreaterThan(0)
    expect(only500.length).toBeLessThanOrEqual(all.length)
    // r175500 == only run 5cb34a1f; test_mission[city_chase] fails in it, so it
    // survives the filter. A range matching no run empties the leaderboard.
    expect(only500.some(r => r.name === 'test_mission[city_chase]')).toBe(true)
    expect(selectFlakeLeaderboard(sampleBundle, { limit: 50, revisionRange: { min: 999999, max: 999999 } })).toEqual([])
  })
})

describe('selectHeatmapMatrix', () => {
  it('returns runs ordered ascending by started_at and tests with at least one observation', () => {
    const m = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10 })
    expect(m.runs.length).toBe(4)
    const times = m.runs.map(r => r.started_at)
    expect([...times]).toEqual([...times].sort())
    expect(m.tests.length).toBeGreaterThan(0)
    for (const t of m.tests) {
      expect(m.cells[t.test_id].length).toBe(m.runs.length)
    }
  })

  it('flags interrupted runs', () => {
    const m = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10 })
    expect(m.interruptedRunIds.has('a882cfbe')).toBe(true)
  })

  it('cells default to not_run when a test was absent in that run', () => {
    const m = selectHeatmapMatrix(sampleBundle, { lastNRuns: 10 })
    // visual_test.py::test_visual[main_menu] only ran in the vulkan smoketest
    // run 38cb3117 — so every other column for that test must read "not_run".
    // Rows are keyed by the suite-independent group key (module::name).
    const tid = 'visual_test.py::test_visual[main_menu]'
    const row = m.cells[tid]
    const runIdx = m.runs.findIndex(r => r.run_id === '38cb3117')
    expect(row[runIdx]).toBe('pass')
    for (let i = 0; i < row.length; i++) {
      if (i !== runIdx) expect(row[i]).toBe('not_run')
    }
  })

  it('lastNRuns trims the run window from the most recent end', () => {
    const m = selectHeatmapMatrix(sampleBundle, { lastNRuns: 2 })
    expect(m.runs.length).toBe(2)
    // The trimmed-out run hashes must not appear in any cell value other
    // than not_run; the row length must equal the trimmed run count.
    for (const tid of Object.keys(m.cells)) {
      expect(m.cells[tid].length).toBe(2)
    }
  })

  it('groups the same test across suites into one row spanning all run columns', () => {
    // test_level[west_coast_usa] runs under three flavours; the producer encodes
    // the flavour into test_id, so it arrives as three tests[] entries. The
    // heatmap must collapse them onto a single row keyed by module::name, with
    // the pass/fail outcome of each flavour's run lined up on its own column.
    const bundle = {
      schema_version: 1,
      runs: [
        { run_id: 's1', suite: 'smoketest',  gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T00:00:00Z' },
        { run_id: 'c1', suite: 'continuous', gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T01:00:00Z' },
        { run_id: 'n1', suite: 'nightly',    gfx_api: 'vulkan', status: 'complete', started_at: '2026-05-20T02:00:00Z' },
      ],
      tests: [
        { test_id: 'smoketest::level_test.py::test_level[west_coast_usa]',  name: 'test_level[west_coast_usa]', module: 'level_test.py', suite: 'smoketest',
          overall: {}, results_by_context: [{ passing_run_ids: ['s1'], failing_run_ids: [] }] },
        { test_id: 'continuous::level_test.py::test_level[west_coast_usa]', name: 'test_level[west_coast_usa]', module: 'level_test.py', suite: 'continuous',
          overall: {}, results_by_context: [{ passing_run_ids: [], failing_run_ids: ['c1'] }] },
        { test_id: 'nightly::level_test.py::test_level[west_coast_usa]',    name: 'test_level[west_coast_usa]', module: 'level_test.py', suite: 'nightly',
          overall: {}, results_by_context: [{ passing_run_ids: ['n1'], failing_run_ids: [] }] },
      ],
    }
    const m = selectHeatmapMatrix(bundle, { lastNRuns: 10, now: Date.parse('2026-05-21T00:00:00Z') })
    expect(m.tests.length).toBe(1)
    const row = m.tests[0]
    expect(row.test_id).toBe('level_test.py::test_level[west_coast_usa]')
    expect(row.member_ids).toHaveLength(3)
    // Columns are ordered by started_at: smoketest pass, continuous fail, nightly pass.
    expect(m.cells[row.test_id]).toEqual(['pass', 'fail', 'pass'])
  })

  it('marks runs expired per-suite: nightly outlives smoketest, undated always expired', () => {
    // now is ~72h after the runs started. With smoketest=48h and nightly=336h
    // retention, the smoketest run's artifacts are gone but the nightly run's
    // are still alive — same age, different window.
    const now = Date.parse('2026-05-04T00:00:00Z')
    const bundle = {
      schema_version: 1,
      runs: [
        { run_id: 'smoke',   suite: 'smoketest', gfx_api: 'v', status: 'complete', started_at: '2026-05-01T00:00:00Z', finished_at: '2026-05-01T01:00:00Z' },
        { run_id: 'night',   suite: 'nightly',   gfx_api: 'v', status: 'complete', started_at: '2026-05-01T00:00:00Z', finished_at: '2026-05-01T01:00:00Z' },
        { run_id: 'mystery', suite: 'oddball',   gfx_api: 'v', status: 'complete', started_at: '2026-05-01T00:00:00Z', finished_at: '2026-05-01T01:00:00Z' },
        { run_id: 'undated', suite: 'nightly',   gfx_api: 'v', status: 'complete' },
      ],
      tests: [
        { test_id: 's::m.py::t', name: 't', module: 'm.py', suite: 's', overall: {},
          results_by_context: [{ passing_run_ids: ['smoke', 'night', 'mystery', 'undated'], failing_run_ids: [] }] },
      ],
    }
    const m = selectHeatmapMatrix(bundle, { lastNRuns: 10, now })
    expect(m.expiredRunIds.has('smoke')).toBe(true)     // 72h old > 48h smoketest window
    expect(m.expiredRunIds.has('night')).toBe(false)    // 72h old < 336h nightly window
    expect(m.expiredRunIds.has('mystery')).toBe(true)   // unknown suite -> 24h default -> expired
    expect(m.expiredRunIds.has('undated')).toBe(true)   // no timestamp -> assume expired
  })
})

describe('selectSuiteIncidentCards', () => {
  // Build a bundle where each run gets exactly `pass` passing + `fail` failing
  // synthetic tests, so the selector's per-run tally is deterministic.
  // runs: [{ run_id, suite, gfx_api, started_at }]; counts: { run_id: { pass, fail } }
  const makeBundle = ({ generated_at, runs, counts }) => {
    const tests = []
    let n = 0
    for (const r of runs) {
      const c = counts[r.run_id] || { pass: 0, fail: 0 }
      for (let i = 0; i < c.pass; i++) {
        tests.push({ test_id: `t${n++}`, suite: r.suite, name: `n${n}`, module: 'm',
          results_by_context: [{ gfx_api: r.gfx_api, passing_run_ids: [r.run_id], failing_run_ids: [] }] })
      }
      for (let i = 0; i < c.fail; i++) {
        tests.push({ test_id: `t${n++}`, suite: r.suite, name: `n${n}`, module: 'm',
          results_by_context: [{ gfx_api: r.gfx_api, passing_run_ids: [], failing_run_ids: [r.run_id] }] })
      }
    }
    return { generated_at, runs, tests }
  }

  const threeGfx = (suite, day, counts) => ([
    { run_id: `${suite}-dx11-${day}`, suite, gfx_api: 'dx11', started_at: `2026-05-${day}T08:00:00Z` },
    { run_id: `${suite}-dx12-${day}`, suite, gfx_api: 'dx12', started_at: `2026-05-${day}T08:00:00Z` },
    { run_id: `${suite}-vulkan-${day}`, suite, gfx_api: 'vulkan', started_at: `2026-05-${day}T08:00:00Z` },
  ])

  it('returns [] for a missing or malformed bundle', () => {
    expect(selectSuiteIncidentCards(null)).toEqual([])
    expect(selectSuiteIncidentCards({})).toEqual([])
  })

  it('all gfx passing in the latest build -> green, full clean streak', () => {
    const runs = threeGfx('smoketest', '20')
    const b = makeBundle({
      generated_at: '2026-05-21T08:00:00Z',
      runs,
      counts: {
        'smoketest-dx11-20': { pass: 26, fail: 0 },
        'smoketest-dx12-20': { pass: 26, fail: 0 },
        'smoketest-vulkan-20': { pass: 26, fail: 0 },
      },
    })
    const [card] = selectSuiteIncidentCards(b)
    expect(card.suite).toBe('smoketest')
    expect(card.status).toBe('pass')
    expect(card.gfx).toEqual([
      { gfx_api: 'dx11', passed: 26, total: 26 },
      { gfx_api: 'dx12', passed: 26, total: 26 },
      { gfx_api: 'vulkan', passed: 26, total: 26 },
    ])
    // No failures in window -> clean streak from oldest run (05-20) to generated_at (05-21) = 1 day.
    expect(card.daysWithoutFailure).toBe(1)
  })

  it('one gfx failing in the latest build -> orange, 0 days', () => {
    const runs = threeGfx('smoketest', '21')
    const b = makeBundle({
      generated_at: '2026-05-21T12:00:00Z',
      runs,
      counts: {
        'smoketest-dx11-21': { pass: 3, fail: 23 },
        'smoketest-dx12-21': { pass: 26, fail: 0 },
        'smoketest-vulkan-21': { pass: 26, fail: 0 },
      },
    })
    const [card] = selectSuiteIncidentCards(b)
    expect(card.status).toBe('warn')
    expect(card.daysWithoutFailure).toBe(0)
    expect(card.gfx.find(g => g.gfx_api === 'dx11')).toEqual({ gfx_api: 'dx11', passed: 3, total: 26 })
  })

  it('all gfx failing in the latest build -> red, 0 days', () => {
    const runs = threeGfx('smoketest', '21')
    const b = makeBundle({
      generated_at: '2026-05-21T12:00:00Z',
      runs,
      counts: {
        'smoketest-dx11-21': { pass: 1, fail: 25 },
        'smoketest-dx12-21': { pass: 10, fail: 16 },
        'smoketest-vulkan-21': { pass: 0, fail: 26 },
      },
    })
    const [card] = selectSuiteIncidentCards(b)
    expect(card.status).toBe('fail')
    expect(card.daysWithoutFailure).toBe(0)
  })

  it('color comes from the latest build but days-without reflects the last failure in history', () => {
    // An old failing dx11 build (05-18), then a clean build for all gfx on 05-21.
    const runs = [
      { run_id: 'old', suite: 'smoketest', gfx_api: 'dx11', started_at: '2026-05-18T08:00:00Z' },
      ...threeGfx('smoketest', '21'),
    ]
    const b = makeBundle({
      generated_at: '2026-05-21T08:00:00Z',
      runs,
      counts: {
        old: { pass: 0, fail: 5 },
        'smoketest-dx11-21': { pass: 26, fail: 0 },
        'smoketest-dx12-21': { pass: 26, fail: 0 },
        'smoketest-vulkan-21': { pass: 26, fail: 0 },
      },
    })
    const [card] = selectSuiteIncidentCards(b)
    // Latest dx11 build passes -> not aggregated with the old failing run.
    expect(card.gfx.find(g => g.gfx_api === 'dx11')).toEqual({ gfx_api: 'dx11', passed: 26, total: 26 })
    expect(card.status).toBe('pass')
    // Last failure 05-18, generated_at 05-21 -> 3 days.
    expect(card.daysWithoutFailure).toBe(3)
  })

  it('renders one card per suite, ordered smoketest -> continuous -> nightly', () => {
    const runs = [
      ...threeGfx('nightly', '20'),
      ...threeGfx('smoketest', '20'),
      ...threeGfx('continuous', '20'),
    ]
    const counts = {}
    for (const r of runs) counts[r.run_id] = { pass: 26, fail: 0 }
    const cards = selectSuiteIncidentCards(makeBundle({ generated_at: '2026-05-21T00:00:00Z', runs, counts }))
    expect(cards.map(c => c.suite)).toEqual(['smoketest', 'continuous', 'nightly'])
  })

  it('a suite whose latest runs have no test data -> status none', () => {
    const runs = threeGfx('smoketest', '21')
    const b = makeBundle({
      generated_at: '2026-05-21T00:00:00Z',
      runs,
      counts: {}, // no tests reference any run
    })
    const [card] = selectSuiteIncidentCards(b)
    expect(card.status).toBe('none')
    expect(card.gfx).toEqual([
      { gfx_api: 'dx11', passed: 0, total: 0 },
      { gfx_api: 'dx12', passed: 0, total: 0 },
      { gfx_api: 'vulkan', passed: 0, total: 0 },
    ])
  })
})
