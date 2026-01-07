import { encodeGitLabTokenForStorage, decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

describe('useSettingsStore token obfuscation', () => {
  it('encodes with prefix and decodes back to original', () => {
    const token = 'glpat-abc123:with/special?chars'
    const enc = encodeGitLabTokenForStorage(token)
    expect(enc).not.toBe(token)
    expect(enc.startsWith('glv-xor1:')).toBe(true)
    expect(decodeGitLabTokenFromStorage(enc)).toBe(token)
  })

  it('encode is idempotent (does not double-encode)', () => {
    const token = 'glpat-xyz'
    const enc1 = encodeGitLabTokenForStorage(token)
    const enc2 = encodeGitLabTokenForStorage(enc1)
    expect(enc2).toBe(enc1)
    expect(decodeGitLabTokenFromStorage(enc2)).toBe(token)
  })

  it('plain tokens pass through decode unchanged (backward compatible)', () => {
    const token = 'plain-token'
    expect(decodeGitLabTokenFromStorage(token)).toBe(token)
  })

  it('empty tokens stay empty', () => {
    expect(encodeGitLabTokenForStorage('')).toBe('')
    expect(decodeGitLabTokenFromStorage('')).toBe('')
  })

  it('saving settings encodes token for storage but does not mutate in-memory token', async () => {
    vi.resetModules()

    const lfMod = await import('localforage')
    const localforage = lfMod.default || lfMod

    const prevElectronApi = window.electronAPI
    try {
      // Force browser storage path
      delete window.electronAPI

      const getSpy = vi.spyOn(localforage, 'getItem').mockResolvedValue(null)
      const setSpy = vi.spyOn(localforage, 'setItem').mockResolvedValue(null)

      const mod = await import('./useSettingsStore')
      const store = mod.useSettingsStore()
      await store.init()

      store.settings.config.token = 'glpat-test-token'
      await new Promise(r => setTimeout(r, 0))

      expect(store.settings.config.token).toBe('glpat-test-token')
      expect(setSpy).toHaveBeenCalled()
      const saved = setSpy.mock.calls[setSpy.mock.calls.length - 1][1]
      expect(saved?.config?.token).toBeUndefined()
      expect(typeof saved?.config?.tokenObfuscated).toBe('string')
      expect(saved.config.tokenObfuscated.startsWith('glv-xor1:')).toBe(true)

      getSpy.mockRestore()
      setSpy.mockRestore()
    } finally {
      window.electronAPI = prevElectronApi
    }
  })

  it('loads legacy plain token key and rewrites to tokenObfuscated on save', async () => {
    vi.resetModules()

    const lfMod = await import('localforage')
    const localforage = lfMod.default || lfMod

    const prevElectronApi = window.electronAPI
    try {
      delete window.electronAPI

      const getSpy = vi.spyOn(localforage, 'getItem').mockResolvedValue({ config: { token: 'glpat-legacy' } })
      const setSpy = vi.spyOn(localforage, 'setItem').mockResolvedValue(null)

      const mod = await import('./useSettingsStore')
      const store = mod.useSettingsStore()
      await store.init()

      // in-memory token is still plain
      expect(store.settings.config.token).toBe('glpat-legacy')

      // trigger persistence
      store.settings.meta.lastUpdated = (store.settings.meta.lastUpdated || 0) + 1
      await new Promise(r => setTimeout(r, 0))

      const saved = setSpy.mock.calls[setSpy.mock.calls.length - 1][1]
      expect(saved?.config?.token).toBeUndefined()
      expect(typeof saved?.config?.tokenObfuscated).toBe('string')
      expect(saved.config.tokenObfuscated.startsWith('glv-xor1:')).toBe(true)

      getSpy.mockRestore()
      setSpy.mockRestore()
    } finally {
      window.electronAPI = prevElectronApi
    }
  })
})


