import { mount } from '@vue/test-utils'
import AppSidebar from './AppSidebar.vue'

describe('AppSidebar', () => {
  it('emits v-model updates via internal proxies and calls handlers', async () => {
    const settings = {
      uiState: {
        ui: {
          isDrawerExpanded: true,
          showTemplates: false,
          currentTemplateName: ''
        }
      }
    }

    const onOpenChangelog = vi.fn()

    const wrapper = mount(AppSidebar, {
      props: {
        settings,
        buildTitle: 't',
        appVersion: '1.0.0',
        physicsPaused: false,
        loading: false,
        loadingMessage: '',
        isDataStale: false,
        canUseSvn: false,
        isElectron: false,
        vizModeOptions: [{ title: 'Git tickets', value: 'issues' }],
        vizMode: 'issues',
        svnVizLimit: 2000,
        GLOBAL_PRESETS: [],
        customPresets: [],
        allLabels: [],
        allAuthors: [],
        allAssignees: [],
        allParticipants: [],
        userStateByName: {},
        meName: '',
        allMilestones: [],
        allPriorities: [],
        allTypes: [],
        dateFilterModes: [],
        groupingModeOptions: [],
        viewModeOptions: [],
        linkModeOptions: [],
        svnRecentCommits: [],
        svnCommitCountLabel: 0,
        hasData: false,
        statsText: '',
        dataAge: null,
        lastUpdatedDate: '',
        groupStatsText: null,
        onTogglePhysics: vi.fn(),
        onOpenConfig: vi.fn(),
        onOpenChangelog,
        onRefreshClick: vi.fn(),
        onCreatePreset: vi.fn(),
        onApplyPreset: vi.fn(),
        onRefocusGraph: vi.fn(),
        onFitGraph: vi.fn(),
        onReflowGraph: vi.fn(),
        onResetFilters: vi.fn(),
        onShowSvnLog: vi.fn()
      },
      global: {
        stubs: {
          'v-navigation-drawer': { template: '<div><slot /></div>' },
          'v-icon': { template: '<i />' },
          'v-select': { template: '<select />' },
          'v-btn': { template: `<button @click="$emit('click', $event)"><slot /></button>` },
          'v-tooltip': { template: '<div><slot name="activator" :props="{}" /></div>' },
          'v-divider': { template: '<hr />' },
          'v-expand-transition': { template: '<div><slot /></div>' },
          'v-chip': { template: '<span><slot /></span>' },
          SidebarFilterControls: { template: '<div />' },
          SidebarSimulationControls: { template: '<div />' }
        }
      }
    })

    // script-setup exposed computeds
    wrapper.vm.vizModeProxy = 'svn'
    wrapper.vm.svnVizLimitProxy = 3000

    expect(wrapper.emitted('update:vizMode')?.[0]).toEqual(['svn'])
    expect(wrapper.emitted('update:svnVizLimit')?.[0]).toEqual([3000])

    await wrapper.find('.app-version').trigger('click')
    expect(onOpenChangelog).toHaveBeenCalled()
  })
})

