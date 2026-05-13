import { onMounted, onUnmounted, ref, watch } from 'vue'

export function useHashRouting ({ activePage, configInitialTab }) {
  // Hash routing (works for hosted + file://):
  // - (no hash)                                    -> main, default view
  // - #/group=author/color=priority/label=Bug      -> main + shared view (key=value segments)
  // - #/config/gitlab
  // - #/config/display
  // - #/config                                     -> config (default tab)
  // - #/chattools
  let isApplyingHash = false
  // Raw "key=value/key=value" portion that follows the page on main view (or trailing on other pages).
  const viewParam = ref('')

  // A segment is treated as a view kv when it contains '='. Pages (config/chattools) use slash paths
  // and tab names don't contain '=', so the split is unambiguous.
  const isKv = (seg) => typeof seg === 'string' && seg.includes('=')

  const parseHash = () => {
    const raw = String(window.location.hash || '')
    const h = raw.startsWith('#') ? raw.slice(1) : raw
    const path = h.replace(/^\/+/, '')
    const parts = path.split('/').filter(Boolean)

    let page = 'main'
    let tab = ''
    let viewParts = []

    if (parts[0] === 'config') {
      page = 'config'
      if (parts[1] && !isKv(parts[1])) tab = String(parts[1])
      viewParts = parts.slice(tab ? 2 : 1).filter(isKv)
    } else if (parts[0] === 'chattools') {
      page = 'chattools'
      viewParts = parts.slice(1).filter(isKv)
    } else {
      viewParts = parts.filter(isKv)
    }

    return { page, tab, view: viewParts.join('/') }
  }

  const buildHash = (page, tab, view) => {
    const p = page === 'config' ? 'config' : (page === 'chattools' ? 'chattools' : 'main')
    const t = String(tab || '').trim()
    const v = String(view || '').trim()
    const vTail = v ? `/${v}` : ''
    if (p === 'main') return v ? `#/${v}` : ''
    if (p === 'config') return `#/config${t ? `/${encodeURIComponent(t)}` : ''}${vTail}`
    return `#/${p}${vTail}`
  }

  const syncStateFromHash = () => {
    const { page, tab, view } = parseHash()
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
      viewParam.value = view
    } finally {
      isApplyingHash = false
    }

    // Strip an empty "#/main" hash if it somehow got there.
    if (page === 'main' && !view) {
      const raw = String(window.location.hash || '')
      if (raw === '#/main' || raw === '#main' || raw === '#/') {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }

  const setHash = (page, tab, { replace, view } = {}) => {
    const v = view != null ? String(view) : viewParam.value
    const next = buildHash(page, tab, v)

    if (page === 'main' && !next) {
      const url = window.location.pathname + window.location.search
      if (window.location.hash) {
        if (replace) history.replaceState(null, '', url)
        else history.pushState(null, '', url)
      }
      return
    }

    if (window.location.hash === next) return
    if (replace) history.replaceState(null, '', next)
    else window.location.hash = next
  }

  // Update only the shared-view part without changing page/tab; never grows history.
  const setView = (view) => {
    const v = String(view || '')
    if (v === viewParam.value) return
    viewParam.value = v
    setHash(activePage.value, configInitialTab.value, { replace: true, view: v })
  }

  onMounted(() => {
    syncStateFromHash()
    window.addEventListener('hashchange', syncStateFromHash)

    watch(activePage, (p) => {
      if (isApplyingHash) return
      setHash(p, configInitialTab.value, { replace: false })
    })
    watch(configInitialTab, (t) => {
      if (isApplyingHash) return
      if (activePage.value !== 'config') return
      setHash('config', t, { replace: true })
    })
  })

  onUnmounted(() => {
    window.removeEventListener('hashchange', syncStateFromHash)
  })

  return { syncStateFromHash, setHash, setView, viewParam }
}
