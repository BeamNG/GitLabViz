<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Team Progress</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="2">
          <v-text-field v-model.number="cfg.days" type="number" min="1" label="Days" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="5">
          <v-text-field v-model="cfg.repo_git" label="Git repo path" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="5">
          <v-text-field v-model="cfg.repo_svn" label="SVN repo path (git-svn mirror)" density="compact" variant="outlined" />
        </v-col>
      </v-row>

      <v-row dense class="mt-1">
        <v-col cols="12" md="6">
          <v-text-field v-model="cfg.git_commit_url_template" label="Git commit URL template (optional)" density="compact" variant="outlined" hint="Use {sha}. Example: https://gitlab.example.com/group/proj/-/commit/{sha}" persistent-hint />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field v-model="cfg.svn_rev_url_template" label="SVN revision URL template (optional)" density="compact" variant="outlined" hint="Use {rev}. Example: https://svn.example.com/revisions/{rev}" persistent-hint />
        </v-col>
      </v-row>

      <div class="d-flex align-center mt-2" style="gap: 8px;">
        <v-btn color="primary" :loading="loading" @click="run">Run</v-btn>
        <v-btn variant="text" @click="toggleView">{{ viewLabel }}</v-btn>
        <div class="text-caption text-medium-emphasis">{{ status }}</div>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>
      <v-alert v-if="isSample" type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-flask-outline">
        Sample output (mock)
      </v-alert>

      <v-divider class="my-4" />

      <div class="text-subtitle-2 mb-2">Roster</div>
      <v-row dense>
        <v-col cols="12" md="4" v-for="m in members" :key="m.id">
          <v-card variant="tonal">
            <v-card-text>
              <v-text-field v-model="m.display" label="Display" density="compact" variant="outlined" class="mb-2" />
              <v-text-field v-model="m.git" label="Repo #1 author" density="compact" variant="outlined" class="mb-2" />
              <v-text-field v-model="m.svn" label="Repo #2 author" density="compact" variant="outlined" class="mb-2" />
              <v-text-field v-model="m.mattermost" label="Mattermost username" density="compact" variant="outlined" class="mb-2" />
              <div class="d-flex justify-end">
                <v-btn size="small" variant="text" color="error" @click="removeMember(m.id)">Remove</v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card variant="outlined">
            <v-card-text>
              <v-btn block variant="tonal" prepend-icon="mdi-plus" @click="addMember">Add member</v-btn>
              <div class="text-caption text-medium-emphasis mt-2">
                Team Progress uses local git history + Mattermost message counts.
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <div class="text-subtitle-2 mb-2">Results</div>

      <v-row dense v-if="rows.length">
        <v-col cols="12" md="4" v-for="r in rows" :key="r.id">
          <v-card variant="outlined">
            <v-card-title class="text-subtitle-2 d-flex align-center justify-space-between">
              <span>{{ r.display }}</span>
              <span class="text-caption text-medium-emphasis">{{ cfg.days }}d</span>
            </v-card-title>
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-1">
                <div class="text-caption text-medium-emphasis">Commits</div>
                <v-btn size="x-small" variant="text" @click="openCommits(r)">Details</v-btn>
              </div>
              <Sparkline :series="r.commit_series" color="#7ee787" />
              <div class="text-caption mt-1">
                Total: <strong>{{ r.commit_total }}</strong>
              </div>

              <div class="d-flex align-center justify-space-between mt-4 mb-1">
                <div class="text-caption text-medium-emphasis">Chat</div>
                <v-btn size="x-small" variant="text" @click="openChat(r)">Channels</v-btn>
              </div>
              <Sparkline :series="r.chat_series" color="#4dabf7" />
              <div class="text-caption mt-1">
                Total: <strong>{{ r.chat_total }}</strong>
              </div>

              <div v-if="cfg.view === 'hourly'" class="mt-4">
                <div class="text-caption text-medium-emphasis mb-1">Hourly (preview)</div>
                <HourlyMiniTable :matrix="r.hourly_commit" label="Commits" />
                <HourlyMiniTable :matrix="r.hourly_chat" label="Chat" class="mt-2" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div v-else class="text-body-2 text-medium-emphasis">
        No results yet.
      </div>

      <v-dialog v-model="showDialog" max-width="900">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>{{ dialogTitle }}</span>
            <v-btn icon="mdi-close" variant="text" @click="showDialog = false" />
          </v-card-title>
          <v-divider />
          <v-card-text style="max-height: 65vh; overflow: auto;">
            <div v-if="dialogMode === 'commits'">
              <div v-if="dialogCommands.length" class="mb-3">
                <div class="text-caption text-medium-emphasis mb-1">Commands</div>
                <pre v-for="(c, i) in dialogCommands" :key="i" style="white-space: pre-wrap;">{{ c }}</pre>
              </div>
              <div v-if="dialogItems.length === 0" class="text-body-2 text-medium-emphasis">No commits.</div>
              <div v-else>
                <div v-for="c in dialogItems" :key="c.sha" class="mb-3">
                  <div class="text-caption text-medium-emphasis">
                    <a v-if="c.url" :href="c.url" target="_blank" rel="noreferrer">{{ c.date_human }}</a>
                    <span v-else>{{ c.date_human }}</span>
                    <span v-if="c.branches && c.branches.length" class="ml-2">
                      <v-chip v-for="b in c.branches" :key="b" size="x-small" variant="tonal" class="mr-1">{{ b }}</v-chip>
                    </span>
                    <span class="ml-2">{{ c.head }}</span>
                  </div>
                  <pre v-if="c.tail" style="white-space: pre-wrap; margin: 0;">{{ c.tail }}</pre>
                </div>
              </div>
            </div>
            <div v-else-if="dialogMode === 'chat'">
              <div v-if="dialogItems.length === 0" class="text-body-2 text-medium-emphasis">No messages found.</div>
              <v-table v-else density="compact">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">/day</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in dialogItems" :key="`${c.team}-${c.name}`">
                    <td>
                      <div>{{ c.name }}</div>
                      <div class="text-caption text-medium-emphasis">{{ c.team }}</div>
                    </td>
                    <td class="text-right">{{ c.count }}</td>
                    <td class="text-right">{{ (c.count / Math.max(1, cfg.days)).toFixed(1).replace(/\.0$/, '') }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useSettingsStore } from '../../composables/useSettingsStore'
