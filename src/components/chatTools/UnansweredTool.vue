<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Unanswered Threads</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.search_days" type="number" min="1" label="Search days" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model.number="cfg.unanswered_hours" type="number" min="1" label="Hours old" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field v-model="cfg.exclude_channels" label="Exclude channels (comma-separated)" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12">
          <v-text-field v-model="cfg.ignore_texts" label='Ignore texts (quoted, e.g. " left the channel.")' density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="3"><v-checkbox v-model="cfg.ignore_muted" label="Ignore muted" density="compact" /></v-col>
        <v-col cols="12" md="3"><v-checkbox v-model="cfg.ignore_threads_with_me" label="Ignore threads with me" density="compact" /></v-col>
        <v-col cols="12" md="3"><v-checkbox v-model="cfg.show_threads_without_answer" label="Show w/o answer" density="compact" /></v-col>
        <v-col cols="12" md="3"><v-checkbox v-model="cfg.show_threads_without_me" label="Show w/o resolution" density="compact" /></v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="cfg.ai_model"
            :items="modelItems"
            label="AI model (optional)"
            density="compact"
            variant="outlined"
            :loading="modelsLoading"
            clearable
          />
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

      <v-row class="mt-3" dense>
        <v-col cols="12" md="6">
          <v-card variant="tonal">
            <v-card-title class="text-subtitle-2">Unanswered</v-card-title>
            <v-card-text>
              <div v-if="unanswered.length === 0 && !loading" class="text-body-2 text-medium-emphasis">No results.</div>
              <v-list v-else density="compact">
                <v-list-item v-for="item in unanswered" :key="item.post.id" class="py-2">
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
                  <div class="mt-1 chattools-post" v-html="item.html"></div>

                  <div class="d-flex align-center mt-2" style="gap: 8px;">
                    <v-btn size="x-small" variant="tonal" :loading="item.aiLoading" @click="analyze(item)">Analyze with AI</v-btn>
                    <div v-if="item.aiResult" class="text-caption">
                      <span v-if="item.aiResult.success && item.aiResult.action_needed" class="text-warning">Action required</span>
                      <span v-else-if="item.aiResult.success" class="text-success">Solved</span>
                      <span v-else class="text-error">AI error</span>
                      <span v-if="item.aiResult.who" class="ml-2 text-medium-emphasis">({{ item.aiResult.who }})</span>
                      <span v-if="item.aiResult.reason" class="ml-2">{{ item.aiResult.reason }}</span>
                    </div>
                  </div>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="tonal">
            <v-card-title class="text-subtitle-2">Omitted (reason)</v-card-title>
            <v-card-text>
              <div v-if="omitted.length === 0 && !loading" class="text-body-2 text-medium-emphasis">No omitted items.</div>
              <v-list v-else density="compact">
                <v-list-item v-for="(item, idx) in omitted" :key="`${idx}-${item.reason}`" class="py-2">
                  <v-list-item-title class="text-body-2">
                    <strong>{{ item.team?.display_name || 'Team' }}</strong>
                    <span class="mx-1">/</span>
                    <span>{{ item.channel?.display_name || item.channel?.name || 'channel' }}</span>
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption text-medium-emphasis">{{ item.reason }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../composables/useSettingsStore'
import { MattermostClient } from '../../chatTools/mmClient'
import { renderMarkdown } from '../../chatTools/utils'
import { getOllamaModels, analyzeThreadWithAI } from '../../chatTools/ai'
import { formatThreadForAI, buildPostPermalink } from '../../chatTools/threadFormat'
import { mockUnanswered } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.unanswered,
  set: v => { settings.config.mattermostTools.unanswered = v }
})

const loading = ref(false)
const status = ref('')
const error = ref('')
const unanswered = ref([])
const omitted = ref([])
const hasRun = ref(false)

const isSample = computed(() => !hasRun.value && unanswered.value.length === 0 && omitted.value.length === 0)

const applySample = () => {
  const s = mockUnanswered(baseUrl.value)
  unanswered.value = s.unanswered
  omitted.value = s.omitted
  status.value = 'Showing sample data.'
}

// show sample immediately until user runs the tool
applySample()

const modelsLoading = ref(false)
const modelItems = ref([{ title: 'Default', value: '' }])

const loadModels = async () => {
  modelsLoading.value = true
  try {
    const models = await getOllamaModels()
    modelItems.value = [{ title: 'Default', value: '' }, ...models.map(m => ({ title: m, value: m }))]
  } catch {
    // ignore; AI is optional
  } finally {
    modelsLoading.value = false
  }
}
loadModels()

const parseIgnoreTexts = (s) => {
  const str = String(s || '')
  const out = []
  const re = /"([^"]*)"/g
  let m
  while ((m = re.exec(str))) out.push(m[1])
  return out
}

