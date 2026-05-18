import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import IssueList from './IssueList.vue'
import { ISSUE_LIST_DEFAULT_ORDER, sanitizeIssueListState } from '../utils/issueListColumns'

// IssueList is heavy on Vuetify slots — stub them down to plain DOM so we can
// mount in jsdom without pulling Vuetify CSS / icons.
const stubs = {
  'v-data-table': { template: '<div class="v-data-table-stub"><slot /></div>' },
  'v-icon': { template: '<i />' },
  'v-chip': { template: '<span><slot /></span>' },
  'v-menu': { template: '<div><slot /></div>' },
  'v-card': { template: '<div><slot /></div>' },
  'v-card-actions': { template: '<div><slot /></div>' },
  'v-divider': { template: '<hr />' },
  'v-list': { template: '<div><slot /></div>' },
  'v-list-item': { template: '<div><slot /></div>' },
  'v-list-item-title': { template: '<div><slot /></div>' },
  'v-spacer': { template: '<span />' },
  'v-btn': { template: '<button><slot /></button>' },
  'v-checkbox-btn': { template: '<input type="checkbox" />' }
}

const baseState = () => sanitizeIssueListState({})

const mkNode = (id, raw = {}, extra = {}) => ({
  id: String(id), type: 'gitlab_issue', _raw: raw, ...extra
})

const mountList = (props = {}) => mount(IssueList, {
  props: {
    nodes: {},
    columnState: baseState(),
    groupingMode: 'none',
    colorMode: 'state',
    dueSoonDays: 7,
    ...props
  },
  global: { stubs }
})

describe('IssueList — items mapping', () => {
  it('skips non-gitlab nodes and maps raw fields onto items', () => {
    const nodes = {
      '1': mkNode('1', {
        iid: 42, title: 'Hello', web_url: 'http://x/1', state: 'opened',
        labels: ['Priority::Blocking', 'Type::Bug', 'frontend'],
        author: { name: 'Alice', avatar_url: 'a' },
        assignees: [{ name: 'Bob', avatar_url: 'b' }, { name: 'Carl' }],
        milestone: { title: 'M1' },
        due_date: '2999-01-01',
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2021-01-01T00:00:00Z',
        user_notes_count: 5,
        weight: 3
      }, { timeEstimate: 3600, timeSpent: 1800, mergeRequestsCount: 2, hasTasks: true, taskStatus: '1 of 2 checklist items completed' }),
      'svn': { id: 'svn', type: 'svn_commit', _raw: {} }
    }
    const w = mountList({ nodes })
    const items = w.vm.items
    expect(items).toHaveLength(1)
    const it = items[0]
    expect(it.iid).toBe('42')
    expect(it.title).toBe('Hello')
    expect(it.url).toBe('http://x/1')
    expect(it.priority).toBe('Blocking')
    expect(it.priorityBucket).toBe('blocking')
    expect(it.type).toBe('Bug')
    expect(it.author).toBe('Alice')
    expect(it.assignees).toEqual(['Bob', 'Carl'])
    expect(it.assigneeAvatar).toBe('b')
    expect(it.milestone).toBe('M1')
    // scoped labels get stripped from the chip list
    expect(it.labels).toEqual(['frontend'])
    expect(it.comments).toBe(5)
    expect(it.weight).toBe(3)
    expect(it.timeEstimate).toBe(3600)
    expect(it.timeSpent).toBe(1800)
    expect(it.mergeRequestsCount).toBe(2)
    expect(it.hasTasks).toBe(true)
    expect(it.overdue).toBe(false) // future due date
  })

  it('flags overdue when open + due in the past', () => {
    const w = mountList({ nodes: {
      '1': mkNode('1', { state: 'opened', due_date: '2000-01-01', labels: [] })
    } })
    expect(w.vm.items[0].overdue).toBe(true)
  })
})

