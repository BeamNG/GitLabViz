export const defaultSettings = () => ({
  config: {
    token: '',
    // GitLab base URL (host), e.g. https://gitlab.example.com
    // (the app will append /api/v4 automatically; in dev you can also use Vite proxy)
    // (leave empty and configure in-app; in dev you can also use Vite proxy)
    gitlabApiBaseUrl: '',
    projectId: '',
    enableGitLab: true,
    enableSvn: false,
    svnUsername: '',
    svnPassword: '',
    svnRepos: [{ id: 'default', url: '', enabled: true }],
    gitlabClosedDays: 180,

    // Flake history (optional). Project id/path + package name configured by
    // the user; URL + token reused from the GitLab fields above. Empty
    // projectId disables the view entirely (renders a not-configured panel
    // pointing at the docs).
    flakeHistory: {
      projectId: '',
      packageName: 'flake-history',
      refreshMinutes: 60,
      // Game install ROOT (e.g. D:\BeamNG.drive). The local results viewer is
      // derived as <root>/<viewerRelPath> and opened alongside an artifact
      // download from the Flake History heatmap. '' = feature off.
      gameInstallPath: '',
      // Viewer file, relative to gameInstallPath. Joined to the root, replacing
      // the whole default segment (e.g. 'graphic_viewer.html' opens
      // <root>/graphic_viewer.html). Empty falls back to the default below.
      viewerRelPath: 'game/test-viewer.html',
    },

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
      theme: 'system', // 'system' | 'dark' | 'light' | 'schedule'
      // Active when `theme === 'schedule'`: light theme between [lightStart..lightEnd)
      // local hours, dark otherwise. `lightStart === lightEnd` means always dark;
      // `lightStart > lightEnd` wraps midnight (e.g. 18..6 = "light overnight").
      themeSchedule: { lightStart: 7, lightEnd: 19 },
      currentTemplateName: '',
      focusMode: false, // hides sidebar + banners, leaving only the graph
      // How often to poll current_version.json and hard-reload when a newer build ships.
      // Reload only fires when a strictly newer version is detected, so short intervals
      // are safe (no churn on idle deploys). 0 = disabled.
      updateCheckMinutes: 120
    },
    hotkeys: {}, // action id -> combo string; empty = use built-in defaults
    kiosk: {
      refreshMinutes: 5,  // 0 disables auto-refresh
      cycleSeconds: 20,   // 0 disables auto-cycling (sticks on one mode)
      // Global "active" filter: count modes (workload / priority / status / type) exclude
      // open tickets idle longer than this many days. 0 = include everything.
      staleDays: 60,
      // Globally drop tickets whose effective status contains "Backlog" from count-based
      // modes (workload / priority / status / type / aging / risks). Milestones, today,
      // velocity and activity stay unfiltered since they represent historical / progress data.
      excludeBacklog: true,
      // Whitelist of priority buckets to include across ALL kiosk modes. Empty = include
      // all. Buckets: 'blocking' (Blocking/Critical), 'high', 'medium' (Medium/Normal),
      // 'low', 'other' (non-canonical labels), 'none' (no Priority:: label at all).
      priorityFilter: [],
      // Milestone title we're driving toward (free-form string matching `raw.milestone.title`).
      // Used by the 'target' focus mode and highlighted in the milestones list. Empty = no target.
      targetMilestone: '',
      // When true, the rich ETA breakdown (throughput grid, formula, timeline) is shown
      // inline below the chip on the Target screen instead of only on hover. Useful for
      // wall displays where the room can't hover.
      etaAlwaysExpanded: false,
      // Screen burn-in protection for always-on office displays.
      // `pixelShift`: nudge the whole kiosk by a few px every ~60s (imperceptible
      // to viewers but no single pixel stays the same colour for long).
      // `offHours`: outside `start..end` (24h, local), dim the screen to
      // `dim` brightness (0 = pure black, 1 = no dim). When `start === end`,
      // treated as 24h working — never dims. `start > end` wraps midnight
      // (e.g. start=22, end=6 means "on overnight").
      burnIn: {
        pixelShift: true,
        offHours: { enabled: false, start: 7, end: 21, dim: 0.05 }
      },
      modes: {
        target: true, burndown: true, blockers: true, wipStale: true,
        today: true, velocity: true,
        heatmap: true, heatmapByLabel: true,
        workload: true, breakdown: true, hotLabels: true,
        milestones: true, aging: true,
        activity: true, closed: true, leaderboard: true,
        risks: true, broken: true,
        // Opt-in: false by default so existing users don't suddenly see a
        // "Not configured" panel in their kiosk rotation. The flake settings
        // panel under the main app turns this on once a bundle is wired up.
        flake: false
      },
      // Per-mode tuning. Modes without an entry have no options yet.
      modeConfig: {
        velocity:   { weeks: 8 },
        workload:   { topN: 12, stackByPriority: true },
        // Combined breakdown screen — three blocks (priority / status / type)
        // share one config object. `showNo*` toggles whether the "(No X)" bucket is shown.
        breakdown:  { showNoPriority: true, showNoStatus: false, showNoType: false },
        milestones: { topN: 8 },
        burndown:   { windowDays: 90 },
        heatmap:    { days: 365 },
        heatmapByLabel: { days: 365, topN: 10, includeScoped: false },
        aging:      {},
        activity:   { limit: 22, includeUpdates: true },
        hotLabels:  { hours: 168, topN: 15, includeScoped: false },
        blockers:   { limit: 12, maxAgeDays: 0 },  // 0 = no upper bound; otherwise hide blockers older than this
        wipStale:   { days: 5, limit: 12 },         // tickets in "in progress" status idle > N days
        closed:     { hours: 48, limit: 18 },
        leaderboard: { topN: 5 },
        risks:      { staleListDays: 14, listLimit: 10 },
        broken:     { listLimit: 12, hideEmpty: true }
      }
    },
    presets: {
      custom: [] // [{ name, config }]
    },
    filters: {
      includeClosed: true,
      // Restrict to a single GitLab issue state. '' = no constraint (use
      // `includeClosed` as the open/closed gate). 'opened' / 'closed' = only
      // that state. Mainly populated by kiosk deep-clicks on the target stat
      // cards; resetFilters clears it.
      selectedState: '',
      selectedStatuses: [],
      selectedSubscription: null, // 'subscribed' | 'unsubscribed' | null
      selectedLabels: [],
      excludedLabels: [],
      selectedAuthors: [],
      selectedAssignees: [],
      selectedMilestones: [],
      selectedPriorities: [],
      selectedTypes: [],
      // Explicit iid whitelist. Mainly populated by kiosk deep-clicks on
      // categories that don't map to a clean predicate (e.g. Evergreen).
      // Empty = no constraint. `resetFilters` clears it.
      selectedIids: [],
      mrMode: null, // 'has' | 'none' | null
      selectedParticipants: [],
      dueStatus: null, // 'overdue' | 'soon' | 'later' | 'none' | null
      spentMode: null, // 'has' | 'none' | null
      budgetMode: null, // 'over' | 'within' | 'no_est' | null
      estimateBucket: null, // 'lt1h' | '1_4h' | '4_8h' | '1_3d' | '3dplus' | 'none' | null
      taskMode: null, // 'no_tasks' | 'none_done' | 'in_progress' | 'done' | null
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
      // Which way to render filtered tickets in the main view. 'graph' = the
      // force-directed issue graph (canvas). 'list' = a sortable data table.
      // Both use the same filteredNodes so switching is instant.
      layout: 'graph',
      // Persisted state of the list view's columns — order, hidden set, and
      // multi-sort spec. Owned by IssueList.vue via v-model:columnState.
      listColumns: {
        order: ['iid', 'title', 'state', 'status', 'priority', 'type', 'assignees', 'milestone', 'dueDate', 'updatedAt', 'createdAt', 'author', 'labels', 'comments', 'weight', 'epic', 'iteration', 'timeEstimate', 'timeSpent', 'closedAt'],
        hidden: ['author', 'labels', 'comments', 'weight', 'epic', 'iteration', 'timeEstimate', 'timeSpent', 'closedAt'],
        widths: {},
        sortBy: [{ key: 'updatedAt', order: 'desc' }],
        // Collapsed group values (`_group` keys from IssueList) — persisted so
        // the URL can carry the open/close state of a grouped table.
        closedGroups: []
      },
      viewMode: 'state',
      groupingMode: 'none',
      linkMode: 'none',
      hideUnlinked: true,
      // When grouping/coloring by assignee, duplicate multi-assignee tickets across each assignee's group.
      // Off = ticket appears only in the first assignee's group/color (legacy/cheaper).
      cloneMultiAssignee: true,
      legendSort: 'name', // 'name' | 'count'
      legendCollapsed: false,
      legendHidden: false,
      showGroupLabels: true,
      dueSoonDays: 7,
      issueOpenTarget: '_blank', // '_blank' | '_self' | 'GitlabVizIssueTab'
      listRowClickAction: 'open', // 'open' (single-click opens ticket) | 'select' (single-click selects, dbl-click opens)
      // Optional per-mode color overrides (persisted in presets):
      // { priority: { '1 - High': '#66bb6a', ... } }
      colorOverrides: {}
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
    gitlabTokenExpiresAt: null, // ISO date string from /personal_access_tokens/self, or null
    gitlabCanWrite: false, // derived from scopes (true when 'api' is present)
    lastUpdated: null,
    lastSyncClosedDays: null, // the gitlabClosedDays value that was used for the most recent successful sync — change ⇒ force full
    closedDaysDefaultBumped: false // one-time migration flag (0.11.3) — bumps users still on the 7d default to 180d
  }
})

