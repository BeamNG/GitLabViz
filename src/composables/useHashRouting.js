import { onMounted, onUnmounted, ref, watch } from 'vue'

export function useHashRouting ({ activePage, configInitialTab, kioskMode, mainLayout }) {
  // Hash routing (works for hosted + file://):
  // - (no hash)                                    -> main (graph layout, default view)
  // - #/list                                       -> main, list layout
  // - #/list/q=foo/group=author                    -> main, list + shared view
  // - #/graph/...                                  -> main, graph (explicit, equivalent to no prefix)
  // - #/group=author/color=priority/label=Bug      -> main + shared view (graph layout, implicit)
  // - #/config/gitlab
  // - #/config/display
  // - #/config                                     -> config (default tab)
  // - #/chattools
  // - #/kiosk                                      -> kiosk (default mode)
  // - #/kiosk/workload                             -> kiosk on a specific mode
  // - #/kiosk/today/paused=1/cycle=10              -> kiosk + mode + kv args (paused/cycle/refresh)
  // - #/flake                                      -> flake history view
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
    } else if (parts[0] === 'kiosk') {
      page = 'kiosk'
      if (parts[1] && !isKv(parts[1])) tab = String(parts[1])
      viewParts = parts.slice(tab ? 2 : 1).filter(isKv)
    } else if (parts[0] === 'flake') {
      page = 'flake'
      viewParts = parts.slice(1).filter(isKv)
    } else if (parts[0] === 'list' || parts[0] === 'graph') {
      // Main page with explicit layout. 'graph' is the default but accepted
      // explicitly so users can paste either form.
      page = 'main'
      tab = parts[0]
      viewParts = parts.slice(1).filter(isKv)
    } else {
      viewParts = parts.filter(isKv)
    }

    return { page, tab, view: viewParts.join('/') }
  }

  const buildHash = (page, tab, view) => {
    const p = page === 'config' ? 'config'
      : page === 'chattools' ? 'chattools'
      : page === 'kiosk' ? 'kiosk'
      : page === 'flake' ? 'flake'
      : 'main'
    const t = String(tab || '').trim()
    const v = String(view || '').trim()
    const vTail = v ? `/${v}` : ''
    if (p === 'main') {
      // Layout 'graph' is the default — left out of the URL to keep it lean.
      // Layout 'list' is emitted as the first segment so the URL reads as
      // `#/list/...` instead of `#/layout=list/...`.
      const layoutSeg = t === 'list' ? 'list' : ''
      if (layoutSeg) return `#/${layoutSeg}${vTail}`
      return v ? `#/${v}` : ''
    }
    if (p === 'config') return `#/config${t ? `/${encodeURIComponent(t)}` : ''}${vTail}`
    if (p === 'kiosk')  return `#/kiosk${t ? `/${encodeURIComponent(t)}` : ''}${vTail}`
    if (p === 'flake')  return `#/flake${vTail}`
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
      } else if (page === 'kiosk') {
        if (tab && kioskMode) kioskMode.value = tab
        activePage.value = 'kiosk'
      } else if (page === 'flake') {
        activePage.value = 'flake'
      } else {
        // Main page — `tab` is the layout ('graph' / 'list'). Only update the
        // ref when the URL carried an explicit segment; otherwise leave the
        // user's saved layout alone.
        if (tab && mainLayout && (tab === 'graph' || tab === 'list')) {
          mainLayout.value = tab
        }
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

  const tabForPage = (p) => {
    if (p === 'config') return configInitialTab.value
    if (p === 'kiosk') return kioskMode ? kioskMode.value : ''
    if (p === 'main') return mainLayout ? mainLayout.value : ''
    return ''
  }

  // Update only the shared-view part without changing page/tab; never grows history.
  const setView = (view) => {
    const v = String(view || '')
    if (v === viewParam.value) return
    viewParam.value = v
    setHash(activePage.value, tabForPage(activePage.value), { replace: true, view: v })
  }

  onMounted(() => {
    syncStateFromHash()
    window.addEventListener('hashchange', syncStateFromHash)

    watch(activePage, (p) => {
      if (isApplyingHash) return
      // Each page owns its own viewParam keyspace (main = share-codec keys like
      // q/group/…; kiosk = paused/cycle/refresh; config/chattools = none).
      // Carrying the old page's params into the new URL would either confuse
      // the new page's decoder or trigger spurious "Unknown URL key" warnings.
      viewParam.value = ''
      setHash(p, tabForPage(p), { replace: false })
    })
    watch(configInitialTab, (t) => {
      if (isApplyingHash) return
      if (activePage.value !== 'config') return
      setHash('config', t, { replace: true })
    })
    if (kioskMode) {
      watch(kioskMode, (t) => {
        if (isApplyingHash) return
        if (activePage.value !== 'kiosk') return
        setHash('kiosk', t, { replace: true })
      })
    }
    if (mainLayout) {
      watch(mainLayout, (t) => {
        if (isApplyingHash) return
        if (activePage.value !== 'main') return
        setHash('main', t, { replace: true })
      })
    }
  })

  onUnmounted(() => {
    window.removeEventListener('hashchange', syncStateFromHash)
  })

  return { syncStateFromHash, setHash, setView, viewParam }
}