describe('IssueList — grouping', () => {
  const labelledNodes = {
    '1': mkNode('1', { state: 'opened', labels: ['Priority::High'], assignees: [{ name: 'Alice' }] }),
    '2': mkNode('2', { state: 'closed', labels: [], assignees: [] }),
    '3': mkNode('3', { state: 'opened', labels: ['Priority::High'], assignees: [{ name: 'Alice' }] })
  }

  it('groupingMode=none leaves _group undefined and headers omit the stub', () => {
    const w = mountList({ nodes: labelledNodes })
    expect(w.vm.items.every(i => i._group === undefined)).toBe(true)
    expect(w.vm.headers.some(h => h.key === '_group')).toBe(false)
  })

  it('groupingMode=state buckets by Open/Closed and inserts _group stub column', () => {
    const w = mountList({ nodes: labelledNodes, groupingMode: 'state' })
    const groups = w.vm.items.map(i => i._group).sort()
    expect(groups).toEqual(['Closed', 'Open', 'Open'])
    // Stub column uses Vuetify's internal key so its auto-injected group
    // column is suppressed; groupBy still references the `_group` field on items.
    expect(w.vm.headers[0].key).toBe('data-table-group')
    expect(w.vm.groupBy).toEqual([{ key: '_group', order: 'asc' }])
    expect(w.vm.isGrouped).toBe(true)
  })

  it('groupingMode=assignee falls back to "(Unassigned)" when none set', () => {
    const w = mountList({ nodes: labelledNodes, groupingMode: 'assignee' })
    const groups = w.vm.items.map(i => i._group).sort()
    expect(groups).toEqual(['(Unassigned)', 'Alice', 'Alice'])
  })

  it('group toggle persists closedGroups via update:columnState', async () => {
    const w = mountList({ nodes: labelledNodes, groupingMode: 'state' })
    // Fake Vuetify's group-header callable
    const toggleGroup = vi.fn()
    w.vm.onGroupToggle({ value: 'Open' }, toggleGroup)
    expect(toggleGroup).toHaveBeenCalled()
    const last = w.emitted('update:columnState').at(-1)[0]
    expect(last.closedGroups).toContain('Open')

    await w.setProps({ columnState: { ...last } })
    w.vm.onGroupToggle({ value: 'Open' }, toggleGroup)
    const next = w.emitted('update:columnState').at(-1)[0]
    expect(next.closedGroups).not.toContain('Open')
  })
})

describe('IssueList — color modes', () => {
  const nodes = {
    '1': mkNode('1', { state: 'opened', labels: ['Priority::Blocking'] }),
    '2': mkNode('2', { state: 'closed', labels: [] })
  }

  it('colorMode=state paints open green and closed grey', () => {
    const w = mountList({ nodes, colorMode: 'state' })
    const byId = Object.fromEntries(w.vm.items.map(i => [i.id, i._color]))
    expect(byId['1']).toBe('#43a047')
    expect(byId['2']).toBe('#90a4ae')
  })

  it('colorMode=priority maps via priorityBucket', () => {
    const w = mountList({ nodes, colorMode: 'priority' })
    const byId = Object.fromEntries(w.vm.items.map(i => [i.id, i._color]))
    // blocking → red, none (no priority label) → neutral grey
    expect(byId['1']).toBe('#d32f2f')
    expect(byId['2']).toBe('rgba(127,127,127,0.45)')
  })

  it('colorLegend reflects mode and counts per legend entry', () => {
    const w = mountList({ nodes, colorMode: 'state' })
    const legend = w.vm.colorLegend
    expect(legend.map(e => e.label)).toEqual(['Open', 'Closed'])
    expect(legend.find(e => e.label === 'Open').count).toBe(1)
    expect(legend.find(e => e.label === 'Closed').count).toBe(1)
  })

  it('colorMode=none returns an empty legend', () => {
    const w = mountList({ nodes, colorMode: 'none' })
    expect(w.vm.colorLegend).toEqual([])
  })
})

