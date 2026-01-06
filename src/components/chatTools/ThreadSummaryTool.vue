<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1">Thread Summary</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12">
          <v-text-field v-model="cfg.thread_url" label="Thread URL or post id" density="compact" variant="outlined" />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="cfg.model"
            :items="modelItems"
            label="AI Model (optional)"
            density="compact"
            variant="outlined"
            :loading="modelsLoading"
            clearable
          />
        </v-col>
        <v-col cols="12" md="6" class="d-flex align-center" style="gap: 8px;">
          <v-btn color="primary" :loading="loading" @click="run">Summarize</v-btn>
          <v-btn variant="text" :disabled="modelsLoading" @click="loadModels">Refresh models</v-btn>
        </v-col>
      </v-row>

      <div class="text-caption text-medium-emphasis mt-2">{{ status }}</div>
      <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

      <v-alert v-if="isSample" type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-flask-outline">
        Sample output (mock)
      </v-alert>

      <v-card v-if="shownResult" class="mt-3" variant="tonal">
        <v-card-text>
          <div class="text-caption text-medium-emphasis mb-1">
            Post: <code>{{ shownResult.postId }}</code> · {{ shownResult.threadLength }} posts · {{ shownResult.participantCount }} participants
          </div>
          <div class="text-body-2" style="white-space: pre-wrap;">{{ shownResult.summary }}</div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../composables/useSettingsStore'
import { MattermostClient } from '../../chatTools/mmClient'
import { extractPostIdFromUrl, formatThreadForAI } from '../../chatTools/threadFormat'
import { getOllamaModels, ollamaGenerate, stripThinkBlocks } from '../../chatTools/ai'
import { mockThreadSummary } from '../../chatTools/mock'

const { settings } = useSettingsStore()
const baseUrl = computed(() => settings.config.mattermostUrl || '')
const token = computed(() => settings.config.mattermostToken || '')

const cfg = computed({
  get: () => settings.config.mattermostTools.thread_summary,
  set: v => { settings.config.mattermostTools.thread_summary = v }
})

const modelsLoading = ref(false)
const modelItems = ref([{ title: 'Default', value: '' }])
const status = ref('')
const error = ref('')
const loading = ref(false)
const result = ref(null)
const hasRun = ref(false)

const sample = computed(() => mockThreadSummary())
const isSample = computed(() => !hasRun.value && !result.value)
const shownResult = computed(() => result.value || (hasRun.value ? null : sample.value))

const loadModels = async () => {
  modelsLoading.value = true
  try {
    const models = await getOllamaModels()
    modelItems.value = [{ title: 'Default', value: '' }, ...models.map(m => ({ title: m, value: m }))]
  } catch (e) {
    // leave default; ThreadSummary is still usable without Ollama
  } finally {
    modelsLoading.value = false
  }
}

// eager load in background (best effort)
loadModels()

const run = async () => {
  error.value = ''
  status.value = ''
  result.value = null
  hasRun.value = true

  if (!baseUrl.value || !token.value) {
    error.value = 'Please log in first.'
    return
  }

  const postId = extractPostIdFromUrl(cfg.value.thread_url)
  if (!postId) {
    error.value = 'Could not extract post id. Provide a Mattermost thread URL containing "/pl/<id>" or a 26-char post id.'
    return
  }

  loading.value = true
  try {
    const api = new MattermostClient({ baseUrl: baseUrl.value, token: token.value })
    status.value = 'Fetching thread...'
    const threadData = await api.thread(postId)
    if (!threadData?.posts || !Array.isArray(threadData?.order) || threadData.order.length === 0) {
      throw new Error('Thread not found or empty.')
    }

    status.value = 'Formatting thread...'
    const { text, participants } = await formatThreadForAI(api, threadData)
    if (!text) throw new Error('Could not format thread text.')

    status.value = 'Generating AI summary...'
    const prompt = `Summarize this Mattermost thread conversation. Use one paragraph per discussed topic.\n\n${text}`
    const chosen = cfg.value.model || ''
    const resp = await ollamaGenerate({ model: chosen || undefined, prompt })
    const cleaned = stripThinkBlocks(resp)

    result.value = {
      postId,
      summary: cleaned,
      threadLength: threadData.order.length,
      participantCount: Object.keys(participants || {}).length
    }
    status.value = 'Done.'
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>


