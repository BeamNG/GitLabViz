import { defineComponent, reactive, ref, computed, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSvnVizMode } from './useSvnVizMode'

describe('useSvnVizMode', () => {
  it('switching to svn mode builds a small svn graph and sets view defaults', async () => {
    const settings = reactive({
      uiState: { view: { viewMode: 'state', groupingMode: 'none', linkMode: 'dependency' } }
    })
    const nodes = reactive({})
    const edges = reactive({})
    const svnRecentCommits = ref([
      { revision: 1, author: 'alice', date: new Date().toISOString(), message: 'r1', paths: [] },
      { revision: 2, author: 'bob', date: new Date().toISOString(), message: 'r2', paths: [] }
    ])
    const canUseSvn = computed(() => true)
    const isElectron = computed(() => false)
    const activePage = ref('main')

    let api
    const Cmp = defineComponent({
      setup () {
        api = useSvnVizMode({ settings, nodes, edges, svnRecentCommits, canUseSvn, isElectron, activePage })
        return {}
      },
      template: '<div />'
    })
    mount(Cmp)

    api.vizMode.value = 'svn'
    await nextTick()

    expect(settings.uiState.view.viewMode).toBe('author')
    expect(settings.uiState.view.groupingMode).toBe('svn_revision')
    expect(settings.uiState.view.linkMode).toBe('none')

    expect(Object.keys(nodes).some(k => k.startsWith('svn-'))).toBe(true)
    expect(Object.keys(edges).some(k => k.includes('rev-svn-1-svn-2'))).toBe(true)
  })

  it('chattools mode navigates and snaps back', async () => {
    const settings = reactive({
      uiState: { view: { viewMode: 'state', groupingMode: 'none', linkMode: 'none' } }
    })
    const nodes = reactive({})
    const edges = reactive({})
    const svnRecentCommits = ref([])
    const canUseSvn = computed(() => true)
    const isElectron = computed(() => true)
    const activePage = ref('main')

    let api
    const Cmp = defineComponent({
      setup () {
        api = useSvnVizMode({ settings, nodes, edges, svnRecentCommits, canUseSvn, isElectron, activePage })
        return {}
      },
      template: '<div />'
    })
    mount(Cmp)

    api.vizMode.value = 'chattools'
    await nextTick()
    await nextTick()

    expect(activePage.value).toBe('chattools')
    expect(api.vizMode.value).toBe('issues')
  })
})

