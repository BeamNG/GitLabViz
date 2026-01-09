<template>
  <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="state.ui.showAdvancedSim = !state.ui.showAdvancedSim">
    <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Simulation</div>
    <v-icon :icon="state.ui.showAdvancedSim ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis"></v-icon>
  </div>

  <v-expand-transition>
    <div v-show="state.ui.showAdvancedSim" class="px-1" style="overflow: visible;">
      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Group Gravity</span>
        <span>{{ state.simulation.groupGravity }}</span>
      </div>
      <v-slider
        v-model="state.simulation.groupGravity"
        :min="0"
        :max="1"
        :step="0.01"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
      ></v-slider>

      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Repulsion</span>
        <span>{{ state.simulation.repulsion }}</span>
      </div>
      <v-slider
        v-model="state.simulation.repulsion"
        :min="50"
        :max="1000"
        :step="10"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
        class="mb-1"
      ></v-slider>

      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Link Force</span>
        <span>{{ state.simulation.linkStrength }}</span>
      </div>
      <v-slider
        v-model="state.simulation.linkStrength"
        :min="0"
        :max="2"
        :step="0.1"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
        class="mb-1"
      ></v-slider>

      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Link Distance</span>
        <span>{{ state.simulation.linkDistance }}</span>
      </div>
      <v-slider
        v-model="state.simulation.linkDistance"
        :min="50"
        :max="600"
        :step="10"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
        class="mb-1"
      ></v-slider>

      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Friction</span>
        <span>{{ state.simulation.friction }}</span>
      </div>
      <v-slider
        v-model="state.simulation.friction"
        :min="0.1"
        :max="0.95"
        :step="0.05"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
        class="mb-1"
      ></v-slider>

      <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <span>Center Gravity</span>
        <span>{{ state.simulation.centerGravity }}</span>
      </div>
      <v-slider
        v-model="state.simulation.centerGravity"
        :min="0"
        :max="0.5"
        :step="0.01"
        density="compact"
        thumb-size="12"
        track-size="2"
        hide-details
      ></v-slider>

      <div class="mt-2">
        <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
          <span>Grid Magnet Strength</span>
          <span>{{ state.simulation.gridStrength }}</span>
        </div>
        <v-slider
          v-model="state.simulation.gridStrength"
          :min="0"
          :max="0.3"
          :step="0.01"
          density="compact"
          thumb-size="12"
          track-size="2"
          hide-details
          class="mb-1"
        ></v-slider>

        <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis">
          <span>Grid Spacing</span>
          <span>{{ state.simulation.gridSpacing }}</span>
        </div>
        <v-slider
          v-model="state.simulation.gridSpacing"
          :min="1.1"
          :max="3"
          :step="0.1"
          density="compact"
          thumb-size="12"
          track-size="2"
          hide-details
        ></v-slider>
      </div>
    </div>
  </v-expand-transition>
</template>

<script setup>
const props = defineProps({
  // single dict for ui/simulation (from useSettingsStore)
  state: { type: Object, required: true }
})

// NOTE: we intentionally mutate nested fields on `state` (prop is shallow-readonly).
// This keeps the call-site simple and avoids extra v-model plumbing.
const { state } = props
</script>

