<template>
  <v-card>
    <v-card-title class="text-subtitle-1 d-flex align-center">
      <v-icon icon="mdi-keyboard-outline" class="mr-2" />
      <span>Keyboard shortcuts</span>
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        class="text-none"
        prepend-icon="mdi-restore"
        @click="resetAll"
        title="Reset all hotkeys to defaults"
      >Reset all</v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div class="text-caption text-medium-emphasis mb-3">
        Click a binding then press a key combo to change it. Leave blank to unbind.
        Press Esc to cancel. Hotkeys are ignored while typing in an input field.
      </div>

      <div v-if="conflicts.size" class="text-caption text-error mb-2">
        Conflicting bindings: {{ Array.from(conflicts).map(formatCombo).join(', ') }}
      </div>

      <div class="hk-groups">
        <div v-for="g in groups" :key="g.id" class="hk-group">
          <div class="hk-group-title">{{ g.label }}</div>
          <div class="hk-grid">
            <template v-for="a in g.items" :key="a.id">
              <div class="hk-label" :title="a.label">{{ a.label }}</div>
              <button
                type="button"
                class="hk-binding"
                :class="{ capturing: capturingId === a.id, conflict: conflicts.has(bindingOf(a)) }"
                @click="startCapture(a.id)"
              >
                <span v-if="capturingId === a.id">Press a key…</span>
                <span v-else-if="!bindingOf(a)" class="hk-unbound">(unbound)</span>
                <span v-else>{{ formatCombo(bindingOf(a)) }}</span>
              </button>
              <div class="hk-actions">
                <v-btn
                  v-if="bindingOf(a) !== a.default"
                  variant="text"
                  size="x-small"
                  icon="mdi-restore"
                  :title="`Reset to ${formatCombo(a.default) || '(unbound)'}`"
                  @click="resetOne(a.id)"
                />
                <v-btn
                  v-if="bindingOf(a)"
                  variant="text"
                  size="x-small"
                  icon="mdi-close"
                  title="Clear binding"
                  @click="clearOne(a.id)"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { HOTKEY_ACTIONS, formatCombo, getEventCombo, groupedHotkeyActions } from '../composables/useHotkeys'
import { useSettingsStore } from '../composables/useSettingsStore'

const { settings } = useSettingsStore()
const capturingId = ref(null)
const groups = groupedHotkeyActions()

const bindingOf = (a) => {
  const v = settings.uiState.hotkeys?.[a.id]
  return v === undefined ? a.default : v
}

const conflicts = computed(() => {
  const seen = new Map()
  const dupes = new Set()
  for (const a of HOTKEY_ACTIONS) {
    const b = (bindingOf(a) || '').toLowerCase()
    if (!b) continue
    if (seen.has(b)) dupes.add(b)
    else seen.set(b, a.id)
  }
  return dupes
})

const setBinding = (id, combo) => { settings.uiState.hotkeys[id] = combo }

const startCapture = (id) => { capturingId.value = id }
const resetOne = (id) => { delete settings.uiState.hotkeys[id] }
const clearOne = (id) => setBinding(id, '')
const resetAll = () => {
  for (const k of Object.keys(settings.uiState.hotkeys)) delete settings.uiState.hotkeys[k]
}

const onCaptureKey = (e) => {
  if (!capturingId.value) return
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { capturingId.value = null; return }
  const combo = getEventCombo(e)
  if (combo) setBinding(capturingId.value, combo)
  capturingId.value = null
}

onMounted(() => window.addEventListener('keydown', onCaptureKey, true))
onUnmounted(() => window.removeEventListener('keydown', onCaptureKey, true))
</script>

<style scoped>
.hk-groups {
  column-count: 2;
  column-gap: 56px;
  column-rule: 1px dashed rgba(127, 127, 127, 0.18);
}
.hk-group {
  break-inside: avoid;
  margin-bottom: 12px;
}
.hk-group-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 2px;
}
.hk-grid {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 2px 8px;
  align-items: center;
  padding-left: 12px;
}
.hk-label {
  opacity: 0.9;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.hk-binding {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.4);
  background: rgba(127, 127, 127, 0.08);
  min-width: 86px;
  cursor: pointer;
  text-align: center;
}
@media (max-width: 700px) {
  .hk-groups { column-count: 1; }
}
.hk-binding:hover { background: rgba(127, 127, 127, 0.16); }
.hk-binding.capturing {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.hk-binding.conflict {
  border-color: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-error));
}
.hk-unbound { opacity: 0.55; font-style: italic; }
.hk-actions { display: inline-flex; gap: 2px; }
</style>
