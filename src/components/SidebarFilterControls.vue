<template>
  <!-- Filters Section -->
  <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="state.ui.showFilters = !state.ui.showFilters">
    <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Filters</div>
    <div class="d-flex align-center gap-1">
      <v-tooltip text="Clear filters" location="right">
        <template v-slot:activator="{ props }">
          <v-btn
            icon="mdi-filter-off"
            variant="text"
            size="x-small"
            color="medium-emphasis"
            v-bind="props"
            @click.stop="emit('reset-filters')"
          />
        </template>
      </v-tooltip>
      <v-icon :icon="state.ui.showFilters ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis"></v-icon>
    </div>
  </div>

  <v-expand-transition><div v-show="state.ui.showFilters" class="px-1">
      <!-- Search -->
      <v-text-field
        v-model="state.filters.searchQuery"
        label="Search"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.searchQuery) }]"
        hide-details
        style="font-size: 12px"
        clearable
      ></v-text-field>

      <!-- Labels -->
      <v-autocomplete
        v-model="state.filters.selectedLabels"
        :items="allLabels"
        label="Labels (Include)"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedLabels) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-tag-multiple"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-tag" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.excludedLabels"
        :items="allLabels"
        label="Labels (Exclude)"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.excludedLabels) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-tag-remove"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-tag-outline" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- People -->
      <v-autocomplete
        v-model="state.filters.selectedAuthors"
        :items="allAuthors"
        label="Author"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedAuthors) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-account-edit"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-account-circle-outline" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedAssignees"
        :items="allAssignees"
        label="Assignee"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedAssignees) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-account"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-account-circle" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Attributes -->
      <v-autocomplete
        v-model="state.filters.selectedMilestones"
        :items="allMilestones"
        label="Milestone"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedMilestones) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-flag"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-flag-variant" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedPriorities"
        :items="allPriorities"
        label="Priority"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedPriorities) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-alert-circle"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-alert-box" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedTypes"
        :items="allTypes"
        label="Type"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedTypes) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-shape"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw">
            <template v-slot:prepend>
              <v-icon icon="mdi-shape-outline" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Status & Subscription -->
      <v-autocomplete
        v-model="state.filters.selectedStatuses"
        :items="[
          { title: 'To do', value: 'To do', icon: 'mdi-circle-outline' },
          { title: 'In progress', value: 'In progress', icon: 'mdi-progress-check' },
          { title: 'Ready for Review', value: 'Ready for Review', icon: 'mdi-eye-outline' },
          { title: 'Done', value: 'Done', icon: 'mdi-check-circle-outline' },
          { title: 'Won\'t do', value: 'Won\'t do', icon: 'mdi-cancel' },
          { title: 'Duplicate', value: 'Duplicate', icon: 'mdi-content-copy' }
        ]"
        label="Status"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedStatuses) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-list-status"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-select
        v-model="state.filters.selectedSubscription"
        :items="[
          { title: 'Explicitly subscribed', value: 'subscribed', icon: 'mdi-bell' },
          { title: 'Explicitly unsubscribed', value: 'unsubscribed', icon: 'mdi-bell-off' }
        ]"
        label="Subscribed"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.selectedSubscription) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-bell-ring-outline"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-select>

      <!-- Dates -->
      <div class="text-caption text-medium-emphasis mb-1 mt-2">Created</div>
      <div class="d-flex flex-column gap-1 mb-1">
        <v-select
          v-model="state.filters.dateFilters.createdMode"
          :items="dateFilterModes"
          density="compact"
          variant="outlined"
          hide-details
          :class="['compact-input', { 'is-active': isDateActive(state.filters.dateFilters.createdMode, state.filters.dateFilters.createdAfter, state.filters.dateFilters.createdBefore, state.filters.dateFilters.createdDays) }]"
          style="font-size: 12px"
          prepend-inner-icon="mdi-calendar-plus"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>
        <v-text-field v-if="state.filters.dateFilters.createdMode === 'after' || state.filters.dateFilters.createdMode === 'between'" v-model="state.filters.dateFilters.createdAfter" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Start Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.createdMode === 'before' || state.filters.dateFilters.createdMode === 'between'" v-model="state.filters.dateFilters.createdBefore" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="End Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.createdMode === 'last_x_days'" v-model.number="state.filters.dateFilters.createdDays" type="number" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Days" min="1"></v-text-field>
      </div>

      <div class="text-caption text-medium-emphasis mb-1">Updated</div>
      <div class="d-flex flex-column gap-1 mb-1">
        <v-select
          v-model="state.filters.dateFilters.updatedMode"
          :items="dateFilterModes"
          density="compact"
          variant="outlined"
          hide-details
          :class="['compact-input', { 'is-active': isDateActive(state.filters.dateFilters.updatedMode, state.filters.dateFilters.updatedAfter, state.filters.dateFilters.updatedBefore, state.filters.dateFilters.updatedDays) }]"
          style="font-size: 12px"
          prepend-inner-icon="mdi-calendar-edit"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>
        <v-text-field v-if="state.filters.dateFilters.updatedMode === 'after' || state.filters.dateFilters.updatedMode === 'between'" v-model="state.filters.dateFilters.updatedAfter" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Start Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.updatedMode === 'before' || state.filters.dateFilters.updatedMode === 'between'" v-model="state.filters.dateFilters.updatedBefore" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="End Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.updatedMode === 'last_x_days'" v-model.number="state.filters.dateFilters.updatedDays" type="number" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Days" min="1"></v-text-field>
      </div>

      <div class="text-caption text-medium-emphasis mb-1">Due Date</div>
      <div class="d-flex flex-column gap-1">
        <v-select
          v-model="state.filters.dateFilters.dueDateMode"
          :items="dateFilterModes"
          density="compact"
          variant="outlined"
          hide-details
          :class="['compact-input', { 'is-active': isDateActive(state.filters.dateFilters.dueDateMode, state.filters.dateFilters.dueDateAfter, state.filters.dateFilters.dueDateBefore, state.filters.dateFilters.dueDateDays) }]"
          style="font-size: 12px"
          prepend-inner-icon="mdi-calendar-clock"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>
        <v-text-field v-if="state.filters.dateFilters.dueDateMode === 'after' || state.filters.dateFilters.dueDateMode === 'between'" v-model="state.filters.dateFilters.dueDateAfter" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Start Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.dueDateMode === 'before' || state.filters.dateFilters.dueDateMode === 'between'" v-model="state.filters.dateFilters.dueDateBefore" type="date" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="End Date"></v-text-field>
        <v-text-field v-if="state.filters.dateFilters.dueDateMode === 'last_x_days'" v-model.number="state.filters.dateFilters.dueDateDays" type="number" density="compact" variant="outlined" hide-details class="compact-input" style="font-size: 12px" placeholder="Days" min="1"></v-text-field>
      </div>

      <v-checkbox
        v-model="state.filters.includeClosed"
        label="Include closed issues"
        density="compact"
        hide-details
        :class="['mb-1 compact-input', { 'is-active-checkbox': !!state.filters.includeClosed }]"
      />

  </div></v-expand-transition>

  <v-divider class="my-2"></v-divider>

  <!-- Display Settings -->
  <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="state.ui.showDisplay = !state.ui.showDisplay">
    <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Display</div>
    <v-icon :icon="state.ui.showDisplay ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="small" color="medium-emphasis"></v-icon>
  </div>

  <v-expand-transition><div v-show="state.ui.showDisplay" class="px-1">
      <div class="d-flex flex-column gap-2 mb-2">
        <v-select
          v-model="state.view.groupingMode"
          :items="groupingModeOptions"
          item-title="title"
          item-value="value"
          label="Group"
          density="compact"
          variant="outlined"
          hide-details
          :class="['compact-input sidebar-display-select', { 'is-active': state.view.groupingMode !== 'none' }]"
          style="font-size: 12px"
        >
          <template v-slot:item="{ props, item }">
            <v-list-subheader v-if="item.raw.type === 'subheader'" :title="item.raw.title" />
            <v-list-item v-else v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-select
          v-model="state.view.viewMode"
          :items="viewModeOptions"
          item-title="title"
          item-value="value"
          label="Color"
          density="compact"
          variant="outlined"
          hide-details
          style="font-size: 12px"
          :class="['compact-input sidebar-display-select', { 'is-active': state.view.viewMode !== 'state' }]"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-select
          v-model="state.view.linkMode"
          :items="linkModeOptions"
          item-title="title"
          item-value="value"
          label="Links"
          density="compact"
          variant="outlined"
          hide-details
          style="font-size: 12px"
          :class="['compact-input sidebar-display-select', { 'is-active': state.view.linkMode !== 'none' }]"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.title">
              <template v-slot:prepend>
                <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-checkbox
          v-if="state.view.linkMode === 'dependency'"
          v-model="state.view.hideUnlinked"
          label="Hide issues with no links"
          density="compact"
          hide-details
          class="mt-1"
          :class="{ 'is-active-checkbox': !!state.view.hideUnlinked }"
        />
      </div>
  </div></v-expand-transition>

  <v-divider class="mb-2"></v-divider>