import { MattermostClient } from '../../chatTools/mmClient'
import { mockTeamProgress } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.team_progress,
  set: v => { settings.config.mattermostTools.team_progress = v }
})

const loading = ref(false)
const status = ref('')
const error = ref('')
const hasRun = ref(false)

// Local editable roster (kept in settings)
const members = reactive((cfg.value.members || []).map(m => ({ ...m })))
watch(members, () => { cfg.value.members = members.map(m => ({ ...m })) }, { deep: true })

const rows = ref([])
const isSample = computed(() => !hasRun.value && rows.value.length > 0 && rows.value.every(r => r.__mock))

// lightweight sparklines + hourly mini tables
const Sparkline = defineComponent({
  name: 'Sparkline',
  props: {
    series: { type: Array, default: () => [] },
    color: { type: String, default: '' }
  },
  setup (props) {
    const c = ref(null)

    const draw = async () => {
      await nextTick()
      const el = c.value
      if (!el) return

      const series = Array.isArray(props.series) ? props.series.map(n => Number(n) || 0) : []
      const w = el.clientWidth || 300
      const hgt = 42
      const dpr = window.devicePixelRatio || 1
      el.width = Math.floor(w * dpr)
      el.height = Math.floor(hgt * dpr)

      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, hgt)

      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.beginPath()
      ctx.moveTo(0, hgt - 1)
      ctx.lineTo(w, hgt - 1)
      ctx.stroke()

      if (!series.length) return
      const max = Math.max(1, ...series)
      const step = series.length > 1 ? (w / (series.length - 1)) : w
      ctx.strokeStyle = props.color || '#4dabf7'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < series.length; i++) {
        const x = i * step
        const y = hgt - 2 - (series[i] / max) * (hgt - 6)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    onMounted(draw)
    watch(() => props.series, draw, { deep: true })
    watch(() => props.color, draw)

    return () => h('canvas', { ref: c, style: 'width: 100%; height: 42px;' })
  }
})

const HourlyMiniTable = defineComponent({
  name: 'HourlyMiniTable',
  props: {
    matrix: { type: Array, default: () => [] },
    label: { type: String, default: '' }
  },
  setup (props) {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const fmt = (v) => {
      const n = Number(v) || 0
      return n ? n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : ''
    }

    return () => {
      const matrix = Array.isArray(props.matrix) ? props.matrix : []
      if (!matrix.length) return null

      return h('div', { class: 'tp-mini' }, [
        h('div', { class: 'text-caption text-medium-emphasis mb-1' }, props.label),
        h('div', { style: 'overflow-x: auto;' }, [
          h('table', { class: 'tp-mini-table' }, [
            h('tbody', {}, matrix.map((row, di) => {
              const r = Array.isArray(row) ? row : []
              return h('tr', { key: di }, [
                h('td', { class: 'text-caption text-medium-emphasis', style: 'width: 36px; padding: 2px 6px 2px 0;' }, dayNames[di] || ''),
                ...r.map((v, hi) => h('td', { key: hi, style: 'padding: 2px 4px; font-variant-numeric: tabular-nums; white-space: nowrap;' }, fmt(v)))
              ])
            }))
          ])
        ])
      ])
    }
  }
})

