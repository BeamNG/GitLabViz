import { onMounted, onUnmounted } from 'vue'

// Single source of truth for keyboard shortcuts. Defaults live here; user overrides
// live in settings.uiState.hotkeys (auto-persisted by useSettingsStore).
export const HOTKEY_GROUPS = [
  { id: 'layout', label: 'Layout' },
  { id: 'graph',  label: 'Graph view' },
  { id: 'view',   label: 'View modes' },
  { id: 'app',    label: 'App' }
]

export const HOTKEY_ACTIONS = [
  { id: 'toggleSidebar',         label: 'Toggle sidebar',                       default: 'b',        group: 'layout' },
  { id: 'toggleFocus',           label: 'Focus mode (hide UI but graph)',       default: 'f',        group: 'layout' },
  { id: 'expandAllSections',     label: 'Expand all sidebar sections',          default: ']',        group: 'layout' },
  { id: 'collapseAllSections',   label: 'Collapse all sidebar sections',        default: '[',        group: 'layout' },
  { id: 'toggleLegend',          label: 'Hide / show legend',                   default: 'l',        group: 'layout' },
  { id: 'toggleLegendCollapse',  label: 'Collapse / expand legend',             default: 'shift+l',  group: 'layout' },

  { id: 'togglePhysics',         label: 'Pause / resume physics',               default: 'p',        group: 'graph' },
  { id: 'refocusGraph',          label: 'Recenter graph',                       default: 'r',        group: 'graph' },
  { id: 'fitGraph',              label: 'Fit graph to screen',                  default: 'shift+f',  group: 'graph' },
  { id: 'reflowGraph',           label: 'Reflow graph (restart physics)',       default: 'shift+r',  group: 'graph' },

  { id: 'toggleListView',        label: 'Toggle graph / list view',             default: 'shift+v',  group: 'view' },
  { id: 'cycleColorMode',        label: 'Cycle color mode',                     default: 'c',        group: 'view' },
  { id: 'cycleGrouping',         label: 'Cycle grouping mode',                  default: 'shift+c',  group: 'view' },
  { id: 'cycleLinkMode',         label: 'Cycle link mode',                      default: 'n',        group: 'view' },
  { id: 'toggleHideUnlinked',    label: 'Toggle "hide unlinked nodes"',         default: 'u',        group: 'view' },
  { id: 'resetFilters',          label: 'Reset filters',                        default: 'shift+x',  group: 'view' },

  { id: 'toggleTheme',           label: 'Cycle theme (light / dark / system)',  default: 't',        group: 'app' },
  { id: 'openConfig',            label: 'Open configuration',                   default: ',',        group: 'app' },
  { id: 'toggleKiosk',           label: 'Toggle kiosk dashboard',               default: 'shift+k',  group: 'app' },
  { id: 'showHotkeyHelp',        label: 'Show keyboard shortcuts',              default: '?',        group: 'app' }
]

// Returns groups with their items attached: [{ id, label, items: [...actions] }, ...]
export function groupedHotkeyActions() {
  return HOTKEY_GROUPS
    .map(g => ({ ...g, items: HOTKEY_ACTIONS.filter(a => a.group === g.id) }))
    .filter(g => g.items.length)
}

// Build "ctrl+shift+l", "?", "shift+f", etc. from a KeyboardEvent. For printable
// non-letter keys we trust event.key directly (so shift+/ on US layouts is "?")
// rather than producing "shift+/", because that's what users actually type.
export function getEventCombo(e) {
  if (!e || !e.key) return ''
  const parts = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.metaKey) parts.push('meta')
  if (e.altKey) parts.push('alt')
  let key = e.key
  if (key === ' ') key = 'space'
  if (key.length === 1) {
    if (/[a-z]/i.test(key)) {
      if (e.shiftKey) parts.push('shift')
      key = key.toLowerCase()
    }
  } else {
    if (e.shiftKey) parts.push('shift')
    key = key.toLowerCase()
  }
  parts.push(key)
  return parts.join('+')
}

const NAMED = {
  space: 'Space', escape: 'Esc', enter: 'Enter', tab: 'Tab', backspace: 'Backspace',
  delete: 'Del', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→'
}
export function formatCombo(combo) {
  if (!combo) return ''
  return combo.split('+').map(p => {
    if (p === 'ctrl') return 'Ctrl'
    if (p === 'meta') return 'Meta'
    if (p === 'alt') return 'Alt'
    if (p === 'shift') return 'Shift'
    if (NAMED[p]) return NAMED[p]
    return p.length === 1 ? p.toUpperCase() : (p.charAt(0).toUpperCase() + p.slice(1))
  }).join(' + ')
}

const isEditableTarget = (t) => {
  if (!t) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return !!t.isContentEditable
}

// Global keydown dispatcher. `getBindings()` returns the user override map,
// `handlers` maps action id → callback, `isEnabled()` gates dispatch globally.
export function useHotkeys({ getBindings, handlers, isEnabled }) {
  const onKey = (e) => {
    if (isEnabled && !isEnabled()) return
    if (isEditableTarget(e.target)) return
    const combo = getEventCombo(e)
    if (!combo || combo === 'ctrl' || combo === 'shift' || combo === 'alt' || combo === 'meta') return
    const bindings = (getBindings && getBindings()) || {}
    for (const action of HOTKEY_ACTIONS) {
      const binding = (bindings[action.id] || action.default || '').toLowerCase()
      if (!binding) continue
      if (binding === combo) {
        const fn = handlers[action.id]
        if (typeof fn === 'function') {
          e.preventDefault()
          fn()
        }
        return
      }
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}
