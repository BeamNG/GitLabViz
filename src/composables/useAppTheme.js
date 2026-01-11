import { ref, watch, onMounted, onUnmounted } from 'vue'

export function useAppTheme ({ settings, vuetifyTheme }) {
  const systemPrefersDark = ref(false)
  let systemMql = null
  let onMqlChange = null

  const getEffectiveThemeName = () => {
    const pref = (settings.uiState && settings.uiState.ui && settings.uiState.ui.theme)
      ? settings.uiState.ui.theme
      : 'system'
    if (pref === 'dark') return 'dark'
    if (pref === 'light') return 'light'
    return systemPrefersDark.value ? 'dark' : 'light'
  }

  const applyTheme = () => {
    const name = getEffectiveThemeName()
    if (vuetifyTheme && typeof vuetifyTheme.change === 'function') vuetifyTheme.change(name)
    else vuetifyTheme.global.name.value = name
    document.documentElement.dataset.theme = name
    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme: name } }))
  }

  onMounted(() => {
    systemMql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    systemPrefersDark.value = !!(systemMql && systemMql.matches)

    if (systemMql && systemMql.addEventListener) {
      onMqlChange = (e) => { systemPrefersDark.value = !!e.matches }
      systemMql.addEventListener('change', onMqlChange)
    }

    applyTheme()
    watch(() => settings.uiState.ui.theme, () => applyTheme())
    watch(systemPrefersDark, () => applyTheme())
  })

  onUnmounted(() => {
    try {
      if (systemMql && onMqlChange && systemMql.removeEventListener) {
        systemMql.removeEventListener('change', onMqlChange)
      }
    } catch {}
    systemMql = null
    onMqlChange = null
  })

  return { systemPrefersDark, getEffectiveThemeName, applyTheme }
}

