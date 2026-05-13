// Filter regression tests against real exported datasets.
//
// To add a fixture: hit Ctrl+Shift+E in the app, then rename the downloaded
// `gitlabviz-export-*.json` to `*.unittestdata.json` and drop it at the project root.
// All matching files are auto-discovered and each gets its own `describe` block
// running the full filter suite. CI without fixtures still passes (suite is skipped).
//
// Predicates are derived from the data — never hardcode counts, so the tests stay
// valid as fixtures change.

import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useGraphDerivedState, currentStatusOfRaw } from './useGraphDerivedState'
import { getScopedLabelValue } from '../utils/scopedLabels'
import { getAssigneeNames } from '../utils/issueFields'

const __filename = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(__filename), '../..')

const fixtureFiles = (() => {
  try {
    return fs.readdirSync(projectRoot)
      .filter(f => /\.unittestdata\.json$/.test(f))
      .sort()
  } catch { return [] }
})()

const baseFilters = () => ({
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
    createdMode: 'none', createdAfter: null, createdBefore: null, createdDays: null,
    updatedMode: 'none', updatedAfter: null, updatedBefore: null, updatedDays: null,
    dueDateMode: 'none', dueDateAfter: null, dueDateBefore: null, dueDateDays: null
  }
})

// Re-export of the shared helper (alias for readability).
const currentStatusOf = currentStatusOfRaw

// Pick the most-frequent value from a list (skips falsy).
const mostFrequent = (values) => {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  let best = null; let bestN = 0
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n }
  return best
}

const expectFilterMatches = (filteredObj, allNodes, predicate) => {
  const expected = allNodes.filter(predicate).map(n => String(n.id)).sort()
  const actual = Object.keys(filteredObj).sort()
  expect(actual).toEqual(expected)
}

