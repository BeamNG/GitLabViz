<template>
  <!-- Filters Section -->
  <div class="d-flex align-center justify-space-between mb-2 cursor-pointer user-select-none" @click="state.ui.showFilters = !state.ui.showFilters">
    <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Filters</div>
    <div class="d-flex align-center ga-1">
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
        :items="makeUserItems(allAuthors)"
        item-title="title"
        item-value="value"
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
          <v-list-subheader v-if="item.raw.type === 'subheader'" :title="item.raw.title" />
          <v-list-item v-else v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="userItemIcon(item.raw.value).icon" :color="userItemIcon(item.raw.value).color" size="small" class="mr-2"></v-icon>
            </template>
            <template v-slot:title>{{ item.raw.title }}</template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedAssignees"
        :items="makeUserItems(allAssignees, { includeUnassigned: true })"
        item-title="title"
        item-value="value"
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
          <v-list-subheader v-if="item.raw.type === 'subheader'" :title="item.raw.title" />
          <v-list-item v-else v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="userItemIcon(item.raw.value).icon" :color="userItemIcon(item.raw.value).color" size="small" class="mr-2"></v-icon>
            </template>
            <template v-slot:title>{{ item.raw.title }}</template>
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

      <v-select
        v-model="state.filters.mrMode"
        :items="[
          { title: 'Has merge requests', value: 'has', icon: 'mdi-source-merge' },
          { title: 'No merge requests', value: 'none', icon: 'mdi-source-merge' }
        ]"
        label="Merge Requests"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.mrMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-source-merge"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="item.raw.icon" size="small" class="mr-2"></v-icon>
            </template>
          </v-list-item>
        </template>
      </v-select>

      <v-autocomplete
        v-model="state.filters.selectedParticipants"
        :items="makeUserItems(allParticipants)"
        item-title="title"
        item-value="value"
        label="Participants"
        multiple
        chips
        closable-chips
        clear-on-select
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetArray(state.filters.selectedParticipants) }]"
        hide-details
        style="font-size: 12px"
        prepend-inner-icon="mdi-account-multiple"
      >
        <template v-slot:item="{ props, item }">
          <v-list-subheader v-if="item.raw.type === 'subheader'" :title="item.raw.title" />
          <v-list-item v-else v-bind="props" :title="item.raw.title">
            <template v-slot:prepend>
              <v-icon :icon="userItemIcon(item.raw.value).icon" :color="userItemIcon(item.raw.value).color" size="small" class="mr-2"></v-icon>
            </template>
            <template v-slot:title>{{ item.raw.title }}</template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-select
        v-model="state.filters.dueStatus"
        :items="[
          { title: 'Overdue', value: 'overdue', icon: 'mdi-calendar-alert' },
          { title: 'Due soon', value: 'soon', icon: 'mdi-calendar-clock' },
          { title: 'Due later', value: 'later', icon: 'mdi-calendar' },
          { title: 'No due date', value: 'none', icon: 'mdi-calendar-remove' }
        ]"
        label="Due status"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.dueStatus) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-calendar-alert"
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
        v-model="state.filters.spentMode"
        :items="[
          { title: 'Has time spent', value: 'has', icon: 'mdi-timer' },
          { title: 'No time spent', value: 'none', icon: 'mdi-timer-off' }
        ]"
        label="Time spent"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.spentMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-timer"
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
        v-model="state.filters.budgetMode"
        :items="[
          { title: 'Over budget', value: 'over', icon: 'mdi-cash-remove' },
          { title: 'Within budget', value: 'within', icon: 'mdi-cash-check' },
          { title: 'No estimate', value: 'no_est', icon: 'mdi-cash-off' }
        ]"
        label="Budget"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.budgetMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-cash"
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
        v-model="state.filters.estimateBucket"
        :items="[
          { title: '< 1h', value: 'lt1h', icon: 'mdi-timer-sand' },
          { title: '1–4h', value: '1_4h', icon: 'mdi-timer-sand' },
          { title: '4–8h', value: '4_8h', icon: 'mdi-timer-sand' },
          { title: '1–3d', value: '1_3d', icon: 'mdi-timer-sand' },
          { title: '3d+', value: '3dplus', icon: 'mdi-timer-sand' },
          { title: 'No estimate', value: 'none', icon: 'mdi-timer-sand-empty' }
        ]"
        label="Estimate bucket"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.estimateBucket) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-timer-sand"
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
        v-model="state.filters.taskMode"
        :items="[
          { title: 'No tasks', value: 'no_tasks', icon: 'mdi-format-list-bulleted' },
          { title: '0% done', value: 'none_done', icon: 'mdi-format-list-checks' },
          { title: 'In progress', value: 'in_progress', icon: 'mdi-progress-check' },
          { title: '100% done', value: 'done', icon: 'mdi-check-circle-outline' }
        ]"
        label="Tasks"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.taskMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-format-list-checks"
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
      <div class="d-flex flex-column ga-1 mb-1">
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
      <div class="d-flex flex-column ga-1 mb-1">
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
      <div class="d-flex flex-column ga-1">
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
      <div class="d-flex flex-column ga-2 mb-2">
        <v-autocomplete
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
        </v-autocomplete>

        <v-autocomplete
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
        </v-autocomplete>

        <v-text-field
          v-if="state.view.viewMode === 'due_status' || !!state.filters.dueStatus"
          v-model.number="state.view.dueSoonDays"
          label="Due soon (days)"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="compact-input sidebar-display-select"
          style="font-size: 12px"
          min="1"
        ></v-text-field>

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
  allParticipants: { type: Array, required: true },
  userStateByName: { type: Object, required: false, default: () => ({}) },
  meName: { type: String, required: false, default: '' },
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
const formatUserLabel = (name) => {
  const n = String(name || '').trim()
  if (!n) return ''
  const m = props.userStateByName || {}
  const sRaw = m[n] || m[n.toLowerCase()] || ''
  const s = sRaw ? String(sRaw).trim().toLowerCase() : ''
  if (!s || s === 'active') return n
  return `${n} (${s})`
}
const isDeactivatedUser = (name) => {
  const n = String(name || '').trim()
  if (!n) return false
  const m = props.userStateByName || {}
  const sRaw = m[n] || m[n.toLowerCase()] || ''
  const s = sRaw ? String(sRaw).trim().toLowerCase() : ''
  return !!s && s !== 'active'
}
const userItemIcon = (value) => {
  const v = String(value || '').trim()
  if (v === '@me') return { icon: 'mdi-account-star-outline', color: 'primary' }
  if (v === '@unassigned') return { icon: 'mdi-account-question-outline', color: '' }
  if (v === '@deactivated') return { icon: 'mdi-account-off-outline', color: 'error' }
  if (isDeactivatedUser(v)) return { icon: 'mdi-account-off-outline', color: 'error' }
  return { icon: 'mdi-account-circle-outline', color: '' }
}
const makeUserItems = (names, opts = {}) => {
  const { includeUnassigned = false } = opts || {}
  const list = Array.isArray(names) ? names.filter(Boolean) : []
  const active = []
  const deactivated = []
  list.forEach(n => (isDeactivatedUser(n) ? deactivated : active).push(n))

  const meLabel = props.meName ? `Me (${props.meName})` : 'Me'
  const items = [{ title: meLabel, value: '@me', disabled: !props.meName }]
  if (includeUnassigned) items.push({ title: 'Unassigned', value: '@unassigned' })
  active.forEach(n => items.push({ title: formatUserLabel(n), value: n }))
  if (deactivated.length) {
    items.push({ title: 'Deactivated users', value: '__sub_deactivated__', type: 'subheader', disabled: true })
    deactivated.forEach(n => items.push({ title: formatUserLabel(n), value: n }))
  }
  // requested: keep this at the very end
  items.push({ title: 'Any deactivated user', value: '@deactivated', disabled: deactivated.length === 0 })
  return items
}
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
