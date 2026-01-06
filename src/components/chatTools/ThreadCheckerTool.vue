<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Thread Checker</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.search_days" type="number" min="1" label="Search days" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.time_limit_minutes" type="number" min="1" label="Time limit (minutes)" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field v-model="cfg.exclude_channels" label="Exclude channels (comma-separated)" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="6">
          <v-checkbox v-model="cfg.ignore_muted" label="Ignore muted channels" density="compact" />
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

      <div v-if="sequences.length === 0 && !loading" class="text-body-2 text-medium-emphasis mt-3">No results yet.</div>

      <v-list v-else density="compact" class="mt-2">
        <v-list-item v-for="(seq, idx) in sequences" :key="idx" class="py-2">
          <v-list-item-title class="text-body-2">
            <strong>{{ seq.team?.display_name || 'Team' }}</strong>
            <span class="mx-1">/</span>
            <span>{{ seq.channel?.display_name || seq.channel?.name || 'channel' }}</span>
            <span class="mx-2 text-caption text-medium-emphasis">· {{ seq.posts.length }} posts</span>
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            <span class="text-medium-emphasis">author:</span>
            <strong>{{ seq.author?.username || 'unknown' }}</strong>
          </v-list-item-subtitle>

          <div class="mt-2">
            <div v-for="p in seq.posts" :key="p.id" class="mb-2">
              <div class="text-caption text-medium-emphasis">
                {{ new Date(Number(p.create_at || 0)).toLocaleString() }}
                <a
                  v-if="p._permalink"
                  class="ml-2"
                  :href="p._permalink"
                  target="_blank"
                  rel="noreferrer"
                >open</a>
              </div>
              <div class="chattools-post" v-html="p._html"></div>
            </div>
          </div>
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
import { mockThreadChecker } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.thread_checker,
  set: v => { settings.config.mattermostTools.thread_checker = v }
})

const loading = ref(false)
const status = ref('')
const error = ref('')
const sequences = ref([])
const hasRun = ref(false)

const isSample = computed(() => !hasRun.value && sequences.value.length > 0 && sequences.value.every(s => s && s.__mock))

// seed sample output so the UI isn't empty
sequences.value = mockThreadChecker(baseUrl.value)

const run = async () => {
  error.value = ''
  status.value = ''
  sequences.value = []
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
    const teams = await api.teams()
    if (!teams.length) throw new Error('Could not retrieve teams.')

    let muted = new Set()
    if (cfg.value.ignore_muted && currentUserId) {
      status.value = 'Fetching muted channels...'
      muted = await api.getMutedChannelIdsForUser(currentUserId, teams)
    }

    status.value = 'Fetching all channels...'
    const allChannels = await api.getAllChannels(teams)
    const teamsById = new Map(teams.map(t => [t.id, t]))

    const searchDays = Math.max(1, Number(cfg.value.search_days) || 1)
    const cutoff = Date.now() - searchDays * 24 * 3600 * 1000
    const limitMs = Math.max(1, Number(cfg.value.time_limit_minutes) || 1) * 60 * 1000
    const exclude = new Set(String(cfg.value.exclude_channels || '').split(',').map(s => s.trim()).filter(Boolean))

    const out = []

    const flush = async (channel, posts) => {
      if (!posts || posts.length < 2) return
      const team = teamsById.get(channel.team_id) || null
      const author = await api.userById(posts[0].user_id)
      out.push({
        channel,
        team,
        author,
        posts: posts.map(p => ({
          ...p,
          _html: renderMarkdown(p.message || ''),
          _permalink: buildPostPermalink(baseUrl.value, team, p.id)
        }))
      })
    }

    let idx = 0
    for (const channel of allChannels) {
      idx++
      const name = channel?.name || ''
      const display = channel?.display_name || name || 'channel'
      status.value = `[${idx}/${allChannels.length}] Analyzing: ${display}`

      if (channel?.type === 'D') continue
      if (exclude.has(name)) continue
      if (cfg.value.ignore_muted && channel?.id && muted.has(channel.id)) continue

      let consecutive = []
      let page = 0
      let keep = true
      while (keep) {
        const postsData = await api.posts(channel.id, { perPage: 200, page })
        const posts = postsData?.posts || {}
        const order = Array.isArray(postsData?.order) ? postsData.order : []
        if (!order.length) break

        // process from oldest -> newest, like Python tool
        for (const postId of order.slice().reverse()) {
          const post = posts[postId]
          if (!post) continue
          const ts = Number(post.create_at || 0)
          if (ts < cutoff) { keep = false; break }

          const isSystem = String(post.type || '').startsWith('system_')
          const isReply = !!post.root_id
          if (isReply || isSystem) {
            await flush(channel, consecutive)
            consecutive = []
            continue
          }

          if (!consecutive.length) {
            consecutive.push(post)
          } else {
            const last = consecutive[consecutive.length - 1]
            const dt = ts - Number(last.create_at || 0)
            if (post.user_id === last.user_id && dt <= limitMs) {
              consecutive.push(post)
            } else {
              await flush(channel, consecutive)
              consecutive = [post]
            }
          }
        }

        if (order.length < 200) break
        page += 1
      }
      await flush(channel, consecutive)
    }

    sequences.value = out
    status.value = out.length ? `Found ${out.length} sequences.` : 'No consecutive posts found.'
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


