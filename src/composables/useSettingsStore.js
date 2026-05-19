import { reactive, watch, toRaw } from 'vue'
import localforage from 'localforage'
import { defaultSettings } from '../defaultSettings'
import { encodeGitLabTokenForStorage, decodeGitLabTokenFromStorage } from '../utils/tokenObfuscation'

let _store
const hasDisk = () => !!(window.electronAPI?.settingsGet && window.electronAPI?.settingsSet)

export function useSettingsStore() {
  if (_store) return _store

  // 1. Initialize with defaults immediately
  const settings = reactive(defaultSettings())
  
  // 2. Define Save Logic
  const save = () => {
    // IMPORTANT: do not mutate the in-memory reactive settings when encoding for storage.
    // toRaw(settings) returns the underlying object; changing it would change live state.
    const src = toRaw(settings)
    let snapshot
    try {
      snapshot = structuredClone(src)
    } catch {
      snapshot = JSON.parse(JSON.stringify(src))
    }

    if (snapshot && snapshot.config && typeof snapshot.config.token === 'string') {
      // Store token obfuscated under a dedicated key; do not keep plain token on disk.
      snapshot.config.tokenObfuscated = encodeGitLabTokenForStorage(snapshot.config.token)
      delete snapshot.config.token
    }
    hasDisk() ? window.electronAPI.settingsSet(snapshot) : localforage.setItem('settings', snapshot)
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

      // One-time migration: the default for `gitlabClosedDays` changed from 7 → 180
      // in 0.11.3. Existing users still sitting on the old default get a one-off bump
      // (anything they explicitly chose, even 7-day, is preserved after the flag is set).
      // The watcher in useDataLoader will see the change and trigger a full re-sync on
      // the next refresh so the newly-included history actually arrives.
      if (!settings.meta.closedDaysDefaultBumped && settings.config.gitlabClosedDays === 7) {
        settings.config.gitlabClosedDays = 180
      }
      settings.meta.closedDaysDefaultBumped = true

      Object.assign(settings.uiState.ui, savedData.uiState?.ui || {})
      Object.assign(settings.uiState.presets, savedData.uiState?.presets || {})
      Object.assign(settings.uiState.view, savedData.uiState?.view || {})
      // Sanitize view.layout — old builds with a 3-button v-btn-toggle could
      // persist a numeric index (e.g. 2) instead of 'graph'/'list', which then
      // triggers Vue String-prop warnings downstream.
      if (settings.uiState.view.layout !== 'list') settings.uiState.view.layout = 'graph'
      Object.assign(settings.uiState.simulation, savedData.uiState?.simulation || {})
      Object.assign(settings.uiState.hotkeys, savedData.uiState?.hotkeys || {})
      const k = savedData.uiState?.kiosk
      if (k) {
        if (typeof k.refreshMinutes === 'number') settings.uiState.kiosk.refreshMinutes = k.refreshMinutes
        if (typeof k.cycleSeconds === 'number') settings.uiState.kiosk.cycleSeconds = k.cycleSeconds
        // Backward compat: workloadIdleDays (per-mode in 0.5.x) → staleDays (global in 0.7.x).
        if (typeof k.staleDays === 'number') settings.uiState.kiosk.staleDays = k.staleDays
        else if (typeof k.workloadIdleDays === 'number') settings.uiState.kiosk.staleDays = k.workloadIdleDays
        if (typeof k.excludeBacklog === 'boolean') settings.uiState.kiosk.excludeBacklog = k.excludeBacklog
        if (Array.isArray(k.priorityFilter)) settings.uiState.kiosk.priorityFilter = k.priorityFilter.slice()
        if (typeof k.targetMilestone === 'string') settings.uiState.kiosk.targetMilestone = k.targetMilestone
        if (typeof k.etaAlwaysExpanded === 'boolean') settings.uiState.kiosk.etaAlwaysExpanded = k.etaAlwaysExpanded
        if (k.burnIn && typeof k.burnIn === 'object') {
          if (typeof k.burnIn.pixelShift === 'boolean') settings.uiState.kiosk.burnIn.pixelShift = k.burnIn.pixelShift
          if (k.burnIn.offHours && typeof k.burnIn.offHours === 'object') {
            Object.assign(settings.uiState.kiosk.burnIn.offHours, k.burnIn.offHours)
          }
        }
        if (k.modes && typeof k.modes === 'object') {
          Object.assign(settings.uiState.kiosk.modes, k.modes)
          // Backward compat: heatmapCreated / heatmapClosed / heatmapAll were merged
          // into a single `heatmap` mode in 0.11.6. If the user had any of the legacy
          // ones enabled, enable the new combined mode too.
          if (k.modes.heatmapCreated || k.modes.heatmapClosed || k.modes.heatmapAll) {
            settings.uiState.kiosk.modes.heatmap = true
          }
          // 0.12.4: priority / status / type were merged into a single `breakdown`
          // screen. Enable the combined mode if any legacy one was on, disable the
          // legacy keys so the modes list doesn't carry them forward.
          if (k.modes.priority || k.modes.status || k.modes.type) {
            settings.uiState.kiosk.modes.breakdown = true
          }
          delete settings.uiState.kiosk.modes.priority
          delete settings.uiState.kiosk.modes.status
          delete settings.uiState.kiosk.modes.type
          // 0.12.13: burnup → burndown rename — mirror the enable flag, drop legacy.
          if (typeof k.modes.burnup === 'boolean') {
            settings.uiState.kiosk.modes.burndown = k.modes.burnup
          }
          delete settings.uiState.kiosk.modes.burnup
        }
        if (k.modeConfig && typeof k.modeConfig === 'object') {
          for (const id of Object.keys(settings.uiState.kiosk.modeConfig)) {
            if (k.modeConfig[id] && typeof k.modeConfig[id] === 'object') {
              Object.assign(settings.uiState.kiosk.modeConfig[id], k.modeConfig[id])
            }
          }
          // Carry the legacy per-mode showNo* flags into the merged breakdown config.
          const legacy = k.modeConfig
          const b = settings.uiState.kiosk.modeConfig.breakdown
          if (legacy.priority && typeof legacy.priority.showNoPriority === 'boolean') b.showNoPriority = legacy.priority.showNoPriority
          if (legacy.status   && typeof legacy.status.showNoStatus     === 'boolean') b.showNoStatus   = legacy.status.showNoStatus
          if (legacy.type     && typeof legacy.type.showNoType         === 'boolean') b.showNoType     = legacy.type.showNoType
          // 0.12.9: velocity switched from a days-window bar chart to a weeks-window
          // heatmap. Convert any preexisting `velocity.days` to a rough weeks count
          // (clamped 1..12) so the migrated kiosk lands on a sensible weeks value.
          const v = settings.uiState.kiosk.modeConfig.velocity
          if (legacy.velocity && typeof legacy.velocity.days === 'number' && typeof v.weeks !== 'number') {
            v.weeks = Math.min(12, Math.max(1, Math.round(legacy.velocity.days / 7)))
          }
          delete v.days
          // 0.12.13: burnup → burndown rename. Carry the windowDays setting over,
          // mirror the mode enable/disable, then strip the legacy keys so they
          // don't linger in storage.
          if (legacy.burnup && typeof legacy.burnup === 'object') {
            Object.assign(settings.uiState.kiosk.modeConfig.burndown, legacy.burnup)
          }
          delete settings.uiState.kiosk.modeConfig.burnup
          // 0.12.10: Hot labels default bumped from 24h → 168h (1 week). Existing
          // users still sitting on the old 24h default get bumped once; explicit
          // choices (anything else) are preserved.
          if (!settings.meta.hotLabelsDefaultBumped && settings.uiState.kiosk.modeConfig.hotLabels.hours === 24) {
            settings.uiState.kiosk.modeConfig.hotLabels.hours = 168
          }
          settings.meta.hotLabelsDefaultBumped = true
        }
      }

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
      const storedToken = (savedData?.config && typeof savedData.config.tokenObfuscated === 'string')
        ? savedData.config.tokenObfuscated
        : (savedData?.config && typeof savedData.config.token === 'string' ? savedData.config.token : '')
      if (storedToken) settings.config.token = decodeGitLabTokenFromStorage(storedToken)
    }

    // 4. ONLY start watching after load is complete.
    watch(settings, save, { deep: true })
    
    return settings
  })()

  return (_store = { settings, init: () => init })
}
