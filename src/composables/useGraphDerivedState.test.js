import { reactive, nextTick } from 'vue'
import { useGraphDerivedState } from './useGraphDerivedState'

const baseSettings = () => reactive({
  meta: { gitlabMeName: '' },
  uiState: {
    filters: {
      includeClosed: true,
      selectedStatuses: [],
      selectedSubscription: null,
      selectedLabels: [],
      excludedLabels: [],
      selectedAuthors: [],
      selectedAssignees: [],
      selectedMilestones: [],
      selectedPriorities: [],
      selectedTypes: [],
      mrMode: null,
      selectedParticipants: [],
      dueStatus: null,
      spentMode: null,
      budgetMode: null,
      estimateBucket: null,
      taskMode: null,
      searchQuery: '',
      dateFilters: {
        createdMode: 'none',
        updatedMode: 'none',
        dueDateMode: 'none'
      }
    },
    view: {
      linkMode: 'none',
      groupingMode: 'none',
      dueSoonDays: 7,
      hideUnlinked: false
    }
  }
})

describe('useGraphDerivedState', () => {
  it('returns nodes directly when filters are effectively off', () => {
    const settings = baseSettings()
    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { state: 'opened', labels: [] } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(d.filteredNodes.value).toBe(nodes)
    expect(d.filteredEdges.value).toEqual({})
  })

  it('supports exact issue-id search', () => {
    const settings = baseSettings()
    settings.uiState.filters.searchQuery = '1'

    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { state: 'opened', title: 'A', labels: [] } },
      '12': { id: '12', type: 'gitlab_issue', _raw: { state: 'opened', title: 'B', labels: [] } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(Object.keys(d.filteredNodes.value)).toEqual(['1'])
  })

  it('builds group links when linkMode=group', () => {
    const settings = baseSettings()
    settings.uiState.view.linkMode = 'group'
    settings.uiState.view.groupingMode = 'assignee'

    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { assignee: { name: 'Alice' }, labels: [] } },
      '2': { id: '2', type: 'gitlab_issue', _raw: { assignee: { name: 'Alice' }, labels: [] } },
      '3': { id: '3', type: 'gitlab_issue', _raw: { assignee: { name: 'Bob' }, labels: [] } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    const keys = Object.keys(d.filteredEdges.value)
    expect(keys.some(k => k.includes('group-1-2'))).toBe(true)
  })

  it('derives label/author/assignee lists', () => {
    const settings = baseSettings()
    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { labels: ['A', 'B'], author: { name: 'Alice' }, assignee: { name: 'Bob' } } },
      '2': { id: '2', type: 'gitlab_issue', _raw: { labels: ['B'], author: { name: 'Alice' }, assignee: null } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(d.allLabels.value).toEqual(['A', 'B'])
    expect(d.allAuthors.value).toEqual(['Alice'])
    expect(d.allAssignees.value).toEqual(['Bob'])
  })

  it('enables hideUnlinked when switching into dependency mode', async () => {
    const settings = baseSettings()
    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { state: 'opened', labels: [] } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(d.filteredEdges.value).toEqual({})

    settings.uiState.view.linkMode = 'dependency'
    await nextTick()
    expect(settings.uiState.view.hideUnlinked).toBe(true)
  })

  it('respects includeClosed=false', () => {
    const settings = baseSettings()
    settings.uiState.filters.includeClosed = false
    // force filtering path
    settings.uiState.filters.selectedLabels = ['X']

    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { state: 'closed', labels: ['X'] } },
      '2': { id: '2', type: 'gitlab_issue', _raw: { state: 'opened', labels: ['X'] } }
    })
    const edges = reactive({})

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(Object.keys(d.filteredNodes.value)).toEqual(['2'])
  })

  it('dependency edges are filtered to visible nodes', () => {
    const settings = baseSettings()
    settings.uiState.view.linkMode = 'dependency'
    // force filtering path but still keep nodes visible
    settings.uiState.filters.selectedLabels = ['X']

    const nodes = reactive({
      '1': { id: '1', type: 'gitlab_issue', _raw: { state: 'opened', labels: ['X'] } },
      '2': { id: '2', type: 'gitlab_issue', _raw: { state: 'opened', labels: ['X'] } }
    })
    const edges = reactive({
      '1-2': { source: '1', target: '2' },
      '2-999': { source: '2', target: '999' }
    })

    const d = useGraphDerivedState({ settings, nodes, edges })
    expect(Object.keys(d.filteredEdges.value)).toEqual(['1-2'])
  })
})