const run = async () => {
  error.value = ''
  status.value = ''
  unanswered.value = []
  omitted.value = []
  hasRun.value = true

  if (!baseUrl.value || !token.value) {
    error.value = 'Please log in first.'
    return
  }

  loading.value = true
  try {
    const api = new MattermostClient({ baseUrl: baseUrl.value, token: token.value })
    const me = await api.me()
    if (!me?.id) throw new Error('Mattermost user info not available. Please log in again.')
    const currentUserId = me.id

    const searchDays = Math.max(1, Number(cfg.value.search_days) || 1)
    const unansweredHours = Math.max(1, Number(cfg.value.unanswered_hours) || 1)
    const excludeNames = new Set(String(cfg.value.exclude_channels || '').split(',').map(s => s.trim()).filter(Boolean))
    const ignoreTexts = parseIgnoreTexts(cfg.value.ignore_texts)
    const searchCutoff = Date.now() - searchDays * 24 * 3600 * 1000
    const unansweredCutoff = Date.now() - unansweredHours * 3600 * 1000

    status.value = 'Fetching teams...'
    const teams = await api.teams()
    if (!teams.length) throw new Error('Could not retrieve teams.')

    let muted = new Set()
    if (cfg.value.ignore_muted) {
      status.value = 'Fetching muted channels...'
      muted = await api.getMutedChannelIdsForUser(currentUserId, teams)
    }

    status.value = 'Fetching all channels...'
    const allChannels = await api.getAllChannels(teams)

    // Fix DM display names in bulk by prefetching DM users (best-effort)
    const dmUserIds = []
    for (const c of allChannels) {
      if (c?.type !== 'D') continue
      const parts = String(c.name || '').split('__')
      if (parts.length !== 2) continue
      const other = parts[0] === currentUserId ? parts[1] : parts[0]
      if (other) dmUserIds.push(other)
    }
    if (dmUserIds.length) await api.usersByIds(dmUserIds)

    const teamsById = new Map(teams.map(t => [t.id, t]))
    const threadDataMap = new Map() // postId -> item

    let chanIdx = 0
    for (const channel of allChannels) {
      chanIdx++
      const channelName = channel?.name || ''
      const display = channel?.display_name || channelName || 'channel'
      status.value = `[${chanIdx}/${allChannels.length}] Analyzing: ${display}`

      if (cfg.value.ignore_muted && channel?.id && muted.has(channel.id)) {
        omitted.value.push({ channel, team: teamsById.get(channel.team_id) || null, reason: 'Muted channel' })
        continue
      }
      if (excludeNames.has(channelName)) {
        omitted.value.push({ channel, team: teamsById.get(channel.team_id) || null, reason: 'In exclude list' })
        continue
      }
      if (channel?.type === 'D' || channel?.type === 'G') continue

      let page = 0
      let keep = true
      while (keep) {
        const postsData = await api.posts(channel.id, { perPage: 200, page })
        const posts = postsData?.posts || {}
        const order = Array.isArray(postsData?.order) ? postsData.order : []
        if (!order.length) break

        for (const postId of order) {
          const post = posts[postId]
          if (!post) continue
          if (post.root_id) continue // only thread starts

          const msgLower = String(post.message || '').toLowerCase()
          const postTime = Number(post.create_at || 0)
          if (ignoreTexts.some(t => t && msgLower.includes(String(t).toLowerCase()))) continue

          if (postTime < searchCutoff) { keep = false; break }
          if (postTime >= unansweredCutoff) continue

          let thread
          try {
            thread = await api.thread(post.id)
          } catch {
            omitted.value.push({ post, channel, team: teamsById.get(channel.team_id) || null, reason: 'No thread data' })
            continue
          }

          const threadPosts = thread?.posts || {}
          const threadOrder = Array.isArray(thread?.order) ? thread.order : []
          if (!threadOrder.length) {
            omitted.value.push({ post, channel, team: teamsById.get(channel.team_id) || null, reason: 'No thread data' })
            continue
          }

          const originalAuthorId = post.user_id
          const isAnswered = threadOrder.slice(1).some(pid => threadPosts?.[pid]?.user_id && threadPosts[pid].user_id !== originalAuthorId)
          const userIdsInThread = new Set(threadOrder.map(pid => threadPosts?.[pid]?.user_id).filter(Boolean))
          if (cfg.value.ignore_threads_with_me && currentUserId && userIdsInThread.has(currentUserId)) continue

          const numReplies = Math.max(0, threadOrder.length - 1)
          const qualifies =
            (!!cfg.value.show_threads_without_answer && !isAnswered) ||
            (!!cfg.value.show_threads_without_me && numReplies <= 15)

          if (!qualifies) continue

          const team = teamsById.get(channel.team_id) || null
          const ageHours = ((Date.now() - postTime) / 1000) / 3600
          const html = renderMarkdown(post.message || '')
          const permalink = buildPostPermalink(baseUrl.value, team, post.id)
          threadDataMap.set(post.id, {
            post,
            channel,
            team,
            ageHours,
            html,
            permalink,
            threadData: thread,
            aiLoading: false,
            aiResult: null
          })
        }

        page += 1
        if (order.length < 200) break
      }
    }

    const list = Array.from(threadDataMap.values())
    list.sort((a, b) => Number(b.post.create_at || 0) - Number(a.post.create_at || 0))
    unanswered.value = list
    status.value = `Found ${list.length} threads.`
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const analyze = async (item) => {
  try {
    item.aiLoading = true
    const api = new MattermostClient({ baseUrl: baseUrl.value, token: token.value })
    const { text } = await formatThreadForAI(api, item.threadData || (await api.thread(item.post.id)))
    item.aiResult = await analyzeThreadWithAI({ threadText: text, model: cfg.value.ai_model || undefined })
  } catch (e) {
    item.aiResult = { success: false, error: e?.message || String(e) }
  } finally {
    item.aiLoading = false
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


