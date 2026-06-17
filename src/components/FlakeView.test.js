import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  FlakeNotConfiguredError, FlakeBundleNotFoundError, UnsupportedSchemaVersionError,
} from '../services/flake'
import sampleBundle from '../../fixtures/flake-history-bundle-sample.json'

// Mock the service so the component never touches HTTP / localforage.
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
    flakeHistory: {
      projectId: '',
      packageName: 'flake-history',
      refreshMinutes: 0,
    },
    ...overrides,
  },
})

const mountFlakeView = async (settings) => {
  // Lazy import to ensure mocks are wired before the component module evaluates.
  const FlakeView = (await import('./FlakeView.vue')).default
  const wrapper = mount(FlakeView, {
    props: { settings },
    global: { stubs: {
      'v-app-bar': true, 'v-app-bar-nav-icon': true, 'v-app-bar-title': true,
      'v-spacer': true, 'v-select': true, 'v-slider': true, 'v-btn': true,
      'v-icon': true, 'v-main': true, 'v-overlay': true, 'v-progress-circular': true,
      'v-container': true, 'v-card': true, 'v-card-title': true, 'v-card-text': true,
      'v-card-actions': true, 'v-text-field': true, 'v-alert': true,
      'v-data-table': true, 'v-chip': true,
      'v-toolbar': true, 'v-switch': true, 'v-tooltip': true, 'v-dialog': true,
      'v-menu': true, 'v-list': true, 'v-list-item': true, 'v-list-item-title': true,
    } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  nextResult = null
  nextError = null
})
afterEach(() => { vi.clearAllMocks() })

describe('FlakeView', () => {
  it('shows the not-configured empty state when projectId is blank', async () => {
    nextError = new FlakeNotConfiguredError()
    const wrapper = await mountFlakeView(baseSettings())
    // Component decides "not_configured" before even calling the service when
    // projectId is missing — but if it did call, FlakeNotConfiguredError leads
    // to the same state. Either way, the empty-state card must render.
    expect(wrapper.vm.errorKind).toBe('not_configured')
  })

  it('formatPipelineLabel renders #<pipeline_id>, or empty when absent', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.formatPipelineLabel({ pipeline_id: 12345 })).toBe('#12345')
    expect(wrapper.vm.formatPipelineLabel({ pipeline_id: 0 })).toBe('#0')
    expect(wrapper.vm.formatPipelineLabel({ pipeline_id: null })).toBe('')
    expect(wrapper.vm.formatPipelineLabel({})).toBe('')
    expect(wrapper.vm.formatPipelineLabel(null)).toBe('')
  })

  it('loads the bundle on mount when configured and exposes leaderboard rows', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe(null)
    expect(wrapper.vm.bundle).toEqual(sampleBundle)
    expect(wrapper.vm.leaderboard.length).toBeGreaterThan(0)
    // Heatmap projection populated
    expect(wrapper.vm.heatmap.runs.length).toBe(4)
  })

  it('surfaces UnsupportedSchemaVersionError as the schema-mismatch state', async () => {
    nextError = new UnsupportedSchemaVersionError(99)
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe('unsupported_schema')
  })

  it('surfaces FlakeBundleNotFoundError as the not_found state', async () => {
    nextError = new FlakeBundleNotFoundError('flake-history')
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe('not_found')
  })

  it('catches generic errors with a human message', async () => {
    nextError = new Error('boom')
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.errorKind).toBe('error')
    expect(wrapper.vm.errorMessage).toContain('boom')
  })

  it('clicking a cell downloads live artifacts, else opens the pipeline', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    // Live artifacts (not expired) -> download (no gameInstallPath, so no viewer).
    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/download', pipeline_url: 'https://pipe' }, false)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('https://art/download', '_blank', 'noopener')

    // Expired -> pipeline, even though the run still carries an artifacts_url.
    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/download', pipeline_url: 'https://pipe' }, true)
    expect(open).toHaveBeenLastCalledWith('https://pipe', '_blank', 'noopener')

    // No artifacts_url -> pipeline.
    wrapper.vm.openArtifactOrPipeline({ pipeline_url: 'https://pipe' }, false)
    expect(open).toHaveBeenLastCalledWith('https://pipe', '_blank', 'noopener')

    open.mockRestore()
  })

  it('builds a file:// URL for the local viewer, tolerating backslashes and a trailing slash', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.buildViewerFileUrl('D:\\BeamNG.drive\\'))
      .toBe('file:///D:/BeamNG.drive/game/test-viewer.html')
    expect(wrapper.vm.buildViewerFileUrl('D:/BeamNG.drive'))
      .toBe('file:///D:/BeamNG.drive/game/test-viewer.html')
    expect(wrapper.vm.buildViewerFileUrl('')).toBe('')
    // Override relative path replaces the default game/test-viewer.html segment.
    expect(wrapper.vm.buildViewerFileUrl('D:\\BeamNG.drive', 'graphic_viewer.html'))
      .toBe('file:///D:/BeamNG.drive/graphic_viewer.html')
    // Leading separators / backslashes in the override are normalized.
    expect(wrapper.vm.buildViewerFileUrl('D:\\BeamNG.drive', '\\sub\\viewer.html'))
      .toBe('file:///D:/BeamNG.drive/sub/viewer.html')
  })

  it('opens the local viewer alongside the download when gameInstallPath is set (browser)', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0, gameInstallPath: 'D:\\BeamNG.drive' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    // Live artifacts -> download AND viewer.
    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl', pipeline_url: 'https://pipe' }, false)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(open).toHaveBeenCalledWith('file:///D:/BeamNG.drive/game/test-viewer.html', '_blank', 'noopener')

    open.mockClear()
    // Expired -> pipeline only, NO viewer.
    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl', pipeline_url: 'https://pipe' }, true)
    expect(open).toHaveBeenCalledWith('https://pipe', '_blank', 'noopener')
    expect(open).not.toHaveBeenCalledWith('file:///D:/BeamNG.drive/game/test-viewer.html', '_blank', 'noopener')

    open.mockRestore()
  })

  it('uses electronAPI.openPath for the viewer when running under Electron', async () => {
    nextResult = sampleBundle
    const openPath = vi.fn(() => Promise.resolve({ success: true }))
    window.electronAPI = { openPath }
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0, gameInstallPath: 'D:\\BeamNG.drive' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(openPath).toHaveBeenCalledWith('D:\\BeamNG.drive', 'game/test-viewer.html')
    // Electron handles it -> no file:// fallback.
    expect(open).not.toHaveBeenCalledWith('file:///D:/BeamNG.drive/game/test-viewer.html', '_blank', 'noopener')

    open.mockRestore()
    delete window.electronAPI
  })

  it('does not open the viewer when gameInstallPath is empty', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    open.mockRestore()
  })

  it('openViewerOnClick defaults ON and ignores settings', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    expect(wrapper.vm.openViewerOnClick).toBe(true)
  })

  it('fires the command listener URL via electron openExternal when useCommandListener is on', async () => {
    nextResult = sampleBundle
    const openExternal = vi.fn(() => Promise.resolve({ success: true }))
    const openPath = vi.fn(() => Promise.resolve({ success: true }))
    window.electronAPI = { openExternal, openPath }
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0,
        gameInstallPath: 'D:\\BeamNG.drive', useCommandListener: true, commandListenerCall: 'scheme:v1/custom_open' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(openExternal).toHaveBeenCalledWith('scheme:v1/custom_open')
    expect(openPath).not.toHaveBeenCalled()

    open.mockRestore()
    delete window.electronAPI
  })

  it('falls back to an anchor click for the command URL outside Electron', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0,
        useCommandListener: true, commandListenerCall: 'scheme:v1/custom_open' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(click).toHaveBeenCalledTimes(1)

    click.mockRestore()
    open.mockRestore()
  })

  it('does not open the viewer or command when openViewerOnClick is off', async () => {
    nextResult = sampleBundle
    const openExternal = vi.fn(() => Promise.resolve({ success: true }))
    const openPath = vi.fn(() => Promise.resolve({ success: true }))
    window.electronAPI = { openExternal, openPath }
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0,
        gameInstallPath: 'D:\\BeamNG.drive', useCommandListener: true, commandListenerCall: 'scheme:v1/custom_open' },
    }))
    wrapper.vm.openViewerOnClick = false
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(openExternal).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()

    open.mockRestore()
    delete window.electronAPI
  })

  it('survives a rejecting electronAPI.openPath without throwing', async () => {
    nextResult = sampleBundle
    const openPath = vi.fn(() => Promise.reject(new Error('nope')))
    window.electronAPI = { openPath }
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0, gameInstallPath: 'D:\\BeamNG.drive' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    // Must not throw even though openPath rejects.
    expect(() => wrapper.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)).not.toThrow()
    expect(open).toHaveBeenCalledWith('https://art/dl', '_blank', 'noopener')
    expect(openPath).toHaveBeenCalledWith('D:\\BeamNG.drive', 'game/test-viewer.html')

    open.mockRestore()
    delete window.electronAPI
  })

  it('honors viewerRelPath override under Electron and in the browser fallback', async () => {
    nextResult = sampleBundle
    // Electron: the override is forwarded to openPath as the relative path.
    const openPath = vi.fn(() => Promise.resolve({ success: true }))
    window.electronAPI = { openPath }
    const wrapperE = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0, gameInstallPath: 'D:\\BeamNG.drive', viewerRelPath: 'graphic_viewer.html' },
    }))
    const openE = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrapperE.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(openPath).toHaveBeenCalledWith('D:\\BeamNG.drive', 'graphic_viewer.html')
    openE.mockRestore()
    delete window.electronAPI

    // Browser: the override drives the file:// URL.
    const wrapperB = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0, gameInstallPath: 'D:\\BeamNG.drive', viewerRelPath: 'graphic_viewer.html' },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrapperB.vm.openArtifactOrPipeline({ artifacts_url: 'https://art/dl' }, false)
    expect(open).toHaveBeenCalledWith('file:///D:/BeamNG.drive/graphic_viewer.html', '_blank', 'noopener')
    open.mockRestore()
  })

  it('config dialog save round-trips all flake fields including gameInstallPath and viewerRelPath', async () => {
    nextResult = sampleBundle
    const settings = baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    })
    const wrapper = await mountFlakeView(settings)

    wrapper.vm.openConfigDialog()
    expect(wrapper.vm.configDialog).toBe(true)
    // Dialog seeds the form from current settings.
    expect(wrapper.vm.form.projectId).toBe('12')

    wrapper.vm.form.gameInstallPath = 'D:\\BeamNG.drive'
    wrapper.vm.form.viewerRelPath = 'graphic_viewer.html'
    wrapper.vm.form.refreshMinutes = 15
    wrapper.vm.saveForm()
    await flushPromises()

    expect(settings.config.flakeHistory).toEqual({
      projectId: '12',
      packageName: 'flake-history',
      refreshMinutes: 15,
      gameInstallPath: 'D:\\BeamNG.drive',
      viewerRelPath: 'graphic_viewer.html',
      useCommandListener: false,
      commandListenerCall: 'command:v1/run_custom_command',
    })
    expect(wrapper.vm.configDialog).toBe(false)
  })

  it('config save persists the command listener toggle and call', async () => {
    nextResult = sampleBundle
    const settings = baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    })
    const wrapper = await mountFlakeView(settings)
    wrapper.vm.openConfigDialog()
    wrapper.vm.form.useCommandListener = true
    wrapper.vm.form.commandListenerCall = 'scheme:v1/custom_open'
    wrapper.vm.saveForm()
    await flushPromises()
    expect(settings.config.flakeHistory.useCommandListener).toBe(true)
    expect(settings.config.flakeHistory.commandListenerCall).toBe('scheme:v1/custom_open')
  })

  it('right-click menu downloads artifacts and opens the pipeline, disabling as appropriate', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    // Live artifacts: both actions enabled.
    wrapper.vm.openCellMenu({ clientX: 10, clientY: 20 }, { artifacts_url: 'https://art/dl', pipeline_url: 'https://pipe' }, false)
    expect(wrapper.vm.cellMenu.open).toBe(true)
    expect(wrapper.vm.cellMenu.x).toBe(10)
    expect(wrapper.vm.cellMenuCanDownload).toBe(true)
    expect(wrapper.vm.cellMenuCanPipeline).toBe(true)

    wrapper.vm.onMenuDownload()
    expect(open).toHaveBeenLastCalledWith('https://art/dl', '_blank', 'noopener')
    expect(wrapper.vm.cellMenu.open).toBe(false)

    wrapper.vm.openCellMenu({ clientX: 0, clientY: 0 }, { artifacts_url: 'https://art/dl', pipeline_url: 'https://pipe' }, false)
    wrapper.vm.onMenuPipeline()
    expect(open).toHaveBeenLastCalledWith('https://pipe', '_blank', 'noopener')
    expect(wrapper.vm.cellMenu.open).toBe(false)

    // Expired: download disabled, pipeline still enabled.
    wrapper.vm.openCellMenu({ clientX: 0, clientY: 0 }, { artifacts_url: 'https://art/dl', pipeline_url: 'https://pipe' }, true)
    expect(wrapper.vm.cellMenuCanDownload).toBe(false)
    expect(wrapper.vm.cellMenuCanPipeline).toBe(true)

    // No URLs at all: both disabled.
    wrapper.vm.openCellMenu({ clientX: 0, clientY: 0 }, {}, false)
    expect(wrapper.vm.cellMenuCanDownload).toBe(false)
    expect(wrapper.vm.cellMenuCanPipeline).toBe(false)

    open.mockRestore()
  })

  it('cellTooltip appends the revision / suite / gfx context line', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))
    const t = { name: 'test_level[italy]' }
    const full = wrapper.vm.cellTooltip(
      t, { run_id: 'f5354954', source_revision: '175518', suite: 'nightly', gfx_api: 'dx12', status: 'complete' }, 'pass')
    expect(full).toContain('test_level[italy]')
    expect(full).toContain('run: f5354954')
    expect(full.split('\n').pop()).toBe('r175518 · nightly · dx12')

    // Missing fields fall back to '?', mirroring runTooltip.
    const fallback = wrapper.vm.cellTooltip(
      t, { run_id: 'x', source_revision: null, suite: null, gfx_api: null, status: 'complete' }, 'fail')
    expect(fallback.split('\n').pop()).toBe('r? · ? · ?')
  })

  it('config save restores the obfuscated default when the command call is blanked', async () => {
    nextResult = sampleBundle
    const settings = baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    })
    const wrapper = await mountFlakeView(settings)
    wrapper.vm.openConfigDialog()
    wrapper.vm.form.commandListenerCall = '   '
    wrapper.vm.saveForm()
    await flushPromises()
    expect(settings.config.flakeHistory.commandListenerCall).toBe('command:v1/run_custom_command')
  })

  it('a revision range in the search box narrows runs without blanking rows; names still search', async () => {
    nextResult = sampleBundle
    const wrapper = await mountFlakeView(baseSettings({
      flakeHistory: { projectId: '12', packageName: 'flake-history', refreshMinutes: 0 },
    }))

    // Revision range -> only r175518 runs survive as columns, rows still present.
    wrapper.vm.searchQuery = 'r175518...r175518'
    await flushPromises()
    expect(wrapper.vm.heatmap.runs.map(r => r.run_id).sort()).toEqual(['38cb3117', 'a882cfbe', 'f5354954'])
    expect(wrapper.vm.heatmap.runs.every(r => r.source_revision === '175518')).toBe(true)
    expect(wrapper.vm.heatmap.tests.length).toBeGreaterThan(0)

    // A plain word still filters rows by test name (all 4 runs remain as columns).
    wrapper.vm.searchQuery = 'handbrake'
    await flushPromises()
    expect(wrapper.vm.heatmap.runs.length).toBe(4)
    expect(wrapper.vm.heatmap.tests.length).toBeGreaterThan(0)
    expect(wrapper.vm.heatmap.tests.every(t => t.name.includes('handbrake'))).toBe(true)
  })
})
