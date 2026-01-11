<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Saved Posts</v-card-title>
    <v-card-text>
      <div class="d-flex align-center ga-2 mb-2">
        <v-btn color="primary" :loading="loading" @click="run">Load saved posts</v-btn>
        <div class="text-caption text-medium-emphasis">{{ status }}</div>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>

      <div v-if="displayItems.length === 0 && !loading" class="text-body-2 text-medium-emphasis">
        {{ hasRun ? 'No saved posts found.' : 'Sample data shown below. Click "Load saved posts" to fetch real results.' }}
      </div>

      <v-alert v-if="isSample" type="info" variant="tonal" density="compact" class="mb-2" icon="mdi-flask-outline">
        Sample output (mock)
      </v-alert>

      <v-list v-if="displayItems.length" density="compact">
        <v-list-item v-for="item in displayItems" :key="item.post.id" class="py-2">
          <v-list-item-title class="text-body-2">
            <strong>{{ item.team?.display_name || 'Direct Message' }}</strong>
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
          </v-list-item-subtitle>

          <!-- Render markdown as HTML (same idea as Flask templates) -->
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
import { renderMarkdown } from '../../chatTools/utils'
import { buildPostPermalink } from '../../chatTools/threadFormat'
import { mockSavedPosts } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const loading = ref(false)
const status = ref('')
const error = ref('')
const items = ref([])
const hasRun = ref(false)

const sampleItems = computed(() => mockSavedPosts(baseUrl.value))
const isSample = computed(() => !hasRun.value && items.value.length === 0)
const displayItems = computed(() => (items.value.length ? items.value : (hasRun.value ? [] : sampleItems.value)))

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
    status.value = 'Fetching saved posts...'
    const flagged = await api.flaggedPosts()
    const order = Array.isArray(flagged?.order) ? flagged.order : []
    const postsMap = flagged?.posts || {}
    if (order.length === 0) {
      status.value = 'No saved posts.'
      return
    }

    status.value = `Resolving ${order.length} posts (channels/teams/users)...`
    const teams = await api.teams()
    const teamsById = new Map(teams.map(t => [t.id, t]))
    const me = await api.me()
    const currentUserId = me?.id || ''

    const results = []
    for (let i = 0; i < order.length; i++) {
      const postId = order[i]
      const post = postsMap[postId]
      if (!post) continue

      status.value = `Processing ${i + 1}/${order.length}...`
      const channel = await api.channelById(post.channel_id)
      const team = channel?.team_id ? (teamsById.get(channel.team_id) || null) : null

      if (channel && (channel.type === 'D' || channel.type === 'G')) {
        await api.fixChannelDisplayName(channel, currentUserId)
      }

      const author = await api.userById(post.user_id)
      const ageHours = ((Date.now() - Number(post.create_at || 0)) / 1000) / 3600
      const html = renderMarkdown(post.message || '')
      const permalink = buildPostPermalink(baseUrl.value, team, post.id)

      results.push({ post, channel, team, author, ageHours, html, permalink })
    }

    results.sort((a, b) => Number(b.post.create_at || 0) - Number(a.post.create_at || 0))
    items.value = results
    status.value = `Loaded ${results.length} saved posts.`
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


