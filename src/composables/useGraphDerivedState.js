import { computed, watch } from 'vue'
import { getScopedLabelValue, getScopedLabelValues } from '../utils/scopedLabels'

export function useGraphDerivedState ({ settings, nodes, edges }) {
  const allLabels = computed(() => {
    const labels = new Set()
    Object.values(nodes).forEach(node => {
      if (node._raw.labels) {
        node._raw.labels.forEach(l => labels.add(l))
      }
    })
    return Array.from(labels).sort()
  })

  const allAuthors = computed(() => {
    const authors = new Set()
    Object.values(nodes).forEach(node => {
      const name = node._raw.author?.name
      if (name) authors.add(name)
    })
    return Array.from(authors).sort()
  })

  const allAssignees = computed(() => {
    const assignees = new Set()
    Object.values(nodes).forEach(node => {
      if (node._raw.assignee) {
        assignees.add(node._raw.assignee.name)
      }
    })
    return Array.from(assignees).sort()
  })

  const allParticipants = computed(() => {
    const people = new Set()
    Object.values(nodes).forEach(node => {
      const raw = node?._raw || {}
      const parts = Array.isArray(raw.participants) ? raw.participants : []
      parts.forEach(p => {
        const n = p?.name || p?.username
        if (n) people.add(n)
      })
      if (raw.author?.name) people.add(raw.author.name)
      if (raw.assignee?.name) people.add(raw.assignee.name)
      if (Array.isArray(raw.assignees)) {
        raw.assignees.forEach(a => {
          if (a?.name) people.add(a.name)
        })
      }
    })
    return Array.from(people).sort()
  })

  const userStateByName = computed(() => {
    const map = {}
    const setState = (name, state) => {
      const n = String(name || '').trim()
      if (!n) return
      const s = String(state || '').trim().toLowerCase()
      if (!s) return
      // prefer non-active if we see it anywhere
      const prev = map[n]
      if (!prev || prev === 'active') map[n] = s
    }

    Object.values(nodes).forEach(node => {
      const raw = node?._raw || {}
      if (raw.author?.name) setState(raw.author.name, raw.author.state)
      if (raw.assignee?.name) setState(raw.assignee.name, raw.assignee.state)
      if (Array.isArray(raw.assignees)) {
        raw.assignees.forEach(a => setState(a?.name, a?.state))
      }
      if (Array.isArray(raw.participants)) {
        raw.participants.forEach(p => setState(p?.name || p?.username, p?.state))
      }
    })

    return map
  })

  const allMilestones = computed(() => {
    const milestones = new Set()
    Object.values(nodes).forEach(node => {
      if (node._raw.milestone) {
        milestones.add(node._raw.milestone.title)
      }
    })
    return Array.from(milestones).sort()
  })

  const allPriorities = computed(() => {
    const priorities = new Set()
    Object.values(nodes).forEach(node => {
      const p = getScopedLabelValue(node._raw.labels, 'Priority')
      if (p) priorities.add(p)
    })
    return Array.from(priorities).sort()
  })

  const allTypes = computed(() => {
    const types = new Set()
    Object.values(nodes).forEach(node => {
      const t = getScopedLabelValue(node._raw.labels, 'Type')
      if (t) types.add(t)
    })
    return Array.from(types).sort()
  })

  const filteredNodes = computed(() => {
    if (settings.uiState.filters.selectedLabels?.length === 0 &&
        settings.uiState.filters.excludedLabels?.length === 0 &&
        settings.uiState.filters.selectedAuthors?.length === 0 &&
        (settings.uiState.filters.selectedAssignees?.length || 0) === 0 &&
        (settings.uiState.filters.selectedMilestones?.length || 0) === 0 &&
        (settings.uiState.filters.selectedPriorities?.length || 0) === 0 &&
        (settings.uiState.filters.selectedTypes?.length || 0) === 0 &&
        (settings.uiState.filters.selectedStatuses?.length || 0) === 0 &&
        !settings.uiState.filters.selectedSubscription &&
        !settings.uiState.filters.mrMode &&
        (settings.uiState.filters.selectedParticipants?.length || 0) === 0 &&
        !settings.uiState.filters.dueStatus &&
        !settings.uiState.filters.spentMode &&
        !settings.uiState.filters.budgetMode &&
        !settings.uiState.filters.estimateBucket &&
        !settings.uiState.filters.taskMode &&
        settings.uiState.filters.includeClosed &&
        !settings.uiState.filters.searchQuery &&
        settings.uiState.filters.dateFilters.createdMode === 'none' &&
        settings.uiState.filters.dateFilters.updatedMode === 'none' &&
        settings.uiState.filters.dateFilters.dueDateMode === 'none'
    ) return nodes

    const result = {}
    const stateMap = userStateByName.value || {}
    Object.values(nodes).forEach(node => {
      const nodeLabels = node._raw.labels || []
      const meName = settings.meta.gitlabMeName || ''
      const authorName = node._raw.author ? node._raw.author.name : null
      const assigneeName = node._raw.assignee ? node._raw.assignee.name : null
      const milestoneTitle = node._raw.milestone ? node._raw.milestone.title : null
      const priority = getScopedLabelValue(nodeLabels, 'Priority')
      const type = getScopedLabelValue(nodeLabels, 'Type')

      // -1. Closed Filter (separate from Status labels)
      if (!settings.uiState.filters.includeClosed && node._raw?.state === 'closed') return false

      // 0. Status Filter
      let statusMatch = true
      if (settings.uiState.filters.selectedStatuses?.length > 0) {
        // Map common GitLab states to our status list if the specific label is missing
        let currentStatus = (node && node._raw && typeof node._raw.status_display === 'string') ? String(node._raw.status_display).trim() : ''
        if (!currentStatus) currentStatus = (node && node._raw && node._raw.work_item_status) ? String(node._raw.work_item_status).trim() : ''
        if (!currentStatus) currentStatus = getScopedLabelValue(nodeLabels, 'Status')
        if (!currentStatus) {
          currentStatus = 'To do'
        }

        statusMatch = settings.uiState.filters.selectedStatuses.includes(currentStatus)
      }

      if (!statusMatch) return false

      // 0b. Subscription Filter
      if (settings.uiState.filters.selectedSubscription) {
        const isSubscribed = !!node._raw?.subscribed
        if (settings.uiState.filters.selectedSubscription === 'subscribed' && !isSubscribed) return false
        if (settings.uiState.filters.selectedSubscription === 'unsubscribed' && isSubscribed) return false
      }

      // 1. Label Filter
      let labelMatch = true
      if (settings.uiState.filters.selectedLabels?.length > 0) {
        labelMatch = settings.uiState.filters.selectedLabels.some(tag => nodeLabels.includes(tag))
      }

      // 1b. Exclude Labels
      if (settings.uiState.filters.excludedLabels?.length > 0) {
        if (settings.uiState.filters.excludedLabels.some(tag => nodeLabels.includes(tag))) {
          labelMatch = false
        }
      }

      // 1c. Author Filter
      let authorMatch = true
      if (settings.uiState.filters.selectedAuthors?.length > 0) {
        const rawWant = settings.uiState.filters.selectedAuthors
        const wantsDeactivated = rawWant.includes('@deactivated')
        const want = rawWant.includes('@me')
          ? (meName ? rawWant.map(v => (v === '@me' ? meName : v)) : [])
          : rawWant
        const wantNames = want.filter(v => v && v !== '@deactivated')
        const isDeactivated = authorName && (() => {
          const s = stateMap[authorName]
          const st = s ? String(s).trim().toLowerCase() : ''
          return !!st && st !== 'active'
        })()
        authorMatch = !!authorName && (wantNames.includes(authorName) || (wantsDeactivated && isDeactivated))
      }

      // 2. Assignee Filter
      let assigneeMatch = true
      if ((settings.uiState.filters.selectedAssignees?.length || 0) > 0) {
        const rawWant = settings.uiState.filters.selectedAssignees
        const want = rawWant.includes('@me')
          ? (meName ? rawWant.map(v => (v === '@me' ? meName : v)) : [])
          : rawWant
        const wantsDeactivated = want.includes('@deactivated')
        const wantsUnassigned = want.includes('@unassigned')
        const wantNames = want.filter(v => v && v !== '@deactivated' && v !== '@unassigned')
        const isDeactivated = assigneeName && (() => {
          const s = stateMap[assigneeName]
          const st = s ? String(s).trim().toLowerCase() : ''
          return !!st && st !== 'active'
        })()
        const matchUnassigned = wantsUnassigned && !assigneeName
        const matchNamed = !!assigneeName && (wantNames.includes(assigneeName) || (wantsDeactivated && isDeactivated))
        assigneeMatch = matchNamed || matchUnassigned
      }

      // Logic: AND between different filters
      if (!labelMatch || !authorMatch || !assigneeMatch) return false

      // 3. Milestone Filter
      let milestoneMatch = true
      if ((settings.uiState.filters.selectedMilestones?.length || 0) > 0) {
        milestoneMatch = milestoneTitle && settings.uiState.filters.selectedMilestones.includes(milestoneTitle)
      }

      // 4. Priority Filter
      let priorityMatch = true
      if ((settings.uiState.filters.selectedPriorities?.length || 0) > 0) {
        priorityMatch = priority && settings.uiState.filters.selectedPriorities.includes(priority)
      }

      // 5. Type Filter
      let typeMatch = true
      if ((settings.uiState.filters.selectedTypes?.length || 0) > 0) {
        typeMatch = type && settings.uiState.filters.selectedTypes.includes(type)
      }

      // 5b. Merge Requests Filter
      if (settings.uiState.filters.mrMode) {
        const mrCount = Number(node.mergeRequestsCount) || 0
        if (settings.uiState.filters.mrMode === 'has' && mrCount <= 0) return false
        if (settings.uiState.filters.mrMode === 'none' && mrCount > 0) return false
      }

      // 5c. Participants Filter
      const rawParticipants = Array.isArray(node._raw?.participants) ? node._raw.participants : []
      const participantNames = rawParticipants
        .map(p => (p && (p.name || p.username)) ? String(p.name || p.username) : '')
        .filter(Boolean)
      if ((settings.uiState.filters.selectedParticipants?.length || 0) > 0) {
        const rawWant = settings.uiState.filters.selectedParticipants
        const wantsDeactivated = rawWant.includes('@deactivated')
        const want = rawWant.includes('@me')
          ? (meName ? rawWant.map(v => (v === '@me' ? meName : v)) : [])
          : rawWant
        const wantNames = want.filter(v => v && v !== '@deactivated')
        const hitName = wantNames.some(n => participantNames.includes(n))
        const hitDeactivated = wantsDeactivated && participantNames.some(n => {
          const s = stateMap[n]
          const st = s ? String(s).trim().toLowerCase() : ''
          return !!st && st !== 'active'
        })
        if (!hitName && !hitDeactivated) return false
      }

      // 5d. Due Status Filter
      if (settings.uiState.filters.dueStatus) {
        const dueRaw = node.dueDate || node._raw?.due_date || node._raw?.dueDate || null
        const due = dueRaw ? new Date(dueRaw) : null
        const dueMs = due && Number.isFinite(due.getTime()) ? due.getTime() : null
        const nowMs = Date.now()
        const soonDays = Math.max(1, Number(settings.uiState.view.dueSoonDays) || 7)
        const soonMs = soonDays * 24 * 60 * 60 * 1000
        const mode = settings.uiState.filters.dueStatus
        if (mode === 'none') {
          if (dueMs != null) return false
        } else if (mode === 'overdue') {
          if (dueMs == null || dueMs >= nowMs) return false
        } else if (mode === 'soon') {
          if (dueMs == null || dueMs < nowMs || (dueMs - nowMs) > soonMs) return false
        } else if (mode === 'later') {
          if (dueMs == null || (dueMs - nowMs) <= soonMs) return false
        }
      }

      // 5e. Time Spent Filter
      if (settings.uiState.filters.spentMode) {
        const spent = Number(node.timeSpent) || 0
        if (settings.uiState.filters.spentMode === 'has' && spent <= 0) return false
        if (settings.uiState.filters.spentMode === 'none' && spent > 0) return false
      }

      // 5f. Budget Filter
      if (settings.uiState.filters.budgetMode) {
        const est = Number(node.timeEstimate) || 0
        const spent = Number(node.timeSpent) || 0
        const mode = settings.uiState.filters.budgetMode
        if (mode === 'no_est') {
          if (est > 0) return false
        } else if (mode === 'over') {
          if (est <= 0 || spent <= est) return false
        } else if (mode === 'within') {
          if (est <= 0 || spent > est) return false
        }
      }

      // 5g. Estimate Bucket Filter
      if (settings.uiState.filters.estimateBucket) {
        const est = Number(node.timeEstimate) || 0
        const h = est / 3600
        const b = settings.uiState.filters.estimateBucket
        if (b === 'none') {
          if (est > 0) return false
        } else if (est <= 0) {
          return false
        } else if (b === 'lt1h' && !(h < 1)) return false
        else if (b === '1_4h' && !(h >= 1 && h < 4)) return false
        else if (b === '4_8h' && !(h >= 4 && h < 8)) return false
        else if (b === '1_3d' && !(h >= 8 && h < 24)) return false
        else if (b === '3dplus' && !(h >= 24)) return false
      }

      // 5h. Task Completion Filter
      if (settings.uiState.filters.taskMode) {
        const tcs = node._raw?.task_completion_status || node._raw?.taskCompletionStatus || null
        const count = Number(tcs?.count) || 0
        const done = Number(tcs?.completed_count ?? tcs?.completedCount) || 0
        const mode = settings.uiState.filters.taskMode
        if (mode === 'no_tasks' && count > 0) return false
        if (mode === 'none_done' && !(count > 0 && done === 0)) return false
        if (mode === 'in_progress' && !(count > 0 && done > 0 && done < count)) return false
        if (mode === 'done' && !(count > 0 && done >= count)) return false
      }

      // 6. Search Filter
      let searchMatch = true
      if (settings.uiState.filters.searchQuery) {
        const query = String(settings.uiState.filters.searchQuery || '').trim().toLowerCase()
        const raw = node._raw || {}

        // Exact issue-id shortcut:
        // - "#123" or "123" matches ONLY that issue iid (prevents accidental matches on references in descriptions).
        const m = query.match(/^#?(\d+)$/)
        if (m && m[1]) {
          searchMatch = String(node.id) === String(m[1])
        } else {
          // Extract JIRA ID if present in title
          const jiraMatch = raw.title ? raw.title.match(/^\[([A-Z]+-\d+)\]/) : null
          const jiraId = jiraMatch ? jiraMatch[1] : ''

          const searchableText = [
            raw.title,
            raw.description,
            String(node.id),
            `#${node.id}`,
            jiraId,
            raw.author?.name,
            raw.assignee?.name,
            ...(raw.assignees || []).map(a => a.name),
            raw.milestone?.title,
            ...(raw.labels || [])
          ].filter(Boolean).join(' ').toLowerCase()

          searchMatch = searchableText.includes(query)
        }
      }

      // 7. Date Filters
      let dateMatch = true
      const raw = node._raw || {}

      // SVN date normalize
      const createdAt = raw.created_at || raw.date // SVN uses date
      const updatedAt = raw.updated_at || raw.date

      if (settings.uiState.filters.dateFilters.createdMode !== 'none') {
        if (settings.uiState.filters.dateFilters.createdMode === 'after' || settings.uiState.filters.dateFilters.createdMode === 'between') {
          if (settings.uiState.filters.dateFilters.createdAfter && (!createdAt || new Date(createdAt) < new Date(settings.uiState.filters.dateFilters.createdAfter))) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.createdMode === 'before' || settings.uiState.filters.dateFilters.createdMode === 'between')) {
          if (settings.uiState.filters.dateFilters.createdBefore) {
            const d = new Date(settings.uiState.filters.dateFilters.createdBefore)
            d.setDate(d.getDate() + 1)
            if (!createdAt || new Date(createdAt) >= d) dateMatch = false
          }
        }
        if (dateMatch && settings.uiState.filters.dateFilters.createdMode === 'last_x_days') {
          if (settings.uiState.filters.dateFilters.createdDays && settings.uiState.filters.dateFilters.createdDays > 0) {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.createdDays)
            if (!createdAt || new Date(createdAt) < cutoff) dateMatch = false
          }
        }
      }

      if (dateMatch && settings.uiState.filters.dateFilters.updatedMode !== 'none') {
        if (settings.uiState.filters.dateFilters.updatedMode === 'after' || settings.uiState.filters.dateFilters.updatedMode === 'between') {
          if (settings.uiState.filters.dateFilters.updatedAfter && (!updatedAt || new Date(updatedAt) < new Date(settings.uiState.filters.dateFilters.updatedAfter))) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.updatedMode === 'before' || settings.uiState.filters.dateFilters.updatedMode === 'between')) {
          if (settings.uiState.filters.dateFilters.updatedBefore) {
            const d = new Date(settings.uiState.filters.dateFilters.updatedBefore)
            d.setDate(d.getDate() + 1)
            if (!updatedAt || new Date(updatedAt) >= d) dateMatch = false
          }
        }
        if (dateMatch && settings.uiState.filters.dateFilters.updatedMode === 'last_x_days') {
          if (settings.uiState.filters.dateFilters.updatedDays && settings.uiState.filters.dateFilters.updatedDays > 0) {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.updatedDays)
            if (!updatedAt || new Date(updatedAt) < cutoff) dateMatch = false
          }
        }
      }

      if (dateMatch && settings.uiState.filters.dateFilters.dueDateMode !== 'none') {
        if (settings.uiState.filters.dateFilters.dueDateMode === 'after' || settings.uiState.filters.dateFilters.dueDateMode === 'between') {
          if (settings.uiState.filters.dateFilters.dueDateAfter && (!raw.due_date || raw.due_date < settings.uiState.filters.dateFilters.dueDateAfter)) dateMatch = false
        }
        if (dateMatch && (settings.uiState.filters.dateFilters.dueDateMode === 'before' || settings.uiState.filters.dateFilters.dueDateMode === 'between')) {
          if (settings.uiState.filters.dateFilters.dueDateBefore && (!raw.due_date || raw.due_date > settings.uiState.filters.dateFilters.dueDateBefore)) dateMatch = false
        }
        if (dateMatch && settings.uiState.filters.dateFilters.dueDateMode === 'last_x_days') {
          if (settings.uiState.filters.dateFilters.dueDateDays && settings.uiState.filters.dateFilters.dueDateDays > 0) {
            // due_date is YYYY-MM-DD
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - settings.uiState.filters.dateFilters.dueDateDays)
            const cutoffStr = cutoff.toISOString().split('T')[0]
            if (!raw.due_date || raw.due_date < cutoffStr) dateMatch = false
          }
        }
      }

      if (labelMatch && assigneeMatch && milestoneMatch && priorityMatch && typeMatch && searchMatch && dateMatch) {
        result[node.id] = node
      }
    })
    return result
  })

  const filteredEdges = computed(() => {
    // If links are hidden (none), return empty object to "kill" them from graph
    if (settings.uiState.view.linkMode === 'none') return {}

    const result = {}
    const nodeIds = new Set(Object.keys(filteredNodes.value))

    if (settings.uiState.view.linkMode === 'dependency') {
      // Standard dependency links
      Object.entries(edges).forEach(([key, edge]) => {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
          result[key] = edge
        }
      })
    } else if (settings.uiState.view.linkMode === 'group') {
      const groupingModeRaw = settings.uiState.view.groupingMode
      const groupingMode = typeof groupingModeRaw === 'string'
        ? groupingModeRaw
        : (groupingModeRaw && typeof groupingModeRaw === 'object' && typeof groupingModeRaw.value === 'string' ? groupingModeRaw.value : '')

      if (groupingMode === 'none') return {} // No groups to link

      // 1. Group nodes
      const groups = {}
      Object.values(filteredNodes.value).forEach(node => {
        let key = 'default'
        const n = node._raw
        if (node.type === 'svn_commit') {
          // Special grouping for SVN?
          if (groupingMode === 'author') key = n.author || 'Unknown'
          else key = 'SVN Commits' // Default for other groupings
        } else {
          if (groupingMode === 'tag') key = node.tag || '_no_tag_'
          else if (groupingMode === 'author') key = n.author ? n.author.name : 'Unknown'
          else if (groupingMode === 'state') key = n.state
          else if (groupingMode === 'assignee') key = n.assignee ? n.assignee.name : 'Unassigned'
          else if (groupingMode === 'milestone') key = n.milestone ? n.milestone.title : 'No Milestone'
          else if (groupingMode === 'priority') key = getScopedLabelValue(n.labels, 'Priority') || 'No Priority'
          else if (groupingMode === 'type') key = getScopedLabelValue(n.labels, 'Type') || 'No Type'
          else if (groupingMode === 'epic') {
            const parentType = String(n.parent?.work_item_type || '').trim().toLowerCase()
            key = (
              (n.epic ? n.epic.title : null) ||
              (parentType === 'epic' ? n.parent?.title : null) ||
              (n.epic_iid != null ? `Epic #${n.epic_iid}` : null) ||
              getScopedLabelValue(n.labels, 'Epic') ||
              'No Epic'
            )
          } else if (String(groupingMode || '').startsWith('scoped:')) {
            const prefix = String(groupingMode || '').substring('scoped:'.length)
            key = getScopedLabelValue(n.labels, prefix) || `No ${prefix}`
          }
        }

        if (!groups[key]) groups[key] = []
        groups[key].push(node.id)
      })

      // 2. Create chain links within groups to keep them together visually
      Object.values(groups).forEach(ids => {
        if (ids.length < 2) return
        // Sort by ID to be deterministic
        ids.sort()
        for (let i = 0; i < ids.length - 1; i++) {
          const source = ids[i]
          const target = ids[i + 1]
          const key = `group-${source}-${target}`
          result[key] = { source, target, label: 'group' }
        }
        // Close the loop for better clustering?
        if (ids.length > 2) {
          const source = ids[ids.length - 1]
          const target = ids[0]
          const key = `group-${source}-${target}`
          result[key] = { source, target, label: 'group' }
        }
      })
    }

    return result
  })

  // Dependency mode: default to hiding unlinked nodes when switching into it.
  watch(() => settings.uiState.view.linkMode, (v, old) => {
    if (v === 'dependency' && old !== 'dependency' && settings.uiState.view.hideUnlinked !== true) {
      settings.uiState.view.hideUnlinked = true
    }
  })

  const hasData = computed(() => Object.keys(nodes).length > 0)

  const isMockGraph = computed(() => {
    try {
      return Object.values(nodes).some(n => n && n._raw && n._raw.__mock)
    } catch {
      return false
    }
  })

  const statsText = computed(() => {
    const nodesArr = Object.values(filteredNodes.value)
    const openCount = nodesArr.filter(n => n._raw?.state === 'opened').length
    const closedCount = nodesArr.filter(n => n._raw?.state === 'closed').length
    const edgeCount = Object.keys(filteredEdges.value).length

    const parts = []
    if (openCount > 0) parts.push(`${openCount} Open`)
    if (closedCount > 0) parts.push(`${closedCount} Closed`)
    if (edgeCount > 0) parts.push(`${edgeCount} Link${edgeCount === 1 ? '' : 's'}`)

    return parts.join(', ') || 'No issues found'
  })

  const groupStatsText = computed(() => {
    const modeRaw = settings.uiState.view.groupingMode
    const mode = typeof modeRaw === 'string'
      ? modeRaw
      : (modeRaw && typeof modeRaw === 'object' && typeof modeRaw.value === 'string' ? modeRaw.value : '')

    if (!mode || mode === 'none') return null
    // Special layout mode (SVN) doesn't meaningfully have groups.
    if (mode === 'svn_revision') return null

    const getWeekYear = (dateStr) => {
      if (!dateStr) return 'No Date'
      const d = new Date(dateStr)
      if (!Number.isFinite(d.getTime())) return 'No Date'
      const onejan = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7)
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    }

    const groups = new Set()
    let multiGroupIssues = 0

    Object.values(filteredNodes.value).forEach(node => {
      const raw = node?._raw || {}
      const labelsRaw = raw.labels || []
      const labels = Array.isArray(labelsRaw)
        ? labelsRaw.filter(l => typeof l === 'string' && l.trim()).map(l => l.trim())
        : []

      let keys = null
      if (mode === 'tag') {
        keys = labels.length ? labels : ['_no_tag_']
      } else if (mode === 'state') {
        const statusKeys = getScopedLabelValues(labels, 'Status')
        keys = statusKeys.length ? statusKeys : [String(raw.state || '').toLowerCase() === 'closed' ? 'Done' : 'To do']
      } else if (mode === 'priority') {
        const ks = getScopedLabelValues(labels, 'Priority')
        keys = ks.length ? ks : ['No Priority']
      } else if (mode === 'type') {
        const ks = getScopedLabelValues(labels, 'Type')
        keys = ks.length ? ks : ['No Type']
      } else if (mode.startsWith('scoped:')) {
        const prefix = mode.substring('scoped:'.length)
        const ks = getScopedLabelValues(labels, prefix)
        keys = ks.length ? ks : [`No ${prefix}`]
      } else if (mode === 'author') {
        keys = [raw.author ? raw.author.name : 'Unknown']
      } else if (mode === 'assignee') {
        keys = [raw.assignee ? raw.assignee.name : 'Unassigned']
      } else if (mode === 'milestone') {
        keys = [raw.milestone ? raw.milestone.title : 'No Milestone']
      } else if (mode === 'weight') {
        keys = [raw.weight != null ? String(raw.weight) : 'No Weight']
      } else if (mode === 'epic') {
        const parentType = String(raw.parent?.work_item_type || '').trim().toLowerCase()
        keys = [(
          (raw.epic ? raw.epic.title : null) ||
          (parentType === 'epic' ? raw.parent?.title : null) ||
          (raw.epic_iid != null ? `Epic #${raw.epic_iid}` : null) ||
          getScopedLabelValue(labels, 'Epic') ||
          'No Epic'
        )]
      } else if (mode === 'iteration') {
        keys = [raw.iteration ? raw.iteration.title : 'No Iteration']
      } else if (mode === 'stale') {
        const now = new Date()
        const updated = raw.updated_at ? new Date(raw.updated_at) : null
        const diffTime = updated && Number.isFinite(updated.getTime()) ? Math.abs(now - updated) : 0
        const diffDays = updated && Number.isFinite(updated.getTime()) ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0
        if (diffDays > 90) keys = ['> 90 Days Stale']
        else if (diffDays > 60) keys = ['> 60 Days Stale']
        else if (diffDays > 30) keys = ['> 30 Days Stale']
        else keys = ['Active (< 30 Days)']
      } else if (mode === 'timeline_created') {
        keys = [getWeekYear(raw.created_at)]
      } else if (mode === 'timeline_updated') {
        keys = [getWeekYear(raw.updated_at)]
      } else if (mode === 'timeline_closed') {
        keys = [getWeekYear(raw.closed_at)]
      } else {
        keys = ['default']
      }

      // De-dupe while preserving order (matches graph behavior)
      const seen = new Set()
      keys = (Array.isArray(keys) ? keys : [keys]).map(k => String(k == null ? '' : k).trim() || 'Unknown').filter(k => {
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      if (keys.length > 1) multiGroupIssues += 1
      keys.forEach(k => groups.add(k))
    })

    let text = `${groups.size} Groups`
    if (multiGroupIssues > 0) text += ` • ${multiGroupIssues} in multiple groups`
    return text
  })

  return {
    allLabels,
    allAuthors,
    allAssignees,
    allParticipants,
    userStateByName,
    allMilestones,
    allPriorities,
    allTypes,
    filteredNodes,
    filteredEdges,
    hasData,
    isMockGraph,
    statsText,
    groupStatsText
  }
}

