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
    })
    expect(wrapper.vm.configDialog).toBe(false)
  })
})
