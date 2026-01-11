import { onMounted, onUnmounted, watch } from 'vue'

export function useHashRouting ({ activePage, configInitialTab }) {
  // Hash routing (works for hosted + file://):
  // Examples:
  // - (no hash)            -> main
  // - #/config/gitlab
  // - #/config/display
  // - #/config             -> config (default tab)
  // - #/chattools
  let isApplyingHash = false

  const parseHash = () => {
    const raw = String(window.location.hash || '')
    const h = raw.startsWith('#') ? raw.slice(1) : raw
    const [pathRaw] = h.split('?')
    const path = (pathRaw || '').replace(/^\/+/, '')
    const parts = path.split('/').filter(Boolean)

    const page = (parts[0] === 'config' || parts[0] === 'chattools') ? parts[0] : 'main'
    const tab = page === 'config' && parts[1] ? String(parts[1]).trim() : ''
    return { page, tab }
  }

  const syncStateFromHash = () => {
    const { page, tab } = parseHash()
    isApplyingHash = true
    try {
      if (page === 'config') {
        if (tab) configInitialTab.value = tab
        activePage.value = 'config'
      } else if (page === 'chattools') {
        activePage.value = 'chattools'
      } else {
        activePage.value = 'main'
      }
    } finally {
      isApplyingHash = false
    }

    // KISS: don't keep "#/main" in the URL.
    if (page === 'main') {
      const raw = String(window.location.hash || '')
      if (raw === '#/main' || raw === '#main' || raw === '#/') {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }

  const setHash = (page, tab, { replace } = {}) => {
    const p = page === 'config' ? 'config' : (page === 'chattools' ? 'chattools' : 'main')
    const t = String(tab || '').trim()
    if (p === 'main') {
      // Main view: no hash at all.
      const nextUrl = window.location.pathname + window.location.search
      if (replace) history.replaceState(null, '', nextUrl)
      else history.pushState(null, '', nextUrl)
      return
    }

    const next = p === 'config'
      ? `#/config${t ? `/${encodeURIComponent(t)}` : ''}`
      : `#/${p}`

    if (window.location.hash === next) return
    if (replace) history.replaceState(null, '', next)
    else window.location.hash = next
  }

  onMounted(() => {
    // Restore page/tab from hash (supports refresh + back/forward).
    syncStateFromHash()
    window.addEventListener('hashchange', syncStateFromHash)

    // Keep URL hash in sync with UI state.
    watch(activePage, (p) => {
      if (isApplyingHash) return
      setHash(p, configInitialTab.value, { replace: false })
    })
    watch(configInitialTab, (t) => {
      if (isApplyingHash) return
      if (activePage.value !== 'config') return
      // Tab switching shouldn't spam browser history.
      setHash('config', t, { replace: true })
    })
  })

  onUnmounted(() => {
    window.removeEventListener('hashchange', syncStateFromHash)
  })

  return { syncStateFromHash, setHash }
}

