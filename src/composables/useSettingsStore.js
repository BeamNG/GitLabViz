import { reactive, watch, toRaw } from 'vue'
import localforage from 'localforage'
import { defaultSettings } from '../defaultSettings'

let _store
const hasDisk = () => !!(window.electronAPI?.settingsGet && window.electronAPI?.settingsSet)

export function useSettingsStore() {
  if (_store) return _store

  // 1. Initialize with defaults immediately
  const settings = reactive(defaultSettings())
  
  // 2. Define Save Logic
  const save = () => {
    hasDisk() ? window.electronAPI.settingsSet(toRaw(settings)) : localforage.setItem('settings', toRaw(settings))
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
    }

    // 4. ONLY start watching after load is complete.
    watch(settings, save, { deep: true })
    
    return settings
  })()

  return (_store = { settings, init: () => init })
}