const ensureId = (m) => {
  const base = (m.mattermost || m.display || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return base || `member_${Date.now()}`
}

const addMember = () => {
  members.push({ id: `m_${Date.now()}`, display: 'New', mattermost: '', git: '', svn: '' })
}

const removeMember = (id) => {
  const idx = members.findIndex(m => m.id === id)
  if (idx >= 0) members.splice(idx, 1)
}

const toggleView = () => {
  cfg.value.view = (cfg.value.view === 'summary') ? 'hourly' : 'summary'
}
const viewLabel = computed(() => cfg.value.view === 'summary' ? 'Switch to hourly' : 'Switch to summary')

// Dialogs
const showDialog = ref(false)
const dialogTitle = ref('')
const dialogMode = ref('commits') // commits | chat
const dialogItems = ref([])
const dialogCommands = ref([])

// Seed sample initially
const seedSample = () => {
  const s = mockTeamProgress()
  rows.value = s.rows
  status.value = 'Showing sample data.'
}
seedSample()

async function gitRun (cwd, args, timeoutMs) {
  if (!window.electronAPI || !window.electronAPI.gitRun) throw new Error('gitRun IPC not available')
  const res = await window.electronAPI.gitRun({ cwd, args, timeoutMs })
  if (!res || !res.success) throw new Error(res?.error || 'git-run failed')
  return String(res.stdout || '')
}

function splitCommitMessage (body) {
  const lines = String(body || '').split('\n')
  const head = (lines[0] || '').trim()
  const tail = lines.slice(1).join('\n').trim()
  return { head, tail }
}

function parseGitLogDaily (stdout) {
  const counts = new Map()
  for (const line of String(stdout || '').split('\n')) {
    const d = line.trim()
    if (!d) continue
    counts.set(d, (counts.get(d) || 0) + 1)
  }
  return counts
}

function dayKeys (days) {
  const d = Math.max(1, Number(days) || 7)
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (d - 1))
  const keys = []
  for (let i = 0; i < d; i++) {
    const x = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    keys.push(x.toISOString().slice(0, 10))
  }
  return { keys, start, end }
}

