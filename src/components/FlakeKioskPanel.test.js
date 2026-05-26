import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { FlakeNotConfiguredError } from '../services/flake'
import sampleBundle from '../../fixtures/flake-history-bundle-sample.json'

let nextResult = null
let nextError = null
vi.mock('../services/flake', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchLatestBundle: vi.fn(async () => {
      if (nextError) throw nextError
      return nextResult
    }),
  }
})
vi.mock('../utils/tokenObfuscation', () => ({
  decodeGitLabTokenFromStorage: vi.fn((v) => v || ''),
}))

const baseSettings = (overrides = {}) => ({
  config: {
    gitlabApiBaseUrl: 'https://gl.example.com',
    token: 'tok',
    flakeHistory: { projectId: '', packageName: 'flake-history', refreshMinutes: 0 },
    ...overrides,
  },
})

const mountPanel = async (settings) => {
  const FlakeKioskPanel = (await import('./FlakeKioskPanel.vue')).default
  const wrapper = mount(FlakeKioskPanel, { props: { settings } })
  await flushPromises()
  return wrapper
}

beforeEach(() => { nextResult = null; nextError = null })
afterEach(() => { vi.clearAllMocks() })

describe('FlakeKioskPanel', () => {
  it('renders "not configured" when projectId missing', async () => {
    nextError = new FlakeNotConfiguredError()
    const wrapper = await mountPanel(baseSettings())
    expect(wrapper.vm.errorKind).toBe('not_configured')
  })

  it('renders the broken + flaky lists when the bundle loads', async () => {
    nextResult = sampleBundle
    const wrapper = await mountPanel(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe(null)
    // The sample has one test whose every cell is fail (test_mission[city_chase])
    // and a few intermittent / actively_flaky tests.
    expect(wrapper.vm.brokenList.length).toBeGreaterThan(0)
    expect(wrapper.vm.flakyList.length).toBeGreaterThan(0)
    // Sparkline must have exactly the recent-runs slot count (<= 5)
    for (const t of wrapper.vm.flakyList) {
      expect(t.sparkline.length).toBeLessThanOrEqual(5)
      for (const s of t.sparkline) expect(['pass', 'fail', 'none']).toContain(s)
    }
  })

  it('shows "Nothing failing" when no tests are currently failing', async () => {
    // Strip out the broken/intermittent tests so last_status=fail rows go to zero.
    const allGreen = {
      ...sampleBundle,
      tests: sampleBundle.tests.filter(t => t.overall.flake_classification === 'stable')
        .map(t => ({
          ...t,
          results_by_context: t.results_by_context.map(ctx => ({
            ...ctx, failing_run_ids: [], fail_count: 0, last_status: 'pass',
          })),
          overall: { ...t.overall, fail_count: 0, is_flaky: false, flake_classification: 'stable' },
        })),
    }
    nextResult = allGreen
    const wrapper = await mountPanel(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe(null)
    expect(wrapper.vm.brokenList.length).toBe(0)
  })
})
