<template>
  <div class="d-flex flex-column fill-height">
    <v-toolbar color="primary" density="comfortable" class="app-toolbar">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$emit('close')" />
      <v-toolbar-title class="font-weight-bold">Chat Tools</v-toolbar-title>
      <v-spacer />
      <v-btn
        variant="text"
        class="text-none"
        :disabled="!isLoggedIn"
        prepend-icon="mdi-logout"
        @click="doLogout"
      >
        Logout
      </v-btn>
    </v-toolbar>

    <v-divider />

    <div class="d-flex flex-grow-1" style="min-height: 0;">
      <!-- Template-style sidebar -->
      <v-navigation-drawer
        width="320"
        permanent
        location="left"
        class="chattools-sidebar"
      >
        <div class="pa-3">
          <div class="mt-2 text-caption text-medium-emphasis">
            <template v-if="isLoggedIn">
              Logged in as <strong>{{ settings.config.mattermostUser?.username || 'unknown' }}</strong>
            </template>
            <template v-else>
              Not logged in (showing sample data)
            </template>
          </div>

          <v-alert v-if="!isLoggedIn" type="warning" variant="tonal" density="compact" class="mt-3" icon="mdi-alert">
            Configure Mattermost login in <strong>Configuration → Mattermost</strong> to fetch real results.
            <div class="mt-2">
              <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-cog" @click="$emit('open-config')">
                Open Configuration
              </v-btn>
            </div>
          </v-alert>
        </div>

        <v-divider />

        <v-list density="compact" nav class="py-0">
          <v-list-item
            v-for="t in tools"
            :key="t.key"
            :active="activeTool === t.key"
            @click="activeTool = t.key"
            class="py-3"
          >
            <v-list-item-title class="text-body-2 font-weight-bold">{{ t.title }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption text-medium-emphasis" style="white-space: normal;">
              {{ t.description }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>

      <!-- Main content -->
      <v-container fluid class="py-6 flex-grow-1 overflow-y-auto" style="min-width: 0; max-width: 1200px;">
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <component :is="activeComponent" v-if="activeComponent" :key="activeTool" />
      </v-container>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../composables/useSettingsStore'
import SavedPostsTool from './chatTools/SavedPostsTool.vue'
import HighlightsTool from './chatTools/HighlightsTool.vue'
import UnansweredTool from './chatTools/UnansweredTool.vue'
import ThreadCheckerTool from './chatTools/ThreadCheckerTool.vue'
import ThreadSummaryTool from './chatTools/ThreadSummaryTool.vue'
import StatisticsTool from './chatTools/StatisticsTool.vue'
import TeamProgressTool from './chatTools/TeamProgressTool.vue'

defineEmits(['close', 'open-config'])

const { settings } = useSettingsStore()
const error = ref('')
const activeTool = ref('saved')

const isLoggedIn = computed(() => !!settings.config.mattermostToken)

const tools = [
  { key: 'highlights', title: 'Highlights', description: 'Search for posts based on keywords.', component: HighlightsTool },
  { key: 'saved', title: 'Saved Posts', description: 'Display your saved/flagged posts.', component: SavedPostsTool },
  { key: 'statistics', title: 'Statistics', description: 'Basic post statistics (charts).', component: StatisticsTool },
  { key: 'thread_summary', title: 'Thread Summary', description: 'Summarize a thread by URL/post id (Ollama).', component: ThreadSummaryTool },
  { key: 'team_progress', title: 'Team Progress', description: 'Track local git commits + Mattermost activity.', component: TeamProgressTool },
  { key: 'thread_checker', title: 'Thread Checker', description: 'Find consecutive posts that should be in a thread.', component: ThreadCheckerTool },
  { key: 'unanswered', title: 'Unanswered Threads', description: 'Find threads without answer / resolution.', component: UnansweredTool }
]

const activeComponent = computed(() => {
  const t = tools.find(x => x.key === activeTool.value)
  return t ? t.component : null
})

const doLogout = () => {
  settings.config.mattermostToken = ''
  settings.config.mattermostUser = null
}
</script>

<style>
.highlighted-keyword {
  background: var(--highlight-bg, #ececec);
  color: var(--highlight-fg, inherit);
  border-radius: 1px;
  padding: 0 0.03em;
  margin: 0;
  font-weight: inherit;
  font-size: inherit;
  border: none;
  box-shadow: none;
  line-height: inherit;
  vertical-align: baseline;
  transition: background 0.2s;
}
</style>