function parseIsoDate (s) {
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseWeekHourMatrix (stdout, startDay, endDay) {
  const mat = Array.from({ length: 7 }).map(() => Array.from({ length: 24 }).map(() => 0))
  const startIso = startDay.toISOString().slice(0, 10)
  const endIso = endDay.toISOString().slice(0, 10)
  for (const line of String(stdout || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    const dt = parseIsoDate(s)
    if (!dt) continue
    const day = dt.toISOString().slice(0, 10)
    if (day < startIso || day > endIso) continue
    const wd = ((dt.getDay() + 6) % 7) // Mon=0..Sun=6
    mat[wd][dt.getHours()] += 1
  }
  return mat
}

async function openCommits (row) {
  dialogMode.value = 'commits'
  dialogTitle.value = `Commits: ${row.display}`
  dialogItems.value = []
  dialogCommands.value = []
  showDialog.value = true

  if (!hasRun.value || row.__mock) {
    dialogItems.value = [
      { sha: 'mock', date_human: 'mock', url: '', branches: ['feature-x'], ...splitCommitMessage('Sample commit message') }
    ]
    return
  }

  // Minimal “feature parity”: show git and svn repo commits merged, like Python.
  const { start, end } = dayKeys(cfg.value.days)
  const since = start.toISOString().slice(0, 10)
  const until = `${end.toISOString().slice(0, 10)} 23:59:59`
  const baseArgs = ['--remotes=origin', '--exclude=refs/remotes/origin/HEAD']
  const fmt = '%H%x00%aI%x00%D%x00%B%x00COMMIT_END_MARKER'

  const commits = []
  const commands = []

  const runRepo = async (repoPath, author, repoType) => {
    if (!repoPath || !author) return
    const args = ['--no-pager', 'log', ...baseArgs, `--since=${since}`, `--until=${until}`, '--regexp-ignore-case', `--author=${author}`, `--format=${fmt}`, '--date=iso-strict']
    commands.push(`cd "${repoPath}" && git ${args.join(' ')}`)
    const out = await gitRun(repoPath, args, 60000)
    const chunks = out.split('COMMIT_END_MARKER\n')
    for (const ch of chunks) {
      const t = ch.trim()
      if (!t) continue
      const parts = t.split('\x00')
      if (parts.length < 4) continue
      const sha = parts[0]
      const dateIso = parts[1]
      const refs = parts[2]
      const body = parts[3]
      const dt = parseIsoDate(dateIso)
      const dateHuman = dt ? `${dt.toISOString().slice(0, 16).replace('T', ' ')}` : dateIso
      const branches = []
      for (const r of String(refs || '').split(',')) {
        let x = r.trim()
        if (!x) continue
        if (x.includes('->')) x = x.split('->')[1].trim()
        x = x.replace(/^origin\//, '')
        if (['master', 'trunk', 'HEAD'].includes(x)) continue
        if (!branches.includes(x)) branches.push(x)
      }
      // svn rev from git-svn-id
      let url = ''
      let refId = sha.slice(0, 8)
      if (repoType === 'git') {
        const tpl = String(cfg.value.git_commit_url_template || '')
        url = tpl ? tpl.replace('{sha}', sha) : ''
      } else {
        const m = String(body || '').match(/git-svn-id:\s.*@(\d+)\s/i)
        if (m) {
          refId = `r${m[1]}`
          const tpl = String(cfg.value.svn_rev_url_template || '')
          url = tpl ? tpl.replace('{rev}', m[1]) : ''
        }
      }
      const { head, tail } = splitCommitMessage(body)
      commits.push({ sha, date_iso: dateIso, date_human: dateHuman, ref_id: refId, url, branches, head, tail, ts: dt ? dt.getTime() : 0 })
    }
  }

  await runRepo(cfg.value.repo_git, row.git, 'git')
  await runRepo(cfg.value.repo_svn, row.svn, 'svn')

  commits.sort((a, b) => (b.ts || 0) - (a.ts || 0))
  dialogItems.value = commits
  dialogCommands.value = commands
}

async function openChat (row) {
  dialogMode.value = 'chat'
  dialogTitle.value = `Messages: ${row.display}`
  dialogItems.value = []
  dialogCommands.value = []
  showDialog.value = true

  if (!hasRun.value || row.__mock) {
    dialogItems.value = [
      { team: 'Mock Team', name: 'mock-dev', count: 12 },
      { team: 'Mock Team', name: 'mock-support', count: 5 }
    ]
    return
  }

  const api = new MattermostClient({ baseUrl: baseUrl.value, token: token.value })
  const u = await api.userByUsername(row.mattermost)
  const uid = u?.id
  if (!uid) throw new Error('Chat user not found')

  const { start, end } = dayKeys(cfg.value.days)
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)

  const teams = await api.teams()
  const out = []
  let total = 0
  for (const t of teams) {
    const teamName = t.display_name || t.name || t.id
    const channels = await api.teamChannels(t.id)
    for (const c of channels) {
      const channelName = c.display_name || c.name || c.id
      let page = 0
      let count = 0
      let stop = false
      while (true) {
        const postsData = await api.posts(c.id, { perPage: 200, page })
        const posts = postsData?.posts || {}
        const order = Array.isArray(postsData?.order) ? postsData.order : []
        if (!order.length) break
        for (const pid of order) {
          const p = posts[pid]
          if (!p) continue
          const ts = new Date(Number(p.create_at || 0))
          const day = ts.toISOString().slice(0, 10)
          if (day > endIso) continue
          if (day < startIso) { stop = true; break }
          if (p.type || p?.props?.from_bot) continue
          if (p.user_id === uid) count++
        }
        if (stop || order.length < 200) break
        page++
      }
      if (count > 0) {
        out.push({ team: teamName, name: channelName, count })
        total += count
      }
    }
  }
  out.sort((a, b) => b.count - a.count)
  dialogItems.value = out
  status.value = `Total messages: ${total}`
}

async function run () {
  error.value = ''
  status.value = ''
  hasRun.value = true
  loading.value = true
  try {
    const days = Math.max(1, Number(cfg.value.days) || 7)
    const { keys, start, end } = dayKeys(days)
    const since = start.toISOString().slice(0, 10)
    const until = `${end.toISOString().slice(0, 10)} 23:59:59`
    const baseArgs = ['--remotes=origin', '--exclude=refs/remotes/origin/HEAD']

    const roster = (cfg.value.members || []).map(m => ({ ...m, id: m.id || ensureId(m) })).filter(m => m.id)
    cfg.value.members = roster

    const api = (baseUrl.value && token.value) ? new MattermostClient({ baseUrl: baseUrl.value, token: token.value }) : null

    // Resolve Mattermost username -> userId (best effort)
    const mmIds = {}
    if (api) {
      for (const m of roster) {
        if (!m.mattermost) continue
        try {
          const u = await api.userByUsername(m.mattermost)
          if (u?.id) mmIds[m.id] = u.id
        } catch { /* ignore */ }
      }
    }

    const outRows = []
    for (let i = 0; i < roster.length; i++) {
      const m = roster[i]
      status.value = `[${i + 1}/${roster.length}] ${m.display || m.id}: counting...`

      // git daily counts
      const gitSeries = Array.from({ length: keys.length }).map(() => 0)
      const svnSeries = Array.from({ length: keys.length }).map(() => 0)

      const runDaily = async (repoPath, author) => {
        if (!repoPath || !author) return new Map()
        const args = ['--no-pager', 'log', ...baseArgs, `--since=${since}`, '--regexp-ignore-case', `--author=${author}`, '--pretty=tformat:%ad', '--date=short']
        const stdout = await gitRun(repoPath, args, 60000)
        return parseGitLogDaily(stdout)
      }

      let gitCounts = new Map()
      let svnCounts = new Map()
      try { if (cfg.value.repo_git && m.git) gitCounts = await runDaily(cfg.value.repo_git, m.git) } catch (e) { console.warn('[TeamProgressTool] git runDaily failed', e) }
      try { if (cfg.value.repo_svn && m.svn) svnCounts = await runDaily(cfg.value.repo_svn, m.svn) } catch (e) { console.warn('[TeamProgressTool] svn runDaily failed', e) }

      keys.forEach((d, idx) => {
        gitSeries[idx] = gitCounts.get(d) || 0
        svnSeries[idx] = svnCounts.get(d) || 0
      })
      const commitSeries = keys.map((_, idx) => (gitSeries[idx] || 0) + (svnSeries[idx] || 0))

      // chat daily counts (simple scan, no caching yet)
      const chatSeries = Array.from({ length: keys.length }).map(() => 0)
      if (api && mmIds[m.id]) {
        const uid = mmIds[m.id]
        const teams = await api.teams()
        for (const t of teams) {
          const channels = await api.teamChannels(t.id)
          for (const c of channels) {
            let page = 0
            let stop = false
            while (true) {
              const postsData = await api.posts(c.id, { perPage: 200, page })
              const posts = postsData?.posts || {}
              const order = Array.isArray(postsData?.order) ? postsData.order : []
              if (!order.length) break
              for (const pid of order) {
                const p = posts[pid]
                if (!p) continue
                const ts = new Date(Number(p.create_at || 0))
                const day = ts.toISOString().slice(0, 10)
                if (day > end.toISOString().slice(0, 10)) continue
                if (day < since) { stop = true; break }
                if (p.type || p?.props?.from_bot) continue
                if (p.user_id === uid) {
                  const di = keys.indexOf(day)
                  if (di >= 0) chatSeries[di] += 1
                }
              }
              if (stop || order.length < 200) break
              page++
            }
          }
        }
      }

      // hourly preview if requested
      let hourlyCommit = null
      let hourlyChat = null
      if (cfg.value.view === 'hourly') {
        try {
          if (cfg.value.repo_git && m.git) {
            const args = ['--no-pager', 'log', ...baseArgs, `--since=${since}`, `--until=${until}`, '--regexp-ignore-case', `--author=${m.git}`, '--pretty=tformat:%ad', '--date=iso-strict']
            hourlyCommit = parseWeekHourMatrix(await gitRun(cfg.value.repo_git, args, 120000), start, end)
          }
        } catch (e) { console.warn('[TeamProgressTool] runDaily failed', e) }
        // chat hourly preview not implemented fully (expensive); keep null unless we add caching
      }

      outRows.push({
        id: m.id,
        display: m.display || m.id,
        mattermost: m.mattermost || '',
        git: m.git || '',
        svn: m.svn || '',
        git_series: gitSeries,
        svn_series: svnSeries,
        commit_series: commitSeries,
        chat_series: chatSeries,
        commit_total: commitSeries.reduce((a, b) => a + b, 0),
        chat_total: chatSeries.reduce((a, b) => a + b, 0),
        hourly_commit: hourlyCommit,
        hourly_chat: hourlyChat,
        __mock: false
      })
    }

    rows.value = outRows
    status.value = 'Done.'
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>