</template>

<script setup>
const emit = defineEmits(['reset-filters'])
const props = defineProps({
  // single dict for filters/view/ui (from useUiState)
  state: { type: Object, required: true },

  allLabels: { type: Array, required: true },
  allAuthors: { type: Array, required: true },
  allAssignees: { type: Array, required: true },
  allMilestones: { type: Array, required: true },
  allPriorities: { type: Array, required: true },
  allTypes: { type: Array, required: true },

  dateFilterModes: { type: Array, required: true },

  groupingModeOptions: { type: Array, required: true },
  viewModeOptions: { type: Array, required: true },
  linkModeOptions: { type: Array, required: true }
})

// NOTE: we intentionally mutate nested fields on `state` (prop is shallow-readonly).
// This keeps the call-site simple and avoids 15 v-model bindings.
const { state } = props

const isSetArray = (v) => Array.isArray(v) && v.length > 0
const isSetString = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v
const isDateActive = (mode, after, before, days) => {
  if (!mode || mode === 'none') return false
  if (mode === 'last_x_days') return !!days
  if (mode === 'after') return !!after
  if (mode === 'before') return !!before
  if (mode === 'between') return !!after || !!before
  return true
}
</script>

<style scoped>
.sidebar-display-select {
  margin-bottom: 10px;
}
.sidebar-display-select:last-child {
  margin-bottom: 0;
}

