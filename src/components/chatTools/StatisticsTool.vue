<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Statistics</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.days" type="number" min="1" label="Days in the past" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field v-model="cfg.exclude_channels" label="Exclude channels (comma-separated)" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="2">
          <v-checkbox v-model="cfg.ignore_muted" label="Ignore muted" density="compact" />
        </v-col>
      </v-row>

      <div class="d-flex align-center mt-2" style="gap: 8px;">
        <v-btn color="primary" :loading="loading" @click="run">Run</v-btn>
        <div class="text-caption text-medium-emphasis">{{ status }}</div>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

      <v-alert v-if="isSample" type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-flask-outline">
        Sample output (mock)
      </v-alert>

      <div v-if="stats" class="mt-3">
        <div class="text-caption text-medium-emphasis mb-2">
          Total messages scanned: <strong>{{ stats.totalMsgs.toLocaleString() }}</strong> ·
          Channels: <strong>{{ stats.channels.toLocaleString() }}</strong> ·
          Users: <strong>{{ stats.users.toLocaleString() }}</strong>
        </div>

        <v-row dense>
          <v-col cols="12" md="6">
            <v-card variant="tonal">
              <v-card-title class="text-subtitle-2">Top contributors</v-card-title>
              <v-card-text>
                <canvas ref="contributorsEl" height="180"></canvas>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card variant="tonal">
              <v-card-title class="text-subtitle-2">Top channels</v-card-title>
              <v-card-text>
                <canvas ref="channelsEl" height="180"></canvas>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row dense class="mt-1">
          <v-col cols="12">
            <v-card variant="tonal">
              <v-card-title class="text-subtitle-2">Messages per day</v-card-title>
              <v-card-text>
                <canvas ref="perDayEl" height="140"></canvas>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useSettingsStore } from '../../composables/useSettingsStore'
import { MattermostClient } from '../../chatTools/mmClient'
import { Chart } from 'chart.js/auto'
import { mockStatistics } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.statistics,
  set: v => { settings.config.mattermostTools.statistics = v }
})

const loading = ref(false)
const status = ref('')
const error = ref('')
const stats = ref(null)
const hasRun = ref(false)
const isSample = computed(() => !hasRun.value && !!stats.value && stats.value.__mock)

const contributorsEl = ref(null)
const channelsEl = ref(null)
const perDayEl = ref(null)

let charts = []
const destroyCharts = () => {
  for (const c of charts) { try { c.destroy() } catch (e) { console.warn('[StatisticsTool] chart destroy failed', e) } }
  charts = []
}

const renderCharts = async ({ contributors, channels, perDay }) => {
  status.value = 'Rendering charts...'
  await nextTick()
  destroyCharts()

  if (contributorsEl.value) {
    charts.push(new Chart(contributorsEl.value.getContext('2d'), {
      type: 'bar',
      data: { labels: contributors.labels, datasets: [{ label: 'Messages', data: contributors.data }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    }))
  }

  if (channelsEl.value) {
    charts.push(new Chart(channelsEl.value.getContext('2d'), {
      type: 'bar',
      data: { labels: channels.labels, datasets: [{ label: 'Messages', data: channels.data }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    }))
  }

  if (perDayEl.value) {
    charts.push(new Chart(perDayEl.value.getContext('2d'), {
      type: 'line',
      data: { labels: perDay.labels, datasets: [{ label: 'Messages per day', data: perDay.data }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 10 } } } }
    }))
  }
}

onMounted(async () => {
  // Seed sample output so the UI isn't empty until the user runs the tool.
  const sample = mockStatistics()
  stats.value = { ...sample.meta }
  await renderCharts({ contributors: sample.contributors, channels: sample.channels, perDay: sample.perDay })
  status.value = 'Showing sample data.'
})

const run = async () => {
  error.value = ''
  status.value = ''
  stats.value = null
  destroyCharts()
  hasRun.value = true

  if (!baseUrl.value || !token.value) {
    error.value = 'Please log in first.'
    return
  }

  loading.value = true
  try {
    const api = new MattermostClient({ baseUrl: baseUrl.value, token: token.value })
    const me = await api.me()
    const currentUserId = me?.id || ''

    const days = Math.max(1, Number(cfg.value.days) || 1)
    const since = Date.now() - days * 24 * 3600 * 1000
    const exclude = new Set(String(cfg.value.exclude_channels || '').split(',').map(s => s.trim()).filter(Boolean))

    status.value = 'Fetching teams...'
    const teams = await api.teams()
    if (!teams.length) throw new Error('Could not retrieve teams.')

    let muted = new Set()
    if (cfg.value.ignore_muted && currentUserId) {
      status.value = 'Fetching muted channels...'
      muted = await api.getMutedChannelIdsForUser(currentUserId, teams)
    }

    status.value = 'Fetching channels...'
    const allChannels = await api.getAllChannels(teams)
    const filtered = allChannels.filter(c => {
      if (!c) return false
      if (c.type === 'D' || c.type === 'G') return false
      if (exclude.has(c.name)) return false
      if (cfg.value.ignore_muted && c.id && muted.has(c.id)) return false
      return true
    })

    const userCounts = new Map() // userId -> count
    const channelCounts = new Map() // display -> count
    const perDay = new Map() // yyyy-mm-dd -> count
    let totalMsgs = 0

    for (let i = 0; i < filtered.length; i++) {
      const channel = filtered[i]
      const cname = channel.display_name || channel.name || channel.id
      status.value = `[${i + 1}/${filtered.length}] ${cname}: scanning...`

      let page = 0
      let keep = true
      while (keep) {
        const postsData = await api.posts(channel.id, { perPage: 200, page })
        const posts = postsData?.posts || {}
        const order = Array.isArray(postsData?.order) ? postsData.order : []
        if (!order.length) break

        for (const postId of order) {
          const p = posts[postId]
          if (!p) continue
          const ts = Number(p.create_at || 0)
          if (ts < since) { keep = false; break }
          totalMsgs++
          const uid = p.user_id || 'unknown'
          userCounts.set(uid, (userCounts.get(uid) || 0) + 1)
          channelCounts.set(cname, (channelCounts.get(cname) || 0) + 1)
          const d = new Date(ts)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          perDay.set(key, (perDay.get(key) || 0) + 1)
        }

        if (order.length < 200) break
        page += 1
      }
    }

    // Resolve top users to usernames
    const topUsers = Array.from(userCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const userIds = topUsers.map(([id]) => id).filter(Boolean)
    const userInfo = await api.usersByIds(userIds)
    const contributorLabels = topUsers.map(([id]) => userInfo?.[id]?.username || id)
    const contributorData = topUsers.map(([, c]) => c)

    const topChannels = Array.from(channelCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const channelLabels = topChannels.map(([n]) => n)
    const channelData = topChannels.map(([, c]) => c)

    const perDayKeys = Array.from(perDay.keys()).sort()
    const perDayVals = perDayKeys.map(k => perDay.get(k) || 0)

    stats.value = {
      totalMsgs,
      channels: filtered.length,
      users: userCounts.size,
      __mock: false
    }

    await renderCharts({
      contributors: { labels: contributorLabels, data: contributorData },
      channels: { labels: channelLabels, data: channelData },
      perDay: { labels: perDayKeys, data: perDayVals }
    })

    status.value = 'Done.'
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>


