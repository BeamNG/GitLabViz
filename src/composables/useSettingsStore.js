import { reactive, watch, toRaw } from 'vue'
import localforage from 'localforage'
import { defaultSettings } from '../defaultSettings'

let _store
const hasDisk = () => !!(window.electronAPI?.settingsGet && window.electronAPI?.settingsSet)

const TOKEN_PREFIX = 'glv-xor1:'
const TOKEN_KEY = 'gitlab-viz-token-xor-v1'

const toBytes = (s) => new TextEncoder().encode(String(s || ''))
const fromBytes = (b) => new TextDecoder().decode(b)

const bytesToBase64 = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const base64ToBytes = (b64) => {
  const bin = atob(String(b64 || ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
  return bytes
}

const xorBytes = (bytes, keyBytes) => {
  if (!keyBytes || !keyBytes.length) return bytes
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length]
  return out
}

export const encodeGitLabTokenForStorage = (token) => {
  const raw = String(token || '')
  if (!raw) return ''
  if (raw.startsWith(TOKEN_PREFIX)) return raw
  const x = xorBytes(toBytes(raw), toBytes(TOKEN_KEY))
  return `${TOKEN_PREFIX}${bytesToBase64(x)}`
}

export const decodeGitLabTokenFromStorage = (maybeEncoded) => {
  const raw = String(maybeEncoded || '')
  if (!raw.startsWith(TOKEN_PREFIX)) return raw
  try {
    const b64 = raw.slice(TOKEN_PREFIX.length)
    const x = base64ToBytes(b64)
    const plainBytes = xorBytes(x, toBytes(TOKEN_KEY))
    return fromBytes(plainBytes)
  } catch {
    // Backward/forward compatible: if decode fails, keep as-is.
    return raw
  }
}

export function useSettingsStore() {
  if (_store) return _store

  // 1. Initialize with defaults immediately
  const settings = reactive(defaultSettings())
  
  // 2. Define Save Logic
  const save = () => {
    const raw = toRaw(settings)
    if (raw && raw.config && typeof raw.config.token === 'string') {
      raw.config.token = encodeGitLabTokenForStorage(raw.config.token)
    }
    hasDisk() ? window.electronAPI.settingsSet(raw) : localforage.setItem('settings', raw)
  }

  // 3. One-time Init
  const init = (async () => {
    const savedData = hasDisk() 
      ? (await window.electronAPI.settingsGet())?.settings 
      : await localforage.getItem('settings')

    if (savedData) {
      Object.assign(settings.config, savedData.config || {})
      Object.assign(settings.graph, savedData.graph || {})
      Object.assign(settings.meta, savedData.meta || {})

      Object.assign(settings.uiState.ui, savedData.uiState?.ui || {})
      Object.assign(settings.uiState.presets, savedData.uiState?.presets || {})
      Object.assign(settings.uiState.view, savedData.uiState?.view || {})
      Object.assign(settings.uiState.simulation, savedData.uiState?.simulation || {})

      // Backward-compat: migrate old sim* keys to the new names
      const sim = settings.uiState.simulation
      if (sim) {
        if (sim.repulsion === undefined && sim.simRepulsion !== undefined) sim.repulsion = sim.simRepulsion
        if (sim.linkStrength === undefined && sim.simLinkStrength !== undefined) sim.linkStrength = sim.simLinkStrength
        if (sim.linkDistance === undefined && sim.simLinkDistance !== undefined) sim.linkDistance = sim.simLinkDistance
        if (sim.friction === undefined && sim.simFriction !== undefined) sim.friction = sim.simFriction
        if (sim.groupGravity === undefined && sim.simGroupGravity !== undefined) sim.groupGravity = sim.simGroupGravity
        if (sim.centerGravity === undefined && sim.simCenterGravity !== undefined) sim.centerGravity = sim.simCenterGravity

        delete sim.simRepulsion
        delete sim.simLinkStrength
        delete sim.simLinkDistance
        delete sim.simFriction
        delete sim.simGroupGravity
        delete sim.simCenterGravity
      }

      const f = savedData.uiState?.filters
      if (f) {
        const { dateFilters, ...rest } = f
        Object.assign(settings.uiState.filters, rest)
        if (dateFilters) Object.assign(settings.uiState.filters.dateFilters, dateFilters)
      }

      // Obfuscation-at-rest: token is stored encoded but used in-memory as plain text.
      if (typeof savedData?.config?.token === 'string') {
        settings.config.token = decodeGitLabTokenFromStorage(savedData.config.token)
      }
    }

    // 4. ONLY start watching after load is complete.
    watch(settings, save, { deep: true })
    
    return settings
  })()

  return (_store = { settings, init: () => init })
}