.is-active :deep(.v-field) {
  position: relative;
}
.is-active :deep(.v-field)::before {
  content: "";
  position: absolute;
  left: -3px;
  top: 3px;
  bottom: 3px;
  width: 5px;
  border-radius: 3px;
  pointer-events: none;
  background: rgba(var(--v-theme-warning), 0.95);
  box-shadow: 0 0 10px rgba(var(--v-theme-warning), 0.35);
  opacity: 0.9;
  transform-origin: 50% 50%;
  animation:
    leftBarActivate 420ms ease-out 1,
    leftBarPulse 2000ms ease-in-out infinite 420ms;
}

.is-active-checkbox :deep(.v-selection-control__wrapper) {
  position: relative;
}
.is-active-checkbox :deep(.v-selection-control__wrapper)::before {
  content: "";
  position: absolute;
  left: -3px;
  top: 2px;
  bottom: 2px;
  width: 5px;
  border-radius: 3px;
  background: rgba(var(--v-theme-warning), 0.95);
  box-shadow: 0 0 10px rgba(var(--v-theme-warning), 0.35);
  opacity: 0.9;
  animation:
    leftBarActivate 420ms ease-out 1,
    leftBarPulse 2000ms ease-in-out infinite 420ms;
  pointer-events: none;
}

@keyframes leftBarActivate {
  0% {
    opacity: 0;
    transform: scaleY(0.6);
    box-shadow: 0 0 0 rgba(var(--v-theme-warning), 0);
  }
  45% {
    opacity: 1;
    transform: scaleY(1.05);
    box-shadow: 0 0 22px rgba(var(--v-theme-warning), 0.65);
  }
  100% {
    opacity: 0.9;
    transform: scaleY(1);
    box-shadow: 0 0 10px rgba(var(--v-theme-warning), 0.35);
  }
}

@keyframes leftBarPulse {
  0%   { opacity: 0.8; transform: scaleY(0.95); }
  50%  { opacity: 1;    transform: scaleY(1); }
  100% { opacity: 0.8; transform: scaleY(0.95); }
}
</style>
