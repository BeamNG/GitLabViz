import { reactive, ref } from 'vue'
import { useGitLabIssueMutations } from './useGitLabIssueMutations'

vi.mock('../services/gitlab', () => {
  return {
    createGitLabClient: vi.fn(() => ({})),
    updateIssue: vi.fn(async () => ({ iid: 1, state: 'closed' }))
  }
})

describe('useGitLabIssueMutations', () => {
  it('blocks when token lacks write scope', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const settings = reactive({
      meta: { gitlabCanWrite: false },
      config: { enableGitLab: true, projectId: 'p', token: 't' }
    })
    const nodes = reactive({ '1': { id: '1', _raw: {} } })
    const issueGraph = ref({ markDataOnlyUpdate: vi.fn() })
    const snackbarText = ref('')
    const snackbar = ref(false)

    const api = useGitLabIssueMutations({
      settings,
      nodes,
      issueGraph,
      resolveGitLabApiBaseUrl: () => '/api',
      snackbarText,
      snackbar
    })

    await api.onIssueStateChange({ iid: 1, state_event: 'close' })
    expect(alertSpy).toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('updates node raw + snackbar on success (and preserves missing fields)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const settings = reactive({
      meta: { gitlabCanWrite: true },
      config: { enableGitLab: true, projectId: 'p', token: 't' }
    })
    const nodes = reactive({ '1': { id: '1', _raw: { epic: { title: 'KeepMe' } } } })
    const issueGraph = ref({ markDataOnlyUpdate: vi.fn() })
    const snackbarText = ref('')
    const snackbar = ref(false)

    const api = useGitLabIssueMutations({
      settings,
      nodes,
      issueGraph,
      resolveGitLabApiBaseUrl: () => '/api',
      snackbarText,
      snackbar
    })

    await api.onIssueStateChange({ iid: 1, state_event: 'close' })
    expect(nodes['1']._raw.epic?.title).toBe('KeepMe')
    expect(snackbar.value).toBe(true)
    expect(snackbarText.value).toContain('Closed')

    alertSpy.mockRestore()
  })

  it('updates assignee and shows snackbar', async () => {
    const settings = reactive({
      meta: { gitlabCanWrite: true },
      config: { enableGitLab: true, projectId: 'p', token: 't' }
    })
    const nodes = reactive({ '1': { id: '1', _raw: { assignees: [], assignee: null } } })
    const issueGraph = ref({ markDataOnlyUpdate: vi.fn() })
    const snackbarText = ref('')
    const snackbar = ref(false)

    const api = useGitLabIssueMutations({
      settings,
      nodes,
      issueGraph,
      resolveGitLabApiBaseUrl: () => '/api',
      snackbarText,
      snackbar
    })

    await api.onIssueAssigneeChange({ iid: 1, assignee_ids: [123] })
    expect(snackbar.value).toBe(true)
    expect(snackbarText.value).toContain('Assigned')
  })
})

