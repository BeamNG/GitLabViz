import { createGitLabClient, updateIssue } from '../services/gitlab'

export function useGitLabIssueMutations ({
  settings,
  nodes,
  issueGraph,
  resolveGitLabApiBaseUrl,
  snackbarText,
  snackbar
}) {
  const onIssueStateChange = async ({ iid, state_event } = {}) => {
    const issueIid = String(iid || '').trim()
    const ev = String(state_event || '').trim()
    if (!issueIid || (ev !== 'close' && ev !== 'reopen')) return

    if (!settings.meta.gitlabCanWrite) {
      alert('Write is disabled for this token (needs api scope).')
      return
    }
    if (!settings.config.enableGitLab) return

    const baseUrl = resolveGitLabApiBaseUrl()
    if (!baseUrl || !settings.config.projectId || !settings.config.token) {
      alert('Missing GitLab URL / Project / Token.')
      return
    }

    try {
      const client = createGitLabClient(baseUrl, settings.config.token)
      const prev = nodes[issueIid]?._raw || null
      const updated = await updateIssue(client, settings.config.projectId, issueIid, { state_event: ev })
      // REST update responses can omit fields we rely on for grouping (ex: epic/iteration).
      if (updated && prev) {
        if (updated.epic == null && prev.epic) updated.epic = prev.epic
        if (updated.epic_iid == null && prev.epic_iid) updated.epic_iid = prev.epic_iid
        if (updated.iteration == null && prev.iteration) updated.iteration = prev.iteration
      }
      if (issueGraph.value && issueGraph.value.markDataOnlyUpdate) issueGraph.value.markDataOnlyUpdate()
      if (nodes[issueIid]) nodes[issueIid]._raw = updated
      snackbarText.value = ev === 'close' ? `Closed #${issueIid}` : `Reopened #${issueIid}`
      snackbar.value = true
    } catch (e) {
      const status = e?.response?.status
      const msg = status ? `GitLab error ${status}: ${e?.message || String(e)}` : (e?.message || String(e))
      alert(msg)
    }
  }

  const onIssueAssigneeChange = async ({ iid, assignee_ids } = {}) => {
    const issueIid = String(iid || '').trim()
    const list = Array.isArray(assignee_ids) ? assignee_ids : null
    if (!issueIid || !list) return

    if (!settings.meta.gitlabCanWrite) {
      alert('Write is disabled for this token (needs api scope).')
      return
    }
    if (!settings.config.enableGitLab) return

    const baseUrl = resolveGitLabApiBaseUrl()
    if (!baseUrl || !settings.config.projectId || !settings.config.token) {
      alert('Missing GitLab URL / Project / Token.')
      return
    }

    try {
      const client = createGitLabClient(baseUrl, settings.config.token)
      const prev = nodes[issueIid]?._raw || null
      const updated = await updateIssue(client, settings.config.projectId, issueIid, { assignee_ids: list })

      // Keep the rest of the app consistent (some parts use _raw.assignee directly).
      if (updated) {
        if (!updated.assignee && Array.isArray(updated.assignees) && updated.assignees.length) updated.assignee = updated.assignees[0]
        if (Array.isArray(updated.assignees) && updated.assignees.length === 0) updated.assignee = null
      }

      // REST update responses can omit fields we rely on for grouping (ex: epic/iteration).
      if (updated && prev) {
        if (updated.epic == null && prev.epic) updated.epic = prev.epic
        if (updated.epic_iid == null && prev.epic_iid) updated.epic_iid = prev.epic_iid
        if (updated.iteration == null && prev.iteration) updated.iteration = prev.iteration
      }

      if (issueGraph.value && issueGraph.value.markDataOnlyUpdate) issueGraph.value.markDataOnlyUpdate()
      if (nodes[issueIid]) nodes[issueIid]._raw = updated
      snackbarText.value = list.length ? `Assigned #${issueIid}` : `Unassigned #${issueIid}`
      snackbar.value = true
    } catch (e) {
      const status = e?.response?.status
      const msg = status ? `GitLab error ${status}: ${e?.message || String(e)}` : (e?.message || String(e))
      alert(msg)
    }
  }

  return { onIssueStateChange, onIssueAssigneeChange }
}