describe('IssueList — column state mutations', () => {
  const node = { '1': mkNode('1', { state: 'opened', labels: [] }) }

  it('toggleHidden adds/removes the column from the hidden set', async () => {
    const w = mountList({ nodes: node })
    w.vm.toggleHidden('title', false) // false = hide
    let upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.hidden).toContain('title')

    await w.setProps({ columnState: { ...upd } })
    w.vm.toggleHidden('title', true) // true = show again
    upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.hidden).not.toContain('title')
  })

  it('setSort / addSort / clearSortFor manage sortBy', async () => {
    const w = mountList({ nodes: node })
    w.vm.setSort('iid', 'asc')
    let upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.sortBy).toEqual([{ key: 'iid', order: 'asc' }])

    await w.setProps({ columnState: { ...upd } })
    w.vm.addSort('title', 'desc')
    upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.sortBy).toEqual([{ key: 'iid', order: 'asc' }, { key: 'title', order: 'desc' }])

    await w.setProps({ columnState: { ...upd } })
    w.vm.clearSortFor('iid')
    upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.sortBy).toEqual([{ key: 'title', order: 'desc' }])
  })

  it('clearSortFor falls back to default sort when sortBy would be empty', () => {
    const w = mountList({ nodes: node, columnState: { ...baseState(), sortBy: [{ key: 'iid', order: 'asc' }] } })
    w.vm.clearSortFor('iid')
    const upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.sortBy).toEqual([{ key: 'updatedAt', order: 'desc' }])
  })

  it('cycleSort cycles asc → desc → cleared', async () => {
    const w = mountList({ nodes: node })
    w.vm.cycleSort('iid')
    expect(w.emitted('update:columnState').at(-1)[0].sortBy).toEqual([{ key: 'iid', order: 'asc' }])

    await w.setProps({ columnState: w.emitted('update:columnState').at(-1)[0] })
    w.vm.cycleSort('iid')
    expect(w.emitted('update:columnState').at(-1)[0].sortBy).toEqual([{ key: 'iid', order: 'desc' }])

    await w.setProps({ columnState: w.emitted('update:columnState').at(-1)[0] })
    w.vm.cycleSort('iid')
    expect(w.emitted('update:columnState').at(-1)[0].sortBy).toEqual([{ key: 'updatedAt', order: 'desc' }])
  })

  it('moveColumn rewrites the order to start or end', () => {
    const w = mountList({ nodes: node })
    w.vm.moveColumn('title', 'start')
    const upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.order[0]).toBe('title')
  })

  it('hideAllColumns keeps Title visible so the user can recover', () => {
    const w = mountList({ nodes: node })
    w.vm.hideAllColumns()
    const upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.hidden).not.toContain('title')
    expect(upd.hidden.length).toBe(ISSUE_LIST_DEFAULT_ORDER.length - 1)
  })

  it('resetAll restores defaults', () => {
    const w = mountList({
      nodes: node,
      columnState: { order: ['title', 'iid'], hidden: ['state'], widths: { title: 500 }, sortBy: [{ key: 'iid', order: 'asc' }], closedGroups: ['x'] }
    })
    w.vm.resetAll()
    const upd = w.emitted('update:columnState').at(-1)[0]
    expect(upd.order).toEqual(ISSUE_LIST_DEFAULT_ORDER)
    expect(upd.hidden).toEqual([])
    expect(upd.widths).toEqual({})
    expect(upd.sortBy).toEqual([{ key: 'updatedAt', order: 'desc' }])
    expect(upd.closedGroups).toEqual([])
  })
})

describe('IssueList — misc', () => {
  it('row click opens issue URL in the configured target', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountList({
      nodes: { '1': mkNode('1', { state: 'opened', labels: [], web_url: 'http://x/1' }) },
      issueOpenTarget: '_self'
    })
    w.vm.onRowClick({}, { item: w.vm.items[0] })
    expect(openSpy).toHaveBeenCalledWith('http://x/1', '_self')
    openSpy.mockRestore()
  })

  it('formatDuration / initialsOf produce expected short strings', () => {
    const w = mountList()
    expect(w.vm.formatDuration(0)).toBe('')
    expect(w.vm.formatDuration(30 * 60)).toBe('30m')
    expect(w.vm.formatDuration(2 * 3600)).toBe('2h')
    expect(w.vm.formatDuration(8 * 3600)).toBe('1d') // GitLab convention: 1d = 8h
    expect(w.vm.initialsOf('Alice Bob')).toBe('AB')
    expect(w.vm.initialsOf('')).toBe('?')
  })

  it('relativeTime grows from "just now" to years', () => {
    const w = mountList()
    const now = Date.now()
    expect(w.vm.relativeTime(0)).toBe('—')
    expect(w.vm.relativeTime(now - 5_000)).toBe('just now')
    expect(w.vm.relativeTime(now - 10 * 60_000)).toMatch(/m ago$/)
    expect(w.vm.relativeTime(now - 5 * 86_400_000)).toMatch(/d ago$/)
    expect(w.vm.relativeTime(now - 800 * 86_400_000)).toMatch(/y ago$/)
  })

  it('toggleLegendPin selects / clears the pinned color', async () => {
    const w = mountList({
      nodes: { '1': mkNode('1', { state: 'opened', labels: [] }) },
      colorMode: 'state'
    })
    w.vm.toggleLegendPin('#43a047')
    await nextTick()
    expect(w.vm.effectiveLegendColor).toBe('#43a047')
    w.vm.toggleLegendPin('#43a047')
    await nextTick()
    expect(w.vm.effectiveLegendColor).toBe(null)
  })
})
