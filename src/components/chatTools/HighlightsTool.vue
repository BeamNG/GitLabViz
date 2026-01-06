<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Highlights</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.days" type="number" min="1" label="Days" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="9">
          <v-text-field v-model="cfg.search_keywords" label="Search keywords (comma-separated)" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="6">
          <v-checkbox v-model="cfg.use_notification_keywords" label="Search also my notification keywords" density="compact" />
        </v-col>
        <v-col cols="12" md="6">
          <v-checkbox v-model="cfg.ignore_muted" label="Ignore muted channels" density="compact" />
        </v-col>
      </v-row>

      <div class="d-flex align-center mt-2" style="gap: 8px;">
        <v-btn color="primary" :loading="loading" @click="run">Search</v-btn>
        <div class="text-caption text-medium-emphasis">{{ status }}</div>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

      <div v-if="displayItems.length === 0 && !loading" class="text-body-2 text-medium-emphasis mt-3">
        {{ hasRun ? 'No matches found.' : 'Sample data shown below. Click "Search" to fetch real results.' }}
      </div>

      <v-alert v-if="isSample" type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-flask-outline">
        Sample output (mock)
      </v-alert>

      <v-list v-if="displayItems.length" density="compact" class="mt-2">
        <v-list-item v-for="item in displayItems" :key="item.post.id" class="py-2">
          <v-list-item-title class="text-body-2">
            <strong>{{ item.team?.display_name || 'Team' }}</strong>
            <span class="mx-1">/</span>
            <span>{{ item.channel?.display_name || item.channel?.name || 'channel' }}</span>
            <span class="mx-2 text-caption text-medium-emphasis">· {{ item.ageHours.toFixed(1) }}h ago</span>
            <a
              v-if="item.permalink"
              class="ml-2 text-caption"
              :href="item.permalink"
              target="_blank"
              rel="noreferrer"
            >open</a>
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            <span class="text-medium-emphasis">by</span>
            <strong>{{ item.author?.username || 'unknown' }}</strong>
            <span v-if="item.matchedKeywords?.length" class="ml-2 text-medium-emphasis">
              (matched: {{ item.matchedKeywords.join(', ') }})
            </span>
          </v-list-item-subtitle>

          <div class="mt-2 chattools-post" v-html="item.html"></div>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../composables/useSettingsStore'
import { MattermostClient } from '../../chatTools/mmClient'
import { renderMarkdown, highlightKeywordsInHtml } from '../../chatTools/utils'
import { buildPostPermalink } from '../../chatTools/threadFormat'
import { mockHighlights } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.highlights,
  set: v => { settings.config.mattermostTools.highlights = v }
})

const loading = ref(false)
const status = ref('')
const error = ref('')
const items = ref([])
const hasRun = ref(false)

const sampleItems = computed(() => mockHighlights(baseUrl.value))
const isSample = computed(() => !hasRun.value && items.value.length === 0)
const displayItems = computed(() => (items.value.length ? items.value : (hasRun.value ? [] : sampleItems.value)))

const isoDateDaysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - Math.max(1, Number(days) || 1))
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const run = async () => {
  error.value = ''
  status.value = ''
  items.value = []
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

    const rawKeywords = String(cfg.value.search_keywords || 'VR')
    const keywords = rawKeywords.split(',').map(s => s.trim()).filter(Boolean)
    let mergedKeywords = keywords.slice()

    if (cfg.value.use_notification_keywords) {
      status.value = 'Fetching notification keywords...'
      const notif = await api.notificationKeywords()
      for (const k of notif) if (!mergedKeywords.includes(k)) mergedKeywords.push(k)
    }

    const query = mergedKeywords.length ? mergedKeywords.join(' OR ') : 'VR'
    const after = isoDateDaysAgo(cfg.value.days)
    const searchQuery = `${query} after:${after}`

    status.value = 'Fetching teams...'
    const teams = await api.teams()

    let muted = new Set()
    if (cfg.value.ignore_muted && currentUserId) {
      status.value = 'Fetching muted channels...'
      muted = await api.getMutedChannelIdsForUser(currentUserId, teams)
    }

    const found = []
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i]
      status.value = `Searching ${i + 1}/${teams.length}: ${team.display_name || team.name}...`
      const res = await api.searchPosts(team.id, searchQuery)
      const posts = res?.posts || {}
      const order = Array.isArray(res?.order) ? res.order : []
      if (!order.length) continue

      const channels = await api.teamChannels(team.id)
      const channelMap = new Map(channels.map(c => [c.id, c]))

      for (const postId of order) {
        const post = posts[postId]
        if (!post) continue
        if (post.type || post?.props?.from_bot) continue

        let channel = channelMap.get(post.channel_id) || null
        if (!channel) channel = await api.channelById(post.channel_id)
        if (!channel) continue
        if (cfg.value.ignore_muted && muted.has(channel.id)) continue

        if (channel.type === 'D' || channel.type === 'G') {
          await api.fixChannelDisplayName(channel, currentUserId)
        }

        const author = await api.userById(post.user_id)
        const text = String(post.message || '')
        const matched = keywords.filter(k => k && text.toLowerCase().includes(k.toLowerCase()))

        const html = highlightKeywordsInHtml(renderMarkdown(text), matched)
        const ageHours = ((Date.now() - Number(post.create_at || 0)) / 1000) / 3600
        const permalink = buildPostPermalink(baseUrl.value, team, post.id)

        found.push({ post, channel, team, author, ageHours, matchedKeywords: matched, html, permalink })
      }
    }

    found.sort((a, b) => a.ageHours - b.ageHours)
    items.value = found
    status.value = `Found ${found.length} posts.`
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style>
.chattools-post code {
  white-space: pre-wrap;
}
.chattools-post pre {
  white-space: pre-wrap;
  overflow-x: auto;
}
</style>


