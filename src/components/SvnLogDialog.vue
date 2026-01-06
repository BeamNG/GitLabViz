<template>
  <v-dialog v-model="open" width="1000" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="font-weight-bold">SVN Log</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="open = false"></v-btn>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pt-4">
        <div class="d-flex gap-2 flex-wrap align-center mb-3">
          <v-text-field
            v-model="search"
            label="Search (min 3 chars)"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 360px"
            clearable
          ></v-text-field>
          <v-select
            v-model="perPage"
            :items="[25, 50, 100, 200]"
            label="Per page"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 140px"
          ></v-select>
          <div class="text-caption text-medium-emphasis">
            Showing {{ paged.length.toLocaleString() }} / {{ total.toLocaleString() }}
          </div>
        </div>
        <div v-if="search && search.trim().length >= 3" class="text-caption text-warning mb-2">
          Search is disabled for large disk-backed logs (would need an index). Clear search to browse pages.
        </div>

        <v-table density="compact">
          <thead>
            <tr>
              <th style="width: 90px;">Rev</th>
              <th style="width: 180px;">Date</th>
              <th style="width: 140px;">Author</th>
              <th>Message</th>
              <th style="width: 90px;">Paths</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in paged"
              :key="c.revision"
              style="cursor: pointer;"
              @click="selected = c"
            >
              <td>{{ c.revision }}</td>
              <td>{{ c.date ? new Date(c.date).toLocaleString() : '' }}</td>
              <td>{{ c.author }}</td>
              <td class="text-truncate" style="max-width: 520px;">{{ c.message }}</td>
              <td>{{ (c.paths || []).length }}</td>
            </tr>
          </tbody>
        </v-table>

        <div class="d-flex justify-space-between align-center mt-3">
          <div class="text-caption text-medium-emphasis">
            Page {{ page }} / {{ pageCount }}
          </div>
          <v-pagination
            v-model="page"
            :length="pageCount"
            density="compact"
            total-visible="7"
          ></v-pagination>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailsOpen" width="900" scrollable>
    <v-card v-if="selected">
      <v-card-title class="d-flex align-center">
        <span class="font-weight-bold">r{{ selected.revision }}</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="selected = null"></v-btn>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pt-4">
        <div class="text-caption text-medium-emphasis mb-2">
          {{ selected.author }} • {{ selected.date ? new Date(selected.date).toLocaleString() : '' }}
        </div>
        <div class="mb-4" style="white-space: pre-wrap;">{{ selected.message }}</div>

        <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2">Paths</div>
        <v-list density="compact" v-if="(selected.paths || []).length">
          <v-list-item
            v-for="(p, idx) in selected.paths"
            :key="idx"
            :title="p.path"
            :subtitle="p.action"
          ></v-list-item>
        </v-list>
        <div v-else class="text-caption text-medium-emphasis">No path details.</div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { svnCacheReadPage } from '../services/cache'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  repoUrl: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const search = ref('')
const page = ref(1)
const perPage = ref(50)
const selected = ref(null)

const total = ref(0)
const items = ref([])

const pageCount = computed(() => {
  return Math.max(1, Math.ceil(total.value / perPage.value))
})

const paged = computed(() => items.value)

const detailsOpen = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null }
})

const loadPage = async () => {
  // KISS: for huge datasets, disable expensive global search (would require indexing)
  if (search.value && search.value.trim().length >= 3) {
    items.value = []
    total.value = 0
    return
  }
  if (!props.repoUrl) {
    items.value = []
    total.value = 0
    return
  }
  const res = await svnCacheReadPage(props.repoUrl, page.value, perPage.value)
  total.value = res.totalCount || 0
  items.value = res.items || []
}

watch([page, perPage], () => {
  loadPage()
})

watch(search, () => {
  page.value = 1
  loadPage()
})

watch(open, (v) => {
  if (!v) {
    selected.value = null
  } else {
    page.value = 1
    loadPage()
  }
})
</script>


