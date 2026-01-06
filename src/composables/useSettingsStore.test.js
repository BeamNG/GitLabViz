import { encodeGitLabTokenForStorage, decodeGitLabTokenFromStorage } from './useSettingsStore'

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
})


