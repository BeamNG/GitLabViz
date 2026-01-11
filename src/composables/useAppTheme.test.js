import { defineComponent, reactive, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useAppTheme } from './useAppTheme'

describe('useAppTheme', () => {
  it('applies theme and reacts to settings changes', async () => {
    const mqlListeners = []
    const prevMatchMedia = window.matchMedia
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: (evt, cb) => {
        if (evt === 'change') mqlListeners.push(cb)
      },
      removeEventListener: () => {}
    }))

    const settings = reactive({
      uiState: {
        ui: {
          theme: 'light'
        }
      }
    })

    const themeName = ref('light')
    // Vuetify shape: vuetifyTheme.global.name is a ref<string>
    const vuetifyTheme = { global: { name: themeName } }

    const Cmp = defineComponent({
      setup () {
        useAppTheme({ settings, vuetifyTheme })
        return { settings }
      },
      template: '<div />'
    })

    mount(Cmp)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(themeName.value).toBe('light')

    settings.uiState.ui.theme = 'dark'
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeName.value).toBe('dark')

    settings.uiState.ui.theme = 'system'
    await nextTick()
    // simulate OS switching to dark
    mqlListeners.forEach(cb => cb({ matches: true }))
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')

    window.matchMedia = prevMatchMedia
  })
})

