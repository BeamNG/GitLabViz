import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useHashRouting } from './useHashRouting'

describe('useHashRouting', () => {
  it('syncs config page/tab from hash on mount', async () => {
    window.location.hash = '#/config/gitlab'

    const activePage = ref('main')
    const configInitialTab = ref('display')

    const Cmp = defineComponent({
      setup () {
        useHashRouting({ activePage, configInitialTab })
        return { activePage, configInitialTab }
      },
      template: '<div />'
    })

    mount(Cmp)
    await nextTick()

    expect(activePage.value).toBe('config')
    expect(configInitialTab.value).toBe('gitlab')
  })

  it('cleans #/main hashes via replaceState', async () => {
    const replaceSpy = vi.spyOn(history, 'replaceState')
    window.location.hash = '#/main'

    const activePage = ref('main')
    const configInitialTab = ref('gitlab')

    const Cmp = defineComponent({
      setup () {
        useHashRouting({ activePage, configInitialTab })
        return {}
      },
      template: '<div />'
    })

    mount(Cmp)
    await nextTick()

    expect(replaceSpy).toHaveBeenCalled()
    replaceSpy.mockRestore()
  })
})

