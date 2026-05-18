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

  <v-expand-transition><div v-show="state.ui.showFilters" class="px-1 glv-filter-list">
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
        :items="sortByCount(allLabels, 'labels')"
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
        :menu-props="menuPropsFor(sortByCount(allLabels, 'labels'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item">
            <template v-slot:prepend>
              <v-icon icon="mdi-tag" size="small" class="mr-2"></v-icon>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'labels')">{{ countOf('labels', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.excludedLabels"
        :items="sortByCount(allLabels, 'excludedLabels')"
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
        :menu-props="menuPropsFor(sortByCount(allLabels, 'excludedLabels'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item">
            <template v-slot:prepend>
              <v-icon icon="mdi-tag-outline" size="small" class="mr-2"></v-icon>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'excludedLabels')">{{ countOf('excludedLabels', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- People -->
      <v-autocomplete
        v-model="state.filters.selectedAuthors"
        :items="sortByCount(makeUserItems(allAuthors), 'authors')"
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
        :menu-props="menuPropsFor(sortByCount(makeUserItems(allAuthors), 'authors'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-subheader v-if="item.type === 'subheader'" :title="item.title" />
          <v-list-item v-else v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(userItemIcon(item.value).color) }"><v-icon :icon="userItemIcon(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:title>{{ item.title }}</template>
            <template v-slot:append><span :class="countChipClass(item, 'authors')">{{ countOf('authors', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedAssignees"
        :items="sortByCount(makeUserItems(allAssignees, { includeUnassigned: true }), 'assignees')"
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
        :menu-props="menuPropsFor(sortByCount(makeUserItems(allAssignees, { includeUnassigned: true }), 'assignees'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-subheader v-if="item.type === 'subheader'" :title="item.title" />
          <v-list-item v-else v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(userItemIcon(item.value).color) }"><v-icon :icon="userItemIcon(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:title>{{ item.title }}</template>
            <template v-slot:append><span :class="countChipClass(item, 'assignees')">{{ countOf('assignees', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Attributes -->
      <v-autocomplete
        v-model="state.filters.selectedMilestones"
        :items="sortByCount(milestoneItems, 'milestones')"
        item-title="title"
        item-value="value"
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
        :menu-props="menuPropsFor(sortByCount(milestoneItems, 'milestones'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(milestoneIconAndColor(item.value).color) }"><v-icon :icon="milestoneIconAndColor(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'milestones')">{{ countOf('milestones', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedPriorities"
        :items="sortByCount(priorityItems, 'priorities')"
        item-title="title"
        item-value="value"
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
        :menu-props="menuPropsFor(sortByCount(priorityItems, 'priorities'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(priorityIconAndColor(item.value).color) }"><v-icon :icon="priorityIconAndColor(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'priorities')">{{ countOf('priorities', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-autocomplete
        v-model="state.filters.selectedTypes"
        :items="sortByCount(typeItems, 'types')"
        item-title="title"
        item-value="value"
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
        :menu-props="menuPropsFor(sortByCount(typeItems, 'types'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(typeIconAndColor(item.value).color) }"><v-icon :icon="typeIconAndColor(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'types')">{{ countOf('types', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Status & Subscription -->
      <v-autocomplete
        v-model="state.filters.selectedStatuses"
        :items="sortByCount(statusItems, 'status')"
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
        :menu-props="menuPropsFor(sortByCount(statusItems, 'status'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'status')">{{ countOf('status', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-select
        v-model="state.filters.selectedSubscription"
        :items="subscriptionOptions"
        label="Subscribed"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.selectedSubscription) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-bell-ring-outline"
        :menu-props="menuPropsFor(subscriptionOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'subscription')">{{ countOf('subscription', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-select
        v-model="state.filters.mrMode"
        :items="mrModeOptions"
        label="Merge Requests"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.mrMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-source-merge"
        :menu-props="menuPropsFor(mrModeOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'mr')">{{ countOf('mr', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-autocomplete
        v-model="state.filters.selectedParticipants"
        :items="sortByCount(makeUserItems(allParticipants), 'participants')"
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
        :menu-props="menuPropsFor(sortByCount(makeUserItems(allParticipants), 'participants'))"
      >
        <template v-slot:item="{ props, item }">
          <v-list-subheader v-if="item.type === 'subheader'" :title="item.title" />
          <v-list-item v-else v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(userItemIcon(item.value).color) }"><v-icon :icon="userItemIcon(item.value).icon" size="small"></v-icon></span>
            </template>
            <template v-slot:title>{{ item.title }}</template>
            <template v-slot:append><span :class="countChipClass(item, 'participants')">{{ countOf('participants', item) }}</span></template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <v-select
        v-model="state.filters.dueStatus"
        :items="dueStatusOptions"
        label="Due status"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.dueStatus) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-calendar-alert"
        :menu-props="menuPropsFor(dueStatusOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'due')">{{ countOf('due', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-select
        v-model="state.filters.spentMode"
        :items="spentModeOptions"
        label="Time spent"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.spentMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-timer"
        :menu-props="menuPropsFor(spentModeOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'spent')">{{ countOf('spent', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-select
        v-model="state.filters.budgetMode"
        :items="budgetModeOptions"
        label="Budget"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.budgetMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-cash"
        :menu-props="menuPropsFor(budgetModeOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'budget')">{{ countOf('budget', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-select
        v-model="state.filters.estimateBucket"
        :items="estimateBucketOptions"
        label="Estimate bucket"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.estimateBucket) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-timer-sand"
        :menu-props="menuPropsFor(estimateBucketOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'estimate')">{{ countOf('estimate', item) }}</span></template>
          </v-list-item>
        </template>
      </v-select>

      <v-select
        v-model="state.filters.taskMode"
        :items="taskModeOptions"
        label="Tasks"
        density="compact"
        variant="outlined"
        :class="['mb-1 compact-input', { 'is-active': isSetString(state.filters.taskMode) }]"
        hide-details
        style="font-size: 12px"
        clearable
        prepend-inner-icon="mdi-format-list-checks"
        :menu-props="menuPropsFor(taskModeOptions)"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.title">
            <template v-slot:prepend>
              <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
            </template>
            <template v-slot:append><span :class="countChipClass(item, 'tasks')">{{ countOf('tasks', item) }}</span></template>
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
          :menu-props="menuPropsFor(dateFilterModes)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
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
          :menu-props="menuPropsFor(dateFilterModes)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
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
          :menu-props="menuPropsFor(dateFilterModes)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <span class="mr-2 list-icon-wrap" :style="{ color: iconColor(item.raw?.color || item.color) }"><v-icon :icon="item.raw?.icon || item.icon" size="small"></v-icon></span>
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

  <!-- Columns control — only relevant in list mode (mirror of the Display
       section, which only matters for the graph). Owns ordering / visibility
       for the data-table view. -->
  <SidebarListColumns v-if="viewLayout === 'list'" :state="state" />

  <!-- Display Settings — Group + Color apply to both graph and list (group
       turns into group-by header rows in the table; color into a left-edge
       row indicator). Link mode + hide-unlinked + clone-multi-assignee are
       graph-only and gated below. -->
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
          :menu-props="menuPropsFor(groupingModeOptions)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-subheader v-if="item.type === 'subheader'" :title="item.title" />
            <v-list-item v-else v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <v-checkbox
          v-if="viewLayout !== 'list' && state.view.groupingMode === 'assignee'"
          v-model="state.view.cloneMultiAssignee"
          label="Duplicate multi-assignee tickets"
          density="compact"
          hide-details
          class="mt-n2"
          :class="{ 'is-active-checkbox': !!state.view.cloneMultiAssignee }"
        />

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
          :menu-props="menuPropsFor(viewModeOptions)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
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
          v-if="viewLayout !== 'list'"
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
          :menu-props="menuPropsFor(linkModeOptions)"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.title">
              <template v-slot:prepend>
                <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-checkbox
          v-if="viewLayout !== 'list' && state.view.linkMode === 'dependency'"
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
import { computed, watch } from 'vue'
import SidebarListColumns from './sidebar/SidebarListColumns.vue'

const emit = defineEmits(['reset-filters'])
const props = defineProps({
  // single dict for filters/view/ui (from useUiState)
  state: { type: Object, required: true },

  allStatuses: { type: Array, required: true },
  allLabels: { type: Array, required: true },
  allAuthors: { type: Array, required: true },
  allAssignees: { type: Array, required: true },
  allParticipants: { type: Array, required: true },
  userStateByName: { type: Object, required: false, default: () => ({}) },
  meName: { type: String, required: false, default: '' },
  allMilestones: { type: Array, required: true },
  allPriorities: { type: Array, required: true },
  allTypes: { type: Array, required: true },
  filterCounts: { type: Object, required: false, default: () => ({}) },

  dateFilterModes: { type: Array, required: true },

  groupingModeOptions: { type: Array, required: true },
  viewModeOptions: { type: Array, required: true },
  linkModeOptions: { type: Array, required: true },
  // 'graph' | 'list' — the Display section (color / group / link) is hidden
  // when in list mode because none of those controls affect the table.
  viewLayout: { type: String, default: 'graph' }
})

// NOTE: we intentionally mutate nested fields on `state` (prop is shallow-readonly).
// This keeps the call-site simple and avoids 15 v-model bindings.
const { state } = props

const isSetArray = (v) => Array.isArray(v) && v.length > 0
const isSetString = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v

// Shared dropdown menu config: taller (more rows visible) + width pinned via custom class.
// Width itself is computed per-dropdown by `menuPropsFor()` based on the longest label,
// because Vuetify virtualizes the list (only ~10 items in DOM at a time) — so CSS-only
// approaches like `max-content` recompute as you scroll. Pre-measuring all items upfront
// gives a stable width that fits everything.
const menuProps = { maxHeight: 460, contentClass: 'glv-filter-menu' }

const MENU_MIN_PX = 280   // never narrower than the combo box
const MENU_MAX_PX = 600   // cap so one giant label can't blow up the menu
const MENU_CHAR_PX = 7    // approx avg width per char at 13px sans-serif
const MENU_CHROME_PX = 80 // icon + count chip + padding

const menuPropsFor = (items, titleFn) => {
  const get = titleFn || ((i) => typeof i === 'string' ? i : (i?.title ?? i?.value ?? ''))
  const list = Array.isArray(items) ? items : []
  let maxLen = 0
  for (const it of list) {
    const t = String(get(it) || '')
    if (t.length > maxLen) maxLen = t.length
  }
  const w = Math.max(MENU_MIN_PX, Math.min(MENU_MAX_PX, maxLen * MENU_CHAR_PX + MENU_CHROME_PX))
  return { ...menuProps, width: w, minWidth: w, maxWidth: w }
}

// Pre-fill sensible defaults when a date mode is picked so the date inputs
// don't render blank (which shows up as "dd/mm/yyyy" / "Invalid"). Past-dated
// dimensions (created/updated) default to the last 7 days; due-date defaults
// to the next 7 days. Only fills empty fields — never overwrites user input.
const todayYmd = () => new Date().toISOString().slice(0, 10)
const ymdOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }

const applyDateDefaults = (group, futureBias) => {
  const f = state.filters.dateFilters
  const mode = f[`${group}Mode`]
  const afterKey = `${group}After`; const beforeKey = `${group}Before`; const daysKey = `${group}Days`
  // Past dimensions: "after" = N days ago, "before" = today.
  // Future dimensions: "after" = today, "before" = N days from now.
  const defAfter = futureBias ? todayYmd() : ymdOffset(-7)
  const defBefore = futureBias ? ymdOffset(7) : todayYmd()
  if ((mode === 'after' || mode === 'between') && !f[afterKey]) f[afterKey] = defAfter
  if ((mode === 'before' || mode === 'between') && !f[beforeKey]) f[beforeKey] = defBefore
  if (mode === 'last_x_days' && (!f[daysKey] || f[daysKey] <= 0)) f[daysKey] = 7
}

watch(() => state.filters.dateFilters.createdMode, () => applyDateDefaults('created', false))
watch(() => state.filters.dateFilters.updatedMode, () => applyDateDefaults('updated', false))
watch(() => state.filters.dateFilters.dueDateMode, () => applyDateDefaults('dueDate', true))

// Per-option icons + semantic colors for the boolean/enum filters.
// Centralized here so the templates stay tidy.
const subscriptionOptions = [
  { title: 'Explicitly subscribed', value: 'subscribed', icon: 'mdi-bell', color: 'success' },
  { title: 'Explicitly unsubscribed', value: 'unsubscribed', icon: 'mdi-bell-off-outline', color: 'medium-emphasis' }
]
const mrModeOptions = [
  { title: 'Has merge requests', value: 'has', icon: 'mdi-source-merge', color: 'info' },
  { title: 'No merge requests', value: 'none', icon: 'mdi-source-branch-remove', color: 'medium-emphasis' }
]
const dueStatusOptions = [
  { title: 'Overdue', value: 'overdue', icon: 'mdi-calendar-alert', color: 'error' },
  { title: 'Due soon', value: 'soon', icon: 'mdi-calendar-clock', color: 'warning' },
  { title: 'Due later', value: 'later', icon: 'mdi-calendar-blank-outline', color: 'info' },
  { title: 'No due date', value: 'none', icon: 'mdi-calendar-remove-outline', color: 'medium-emphasis' }
]
const spentModeOptions = [
  { title: 'Has time spent', value: 'has', icon: 'mdi-timer-outline', color: 'info' },
  { title: 'No time spent', value: 'none', icon: 'mdi-timer-off-outline', color: 'medium-emphasis' }
]
const budgetModeOptions = [
  { title: 'Over budget', value: 'over', icon: 'mdi-cash-remove', color: 'error' },
  { title: 'Within budget', value: 'within', icon: 'mdi-cash-check', color: 'success' },
  { title: 'No estimate', value: 'no_est', icon: 'mdi-cash-off', color: 'medium-emphasis' }
]
const estimateBucketOptions = [
  { title: '< 1h', value: 'lt1h', icon: 'mdi-flash-outline', color: 'success' },
  { title: '1–4h', value: '1_4h', icon: 'mdi-clock-fast', color: 'info' },
  { title: '4–8h', value: '4_8h', icon: 'mdi-clock-outline', color: 'info' },
  { title: '1–3d', value: '1_3d', icon: 'mdi-calendar-week-outline', color: 'warning' },
  { title: '3d+', value: '3dplus', icon: 'mdi-calendar-month-outline', color: 'error' },
  { title: 'No estimate', value: 'none', icon: 'mdi-timer-sand-empty', color: 'medium-emphasis' }
]
const taskModeOptions = [
  { title: 'No tasks', value: 'no_tasks', icon: 'mdi-format-list-bulleted', color: 'medium-emphasis' },
  { title: '0% done', value: 'none_done', icon: 'mdi-checkbox-blank-outline', color: 'warning' },
  { title: 'In progress', value: 'in_progress', icon: 'mdi-progress-check', color: 'info' },
  { title: '100% done', value: 'done', icon: 'mdi-check-circle-outline', color: 'success' }
]

// Lookup ticket count for a filter value; falls back to 0 (shown greyed in the row).
// Vuetify's `item` slot prop is an InternalListItem ({value, title, raw, ...}) for object
// items, but a plain primitive for string-array items — accept both shapes.
const countOf = (bucket, item) => {
  const m = props.filterCounts && props.filterCounts[bucket]
  if (!m || typeof m.get !== 'function') return 0
  const key = (item && typeof item === 'object') ? (item.value ?? item.raw ?? item.title) : item
  return m.get(key) || 0
}

// Sort items by ticket count (descending) so frequently-used values surface first.
// Sentinels (@me / @none / @unassigned / @deactivated, subheaders, disabled rows) stay
// at the top in their original relative order.
const SENTINELS = new Set(['@me', '@none', '@unassigned', '@deactivated'])
const isSentinelItem = (it) => {
  if (!it) return false
  if (typeof it === 'object') {
    if (it.type === 'subheader' || it.disabled) return true
    return SENTINELS.has(it.value)
  }
  return SENTINELS.has(it)
}
const sortByCount = (items, bucket) => {
  const m = props.filterCounts && props.filterCounts[bucket]
  if (!Array.isArray(items) || !m || typeof m.get !== 'function') return items || []
  const decorated = items.map((it, i) => ({ it, i, sent: isSentinelItem(it), count: countOf(bucket, it) }))
  decorated.sort((a, b) => {
    if (a.sent !== b.sent) return a.sent ? -1 : 1
    if (a.sent && b.sent) return a.i - b.i
    if (b.count !== a.count) return b.count - a.count
    return a.i - b.i
  })
  return decorated.map(d => d.it)
}

// Color the count chip with the same semantic color as the row's icon
// (success/warning/error/info/...) — and dim it when the count is zero.
const countChipClass = (item, bucket) => {
  const c = countOf(bucket, item)
  const obj = item && typeof item === 'object' ? item : null
  const color = obj?.raw?.color || obj?.color || 'medium-emphasis'
  return ['count-chip', `text-${color}`, c === 0 ? 'count-chip-zero' : '']
}

// Map semantic color names to hex. Passing hex to v-icon's `color` prop forces it via
// inline style on the icon element itself (works around Vuetify's prepend-slot dimming).
const ICON_COLOR_MAP = {
  success: '#4caf50',
  info: '#2196f3',
  warning: '#fb8c00',
  error: '#ef5350',
  amber: '#ffb300',
  primary: '#1976d2',
  'medium-emphasis': '#9e9e9e'
}
const iconColor = (color) => ICON_COLOR_MAP[color] || color || ''

const statusIconAndColor = (status) => {
  const s = String(status || '').trim()
  if (s === 'To do') return { icon: 'mdi-circle-outline', color: 'medium-emphasis' }
  if (s === 'In progress') return { icon: 'mdi-progress-check', color: 'info' }
  if (s === 'Ready for Review') return { icon: 'mdi-eye-outline', color: 'warning' }
  if (s === 'On Hold/Blocked') return { icon: 'mdi-pause-circle-outline', color: 'error' }
  if (s === 'Done') return { icon: 'mdi-check-circle-outline', color: 'success' }
  if (s === "Won't do") return { icon: 'mdi-cancel', color: 'error' }
  if (s === 'Duplicate') return { icon: 'mdi-content-copy', color: 'medium-emphasis' }
  return { icon: 'mdi-circle-medium', color: '' }
}

// Visual cue per priority bucket — icon + color so the dropdown reads at a glance.
const priorityIconAndColor = (value) => {
  const v = String(value || '').trim().toLowerCase()
  if (v === '@none') return { icon: 'mdi-circle-outline', color: 'medium-emphasis' }
  if (v.includes('block')) return { icon: 'mdi-alert-octagram', color: 'error' }
  if (v.includes('high')) return { icon: 'mdi-arrow-up-bold', color: 'warning' }
  if (v.includes('medium') || v.includes('med')) return { icon: 'mdi-equal', color: 'amber' }
  if (v.includes('lowest')) return { icon: 'mdi-chevron-double-down', color: 'medium-emphasis' }
  if (v.includes('low')) return { icon: 'mdi-arrow-down-bold', color: 'success' }
  if (v.includes('tbd')) return { icon: 'mdi-help-circle-outline', color: 'medium-emphasis' }
  return { icon: 'mdi-flag-variant-outline', color: '' }
}

// Per Type bucket — picks a thematic mdi icon based on the label name.
const typeIconAndColor = (value) => {
  const v = String(value || '').trim().toLowerCase()
  if (v === '@none') return { icon: 'mdi-shape-plus-outline', color: 'medium-emphasis' }
  if (v === 'bug') return { icon: 'mdi-bug-outline', color: 'error' }
  if (v === 'feature') return { icon: 'mdi-star-outline', color: 'amber' }
  if (v === 'story') return { icon: 'mdi-book-open-page-variant-outline', color: 'info' }
  if (v === 'task') return { icon: 'mdi-checkbox-marked-outline', color: '' }
  if (v === 'sub-task' || v === 'subtask') return { icon: 'mdi-format-list-bulleted-square', color: 'medium-emphasis' }
  if (v === 'chore') return { icon: 'mdi-broom', color: 'medium-emphasis' }
  if (v === 'performance') return { icon: 'mdi-speedometer', color: 'warning' }
  if (v === 'idea') return { icon: 'mdi-lightbulb-outline', color: 'amber' }
  if (v === 'feedback') return { icon: 'mdi-comment-quote-outline', color: 'info' }
  if (v === 'recurring') return { icon: 'mdi-repeat', color: '' }
  if (v === 'project') return { icon: 'mdi-folder-outline', color: '' }
  if (v === 'incident') return { icon: 'mdi-alert-circle-outline', color: 'error' }
  return { icon: 'mdi-shape-outline', color: '' }
}

// Milestones often look like version numbers ("0.39"); pick a flag style for "open" milestones,
// flag-outline for the @none sentinel, and a calendar tag for date-stamped or special ones.
const milestoneIconAndColor = (value) => {
  const v = String(value || '').trim()
  if (v === '@none') return { icon: 'mdi-flag-outline', color: 'medium-emphasis' }
  if (/^\d/.test(v)) return { icon: 'mdi-flag-variant', color: 'info' }
  if (/tbd|backlog/i.test(v)) return { icon: 'mdi-flag-variant-outline', color: 'medium-emphasis' }
  return { icon: 'mdi-flag-variant', color: '' }
}

const statusItems = computed(() => {
  const list = Array.isArray(props.allStatuses) ? props.allStatuses : []
  const counts = (props.filterCounts && props.filterCounts.status) || null
  const get = counts && typeof counts.get === 'function' ? (k) => counts.get(k) || 0 : () => 0
  return list.filter(Boolean).map(s => {
    // Drop the dedicated icon for unused entries — the standard icon list otherwise implies
    // the option is canonical when in fact this project may use a different status name.
    const present = get(s) > 0
    const { icon, color } = present
      ? statusIconAndColor(s)
      : { icon: 'mdi-circle-medium', color: 'medium-emphasis' }
    return { title: s, value: s, icon, color }
  })
})

// Prepend an "@none" sentinel so users can filter for tickets without a milestone/priority/type.
// `icon`/`color` are also embedded so the count-chip can pick up the row's semantic color.
const milestoneItems = computed(() => [
  { title: '(No milestone)', value: '@none', ...milestoneIconAndColor('@none') },
  ...(props.allMilestones || []).map(v => ({ title: v, value: v, ...milestoneIconAndColor(v) }))
])
const priorityItems = computed(() => [
  { title: '(No priority)', value: '@none', ...priorityIconAndColor('@none') },
  ...(props.allPriorities || []).map(v => ({ title: v, value: v, ...priorityIconAndColor(v) }))
])
const typeItems = computed(() => [
  { title: '(No type)', value: '@none', ...typeIconAndColor('@none') },
  ...(props.allTypes || []).map(v => ({ title: v, value: v, ...typeIconAndColor(v) }))
])
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

.count-chip {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  margin-left: 8px;
  min-width: 28px;
  text-align: right;
  opacity: 0.7;
}
.count-chip-zero {
  opacity: 0.25;
}

/* (filter dropdown menu styles moved to the unscoped block below — Vuetify menus are
   teleported to <body> so they live outside this component's scoped CSS attribute.) */

/* Focused-filter affordance: dim non-focused siblings + give the active field a clear
   primary outline. Helps the eye land on the input the user is currently working with.
   Uses TWO conditions so the dim persists once a dropdown menu opens (Vuetify teleports
   the menu and may move DOM focus away, breaking `:focus-within`; but Vuetify keeps the
   `.v-field--focused` class on the activator while the menu is open). */
.glv-filter-list > * {
  transition: opacity 160ms ease-out;
}
.glv-filter-list:focus-within > *:not(:focus-within),
.glv-filter-list:has(.v-field--focused) > *:not(:has(.v-field--focused)) {
  opacity: 0.35;
}
.glv-filter-list :deep(.v-field.v-field--focused) {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.55);
  border-radius: 4px;
}

/* The icon wrapper sets `color`, the inner v-icon glyph inherits via `currentColor`.
   Force opacity:1 on both to defeat Vuetify's prepend-slot dimming. */
.list-icon-wrap,
.list-icon-wrap :deep(.v-icon) {
  opacity: 1 !important;
}
.list-icon-wrap :deep(.v-icon),
.list-icon-wrap :deep(.v-icon i),
.list-icon-wrap :deep(.v-icon svg) {
  color: inherit !important;
  fill: currentColor !important;
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

<!-- Unscoped: Vuetify menus are teleported to <body>, so they're outside the component's
     scoped CSS. Use a contentClass-based selector with high specificity to pin the menu
     width (no jitter while scrolling through items of varying length) and tighten rows. -->
<style>
/* Width is set per-dropdown via JS (`menuPropsFor()` measures the longest item once
   and pins the menu to a fixed px). CSS-based sizing like `max-content` would re-flow
   while scrolling because Vuetify virtualizes the list. */
.glv-filter-menu.v-overlay__content,
.v-overlay__content.glv-filter-menu {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25) !important;
}
.glv-filter-menu .v-list {
  padding-block: 2px;
}
.glv-filter-menu .v-list-item {
  min-height: 30px !important;
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}
.glv-filter-menu .v-list-item__prepend {
  padding-inline-end: 6px !important;
}
/* Subtle zebra striping so rows are easier to track horizontally. */
.glv-filter-menu .v-list-item:nth-child(even) {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
.glv-filter-menu .v-list-item__content {
  min-width: 0;
  overflow: hidden;
}
.glv-filter-menu .v-list-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
