export const defaultSettings = () => ({
  config: {
    token: '',
    // GitLab base URL (host), e.g. https://gitlab.example.com
    // (the app will append /api/v4 automatically; in dev you can also use Vite proxy)
    // (leave empty and configure in-app; in dev you can also use Vite proxy)
    gitlabApiBaseUrl: '',
    projectId: 'group/project',
    enableGitLab: true,
    enableSvn: false,
    svnUsername: '',
    svnPassword: '',
    svnRepos: [{ id: 'default', url: '', enabled: true }],
    gitlabClosedDays: 0,

    // ChatTools (Mattermost) assimilation
    mattermostUrl: '',
    mattermostToken: '',
    mattermostUser: null,
    mattermostTools: {
      saved_posts: {},
      highlights: {
        days: 7,
        search_keywords: 'VR',
        use_notification_keywords: true,
        ignore_muted: true
      },
      unanswered: {
        search_days: 3,
        unanswered_hours: 24,
        exclude_channels: '',
        ignore_texts: '" left the channel.", " joined the channel.", " added to the channel by "',
        ignore_muted: true,
        ignore_threads_with_me: false,
        show_threads_without_answer: true,
        show_threads_without_me: false,
        ai_model: ''
      },
      thread_checker: {
        search_days: 7,
        time_limit_minutes: 5,
        exclude_channels: '',
        ignore_muted: true
      },
      thread_summary: {
        thread_url: '',
        model: ''
      },
      statistics: {
        days: 7,
        exclude_channels: '',
        ignore_muted: true
      },
      team_progress: {
        days: 7,
        repo_git: '',
        repo_svn: '',
        git_commit_url_template: '',
        svn_rev_url_template: '',
        view: 'summary',
        members: [
          { id: 'alice', display: 'Alice', mattermost: 'alice', git: 'Alice', svn: 'Alice' },
          { id: 'bob', display: 'Bob', mattermost: 'bob', git: 'Bob', svn: 'Bob' }
        ]
      }
    }
  },
  uiState: {
    ui: {
      isDrawerExpanded: true,
      showFilters: true,
      showTemplates: true,
      showDisplay: true,
      showAdvancedSim: false,
      theme: 'system', // 'system' | 'dark' | 'light'
      currentTemplateName: ''
    },
    presets: {
      custom: [] // [{ name, config }]
    },
    filters: {
      includeClosed: true,
      selectedStatuses: [],
      selectedSubscription: null, // 'subscribed' | 'unsubscribed' | null
      selectedLabels: [],
      excludedLabels: [],
      selectedAuthors: [],
      selectedAssignees: [],
      selectedMilestones: [],
      selectedPriorities: [],
      selectedTypes: [],
      searchQuery: '',
      dateFilters: {
        createdMode: 'none',
        createdAfter: null,
        createdBefore: null,
        createdDays: null,
        updatedMode: 'none',
        updatedAfter: null,
        updatedBefore: null,
        updatedDays: null,
        dueDateMode: 'none',
        dueDateAfter: null,
        dueDateBefore: null,
        dueDateDays: null
      }
    },
    view: {
      viewMode: 'state',
      groupingMode: 'none',
      linkMode: 'none',
      hideUnlinked: true,
      legendSort: 'name', // 'name' | 'count'
      issueOpenTarget: '_blank' // '_blank' | '_self' | 'GitlabVizIssueTab'
    },
    simulation: {
      repulsion: 300,
      linkStrength: 0.5,
      linkDistance: 250,
      friction: 0.6,
      groupGravity: 0.2,
      centerGravity: 0.01,
      gridStrength: 0,
      gridSpacing: 1.5
    }
  },
  graph: {
    transform: null, // {k,x,y}
    lastOpenedNodeId: null
  },
  meta: {
    gitlabMeName: '',
    gitlabMeId: null, // numeric GitLab user id (for "assign to me")
    gitlabTokenScopes: null, // null = unknown/unverified, otherwise array of scopes (e.g. ['read_api', 'api'])
    gitlabCanWrite: false, // derived from scopes (true when 'api' is present)
    lastUpdated: null
  }
})