// Run the full filter suite against one fixture. Called once per discovered file.
const runFixtureSuite = (fname, fixture) => {
  const allNodes = Object.values(fixture.nodes || {})
  const meName = fixture?.meta?.gitlabMeName || ''

  const buildState = (filterPatch = {}, viewPatch = {}) => {
    const settings = reactive({
      meta: { gitlabMeName: meName },
      uiState: {
        filters: { ...baseFilters(), ...filterPatch, dateFilters: { ...baseFilters().dateFilters, ...(filterPatch.dateFilters || {}) } },
        view: { linkMode: 'none', groupingMode: 'none', dueSoonDays: 7, hideUnlinked: false, ...viewPatch }
      }
    })
    return useGraphDerivedState({ settings, nodes: fixture.nodes, edges: fixture.edges || {} })
  }

  describe(`fixture: ${fname} (${allNodes.length} nodes)`, () => {
    // Field freshness: the current gitlab.js writes these. If a fixture is missing
    // ALL of them, the cache predates the field and the dependent filter is dead
    // (e.g. all `subscribed` undefined → Subscribed filter always returns 0).
    // Logged as warnings rather than failures so old fixtures still allow CI to pass.
    it('field freshness — flags fields the current GitLab fetch should write', () => {
      const expected = [
        { key: 'status_display', desc: 'work-item status (powers Status filter)' },
        { key: 'work_item_status', desc: 'raw work-item status name' },
        { key: 'subscribed', desc: 'subscription state (powers Subscribed filter)' },
        { key: 'participants', desc: 'participants list (powers Participants filter)' },
        { key: 'parent', desc: 'work-item parent (powers Epic grouping via parent)' },
        { key: 'health_status', desc: 'health status' }
      ]
      const stale = expected.filter(({ key }) => !allNodes.some(n => n._raw?.[key] !== undefined))
      if (stale.length) {
        // eslint-disable-next-line no-console
        console.warn(`[${fname}] stale cache — refetch to populate: ${stale.map(s => `${s.key} (${s.desc})`).join('; ')}`)
      }
      expect(true).toBe(true)
    })

    it('dropdown↔filter parity: every status the dropdown shows that has nodes is filterable', () => {
      const d = buildState()
      const statusCounts = {}
      allNodes.forEach(n => { const s = currentStatusOf(n._raw); statusCounts[s] = (statusCounts[s] || 0) + 1 })
      // For every status with at least one matching node, filtering by it must return that count.
      for (const [status, expected] of Object.entries(statusCounts)) {
        const dd = buildState({ selectedStatuses: [status] })
        expect(Object.keys(dd.filteredNodes.value).length).toBe(expected)
        // and the dropdown should list it
        expect(d.allStatuses.value).toContain(status)
      }
    })

    it('filtering by "Done" matches closed issues without an explicit status (closed→Done fallback)', () => {
      // Only meaningful if the fixture has closed issues without an explicit work-item status.
      const closedNoStatus = allNodes.filter(n => n._raw?.state === 'closed' && currentStatusOf(n._raw) === 'Done')
      if (!closedNoStatus.length) return
      const d = buildState({ selectedStatuses: ['Done'] })
      closedNoStatus.forEach(n => {
        expect(d.filteredNodes.value[String(n.id)]).toBeTruthy()
      })
    })

    it('passes everything through when no filter is active', () => {
      const d = buildState()
      expect(Object.keys(d.filteredNodes.value)).toHaveLength(allNodes.length)
    })

    // filterCounts powers the per-row count chips in the sidebar. Ensure each bucket
    // is a non-empty Map for buckets we can derive predicates for.
    it('filterCounts populates non-empty Maps for each buckets that has data', () => {
      const d = buildState()
      const fc = d.filterCounts.value
      expect(fc).toBeTruthy()
      // labels is the bucket the user reported broken; assert it has every label
      // present in any _raw.labels at least once with the right count.
      const labelTotals = {}
      allNodes.forEach(n => (n._raw?.labels || []).forEach(l => { labelTotals[l] = (labelTotals[l] || 0) + 1 }))
      for (const [label, total] of Object.entries(labelTotals)) {
        expect(fc.labels.get(label)).toBe(total)
      }
      // sanity: status count of most-frequent matches predicate count
      const statusCounts = {}
      allNodes.forEach(n => {
        const r = n._raw || {}
        let s = (typeof r.status_display === 'string' && r.status_display.trim()) || ''
        if (!s && r.work_item_status) s = String(r.work_item_status).trim()
        if (!s) s = (r.labels || []).find(l => typeof l === 'string' && l.startsWith('Status::'))?.split('::').slice(1).join('::') || ''
        if (!s) s = String(r.state || '').toLowerCase() === 'closed' ? 'Done' : 'To do'
        statusCounts[s] = (statusCounts[s] || 0) + 1
      })
      for (const [status, total] of Object.entries(statusCounts)) {
        expect(fc.status.get(status)).toBe(total)
      }
    })

    it('includeClosed=false excludes state==="closed"', () => {
      const allLabels = [].concat(...allNodes.map(n => n._raw?.labels || []))
      const label = mostFrequent(allLabels)
      if (!label) return
      const d = buildState({ includeClosed: false, selectedLabels: [label] })
      expectFilterMatches(d.filteredNodes.value, allNodes,
        n => n._raw?.state !== 'closed' && (n._raw?.labels || []).includes(label))
    })

    it('selectedStatuses matches by computed currentStatus', () => {
      const status = mostFrequent(allNodes.map(n => currentStatusOf(n._raw)))
      if (!status) return
      const d = buildState({ selectedStatuses: [status] })
      expect(Object.keys(d.filteredNodes.value).length).toBeGreaterThan(0)
      expectFilterMatches(d.filteredNodes.value, allNodes, n => currentStatusOf(n._raw) === status)
    })

    it('selectedStatuses with multiple values uses OR semantics', () => {
      const counts = {}
      allNodes.forEach(n => { const s = currentStatusOf(n._raw); counts[s] = (counts[s] || 0) + 1 })
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 2)
      if (top.length < 2) return
      const d = buildState({ selectedStatuses: top })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => top.includes(currentStatusOf(n._raw)))
    })

    it('selectedLabels matches if ANY label is in selection', () => {
      const label = mostFrequent([].concat(...allNodes.map(n => n._raw?.labels || [])))
      if (!label) return
      const d = buildState({ selectedLabels: [label] })
      expect(Object.keys(d.filteredNodes.value).length).toBeGreaterThan(0)
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (n._raw?.labels || []).includes(label))
    })

    it('excludedLabels removes any node carrying that label', () => {
      const label = mostFrequent([].concat(...allNodes.map(n => n._raw?.labels || [])))
      if (!label) return
      const d = buildState({ excludedLabels: [label] })
      Object.values(d.filteredNodes.value).forEach(n => {
        expect((n._raw?.labels || []).includes(label)).toBe(false)
      })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => !(n._raw?.labels || []).includes(label))
    })

    it('selectedAuthors matches author.name', () => {
      const author = mostFrequent(allNodes.map(n => n._raw?.author?.name))
      if (!author) return
      const d = buildState({ selectedAuthors: [author] })
      expect(Object.keys(d.filteredNodes.value).length).toBeGreaterThan(0)
      expectFilterMatches(d.filteredNodes.value, allNodes, n => n._raw?.author?.name === author)
    })

    it('selectedAuthors with @me resolves to meName', () => {
      if (!meName) return
      const d = buildState({ selectedAuthors: ['@me'] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => n._raw?.author?.name === meName)
    })

    it('selectedAssignees matches when ANY assignee is in selection', () => {
      const assignee = mostFrequent([].concat(...allNodes.map(n => getAssigneeNames(n._raw))))
      if (!assignee) return
      const d = buildState({ selectedAssignees: [assignee] })
      expect(Object.keys(d.filteredNodes.value).length).toBeGreaterThan(0)
      expectFilterMatches(d.filteredNodes.value, allNodes, n => getAssigneeNames(n._raw).includes(assignee))
    })

    it('selectedAssignees with @unassigned matches issues with no assignees', () => {
      const expected = allNodes.filter(n => getAssigneeNames(n._raw).length === 0).length
      if (expected === 0) return
      const d = buildState({ selectedAssignees: ['@unassigned'] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => getAssigneeNames(n._raw).length === 0)
    })

    it('selectedMilestones matches milestone.title', () => {
      const milestone = mostFrequent(allNodes.map(n => n._raw?.milestone?.title))
      if (!milestone) return
      const d = buildState({ selectedMilestones: [milestone] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => n._raw?.milestone?.title === milestone)
    })

    it('selectedMilestones with @none matches issues without a milestone', () => {
      const expected = allNodes.filter(n => !n._raw?.milestone).length
      if (expected === 0) return
      const d = buildState({ selectedMilestones: ['@none'] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => !n._raw?.milestone)
    })

    it('selectedPriorities matches Priority:: scoped label', () => {
      const priority = mostFrequent(allNodes.map(n => getScopedLabelValue(n._raw?.labels, 'Priority')))
      if (!priority) return
      const d = buildState({ selectedPriorities: [priority] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => getScopedLabelValue(n._raw?.labels, 'Priority') === priority)
    })

    it('selectedPriorities with @none matches issues without a Priority scoped label', () => {
      const expected = allNodes.filter(n => !getScopedLabelValue(n._raw?.labels, 'Priority')).length
      if (expected === 0) return
      const d = buildState({ selectedPriorities: ['@none'] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => !getScopedLabelValue(n._raw?.labels, 'Priority'))
    })

    it('selectedTypes matches Type:: scoped label', () => {
      const type = mostFrequent(allNodes.map(n => getScopedLabelValue(n._raw?.labels, 'Type')))
      if (!type) return
      const d = buildState({ selectedTypes: [type] })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => getScopedLabelValue(n._raw?.labels, 'Type') === type)
    })

    it('mrMode="has" returns only issues with MR count > 0', () => {
      const expected = allNodes.filter(n => (Number(n.mergeRequestsCount) || 0) > 0).length
      if (expected === 0) return
      const d = buildState({ mrMode: 'has' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (Number(n.mergeRequestsCount) || 0) > 0)
    })

    it('mrMode="none" returns only issues with MR count === 0', () => {
      const d = buildState({ mrMode: 'none' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (Number(n.mergeRequestsCount) || 0) === 0)
    })

    it('selectedSubscription="subscribed" returns only subscribed issues', () => {
      const expected = allNodes.filter(n => !!n._raw?.subscribed).length
      if (expected === 0) return
      const d = buildState({ selectedSubscription: 'subscribed' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => !!n._raw?.subscribed)
    })

    it('selectedParticipants matches by name/username in raw.participants', () => {
      const names = []
      for (const n of allNodes) {
        for (const p of (n._raw?.participants || [])) {
          const nm = p?.name || p?.username
          if (nm) names.push(nm)
        }
      }
      const participant = mostFrequent(names)
      if (!participant) return
      const d = buildState({ selectedParticipants: [participant] })
      const matchesParticipant = (n) => (n._raw?.participants || []).some(p => (p?.name || p?.username) === participant)
      expectFilterMatches(d.filteredNodes.value, allNodes, matchesParticipant)
    })

    it('dueStatus="none" matches issues without a due date', () => {
      const expected = allNodes.filter(n => !(n.dueDate || n._raw?.due_date)).length
      if (expected === 0) return
      const d = buildState({ dueStatus: 'none' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => !(n.dueDate || n._raw?.due_date))
    })

    it('spentMode="has" returns only issues with timeSpent > 0', () => {
      const expected = allNodes.filter(n => (Number(n.timeSpent) || 0) > 0).length
      if (expected === 0) return
      const d = buildState({ spentMode: 'has' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (Number(n.timeSpent) || 0) > 0)
    })

    it('budgetMode="no_est" returns only issues with no time estimate', () => {
      const d = buildState({ budgetMode: 'no_est' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (Number(n.timeEstimate) || 0) <= 0)
    })

    it('estimateBucket="none" matches issues with no estimate', () => {
      const d = buildState({ estimateBucket: 'none' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => (Number(n.timeEstimate) || 0) <= 0)
    })

    it('taskMode="no_tasks" matches issues with no checklist items', () => {
      const tcsCount = (n) => Number(n._raw?.task_completion_status?.count) || 0
      const expected = allNodes.filter(n => tcsCount(n) === 0).length
      if (expected === 0) return
      const d = buildState({ taskMode: 'no_tasks' })
      expectFilterMatches(d.filteredNodes.value, allNodes, n => tcsCount(n) === 0)
    })

    it('searchQuery does substring match on title (case-insensitive)', () => {
      const sample = allNodes.find(n => typeof n._raw?.title === 'string' && n._raw.title.length >= 4)
      if (!sample) return
      const word = sample._raw.title.split(/\s+/).find(w => w.length >= 4 && /^[A-Za-z]+$/.test(w))
      if (!word) return
      const q = word.toLowerCase()
      const d = buildState({ searchQuery: word })
      expect(d.filteredNodes.value[String(sample.id)]).toBeTruthy()
      Object.values(d.filteredNodes.value).forEach(n => {
        const hay = [
          n._raw?.title, n._raw?.description, String(n.id), `#${n.id}`,
          n._raw?.author?.name, n._raw?.assignee?.name,
          ...((n._raw?.assignees || []).map(a => a.name)),
          n._raw?.milestone?.title,
          ...((n._raw?.labels || []))
        ].filter(Boolean).join(' ').toLowerCase()
        expect(hay.includes(q)).toBe(true)
      })
    })

    it('searchQuery with "#NNN" shortcut matches a single issue id only', () => {
      const sample = allNodes[0]
      if (!sample) return
      const d = buildState({ searchQuery: `#${sample.id}` })
      expect(Object.keys(d.filteredNodes.value)).toEqual([String(sample.id)])
    })

    it('createdMode=after with a far-past date includes everything', () => {
      const d = buildState({ dateFilters: { createdMode: 'after', createdAfter: '1970-01-01' } })
      expectFilterMatches(d.filteredNodes.value, allNodes, () => true)
    })

    it('createdMode=after with a far-future date excludes everything', () => {
      const d = buildState({ dateFilters: { createdMode: 'after', createdAfter: '2999-01-01' } })
      expect(Object.keys(d.filteredNodes.value)).toHaveLength(0)
    })

    it('createdMode=last_x_days windows recent issues', () => {
      const d = buildState({ dateFilters: { createdMode: 'last_x_days', createdDays: 1 } })
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 1)
      expectFilterMatches(d.filteredNodes.value, allNodes, n => {
        const t = n._raw?.created_at || n._raw?.date
        return !!t && new Date(t) >= cutoff
      })
    })

    it('filterCounts is contextual: active filters narrow OTHER dropdowns but not their own', () => {
      const author = mostFrequent(allNodes.map(n => n._raw?.author?.name))
      if (!author) return
      // With an author filter active...
      const d = buildState({ selectedAuthors: [author] })
      const fc = d.filterCounts.value

      // Author dropdown counts SKIP the authors filter → all authors still visible.
      const authorTotal = allNodes.filter(n => n._raw?.author?.name === author).length
      expect(fc.authors.get(author)).toBe(authorTotal)

      // Other dropdowns (e.g., status) only count tickets matching the active author filter.
      const expectedStatus = {}
      allNodes.forEach(n => {
        if (n._raw?.author?.name !== author) return
        const s = currentStatusOf(n._raw); expectedStatus[s] = (expectedStatus[s] || 0) + 1
      })
      for (const [status, total] of Object.entries(expectedStatus)) {
        expect(fc.status.get(status)).toBe(total)
      }
    })

    it('combining filters AND-s independent dimensions', () => {
      const author = mostFrequent(allNodes.map(n => n._raw?.author?.name))
      const status = mostFrequent(allNodes.map(n => currentStatusOf(n._raw)))
      if (!author || !status) return
      const expected = allNodes.filter(n => n._raw?.author?.name === author && currentStatusOf(n._raw) === status).length
      if (expected === 0) return
      const d = buildState({ selectedAuthors: [author], selectedStatuses: [status] })
      expectFilterMatches(d.filteredNodes.value, allNodes,
        n => n._raw?.author?.name === author && currentStatusOf(n._raw) === status)
    })
  })
}

if (fixtureFiles.length === 0) {
  describe.skip('useGraphDerivedState — fixture-backed filter regression (no *.unittestdata.json found)', () => {
    it('placeholder', () => {})
  })
} else {
  describe('useGraphDerivedState — fixture-backed filter regression', () => {
    for (const fname of fixtureFiles) {
      const fixture = JSON.parse(fs.readFileSync(path.join(projectRoot, fname), 'utf8'))
      runFixtureSuite(fname, fixture)
    }
  })
}
