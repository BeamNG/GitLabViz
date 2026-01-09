export const GLOBAL_PRESETS = [
  {
    name: 'Priorities',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "priority",
        grouping: "none",
        linkMode: "none"
      },
      simulation: {
        repulsion: 760,
        linkStrength: 0.4,
        linkDistance: 250,
        friction: 0.6,
        groupGravity: 0,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Blocking Issues',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [
          "0 - Blocking"
        ],
        types: []
      },
      view: {
        colorMode: "tag",
        grouping: "tag",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0,
        linkDistance: 330,
        friction: 0.3,
        groupGravity: 0.15,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'By me',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: ['@me'],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "timeline_updated",
        grouping: "none",
        linkMode: "none"
      },
      simulation: {
        gridStrength: 0
      }
    }
  },
  {
    name: 'Assigned to me',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: ['@me'],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "timeline_updated",
        grouping: "none",
        linkMode: "none"
      },
      simulation: {
        gridStrength: 0
      }
    }
  },
  {
    
    name: 'Links',
    config: {
      filters: {
        includeClosed: false,
        statuses: [],
        subscription: null,
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "priority",
        grouping: "none",
        linkMode: "dependency"
      },
      ui: {
        showFilters: true,
        showTemplates: true,
        showDisplay: true,
        showAdvancedSim: true
      },
      simulation: {
        repulsion: 1000,
        linkStrength: 0.1,
        linkDistance: 600,
        friction: 0.1,
        groupGravity: 0.09,
        centerGravity: 0.01,
        gridStrength: 0.02,
        gridSpacing: 1.5
      }
    }
  },
  {
    name: 'Labels',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "tag",
        grouping: "tag",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0,
        linkDistance: 50,
        friction: 0.3,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Authors',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "author",
        grouping: "author",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0.4,
        linkDistance: 50,
        friction: 0.3,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Assignees',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "assignee",
        grouping: "assignee",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0.4,
        linkDistance: 50,
        friction: 0.3,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Milestones',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "milestone",
        grouping: "milestone",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0.4,
        linkDistance: 50,
        friction: 0.3,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Issue Types',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: []
      },
      view: {
        colorMode: "type",
        grouping: "type",
        linkMode: "none"
      },
      simulation: {
        repulsion: 430,
        linkStrength: 0.4,
        linkDistance: 50,
        friction: 0.3,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'New Tickets (60d)',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "last_x_days",
          createdAfter: null,
          createdBefore: null,
          createdDays: 60,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "author",
        grouping: "author",
        linkMode: "none"
      },
      simulation: {
        repulsion: 760,
        linkStrength: 0.4,
        linkDistance: 250,
        friction: 0.6,
        groupGravity: 0.15,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Updated (30d)',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: 60,
          updatedMode: "last_x_days",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: 30,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "author",
        grouping: "author",
        linkMode: "none"
      },
      simulation: {
        repulsion: 760,
        linkStrength: 0.4,
        linkDistance: 250,
        friction: 0.6,
        groupGravity: 0.15,
        centerGravity: 0.04,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Ticket Age',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "last_updated",
        grouping: "stale",
        linkMode: "none"
      },
      simulation: {
        repulsion: 1000,
        linkStrength: 0.4,
        linkDistance: 80,
        friction: 0.25,
        groupGravity: 0.05,
        centerGravity: 0.1,
        gridStrength: 0
      }
    }
  },
  {
    name: 'timeline - created',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "timeline_created",
        grouping: "timeline_created",
        linkMode: "none"
      },
      ui: {
        showFilters: true,
        showTemplates: false,
        showDisplay: true,
        showAdvancedSim: true
      },
      simulation: {
        repulsion: 460,
        linkStrength: 0,
        linkDistance: 50,
        friction: 0.1,
        groupGravity: 0.11,
        centerGravity: 0.02,
        gridStrength: 0
      }
    }
  },
  {
    name: 'timeline - updated',
    config: {
      filters: {
        labels: [],
        excludedLabels: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "timeline_updated",
        grouping: "timeline_updated",
        linkMode: "none"
      },
      simulation: {
        repulsion: 460,
        linkStrength: 0,
        linkDistance: 50,
        friction: 0.1,
        groupGravity: 0.11,
        centerGravity: 0.02,
        gridStrength: 0
      }
    }
  },
  {
    name: 'Components',
    config: {
      filters: {
        includeClosed: false,
        statuses: [],
        subscription: null,
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "last_updated",
        grouping: "scoped:Component",
        linkMode: "none",
        issueOpenTarget: "GitlabVizIssueTab"
      },
      ui: {
        showFilters: true,
        showTemplates: true,
        showDisplay: true,
        showAdvancedSim: true
      },
      simulation: {
        repulsion: 760,
        linkStrength: 0,
        linkDistance: 250,
        friction: 0.25,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0,
        gridSpacing: 1.5
      }
    }
  },
  {
    name: 'epics',
    config: {
      filters: {
        includeClosed: false,
        statuses: [],
        subscription: null,
        labels: [],
        excludedLabels: [],
        authors: [],
        assignees: [],
        milestones: [],
        priorities: [],
        types: [],
        mrMode: null,
        participants: [],
        dueStatus: null,
        spentMode: null,
        budgetMode: null,
        estimateBucket: null,
        taskMode: null,
        dateFilters: {
          createdMode: "none",
          createdAfter: null,
          createdBefore: null,
          createdDays: null,
          updatedMode: "none",
          updatedAfter: null,
          updatedBefore: null,
          updatedDays: null,
          dueDateMode: "none",
          dueDateAfter: null,
          dueDateBefore: null,
          dueDateDays: null
        }
      },
      view: {
        colorMode: "last_updated",
        grouping: "epic",
        linkMode: "none",
        dueSoonDays: 7,
        issueOpenTarget: "GitlabVizIssueTab"
      },
      ui: {
        showFilters: true,
        showTemplates: true,
        showDisplay: true,
        showAdvancedSim: true
      },
      simulation: {
        repulsion: 760,
        linkStrength: 0,
        linkDistance: 250,
        friction: 0.25,
        groupGravity: 0.05,
        centerGravity: 0.04,
        gridStrength: 0,
        gridSpacing: 1.5
      }
    }
  }
]

