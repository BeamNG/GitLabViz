import { renderMarkdown, highlightKeywordsInHtml } from './utils'
import { buildPostPermalink } from './threadFormat'

const nowMs = () => Date.now()

const mkPost = (id, hoursAgo, message) => ({
  id,
  create_at: nowMs() - Math.round(hoursAgo * 3600 * 1000),
  message,
  user_id: `u-${id}`,
  channel_id: `c-${id}`,
  __mock: true
})

export function mockSavedPosts (baseUrl) {
  const team = { id: 't-mock', name: 'mock-team', display_name: 'Mock Team', __mock: true }
  const channel = { id: 'c-mock', name: 'mock-channel', display_name: 'mock-channel', type: 'O', team_id: team.id, __mock: true }
  const author = { id: 'u-mock', username: 'mock-user', __mock: true }

  const posts = [
    mkPost('p1', 3.2, 'Sample saved post with `code` and a link: https://example.com'),
    mkPost('p2', 18.5, 'Another saved post.\n\n- bullet\n- list\n\n```js\nconsole.log(\"hello\")\n```')
  ]

  return posts.map((post, i) => ({
    post,
    channel,
    team,
    author,
    ageHours: (nowMs() - Number(post.create_at || 0)) / 3600_000,
    html: renderMarkdown(post.message || ''),
    permalink: buildPostPermalink(baseUrl, team, post.id),
    __mock: true
  }))
}

export function mockHighlights (baseUrl) {
  const team = { id: 't-mock', name: 'mock-team', display_name: 'Mock Team', __mock: true }
  const channel = { id: 'c-hl', name: 'mock-highlights', display_name: 'mock-highlights', type: 'O', team_id: team.id, __mock: true }
  const author = { id: 'u-hl', username: 'mock-user', __mock: true }
  const keywords = ['VR', 'physics']

  const posts = [
    mkPost('h1', 1.0, 'Investigating VR rendering regressions in the new build.'),
    mkPost('h2', 9.5, 'Physics: suspension tweak needs review; possible instability at high speed.')
  ]

  return posts.map(post => {
    const html = highlightKeywordsInHtml(renderMarkdown(post.message || ''), keywords)
    const matched = keywords.filter(k => String(post.message || '').toLowerCase().includes(k.toLowerCase()))
    return {
      post,
      channel,
      team,
      author,
      ageHours: (nowMs() - Number(post.create_at || 0)) / 3600_000,
      matchedKeywords: matched,
      html,
      permalink: buildPostPermalink(baseUrl, team, post.id),
      __mock: true
    }
  })
}

export function mockUnanswered (baseUrl) {
  const team = { id: 't-mock', name: 'mock-team', display_name: 'Mock Team', __mock: true }
  const channel = { id: 'c-un', name: 'mock-support', display_name: 'mock-support', type: 'O', team_id: team.id, __mock: true }
  const author = { id: 'u-un', username: 'mock-reporter', __mock: true }

  const post = mkPost('u1', 36, 'Can someone confirm if this is expected behavior?')
  const unanswered = [{
    post,
    channel,
    team,
    author,
    ageHours: (nowMs() - Number(post.create_at || 0)) / 3600_000,
    html: renderMarkdown(post.message || ''),
    permalink: buildPostPermalink(baseUrl, team, post.id),
    aiLoading: false,
    aiResult: { success: true, action_needed: true, who: 'programmer', reason: 'Needs confirmation and follow-up investigation.' },
    __mock: true
  }]

  const omitted = [{
    channel: { id: 'c-om', name: 'excluded-channel', display_name: 'excluded-channel', type: 'O', team_id: team.id, __mock: true },
    team,
    reason: 'In exclude list',
    __mock: true
  }]

  return { unanswered, omitted }
}

export function mockThreadChecker (baseUrl) {
  const team = { id: 't-mock', name: 'mock-team', display_name: 'Mock Team', __mock: true }
  const channel = { id: 'c-tc', name: 'mock-dev', display_name: 'mock-dev', type: 'O', team_id: team.id, __mock: true }
  const author = { id: 'u-tc', username: 'mock-dev', __mock: true }

  const posts = [
    mkPost('tc1', 2.0, 'Part 1: update status...'),
    mkPost('tc2', 1.9, 'Part 2: more details...'),
    mkPost('tc3', 1.8, 'Part 3: and one more message...')
  ].map(p => ({
    ...p,
    _html: renderMarkdown(p.message || ''),
    _permalink: buildPostPermalink(baseUrl, team, p.id),
    __mock: true
  }))

  return [{
    channel,
    team,
    author,
    posts,
    __mock: true
  }]
}

export function mockThreadSummary () {
  return {
    postId: 'mock-post-id-xxxxxxxxxxxxxxxxxxxx',
    summary: 'Sample summary: one paragraph per topic. This is placeholder text until you run the tool.',
    threadLength: 12,
    participantCount: 4,
    __mock: true
  }
}

export function mockStatistics () {
  return {
    meta: { totalMsgs: 1240, channels: 18, users: 42, __mock: true },
    contributors: { labels: ['alice', 'bob', 'carol', 'dan'], data: [320, 260, 180, 140] },
    channels: { labels: ['dev', 'support', 'art', 'qa'], data: [410, 300, 220, 160] },
    perDay: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [120, 180, 210, 190, 240, 160, 140] }
  }
}

export function mockTeamProgress () {
  const days = 7
  const dayLabels = Array.from({ length: days }).map((_, i) => {
    const d = new Date(Date.now() - (days - i) * 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const mkSeries = (base) => dayLabels.map((_, i) => Math.max(0, Math.round(base + (Math.sin(i * 1.1) * 2))))

  const members = [
    { id: 'alice', display: 'Alice', mattermost: 'alice', git: 'Alice', svn: 'Alice' },
    { id: 'bob', display: 'Bob', mattermost: 'bob', git: 'Bob', svn: 'Bob' },
    { id: 'carol', display: 'Carol', mattermost: 'carol', git: 'Carol', svn: 'Carol' }
  ]

  const rows = members.map((m, idx) => {
    const commitSeries = mkSeries(2 + idx)
    const chatSeries = mkSeries(5 + idx * 2)
    const gitSeries = commitSeries.map(v => Math.max(0, v - 1))
    const svnSeries = commitSeries.map(v => Math.max(0, v - 1 - (idx % 2)))
    return {
      id: m.id,
      display: m.display,
      mattermost: m.mattermost,
      git: m.git,
      svn: m.svn,
      commit_series: commitSeries,
      git_series: gitSeries,
      svn_series: svnSeries,
      chat_series: chatSeries,
      commit_total: commitSeries.reduce((a, b) => a + b, 0),
      chat_total: chatSeries.reduce((a, b) => a + b, 0),
      __mock: true
    }
  })

  return { days, dayLabels, rows, __mock: true }
}


