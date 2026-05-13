import { computed, watch } from 'vue'
import { getScopedLabelValue, getScopedLabelValues, isScopedLabel } from '../utils/scopedLabels'
import { getAssigneeNames, resolveAssigneeFilter, filterAssigneeKeys } from '../utils/issueFields'

// Single source of truth for an issue's effective status — used by the dropdown
// derivation, the filter, and the graph so they never disagree. Returns the raw value
// only (status_display → work_item_status → Status:: scoped label); empty string when
// none is set, so we never pretend a ticket has a status it doesn't.
export const currentStatusOfRaw = (raw) => {
  let s = (typeof raw?.status_display === 'string' && raw.status_display.trim()) ? raw.status_display.trim() : ''
  if (!s && raw?.work_item_status) s = String(raw.work_item_status).trim()
  if (!s) s = getScopedLabelValue(raw?.labels, 'Status') || ''
  return s
}

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

  // GitLab's default work-item statuses. Always shown in the filter dropdown so users can
  // filter for any standard status even if no currently-loaded issue is in that state.
  // Project-specific custom statuses (e.g. "Backlog") are added on top from the loaded data.
  const STANDARD_STATUSES = ['To do', 'In progress', 'Ready for Review', 'On Hold/Blocked', 'Done', "Won't do", 'Duplicate']

  const allStatuses = computed(() => {
    const statuses = new Set(STANDARD_STATUSES)
    Object.values(nodes).forEach(node => {
      const s = currentStatusOfRaw(node?._raw)
      if (s) statuses.add(s)
    })

    const list = Array.from(statuses)
    list.sort((a, b) => {
      const ia = STANDARD_STATUSES.indexOf(a)
      const ib = STANDARD_STATUSES.indexOf(b)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      return String(a).localeCompare(String(b))
    })
    return list
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
      getAssigneeNames(node._raw).forEach(n => assignees.add(n))
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

  // Contextual per-value ticket counts for filter dropdowns (GitLab-style UX): each bucket's
  // count reflects nodes that pass ALL OTHER active filters except this dropdown's own,
  // so selecting an option doesn't zero out the dropdown's siblings. Recomputed when any
  // filter changes; cost is O(N × buckets), which is fine at typical project sizes.
  const filterCounts = computed(() => {
    const meName = settings.meta.gitlabMeName || ''
    const buckets = {
      status: new Map(), labels: new Map(), excludedLabels: new Map(),
      authors: new Map(), assignees: new Map(), participants: new Map(),
      milestones: new Map(), priorities: new Map(), types: new Map(),
      subscription: new Map(), mr: new Map(), due: new Map(),
      spent: new Map(), budget: new Map(), estimate: new Map(), tasks: new Map()
    }
    const inc = (m, k) => { if (k != null && k !== '') m.set(k, (m.get(k) || 0) + 1) }

    const soonMs = Math.max(1, Number(settings.uiState.view.dueSoonDays) || 7) * 86400000
    const nowMs = Date.now()

    // Each entry: [bucket name, skip set, extractor that increments the bucket's Map].
    // `labels`/`excludedLabels` are two views over the same `_raw.labels` data; each skips
    // its own selection so siblings remain visible.
    const dimensions = [
      ['status', new Set(['status']), (r, n) => inc(buckets.status, currentStatusOfRaw(r))],
      ['labels', new Set(['labels']), (r) => (r.labels || []).forEach(l => inc(buckets.labels, l))],
      ['excludedLabels', new Set(['excludedLabels']), (r) => (r.labels || []).forEach(l => inc(buckets.excludedLabels, l))],
      ['authors', new Set(['authors']), (r) => inc(buckets.authors, r.author?.name)],
      ['assignees', new Set(['assignees']), (r) => {
        const aNames = getAssigneeNames(r)
        if (aNames.length === 0) inc(buckets.assignees, '@unassigned')
        else aNames.forEach(n => inc(buckets.assignees, n))
      }],
      ['participants', new Set(['participants']), (r) => (r.participants || []).forEach(p => inc(buckets.participants, p?.name || p?.username))],
      ['milestones', new Set(['milestones']), (r) => inc(buckets.milestones, r.milestone?.title || '@none')],
      ['priorities', new Set(['priorities']), (r) => inc(buckets.priorities, getScopedLabelValue(r.labels, 'Priority') || '@none')],
      ['types', new Set(['types']), (r) => inc(buckets.types, getScopedLabelValue(r.labels, 'Type') || '@none')],
      ['subscription', new Set(['subscription']), (r) => inc(buckets.subscription, r.subscribed ? 'subscribed' : 'unsubscribed')],
      ['mr', new Set(['mr']), (r, n) => inc(buckets.mr, (Number(n?.mergeRequestsCount) || 0) > 0 ? 'has' : 'none')],
      ['due', new Set(['due']), (r, n) => {
        const dueRaw = n?.dueDate || r.due_date || null
        const dueMs = dueRaw ? new Date(dueRaw).getTime() : null
        if (dueMs == null || !Number.isFinite(dueMs)) inc(buckets.due, 'none')
        else if (dueMs < nowMs) inc(buckets.due, 'overdue')
        else if ((dueMs - nowMs) <= soonMs) inc(buckets.due, 'soon')
        else inc(buckets.due, 'later')
      }],
      ['spent', new Set(['spent']), (r, n) => inc(buckets.spent, (Number(n?.timeSpent) || 0) > 0 ? 'has' : 'none')],
      ['budget', new Set(['budget']), (r, n) => {
        const est = Number(n?.timeEstimate) || 0
        const ts = Number(n?.timeSpent) || 0
        if (est <= 0) inc(buckets.budget, 'no_est')
        else if (ts > est) inc(buckets.budget, 'over')
        else inc(buckets.budget, 'within')
      }],
      ['estimate', new Set(['estimate']), (r, n) => {
        const est = Number(n?.timeEstimate) || 0
        if (est <= 0) { inc(buckets.estimate, 'none'); return }
        const h = est / 3600
        if (h < 1) inc(buckets.estimate, 'lt1h')
        else if (h < 4) inc(buckets.estimate, '1_4h')
        else if (h < 8) inc(buckets.estimate, '4_8h')
        else if (h < 24) inc(buckets.estimate, '1_3d')
        else inc(buckets.estimate, '3dplus')
      }],
      ['tasks', new Set(['tasks']), (r) => {
        const tcs = r.task_completion_status || r.taskCompletionStatus || null
        const c = Number(tcs?.count) || 0
        const d = Number(tcs?.completed_count ?? tcs?.completedCount) || 0
        if (c === 0) inc(buckets.tasks, 'no_tasks')
        else if (d === 0) inc(buckets.tasks, 'none_done')
        else if (d < c) inc(buckets.tasks, 'in_progress')
        else inc(buckets.tasks, 'done')
      }]
    ]

    const allNodes = Object.values(nodes)
    for (const [, skip, extract] of dimensions) {
      for (const node of allNodes) {
        if (!passesFilters(node, skip)) continue
        extract(node._raw || {}, node)
      }
    }

    // Resolve @me sentinel to the user's actual count (so the @me row mirrors their data).
    if (meName) {
      const a = buckets.authors.get(meName); if (a) buckets.authors.set('@me', a)
      const as = buckets.assignees.get(meName); if (as) buckets.assignees.set('@me', as)
      const p = buckets.participants.get(meName); if (p) buckets.participants.set('@me', p)
    }

    return buckets
  })

  const allTypes = computed(() => {
    const types = new Set()
    Object.values(nodes).forEach(node => {
      const t = getScopedLabelValue(node._raw.labels, 'Type')
      if (t) types.add(t)
    })
    return Array.from(types).sort()
  })

  // Returns true if `node` passes all currently-active filters except those whose dimension
  // name is in `skip`. Used by both `filteredNodes` (no skips) and `filterCounts` (skips
  // each dropdown's own dimension so options aren't zeroed out by their own selection).
  const passesFilters = (node, skip) => {
    const r = node?._raw || {}
    const f = settings.uiState.filters
    const stateMap = userStateByName.value || {}
    const meName = settings.meta.gitlabMeName || ''
    const nodeLabels = r.labels || []
    const isDeactivated = (n) => {
      const s = stateMap[n]
      const st = s ? String(s).trim().toLowerCase() : ''
      return !!st && st !== 'active'
    }
    const resolveMe = (list) => list.includes('@me') ? (meName ? list.map(v => v === '@me' ? meName : v) : []) : list

    if (!skip.has('includeClosed') && !f.includeClosed && r.state === 'closed') return false

    if (!skip.has('status') && f.selectedStatuses?.length > 0) {
      if (!f.selectedStatuses.includes(currentStatusOfRaw(r))) return false
    }

    if (!skip.has('subscription') && f.selectedSubscription) {
      const isSubscribed = !!r.subscribed
      if (f.selectedSubscription === 'subscribed' && !isSubscribed) return false
      if (f.selectedSubscription === 'unsubscribed' && isSubscribed) return false
    }

    if (!skip.has('labels') && f.selectedLabels?.length > 0) {
      if (!f.selectedLabels.some(tag => nodeLabels.includes(tag))) return false
    }
    if (!skip.has('excludedLabels') && f.excludedLabels?.length > 0) {
      if (f.excludedLabels.some(tag => nodeLabels.includes(tag))) return false
    }

    if (!skip.has('authors') && f.selectedAuthors?.length > 0) {
      const want = resolveMe(f.selectedAuthors)
      const wantsDeactivated = want.includes('@deactivated')
      const wantNames = want.filter(v => v && v !== '@deactivated')
      const authorName = r.author ? r.author.name : null
      if (!authorName) return false
      if (!(wantNames.includes(authorName) || (wantsDeactivated && isDeactivated(authorName)))) return false
    }

    if (!skip.has('assignees') && f.selectedAssignees?.length > 0) {
      const want = resolveMe(f.selectedAssignees)
      const wantsDeactivated = want.includes('@deactivated')
      const wantsUnassigned = want.includes('@unassigned')
      const wantNames = want.filter(v => v && v !== '@deactivated' && v !== '@unassigned')
      const assigneeNames = getAssigneeNames(r)
      const matchUnassigned = wantsUnassigned && assigneeNames.length === 0
      const matchNamed = assigneeNames.some(n => wantNames.includes(n) || (wantsDeactivated && isDeactivated(n)))
      if (!(matchNamed || matchUnassigned)) return false
    }

    if (!skip.has('milestones') && f.selectedMilestones?.length > 0) {
      const want = f.selectedMilestones
      const wantsNone = want.includes('@none')
      const wantNames = want.filter(v => v !== '@none')
      const milestoneTitle = r.milestone ? r.milestone.title : null
      if (!((!!milestoneTitle && wantNames.includes(milestoneTitle)) || (wantsNone && !milestoneTitle))) return false
    }

    if (!skip.has('priorities') && f.selectedPriorities?.length > 0) {
      const want = f.selectedPriorities
      const wantsNone = want.includes('@none')
      const wantNames = want.filter(v => v !== '@none')
      const priority = getScopedLabelValue(nodeLabels, 'Priority')
      if (!((!!priority && wantNames.includes(priority)) || (wantsNone && !priority))) return false
    }

    if (!skip.has('types') && f.selectedTypes?.length > 0) {
      const want = f.selectedTypes
      const wantsNone = want.includes('@none')
      const wantNames = want.filter(v => v !== '@none')
      const type = getScopedLabelValue(nodeLabels, 'Type')
      if (!((!!type && wantNames.includes(type)) || (wantsNone && !type))) return false
    }

    if (!skip.has('mr') && f.mrMode) {
      const mrCount = Number(node.mergeRequestsCount) || 0
      if (f.mrMode === 'has' && mrCount <= 0) return false
      if (f.mrMode === 'none' && mrCount > 0) return false
    }

    if (!skip.has('participants') && f.selectedParticipants?.length > 0) {
      const want = resolveMe(f.selectedParticipants)
      const wantsDeactivated = want.includes('@deactivated')
      const wantNames = want.filter(v => v && v !== '@deactivated')
      const participantNames = (Array.isArray(r.participants) ? r.participants : [])
        .map(p => (p && (p.name || p.username)) ? String(p.name || p.username) : '')
        .filter(Boolean)
      const hitName = wantNames.some(n => participantNames.includes(n))
      const hitDeactivated = wantsDeactivated && participantNames.some(isDeactivated)
      if (!hitName && !hitDeactivated) return false
    }

    if (!skip.has('due') && f.dueStatus) {
      const dueRaw = node.dueDate || r.due_date || r.dueDate || null
      const due = dueRaw ? new Date(dueRaw) : null
      const dueMs = due && Number.isFinite(due.getTime()) ? due.getTime() : null
      const nowMs = Date.now()
      const soonMs = Math.max(1, Number(settings.uiState.view.dueSoonDays) || 7) * 86400000
      const m = f.dueStatus
      if (m === 'none' && dueMs != null) return false
      if (m === 'overdue' && (dueMs == null || dueMs >= nowMs)) return false
      if (m === 'soon' && (dueMs == null || dueMs < nowMs || (dueMs - nowMs) > soonMs)) return false
      if (m === 'later' && (dueMs == null || (dueMs - nowMs) <= soonMs)) return false
    }

    if (!skip.has('spent') && f.spentMode) {
      const spent = Number(node.timeSpent) || 0
      if (f.spentMode === 'has' && spent <= 0) return false
      if (f.spentMode === 'none' && spent > 0) return false
    }

    if (!skip.has('budget') && f.budgetMode) {
      const est = Number(node.timeEstimate) || 0
      const spent = Number(node.timeSpent) || 0
      if (f.budgetMode === 'no_est' && est > 0) return false
      if (f.budgetMode === 'over' && (est <= 0 || spent <= est)) return false
      if (f.budgetMode === 'within' && (est <= 0 || spent > est)) return false
    }

    if (!skip.has('estimate') && f.estimateBucket) {
      const est = Number(node.timeEstimate) || 0
      const h = est / 3600
      const b = f.estimateBucket
      if (b === 'none') { if (est > 0) return false }
      else if (est <= 0) return false
      else if (b === 'lt1h' && !(h < 1)) return false
      else if (b === '1_4h' && !(h >= 1 && h < 4)) return false
      else if (b === '4_8h' && !(h >= 4 && h < 8)) return false
      else if (b === '1_3d' && !(h >= 8 && h < 24)) return false
      else if (b === '3dplus' && !(h >= 24)) return false
    }

    if (!skip.has('tasks') && f.taskMode) {
      const tcs = r.task_completion_status || r.taskCompletionStatus || null
      const count = Number(tcs?.count) || 0
      const done = Number(tcs?.completed_count ?? tcs?.completedCount) || 0
      const m = f.taskMode
      if (m === 'no_tasks' && count > 0) return false
      if (m === 'none_done' && !(count > 0 && done === 0)) return false
      if (m === 'in_progress' && !(count > 0 && done > 0 && done < count)) return false
      if (m === 'done' && !(count > 0 && done >= count)) return false
    }

    if (!skip.has('searchQuery') && f.searchQuery) {
      const query = String(f.searchQuery || '').trim().toLowerCase()
      const m = query.match(/^#?(\d+)$/)
      if (m && m[1]) {
        if (String(node.id) !== String(m[1])) return false
      } else {
        const jiraMatch = r.title ? r.title.match(/^\[([A-Z]+-\d+)\]/) : null
        const jiraId = jiraMatch ? jiraMatch[1] : ''
        const hay = [
          r.title, r.description, String(node.id), `#${node.id}`, jiraId,
          r.author?.name, r.assignee?.name,
          ...(r.assignees || []).map(a => a.name),
          r.milestone?.title,
          ...(r.labels || [])
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(query)) return false
      }
    }

    if (!skip.has('dateFilters')) {
      const createdAt = r.created_at || r.date
      const updatedAt = r.updated_at || r.date
      const checkRange = (mode, after, before, days, value, ymdOnly = false) => {
        if (mode === 'none') return true
        if ((mode === 'after' || mode === 'between') && after) {
          if (ymdOnly) { if (!value || value < after) return false }
          else { if (!value || new Date(value) < new Date(after)) return false }
        }
        if ((mode === 'before' || mode === 'between') && before) {
          if (ymdOnly) { if (!value || value > before) return false }
          else {
            const d = new Date(before); d.setDate(d.getDate() + 1)
            if (!value || new Date(value) >= d) return false
          }
        }
        if (mode === 'last_x_days' && days && days > 0) {
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
          if (ymdOnly) {
            const cutoffStr = cutoff.toISOString().split('T')[0]
            if (!value || value < cutoffStr) return false
          } else {
            if (!value || new Date(value) < cutoff) return false
          }
        }
        return true
      }
      const dF = f.dateFilters
      if (!checkRange(dF.createdMode, dF.createdAfter, dF.createdBefore, dF.createdDays, createdAt)) return false
      if (!checkRange(dF.updatedMode, dF.updatedAfter, dF.updatedBefore, dF.updatedDays, updatedAt)) return false
      if (!checkRange(dF.dueDateMode, dF.dueDateAfter, dF.dueDateBefore, dF.dueDateDays, r.due_date, true)) return false
    }

    return true
  }

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
    const empty = new Set()
    Object.values(nodes).forEach(node => {
      if (passesFilters(node, empty)) result[node.id] = node
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
      const cloneMultiAssignee = !!settings.uiState.view.cloneMultiAssignee
      const assigneeFilter = resolveAssigneeFilter(
        settings.uiState.filters.selectedAssignees,
        settings.meta.gitlabMeName || '',
        userStateByName.value
      )
      const groups = {}
      Object.values(filteredNodes.value).forEach(node => {
        let keys = ['default']
        const n = node._raw
        if (node.type === 'svn_commit') {
          // Special grouping for SVN?
          keys = [groupingMode === 'author' ? (n.author || 'Unknown') : 'SVN Commits']
        } else {
          if (groupingMode === 'tag') keys = [node.tag || '_no_tag_']
          else if (groupingMode === 'author') keys = [n.author ? n.author.name : 'Unknown']
          else if (groupingMode === 'state') keys = [n.state]
          else if (groupingMode === 'assignee') {
            const names = getAssigneeNames(n)
            const allowed = filterAssigneeKeys(names.length ? names : ['Unassigned'], assigneeFilter)
            keys = cloneMultiAssignee ? allowed : [allowed[0]]
          }
          else if (groupingMode === 'milestone') keys = [n.milestone ? n.milestone.title : 'No Milestone']
          else if (groupingMode === 'priority') keys = [getScopedLabelValue(n.labels, 'Priority') || 'No Priority']
          else if (groupingMode === 'type') keys = [getScopedLabelValue(n.labels, 'Type') || 'No Type']
          else if (groupingMode === 'epic') {
            const parentType = String(n.parent?.work_item_type || '').trim().toLowerCase()
            keys = [(
              (n.epic ? n.epic.title : null) ||
              (parentType === 'epic' ? n.parent?.title : null) ||
              (n.epic_iid != null ? `Epic #${n.epic_iid}` : null) ||
              getScopedLabelValue(n.labels, 'Epic') ||
              'No Epic'
            )]
          } else if (String(groupingMode || '').startsWith('scoped:')) {
            const prefix = String(groupingMode || '').substring('scoped:'.length)
            keys = [getScopedLabelValue(n.labels, prefix) || `No ${prefix}`]
          }
        }

        for (const key of keys) {
          if (!groups[key]) groups[key] = []
          groups[key].push(node.id)
        }
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
        const plain = labels.filter(l => !isScopedLabel(l))
        keys = plain.length ? plain : ['_no_tag_']
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
        const names = getAssigneeNames(raw)
        const filter = resolveAssigneeFilter(
          settings.uiState.filters.selectedAssignees,
          settings.meta.gitlabMeName || '',
          userStateByName.value
        )
        const allowed = filterAssigneeKeys(names.length ? names : ['Unassigned'], filter)
        keys = settings.uiState.view.cloneMultiAssignee ? allowed : [allowed[0]]
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
    allStatuses,
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
    groupStatsText,
    filterCounts
  }
}

