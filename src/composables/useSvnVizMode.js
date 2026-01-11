import { ref, reactive, computed, watch, nextTick } from 'vue'

export function useSvnVizMode ({
  settings,
  nodes,
  edges,
  svnRecentCommits,
  canUseSvn,
  isElectron,
  activePage
}) {
  const vizMode = ref('issues') // 'issues' | 'svn' | 'chattools' (action)
  const lastGraphVizMode = ref('issues')
  const svnVizLimit = ref(2000)

  // Snapshot of the "issues" graph so we can switch modes without refetching
  const issueGraphSnapshot = reactive({
    nodes: {},
    edges: {}
  })

  const issueModePrefs = reactive({
    viewMode: 'state',
    groupingMode: 'none',
    linkMode: 'none'
  })

  const vizModeOptions = computed(() => {
    const base = [
      { title: 'Git tickets', value: 'issues' }
    ]
    if (canUseSvn.value) base.push({ title: 'SVN rev tree', value: 'svn' })
    if (isElectron.value) base.push({ title: 'Chat tools', value: 'chattools' })
    return base
  })

  const buildSvnVizGraph = () => {
    // Clear current graph data
    for (const k in nodes) delete nodes[k]
    for (const k in edges) delete edges[k]

    const limit = Math.max(100, Math.min(Number(svnVizLimit.value) || 2000, 5000))
    // Use most recent N revisions (svnRecentCommits is newest-first), but order them old -> new for left-to-right layout.
    let list = (svnRecentCommits.value || [])
      .slice(0, limit)
      .slice()
      .sort((a, b) => Number(a.revision) - Number(b.revision))

    // If no SVN data is present, show a small sample timeline.
    if (!list.length) {
      const baseRev = 1000
      list = Array.from({ length: 12 }).map((_, i) => {
        const rev = baseRev + i
        return {
          revision: rev,
          author: i % 3 === 0 ? 'alice' : (i % 3 === 1 ? 'bob' : 'carol'),
          date: new Date(Date.now() - (12 - i) * 3600 * 1000).toISOString(),
          message: `Sample commit r${rev} (mock)`,
          paths: [],
          __mock: true
        }
      })
    }

    // Build nodes
    list.forEach(commit => {
      const rev = String(commit.revision)
      const id = `svn-${rev}`
      const raw = {
        ...commit,
        title: commit.message || `r${rev}`,
        author: { name: commit.author || 'Unknown' },
        created_at: commit.date,
        updated_at: commit.date,
        state: 'svn',
        labels: [],
        __mock: !!commit.__mock
      }

      nodes[id] = {
        id,
        name: `r${rev} ${commit.author || 'Unknown'}`,
        color: '#6f42c1',
        updatedAt: commit.date,
        createdAt: commit.date,
        author: { name: commit.author || 'Unknown' },
        webUrl: '',
        type: 'svn_commit',
        _raw: raw
      }
    })

    // Build edges: sequential chain + copy-from edges if available
    for (let i = 0; i < list.length - 1; i++) {
      const a = `svn-${list[i].revision}`
      const b = `svn-${list[i + 1].revision}`
      edges[`rev-${a}-${b}`] = { source: a, target: b, label: 'prev' }
    }

    list.forEach(commit => {
      const to = `svn-${commit.revision}`
      ;(commit.paths || []).forEach(p => {
        if (!p || !p.copyFromRev) return
        const from = `svn-${p.copyFromRev}`
        if (nodes[from]) {
          const key = `copy-${from}-${to}-${p.path || ''}`
          edges[key] = { source: from, target: to, label: 'copy' }
        }
      })
    })
  }

  const applyVizMode = () => {
    if (vizMode.value === 'svn') {
      // Save current issues-mode prefs
      issueModePrefs.viewMode = settings.uiState.view.viewMode
      issueModePrefs.groupingMode = settings.uiState.view.groupingMode
      issueModePrefs.linkMode = settings.uiState.view.linkMode

      // Defaults for SVN tree
      settings.uiState.view.viewMode = 'author'
      settings.uiState.view.groupingMode = 'svn_revision'
      settings.uiState.view.linkMode = 'none'

      buildSvnVizGraph()
      return
    }

    // issues mode: restore snapshot
    for (const k in nodes) delete nodes[k]
    for (const k in edges) delete edges[k]
    Object.assign(nodes, issueGraphSnapshot.nodes)
    Object.assign(edges, issueGraphSnapshot.edges)

    // Restore user prefs for issues mode
    settings.uiState.view.viewMode = issueModePrefs.viewMode
    settings.uiState.view.groupingMode = issueModePrefs.groupingMode
    settings.uiState.view.linkMode = issueModePrefs.linkMode
  }

  watch(vizMode, async (v) => {
    // Special-case: "chattools" is a navigation action, not a persistent graph mode.
    if (v === 'chattools') {
      if (!isElectron.value) {
        await nextTick()
        vizMode.value = lastGraphVizMode.value || 'issues'
        return
      }
      activePage.value = 'chattools'
      // Snap back to the last graph mode so returning from ChatTools doesn't immediately re-open it.
      await nextTick()
      vizMode.value = lastGraphVizMode.value || 'issues'
      return
    }

    if (v === 'issues' || v === 'svn') lastGraphVizMode.value = v
    applyVizMode()
  })

  watch(svnVizLimit, () => {
    if (vizMode.value === 'svn') buildSvnVizGraph()
  })

  return {
    vizMode,
    svnVizLimit,
    issueGraphSnapshot,
    vizModeOptions,
    buildSvnVizGraph
  }
}

