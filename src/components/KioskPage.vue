<template>
  <div class="kiosk" tabindex="0" ref="root">
    <header class="kiosk-head">
      <div class="kiosk-head-left">
        <span class="kiosk-tag">KIOSK</span>
        <span class="kiosk-mode-label">{{ currentModeLabel }}</span>
        <span v-if="targetMilestone" class="kiosk-scope-chip" :title="`All counts scoped to milestone: ${targetMilestone}`">
          <v-icon icon="mdi-flag" size="x-small" />
          {{ targetMilestone }}
        </span>
        <span
          v-if="priorityFilter.length"
          class="kiosk-scope-chip kiosk-scope-chip-priority"
          :title="`Priority filter: ${priorityFilter.map(p => PRIORITY_BUCKET_LABEL[p] || p).join(' + ')}`"
        >
          <v-icon icon="mdi-filter-variant" size="x-small" />
          {{ priorityFilter.map(p => PRIORITY_BUCKET_LABEL[p] || p).join(' + ') }}
        </span>
      </div>
      <div class="kiosk-head-right">
        <span class="kiosk-clock">{{ clock }}</span>
        <button
          type="button"
          class="kiosk-refresh-eta"
          :title="`${lastRefreshTitle} — click to refresh now`"
          :disabled="loading"
          @click="onManualRefresh"
        >
          <v-icon icon="mdi-refresh" size="small" :class="{ spinning: loading }" />
          {{ refreshLabel }}
        </button>
        <button class="kiosk-icon-btn" title="Previous (←)" @click="prevMode">‹</button>
        <button class="kiosk-icon-btn" title="Next (→)" @click="nextMode">›</button>
        <button class="kiosk-icon-btn" :title="paused ? 'Resume cycling (Space)' : 'Pause cycling (Space)'" @click="paused = !paused">
          <v-icon :icon="paused ? 'mdi-play' : 'mdi-pause'" size="small" />
        </button>
        <button class="kiosk-icon-btn" title="Open kiosk settings" @click="$emit('open-config')">
          <v-icon icon="mdi-cog-outline" size="small" />
        </button>
        <button class="kiosk-icon-btn" title="Exit kiosk (Esc)" @click="$emit('close')">×</button>
      </div>
    </header>

    <main class="kiosk-body" :class="`mode-${currentMode}`">
      <!-- Target milestone (focused view) -->
      <section v-if="currentMode === 'target'" class="k-target">
        <div v-if="!targetData" class="k-target-empty">
          <v-icon icon="mdi-flag-outline" size="64" />
          <div class="k-target-empty-title">No target milestone set</div>
          <div class="k-target-empty-sub">
            Configuration → Kiosk → "Target milestone" to pin one.
          </div>
        </div>
        <template v-else>
          <div class="k-target-head">
            <div class="k-target-head-l">
              <div class="k-section-title k-target-title">
                <v-icon icon="mdi-flag" />
                {{ targetData.title }}
                <span v-if="targetData.state && targetData.state !== 'active'" class="k-target-state">{{ targetData.state }}</span>
              </div>
              <div v-if="targetData.dueLabel" class="k-target-due" :class="targetData.dueClass">
                <v-icon icon="mdi-calendar" size="small" />
                {{ targetData.dueLabel }}{{ targetData.due ? ' · ' + targetData.due : '' }}
              </div>
            </div>
            <div class="k-target-pct">{{ targetData.pct }}<span>%</span></div>
          </div>

          <div class="k-target-bar k-target-bar-rich">
            <div
              v-if="targetData.closed"
              class="k-trb-seg k-trb-closed"
              :style="{ width: (targetData.closed / targetData.total * 100) + '%' }"
              :title="`${targetData.closed} closed`"
            />
            <div
              v-if="targetData.openOriginal"
              class="k-trb-seg k-trb-open"
              :style="{ width: (targetData.openOriginal / targetData.total * 100) + '%' }"
              :title="`${targetData.openOriginal} open · original scope`"
            />
            <div
              v-if="targetData.openAdded"
              class="k-trb-seg k-trb-added"
              :style="{ width: (targetData.openAdded / targetData.total * 100) + '%' }"
              :title="`${targetData.openAdded} open · added after milestone start`"
            />
          </div>
          <div class="k-trb-legend">
            <span><i class="k-swatch k-trb-closed" />Closed {{ targetData.closed }}</span>
            <span><i class="k-swatch k-trb-open" />Open original {{ targetData.openOriginal }}</span>
            <span v-if="targetData.openAdded || targetData.closedAdded">
              <i class="k-swatch k-trb-added" />Added after start {{ targetData.openAdded + targetData.closedAdded }}
              <template v-if="targetData.closedAdded">({{ targetData.closedAdded }} already closed)</template>
            </span>
          </div>

          <div class="k-target-stats">
            <div class="k-stat k-stat-pos">
              <v-icon icon="mdi-check-circle" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.closed) }}</div>
              <div class="k-stat-lbl">Closed</div>
              <div v-if="targetForecast" class="k-stat-sub">+{{ fmtNum(targetForecast.closedRecent) }} last {{ targetForecast.lookbackDays }}d</div>
            </div>
            <div class="k-stat">
              <v-icon icon="mdi-circle-outline" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.open) }}</div>
              <div class="k-stat-lbl">Open</div>
              <div v-if="targetForecast" class="k-stat-sub">{{ targetForecast.closedPerWeek }} closed/wk · {{ targetForecast.addedPerWeek }} added/wk</div>
            </div>
            <div class="k-stat">
              <v-icon icon="mdi-sigma" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.total) }}</div>
              <div class="k-stat-lbl">Total</div>
              <div v-if="targetForecast" class="k-stat-sub">+{{ fmtNum(targetForecast.addedRecent) }} added last {{ targetForecast.lookbackDays }}d</div>
            </div>
          </div>

          <div v-if="targetForecast" class="k-target-eta" :class="`is-${targetForecast.status}`">
            <v-icon :icon="ETA_ICON[targetForecast.status]" />
            <div class="k-target-eta-main">
              <template v-if="targetForecast.status === 'on-track' || targetForecast.status === 'late' || targetForecast.status === 'no-deadline'">
                <strong>ETA ~{{ targetForecast.weeksToShip }} weeks</strong>
                <span class="k-target-eta-date">→ {{ targetForecast.eta }}</span>
              </template>
              <template v-else-if="targetForecast.status === 'done'">
                <strong>Milestone complete</strong>
              </template>
              <template v-else>
                <strong>No ETA</strong>
              </template>
              <span class="k-target-eta-msg">· {{ targetForecast.message }}</span>
            </div>
          </div>

          <div class="k-target-recent">
            <div class="k-target-recent-card">
              <div class="k-section-title k-target-recent-title k-target-recent-closed">
                <v-icon icon="mdi-check-circle" />
                Recently closed · {{ targetRecent.closed.length }}
              </div>
              <ul v-if="targetRecent.closed.length" class="k-target-feed k-target-feed-compact">
                <li
                  v-for="(t, i) in targetRecent.closed"
                  :key="i"
                  :class="{ 'k-clickable': !!t.url }"
                  @click="openIssue(t.url)"
                  :title="t.url ? 'Open in GitLab' : ''"
                >
                  <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
                  <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
                  <span class="k-feed-who" :title="t.who || ''">
                    <template v-if="t.who">
                      <span class="k-feed-avatar" :style="{ background: avatarColor(t.who) }">{{ initialsOf(t.who) }}</span>
                    </template>
                  </span>
                  <span class="k-feed-when">{{ relTime(t.ts) }}</span>
                </li>
              </ul>
              <div v-else class="k-empty k-empty-compact">Nothing closed in last {{ targetForecast?.lookbackDays || 14 }}d.</div>
            </div>
            <div class="k-target-recent-card">
              <div class="k-section-title k-target-recent-title k-target-recent-added">
                <v-icon icon="mdi-plus-circle" />
                Recently added · {{ targetRecent.added.length }}
              </div>
              <ul v-if="targetRecent.added.length" class="k-target-feed k-target-feed-compact">
                <li
                  v-for="(t, i) in targetRecent.added"
                  :key="i"
                  :class="{ 'k-clickable': !!t.url }"
                  @click="openIssue(t.url)"
                  :title="t.url ? 'Open in GitLab' : ''"
                >
                  <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
                  <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
                  <span class="k-feed-who" :title="t.who || ''">
                    <template v-if="t.who">
                      <span class="k-feed-avatar" :style="{ background: avatarColor(t.who) }">{{ initialsOf(t.who) }}</span>
                    </template>
                  </span>
                  <span class="k-feed-when">{{ relTime(t.ts) }}</span>
                </li>
              </ul>
              <div v-else class="k-empty k-empty-compact">No new tickets added in last {{ targetForecast?.lookbackDays || 14 }}d.</div>
            </div>
          </div>
        </template>
      </section>

      <!-- Milestone burnup: cumulative scope vs closed over lifetime -->
      <section v-else-if="currentMode === 'burnup'" class="k-burnup-section">
        <div v-if="!targetBurnup" class="k-empty">
          {{ targetMilestone ? 'No tickets in this milestone yet.' : 'No target milestone set (Configuration → Kiosk).' }}
        </div>
        <template v-else>
          <div class="k-section-title k-burnup-title">
            <v-icon icon="mdi-chart-areaspline" />
            {{ targetMilestone }} · burnup
            <span class="k-section-sub">
              {{ targetBurnup.startLabel }} → {{ targetBurnup.endLabel }} ({{ targetBurnup.windowDays }}d window)
              <span v-if="targetBurnup.scopeBaseline || targetBurnup.closedBaseline">
                · baseline {{ targetBurnup.closedBaseline }} / {{ targetBurnup.scopeBaseline }}
              </span>
            </span>
          </div>
          <svg
            ref="burnupSvgRef"
            class="k-burnup-svg"
            :viewBox="`0 0 ${targetBurnup.vbWidth} ${targetBurnup.vbHeight}`"
          >
            <!-- horizontal grid -->
            <line
              v-for="(t, i) in targetBurnup.yTicks" :key="'yg' + i"
              :x1="targetBurnup.innerLeft" :x2="targetBurnup.innerRight"
              :y1="t.y" :y2="t.y"
              stroke="rgba(127,127,127,0.18)" stroke-dasharray="3 4"
            />
            <text
              v-for="(t, i) in targetBurnup.yTicks" :key="'yt' + i"
              :x="targetBurnup.innerLeft - 8" :y="t.y + 6"
              text-anchor="end" font-size="18" fill="rgba(200,200,200,0.85)"
              font-weight="600"
            >{{ t.v }}</text>

            <!-- open band (area between scope and closed) — coloured amber as the
                 "risk zone": as closures catch up, the colored area shrinks visually. -->
            <path :d="targetBurnup.areaPath" :fill="targetBurnup.onTrack ? 'rgba(255, 179, 0, 0.18)' : 'rgba(239, 83, 80, 0.22)'" />

            <!-- future zone — dims everything to the right of "today" so the eye stays
                 in the past where the actual data lives. -->
            <rect
              v-if="targetBurnup.todayX != null && targetBurnup.todayX < targetBurnup.innerRight"
              :x="targetBurnup.todayX"
              :y="targetBurnup.innerTop"
              :width="targetBurnup.innerRight - targetBurnup.todayX"
              :height="targetBurnup.innerBottom - targetBurnup.innerTop"
              fill="rgba(0, 0, 0, 0.35)"
            />

            <!-- ideal burn guideline (dotted) — from (start, baseline-closed) to (due, scope) -->
            <path
              v-if="targetBurnup.idealPath"
              :d="targetBurnup.idealPath"
              stroke="rgba(255, 255, 255, 0.5)" stroke-width="2.5" fill="none"
              stroke-dasharray="8 6"
            />

            <!-- scope line -->
            <path :d="targetBurnup.scopePath" stroke="#5c6bc0" stroke-width="3" fill="none" stroke-linejoin="round" />
            <!-- closed line -->
            <path :d="targetBurnup.closedPath" stroke="#66bb6a" stroke-width="3.5" fill="none" stroke-linejoin="round" />

            <!-- today / due markers -->
            <g v-if="targetBurnup.todayX != null">
              <line
                :x1="targetBurnup.todayX" :x2="targetBurnup.todayX"
                :y1="targetBurnup.innerTop" :y2="targetBurnup.innerBottom"
                stroke="#ffffff" stroke-width="2"
              />
              <rect
                :x="targetBurnup.todayX - 42" :y="targetBurnup.innerTop - 4"
                width="84" height="26" rx="5" ry="5"
                fill="rgba(255, 255, 255, 0.92)"
              />
              <text
                :x="targetBurnup.todayX" :y="targetBurnup.innerTop + 14"
                text-anchor="middle" font-size="16" font-weight="800"
                fill="#212121"
                letter-spacing="0.5"
              >TODAY</text>
            </g>
            <g v-if="targetBurnup.dueX != null">
              <line
                :x1="targetBurnup.dueX" :x2="targetBurnup.dueX"
                :y1="targetBurnup.innerTop" :y2="targetBurnup.innerBottom"
                stroke="#ef5350" stroke-width="2"
              />
              <rect
                :x="targetBurnup.dueX - 32" :y="targetBurnup.innerTop + 28"
                width="64" height="26" rx="5" ry="5"
                fill="#ef5350"
              />
              <text
                :x="targetBurnup.dueX" :y="targetBurnup.innerTop + 46"
                text-anchor="middle" font-size="16" font-weight="800"
                fill="#ffffff"
                letter-spacing="0.5"
              >DUE</text>
            </g>

            <!-- x axis ticks -->
            <text
              v-for="(t, i) in targetBurnup.ticks" :key="'xt' + i"
              :x="t.x" :y="targetBurnup.innerBottom + 28"
              text-anchor="middle" font-size="16" fill="rgba(200,200,200,0.85)"
              font-weight="600"
            >{{ t.label }}</text>
          </svg>
          <div class="k-burnup-legend">
            <span><i class="k-swatch" style="background: #5c6bc0;" />Scope — {{ fmtNum(targetBurnup.totalScope) }}</span>
            <span><i class="k-swatch" style="background: #66bb6a;" />Closed — {{ fmtNum(targetBurnup.totalClosed) }}</span>
            <span><i class="k-swatch" :style="{ background: targetBurnup.onTrack ? 'rgba(255, 179, 0, 0.6)' : 'rgba(239, 83, 80, 0.65)' }" />Remaining (risk zone)</span>
            <span v-if="targetBurnup.idealPath"><i class="k-swatch k-swatch-dotted" />Ideal burn</span>
            <span class="k-legend-spacer" />
            <span :class="targetBurnup.onTrack ? '' : 'k-burnup-warn'">
              {{ targetBurnup.onTrack ? 'Tracking ideal burn' : 'Behind ideal burn' }}
            </span>
          </div>
        </template>
      </section>

      <!-- Blockers: fire-alarm list (critical priority / severity / blocked) -->
      <section v-else-if="currentMode === 'blockers'" class="k-blockers">
        <div class="k-section-title k-blockers-title">
          <v-icon icon="mdi-alert-octagon" />
          Blockers · {{ blockers.total }}
          <span v-if="blockers.total > blockers.list.length" class="k-section-sub">showing top {{ blockers.list.length }}</span>
        </div>
        <div v-if="!blockers.list.length" class="k-empty">
          <v-icon icon="mdi-check-decagram-outline" size="48" />
          <div>No blockers — clear sailing.</div>
        </div>
        <ul v-else class="k-target-feed">
          <li
            v-for="(t, i) in blockers.list"
            :key="i"
            :class="{ 'k-clickable': !!t.url }"
            @click="openIssue(t.url)"
            :title="t.url ? 'Open in GitLab' : ''"
          >
            <span class="k-target-pri k-blockers-pri">{{ t.priority || 'BLOCKED' }}</span>
            <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
            <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
            <span class="k-feed-who" v-if="t.assignees && t.assignees.length">
              <span class="k-feed-avatar" :style="{ background: avatarColor(t.assignees[0]) }">{{ initialsOf(t.assignees[0]) }}</span>
              <span class="k-feed-who-name">{{ t.assignees[0] }}{{ t.assignees.length > 1 ? ` +${t.assignees.length - 1}` : '' }}</span>
            </span>
            <span class="k-feed-when k-blockers-age">{{ t.ageDays != null ? t.ageDays + 'd' : '' }}</span>
          </li>
        </ul>
      </section>

      <!-- Stale WIP: tickets stuck in "In progress" / "Doing" / "WIP" status -->
      <section v-else-if="currentMode === 'wipStale'" class="k-blockers">
        <div class="k-section-title k-wip-title">
          <v-icon icon="mdi-progress-alert" />
          Stale WIP · {{ wipStale.total }}
          <span class="k-section-sub">in progress · no update &gt; {{ wipStale.thresholdDays }}d</span>
        </div>
        <div v-if="!wipStale.list.length" class="k-empty">
          <v-icon icon="mdi-fire" size="48" />
          <div>No stale WIP — everything in progress has recent activity.</div>
        </div>
        <ul v-else class="k-target-feed">
          <li
            v-for="(t, i) in wipStale.list"
            :key="i"
            :class="{ 'k-clickable': !!t.url }"
            @click="openIssue(t.url)"
            :title="t.url ? 'Open in GitLab' : ''"
          >
            <span class="k-target-pri k-wip-pri">{{ t.status }}</span>
            <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
            <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
            <span class="k-feed-who" v-if="t.assignees && t.assignees.length">
              <span class="k-feed-avatar" :style="{ background: avatarColor(t.assignees[0]) }">{{ initialsOf(t.assignees[0]) }}</span>
              <span class="k-feed-who-name">{{ t.assignees[0] }}{{ t.assignees.length > 1 ? ` +${t.assignees.length - 1}` : '' }}</span>
            </span>
            <span class="k-feed-when k-wip-idle">idle {{ t.idleDays }}d</span>
          </li>
        </ul>
      </section>

      <!-- Today's pulse -->
      <section v-else-if="currentMode === 'today'" class="k-today">
        <div class="k-stat k-stat-pos k-stat-click" @click="filterCreatedToday" title="Filter graph to issues created today">
          <v-icon icon="mdi-plus-circle" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(today.opened) }}</div>
          <div class="k-stat-lbl">Opened today</div>
        </div>
        <div class="k-stat k-stat-neg">
          <v-icon icon="mdi-check-circle" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(today.closed) }}</div>
          <div class="k-stat-lbl">Closed today</div>
        </div>
        <div class="k-stat" :class="today.net > 0 ? 'k-stat-warn' : 'k-stat-pos'">
          <v-icon :icon="today.net > 0 ? 'mdi-trending-up' : (today.net < 0 ? 'mdi-trending-down' : 'mdi-trending-neutral')" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ today.net >= 0 ? '+' : '' }}{{ fmtNum(today.net) }}</div>
          <div class="k-stat-lbl">Net change</div>
        </div>
        <div class="k-stat k-stat-click" @click="filterUpdatedToday" title="Filter graph to issues updated today">
          <v-icon icon="mdi-pencil-circle" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(today.updated) }}</div>
          <div class="k-stat-lbl">Updated today</div>
        </div>
        <div class="k-stat k-stat-click" @click="filterOpen" title="Open the graph with default filters">
          <v-icon icon="mdi-circle-outline" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(totals.open) }}</div>
          <div class="k-stat-lbl">Open total</div>
        </div>
        <div class="k-stat">
          <v-icon icon="mdi-check-all" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(totals.closed) }}</div>
          <div class="k-stat-lbl">Closed total</div>
        </div>
      </section>

      <!-- Velocity (N-day created vs closed) -->
      <section v-else-if="currentMode === 'velocity'" class="k-velocity">
        <div class="k-section-title">Last {{ velocity.buckets.length }} days · created vs closed</div>
        <div class="k-velocity-chart" :style="{ gridTemplateColumns: `repeat(${velocity.buckets.length}, 1fr)` }">
          <div
            v-for="(b, i) in velocity.buckets"
            :key="b.iso"
            class="k-vel-col k-clickable"
            :class="{ 'k-vel-today': i === velocity.buckets.length - 1 }"
            @click="filterByDay(b.iso)"
            :title="`Filter graph to ${b.label} (${b.iso})`"
          >
            <div class="k-vel-bars" :style="{ height: velocity.barAreaPx + 'px' }">
              <div class="k-vel-bar k-vel-created" :style="{ height: (b.created / velocity.max * 100) + '%' }" :title="`${b.created} created`">
                <span v-if="b.created" class="k-vel-num">{{ b.created }}</span>
              </div>
              <div class="k-vel-bar k-vel-closed" :style="{ height: (b.closed / velocity.max * 100) + '%' }" :title="`${b.closed} closed`">
                <span v-if="b.closed" class="k-vel-num">{{ b.closed }}</span>
              </div>
            </div>
            <div class="k-vel-lbl">{{ b.label }}</div>
          </div>
        </div>
        <div class="k-legend">
          <span><i class="k-swatch k-vel-created" /> Created</span>
          <span><i class="k-swatch k-vel-closed" /> Closed</span>
          <span class="k-legend-spacer" />
          <span>Σ created {{ fmtNum(velocity.totalCreated) }} · Σ closed {{ fmtNum(velocity.totalClosed) }}</span>
        </div>
      </section>

      <!-- Workload by assignee (stacked by priority bucket) -->
      <section v-else-if="currentMode === 'workload'" class="k-workload">
        <div class="k-section-title">
          Active workload by assignee · top {{ workload.length }}
          <span class="k-section-sub">{{ workloadSubtitle }} · stacked by priority</span>
        </div>
        <div v-if="!workload.length" class="k-empty">No active tickets in scope.</div>
        <div v-else class="k-bar-list">
          <div v-for="row in workload" :key="row.name" class="k-bar-row k-clickable" @click="filterByAssignee(row.name)" :title="`Filter graph by ${row.name}`">
            <div class="k-bar-name k-bar-name-with-avatar" :title="row.name">
              <span class="k-feed-avatar" :style="{ background: avatarColor(row.name) }">{{ initialsOf(row.name) }}</span>
              <span class="k-bar-name-text">{{ row.name }}</span>
            </div>
            <div class="k-bar-track k-bar-track-stacked" :style="{ width: (row.total / workloadMax * 100) + '%' }">
              <template v-for="b in PRIORITY_BUCKETS" :key="b">
                <div
                  v-if="row[b]"
                  class="k-bar-seg"
                  :style="{ flexGrow: row[b], background: PRIORITY_BUCKET_COLOR[b] }"
                  :title="`${row[b]} ${PRIORITY_BUCKET_LABEL[b]}`"
                />
              </template>
            </div>
            <div class="k-bar-count">{{ fmtNum(row.total) }}</div>
          </div>
        </div>
        <div v-if="workloadActiveBuckets.length" class="k-legend k-workload-legend">
          <span v-for="b in workloadActiveBuckets" :key="b">
            <i class="k-swatch" :style="{ background: PRIORITY_BUCKET_COLOR[b] }" />
            {{ PRIORITY_BUCKET_LABEL[b] }}
          </span>
        </div>
      </section>

      <!-- Priority overview -->
      <section v-else-if="currentMode === 'priority'" class="k-priority">
        <div class="k-section-title">
          Open by priority
          <span class="k-section-sub">{{ activeFilterSubtitle }}</span>
        </div>
        <div v-if="!priorityData.length" class="k-empty">No priorities found on active tickets.</div>
        <div v-else class="k-bar-list">
          <div
            v-for="row in priorityData"
            :key="row.label"
            class="k-bar-row"
            :class="{ 'k-clickable': !/^\(/.test(row.label) }"
            @click="filterByPriority(row.label)"
            :title="`Filter graph by Priority::${row.label}`"
          >
            <div class="k-bar-name">{{ row.label }}</div>
            <div class="k-bar-track">
              <div class="k-bar-fill" :style="{ width: (row.count / priorityMax * 100) + '%', background: row.color }" />
            </div>
            <div class="k-bar-count">{{ fmtNum(row.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(row.count, priorityTotal) }}%</div>
            <div class="k-bar-side">oldest {{ row.oldestDays }}d</div>
          </div>
        </div>
      </section>

      <!-- Status breakdown (with avg-idle column to surface review/queue bottlenecks) -->
      <section v-else-if="currentMode === 'status'" class="k-priority">
        <div class="k-section-title">
          Open by status
          <span class="k-section-sub">{{ activeFilterSubtitle }} · avg idle = days since last update</span>
        </div>
        <div v-if="!statusData.length" class="k-empty">No statuses set on active tickets.</div>
        <div v-else class="k-bar-list">
          <div v-for="row in statusData" :key="row.label" class="k-bar-row">
            <div class="k-bar-name">{{ row.label }}</div>
            <div class="k-bar-track"><div class="k-bar-fill" :style="{ width: (row.count / statusMax * 100) + '%' }" /></div>
            <div class="k-bar-count">{{ fmtNum(row.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(row.count, statusTotal) }}%</div>
            <div class="k-bar-side" :class="row.avgIdleDays > 14 ? 'k-bar-side-warn' : ''">avg idle {{ row.avgIdleDays }}d</div>
          </div>
        </div>
      </section>

      <!-- Type breakdown -->
      <section v-else-if="currentMode === 'type'" class="k-priority">
        <div class="k-section-title">
          Open by Type
          <span class="k-section-sub">{{ activeFilterSubtitle }}</span>
        </div>
        <div v-if="!typeData.length" class="k-empty">No Type:: labels on active tickets.</div>
        <div v-else class="k-bar-list">
          <div v-for="row in typeData" :key="row.label" class="k-bar-row">
            <div class="k-bar-name">{{ row.label }}</div>
            <div class="k-bar-track"><div class="k-bar-fill" :style="{ width: (row.count / typeMax * 100) + '%' }" /></div>
            <div class="k-bar-count">{{ fmtNum(row.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(row.count, typeTotal) }}%</div>
          </div>
        </div>
      </section>

      <!-- Hot labels (recent activity window) -->
      <section v-else-if="currentMode === 'hotLabels'" class="k-priority">
        <div class="k-section-title">
          Hot labels · last {{ hotLabels.hours }}h
          <span class="k-section-sub">{{ hotLabels.activeTickets }} active ticket{{ hotLabels.activeTickets === 1 ? '' : 's' }}</span>
        </div>
        <div v-if="!hotLabels.list.length" class="k-empty">No active labels in this window.</div>
        <div v-else class="k-bar-list">
          <div
            v-for="row in hotLabels.list" :key="row.label"
            class="k-bar-row k-clickable"
            @click="filterByLabel(row.label)"
            :title="`Filter graph by label: ${row.label}`"
          >
            <div class="k-bar-name" :title="row.label">{{ row.label }}</div>
            <div class="k-bar-track"><div class="k-bar-fill" :style="{ width: (row.count / hotLabelsMax * 100) + '%' }" /></div>
            <div class="k-bar-count">{{ fmtNum(row.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(row.count, hotLabels.activeTickets) }}%</div>
          </div>
        </div>
      </section>

      <!-- Milestone progress -->
      <section v-else-if="currentMode === 'milestones'" class="k-priority">
        <div class="k-section-title">Milestone progress · active milestones</div>
        <div v-if="!milestonesData.length" class="k-empty">No active milestones with tickets.</div>
        <div v-else class="k-bar-list">
          <div v-for="m in milestonesData" :key="m.title" class="k-bar-row" :class="{ 'k-bar-pinned': m.isTarget }">
            <div class="k-bar-name" :title="m.title">
              <v-icon v-if="m.isTarget" icon="mdi-flag" size="x-small" class="mr-1" />{{ m.title }}
            </div>
            <div class="k-bar-track">
              <div class="k-bar-fill" :style="{ width: m.pct + '%', background: m.pct >= 80 ? '#43a047' : (m.pct >= 50 ? '#fbc02d' : '#1e88e5') }" />
            </div>
            <div class="k-bar-count">{{ m.pct }}%</div>
            <div class="k-bar-side">{{ fmtNum(m.closed) }}/{{ fmtNum(m.total) }}{{ m.due ? ' · due ' + m.due : '' }}</div>
          </div>
        </div>
      </section>

      <!-- Aging buckets (open · honors backlog filter · NOT stale-filtered) -->
      <section v-else-if="currentMode === 'aging'" class="k-priority">
        <div class="k-section-title">
          Open tickets by age
          <span class="k-section-sub">{{ openFilterSubtitle }}</span>
        </div>
        <div class="k-bar-list">
          <div v-for="b in agingData" :key="b.id" class="k-bar-row">
            <div class="k-bar-name">{{ b.label }}</div>
            <div class="k-bar-track"><div class="k-bar-fill" :style="{ width: (b.count / agingMax * 100) + '%', background: b.color }" /></div>
            <div class="k-bar-count">{{ fmtNum(b.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(b.count, agingTotal) }}%</div>
          </div>
        </div>
      </section>

      <!-- Recent activity feed -->
      <section v-else-if="currentMode === 'activity'" class="k-activity">
        <div class="k-section-title">Recent activity</div>
        <div v-if="!activityFeed.length" class="k-empty">No activity yet.</div>
        <ul v-else class="k-feed">
          <li
            v-for="(e, i) in activityFeed"
            :key="i"
            :class="[`k-feed-${e.kind}`, { 'k-clickable': !!e.url }]"
            @click="openIssue(e.url)"
            :title="e.url ? 'Open issue in GitLab' : ''"
          >
            <v-icon class="k-feed-icon" :icon="FEED_ICON[e.kind]" size="small" />
            <span class="k-feed-tag">{{ FEED_LABEL[e.kind] }}</span>
            <span class="k-feed-iid">{{ e.iid ? '#' + e.iid : '' }}</span>
            <span class="k-feed-title" :title="e.title">{{ e.title }}</span>
            <span class="k-feed-notes" :title="e.notes ? `${e.notes} comment${e.notes === 1 ? '' : 's'}` : ''">
              <template v-if="e.notes">
                <v-icon icon="mdi-comment-outline" size="x-small" />{{ e.notes }}
              </template>
            </span>
            <span class="k-feed-who" :title="e.who || ''">
              <template v-if="e.who">
                <span class="k-feed-avatar" :style="{ background: avatarColor(e.who) }">{{ initialsOf(e.who) }}</span>
                <span class="k-feed-who-name">{{ e.who }}</span>
              </template>
            </span>
            <span class="k-feed-when">{{ relTime(e.ts) }}</span>
          </li>
        </ul>
      </section>

      <!-- Recently closed: celebration view -->
      <section v-else-if="currentMode === 'closed'" class="k-closed">
        <div class="k-section-title k-closed-title">
          <v-icon icon="mdi-party-popper" />
          Closed in last {{ closedRecently.hours }}h · {{ closedRecently.total }}
        </div>
        <div v-if="!closedRecently.list.length" class="k-empty">
          <v-icon icon="mdi-clock-time-three-outline" size="48" />
          <div>No closures in the last {{ closedRecently.hours }}h yet.</div>
        </div>
        <ul v-else class="k-feed">
          <li
            v-for="(e, i) in closedRecently.list"
            :key="i"
            class="k-feed-closed-cel"
            :class="{ 'k-clickable': !!e.url }"
            @click="openIssue(e.url)"
            :title="e.url ? 'Open in GitLab' : ''"
          >
            <v-icon class="k-feed-icon" icon="mdi-check-circle" size="small" />
            <span class="k-feed-tag">CLOSED</span>
            <span class="k-feed-iid">{{ e.iid ? '#' + e.iid : '' }}</span>
            <span class="k-feed-title" :title="e.title">{{ e.title }}</span>
            <span class="k-feed-notes" />
            <span class="k-feed-who" :title="e.who || ''">
              <template v-if="e.who">
                <span class="k-feed-avatar" :style="{ background: avatarColor(e.who) }">{{ initialsOf(e.who) }}</span>
                <span class="k-feed-who-name">{{ e.who }}</span>
              </template>
            </span>
            <span class="k-feed-when">{{ relTime(e.ts) }}</span>
          </li>
        </ul>
      </section>

      <!-- Risks: overdue / stale / unassigned -->
      <section v-else-if="currentMode === 'risks'" class="k-risks">
        <div class="k-risks-grid">
          <div class="k-risks-card">
            <div class="k-section-title">Overdue · {{ risks.overdue.length }}</div>
            <ul v-if="risks.overdue.length" class="k-list">
              <li v-for="(r, i) in risks.overdue" :key="i" :class="{ 'k-clickable': !!r.url }" @click="openIssue(r.url)" title="Open issue in GitLab">
                <span class="k-list-title" :title="r.title">{{ r.title }}</span>
                <span class="k-list-side k-list-bad">{{ r.ageDays }}d overdue</span>
              </li>
            </ul>
            <div v-else class="k-empty">Nothing overdue.</div>
          </div>
          <div class="k-risks-card">
            <div class="k-section-title">Stale (no update &gt; {{ risks.staleThreshold }}d) · {{ risks.stale.length }}</div>
            <ul v-if="risks.stale.length" class="k-list">
              <li v-for="(r, i) in risks.stale" :key="i" :class="{ 'k-clickable': !!r.url }" @click="openIssue(r.url)" title="Open issue in GitLab">
                <span class="k-list-title" :title="r.title">{{ r.title }}</span>
                <span class="k-list-side">{{ r.ageDays }}d</span>
              </li>
            </ul>
            <div v-else class="k-empty">Nothing stale.</div>
          </div>
          <div class="k-risks-card k-risks-stats">
            <div class="k-stat k-stat-click" @click="filterUnassigned" title="Filter graph to unassigned open tickets">
              <v-icon icon="mdi-account-off-outline" size="28" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(risks.unassigned) }}</div>
              <div class="k-stat-lbl">Unassigned · open</div>
            </div>
            <div class="k-stat k-stat-click" @click="filterNoDueDate" title="Filter graph to open tickets with no due date">
              <v-icon icon="mdi-calendar-question" size="28" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(risks.noDueDate) }}</div>
              <div class="k-stat-lbl">No due date · open</div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="kiosk-foot">
      <span
        v-for="m in activeModes"
        :key="m.id"
        class="kiosk-dot"
        :class="{ active: m.id === currentMode }"
        @click="setMode(m.id)"
        :title="m.label"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useSettingsStore } from '../composables/useSettingsStore'
import { HOTKEY_ACTIONS, getEventCombo } from '../composables/useHotkeys'
import { getAssigneeNames } from '../utils/issueFields'
import { getScopedLabelValue, isScopedLabel } from '../utils/scopedLabels'
import { currentStatusOfRaw } from '../composables/useGraphDerivedState'

const props = defineProps({
  nodes: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  lastUpdated: { type: Number, default: null }, // ms epoch
  onRefresh: { type: Function, default: null },
  mode: { type: String, default: '' },         // current mode id (driven by URL via parent)
  viewParam: { type: String, default: '' }     // 'paused=1/cycle=10/refresh=2'
})
const emit = defineEmits(['close', 'update:mode', 'update:viewParam', 'apply-filter', 'open-config'])

const { settings } = useSettingsStore()
const root = ref(null)

const ALL_MODES = [
  { id: 'target',     label: 'Target milestone' },
  { id: 'burnup',     label: 'Milestone burnup' },
  { id: 'blockers',   label: 'Blockers' },
  { id: 'wipStale',   label: 'Stale WIP' },
  { id: 'today',      label: "Today's pulse" },
  { id: 'velocity',   label: 'Velocity' },
  { id: 'workload',   label: 'Workload by assignee' },
  { id: 'priority',   label: 'Priority overview' },
  { id: 'status',     label: 'Status breakdown' },
  { id: 'type',       label: 'Type breakdown' },
  { id: 'hotLabels',  label: 'Hot labels' },
  { id: 'milestones', label: 'Milestone progress' },
  { id: 'aging',      label: 'Aging buckets' },
  { id: 'activity',   label: 'Recent activity' },
  { id: 'closed',     label: 'Recently closed' },
  { id: 'risks',      label: 'Overdue, stale & unassigned' }
]

const activeModes = computed(() => {
  const enabled = settings.uiState.kiosk?.modes || {}
  const list = ALL_MODES.filter(m => enabled[m.id] !== false)
  return list.length ? list : ALL_MODES
})

// Parse `key=value/key=value` from props.viewParam.
const argParams = computed(() => {
  const out = {}
  const v = String(props.viewParam || '')
  if (!v) return out
  for (const seg of v.split('/')) {
    const eq = seg.indexOf('=')
    if (eq <= 0) continue
    out[seg.slice(0, eq)] = seg.slice(eq + 1)
  }
  return out
})

const currentMode = computed({
  get: () => {
    const m = props.mode
    if (m && activeModes.value.find(x => x.id === m)) return m
    return activeModes.value[0]?.id || 'today'
  },
  set: (v) => emit('update:mode', v)
})
const currentModeLabel = computed(() => ALL_MODES.find(m => m.id === currentMode.value)?.label || currentMode.value)
const paused = ref(argParams.value.paused === '1')

// Sync `paused` (and other in-session URL args) back into the URL so the kiosk URL is
// always shareable / reproducible — `#/kiosk/today/paused=1/cycle=5/refresh=2`.
const writeArgs = (patch) => {
  const params = { ...argParams.value, ...patch }
  for (const k of Object.keys(params)) if (params[k] == null || params[k] === '') delete params[k]
  emit('update:viewParam', Object.entries(params).map(([k, v]) => `${k}=${v}`).join('/'))
}
watch(paused, (p) => writeArgs({ paused: p ? '1' : '' }))
// React to external URL changes (back / forward / pasted link).
watch(argParams, (a) => { const want = a.paused === '1'; if (paused.value !== want) paused.value = want })

const setMode = (id) => { currentMode.value = id }
const indexOfCurrent = () => activeModes.value.findIndex(m => m.id === currentMode.value)
const nextMode = () => {
  const list = activeModes.value
  if (!list.length) return
  const i = indexOfCurrent()
  currentMode.value = list[(i + 1 + list.length) % list.length].id
}
const prevMode = () => {
  const list = activeModes.value
  if (!list.length) return
  const i = indexOfCurrent()
  currentMode.value = list[(i - 1 + list.length) % list.length].id
}

// Keep currentMode valid if user disables it in settings.
watch(activeModes, (list) => {
  if (!list.find(m => m.id === currentMode.value)) currentMode.value = list[0]?.id || 'today'
})

// Effective timings: URL args override persisted settings so a shared link can pin
// `?cycle=10&refresh=2` without mutating the user's defaults.
const numFromUrl = (k) => { const n = Number(argParams.value[k]); return Number.isFinite(n) && n >= 0 ? n : null }
const cycleSec   = computed(() => numFromUrl('cycle')   ?? Math.max(0, Number(settings.uiState.kiosk?.cycleSeconds)   || 0))
const refreshMin = computed(() => numFromUrl('refresh') ?? Math.max(0, Number(settings.uiState.kiosk?.refreshMinutes) || 0))

let cycleTimer = null
let refreshTimer = null
const startCycle = () => {
  if (cycleTimer) clearInterval(cycleTimer)
  if (!cycleSec.value) return
  cycleTimer = setInterval(() => { if (!paused.value) nextMode() }, cycleSec.value * 1000)
}
const startRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (!refreshMin.value) return
  nextRefreshAt.value = Date.now() + refreshMin.value * 60 * 1000
  refreshTimer = setInterval(() => {
    nextRefreshAt.value = Date.now() + refreshMin.value * 60 * 1000
    if (typeof props.onRefresh === 'function' && !props.loading) props.onRefresh()
  }, refreshMin.value * 60 * 1000)
}
watch(cycleSec, startCycle)
watch(refreshMin, startRefresh)

// Clock & refresh countdown — tick every second.
const nowTick = ref(Date.now())
const nextRefreshAt = ref(null)
let nowTickTimer = null

const clock = computed(() => new Date(nowTick.value).toLocaleString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZoneName: 'short'
}))
const refreshLabel = computed(() => {
  if (!refreshMin.value) return 'auto-refresh off'
  if (props.loading) return 'refreshing…'
  if (!nextRefreshAt.value) return `${refreshMin.value}m`
  const ms = Math.max(0, nextRefreshAt.value - nowTick.value)
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
})
const lastRefreshTitle = computed(() => {
  if (!props.lastUpdated) return 'Never refreshed'
  return `Last refreshed: ${new Date(props.lastUpdated).toLocaleString()}`
})

const onManualRefresh = () => {
  if (props.loading || typeof props.onRefresh !== 'function') return
  props.onRefresh()
  // Reset the auto-refresh countdown so the next tick fires N minutes from this click.
  if (refreshMin.value) nextRefreshAt.value = Date.now() + refreshMin.value * 60 * 1000
}

const toggleKioskCombo = computed(() => {
  const def = HOTKEY_ACTIONS.find(a => a.id === 'toggleKiosk')?.default || ''
  return (settings.uiState.hotkeys?.toggleKiosk ?? def).toLowerCase()
})
const handleWindowKey = (e) => {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'Escape')         { e.preventDefault(); emit('close'); return }
  if (e.key === 'ArrowRight')     { e.preventDefault(); nextMode(); return }
  if (e.key === 'ArrowLeft')      { e.preventDefault(); prevMode(); return }
  if (e.key === ' ')              { e.preventDefault(); paused.value = !paused.value; return }
  if (toggleKioskCombo.value && getEventCombo(e) === toggleKioskCombo.value) {
    e.preventDefault(); emit('close')
  }
}

// Track the burnup SVG's actual pixel size — keeps viewBox 1:1 with screen so text
// and strokes never get squished. Observer is rebuilt when burnup becomes the current
// mode (the ref doesn't exist on other modes).
let burnupRO = null
const watchBurnupSvg = () => {
  if (burnupRO) { burnupRO.disconnect(); burnupRO = null }
  const el = burnupSvgRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  const update = () => {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) burnupSize.value = { w: Math.round(r.width), h: Math.round(r.height) }
  }
  update()
  burnupRO = new ResizeObserver(update)
  burnupRO.observe(el)
}
watch(() => [currentMode.value, burnupSvgRef.value], () => nextTick(watchBurnupSvg))

onMounted(() => {
  startCycle()
  startRefresh()
  nowTickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
  window.addEventListener('keydown', handleWindowKey)
  if (root.value && typeof root.value.focus === 'function') root.value.focus()
  nextTick(watchBurnupSvg)
})
onUnmounted(() => {
  if (cycleTimer) clearInterval(cycleTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (nowTickTimer) clearInterval(nowTickTimer)
  window.removeEventListener('keydown', handleWindowKey)
  if (burnupRO) { burnupRO.disconnect(); burnupRO = null }
})

// Priority buckets — declared up here because the global `priorityFilter` setting
// classifies every ticket into one of them before any mode-specific computation.
const priorityBucket = (label) => {
  const k = String(label || '').toLowerCase()
  if (!k) return 'none'
  if (/blocking|critical/.test(k)) return 'blocking'
  if (/high/.test(k)) return 'high'
  if (/medium|normal/.test(k)) return 'medium'
  if (/low/.test(k)) return 'low'
  return 'other'
}
const PRIORITY_BUCKETS = ['blocking', 'high', 'medium', 'low', 'other', 'none']
const PRIORITY_BUCKET_COLOR = {
  blocking: '#d32f2f', high: '#f57c00', medium: '#fbc02d',
  low: '#7cb342', other: '#1e88e5', none: 'rgba(127,127,127,0.45)'
}
const PRIORITY_BUCKET_LABEL = {
  blocking: 'Blocking', high: 'High', medium: 'Medium',
  low: 'Low', other: 'Other', none: 'No priority'
}

// --- Data helpers ---
const safeDate = (iso) => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const isOpen = (n) => String(n?._raw?.state || '').toLowerCase() !== 'closed'
const isBacklog = (raw) => /backlog/i.test(currentStatusOfRaw(raw) || '')

// Display helpers
const NUM_FMT = new Intl.NumberFormat()
const fmtNum = (n) => NUM_FMT.format(Number(n) || 0)
const pctOf = (n, total) => total > 0 ? Math.round((n / total) * 100) : 0

// Global kiosk filters — applied at the `allItems` layer so every mode (target focus,
// burnup, milestones progress, today's pulse, every count list, every feed) reflects
// the same scope. "Stale" and "exclude backlog" only affect OPEN tickets — closed ones
// are historical events that shouldn't disappear based on current staleness.
const priorityFilter = computed(() => {
  const v = settings.uiState.kiosk?.priorityFilter
  return Array.isArray(v) ? v : []
})
const staleDays      = computed(() => Math.max(0, Number(settings.uiState.kiosk?.staleDays) || 0))
const excludeBacklog = computed(() => settings.uiState.kiosk?.excludeBacklog !== false)

const allItems = computed(() => {
  let list = Object.values(props.nodes || {})
  // All three "active work" filters apply to OPEN tickets only. Closed tickets are
  // historical events — we don't want them to vanish from velocity / today / activity
  // just because they were closed before a priority label was applied or got tagged as
  // Backlog after the fact.
  if (priorityFilter.value.length) {
    const allowed = new Set(priorityFilter.value)
    list = list.filter(n => {
      if (!isOpen(n)) return true
      return allowed.has(priorityBucket(getScopedLabelValue(n?._raw?.labels || [], 'Priority')))
    })
  }
  if (excludeBacklog.value) {
    list = list.filter(n => !isOpen(n) || !isBacklog(n?._raw || {}))
  }
  if (staleDays.value > 0) {
    const cutoff = Date.now() - staleDays.value * 24 * 60 * 60 * 1000
    list = list.filter(n => {
      if (!isOpen(n)) return true
      const upd = safeDate(n?._raw?.updated_at) || safeDate(n?._raw?.created_at) || 0
      return upd >= cutoff
    })
  }
  return list
})
const items = computed(() => {
  const t = String(settings.uiState.kiosk?.targetMilestone || '').trim()
  if (!t) return allItems.value
  return allItems.value.filter(n => n?._raw?.milestone?.title === t)
})

const totals = computed(() => {
  let open = 0, closed = 0
  for (const n of items.value) {
    if (isOpen(n)) open++; else closed++
  }
  return { open, closed }
})

const today = computed(() => {
  const start = startOfToday()
  let opened = 0, closed = 0, updated = 0
  for (const n of items.value) {
    const raw = n._raw || {}
    if ((safeDate(raw.created_at) || 0) >= start) opened++
    if ((safeDate(raw.closed_at) || 0) >= start) closed++
    if ((safeDate(raw.updated_at) || 0) >= start) updated++
  }
  return { opened, closed, updated, net: opened - closed }
})

const velocityCfg = computed(() => settings.uiState.kiosk?.modeConfig?.velocity || {})
const velocity = computed(() => {
  const days = Math.min(31, Math.max(1, Number(velocityCfg.value.days) || 7))
  const dayMs = 24 * 60 * 60 * 1000
  const today0 = startOfToday()
  const firstDay = today0 - (days - 1) * dayMs
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)
  const labelFor = (i, ms) => {
    if (i === days - 1) return 'Today'
    return days <= 8
      ? new Date(ms).toLocaleDateString(undefined, { weekday: 'short' })
      : new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  const buckets = Array.from({ length: days }, (_, i) => ({
    label: labelFor(i, firstDay + i * dayMs),
    iso: isoDay(firstDay + i * dayMs),
    created: 0,
    closed: 0
  }))
  for (const n of items.value) {
    const raw = n._raw || {}
    const c = safeDate(raw.created_at); if (c) {
      const day = Math.floor((c - firstDay) / dayMs)
      if (day >= 0 && day < days) buckets[day].created++
    }
    const cl = safeDate(raw.closed_at); if (cl) {
      const day = Math.floor((cl - firstDay) / dayMs)
      if (day >= 0 && day < days) buckets[day].closed++
    }
  }
  const max = Math.max(1, ...buckets.flatMap(b => [b.created, b.closed]))
  return {
    buckets,
    max,
    barAreaPx: 220,
    totalCreated: buckets.reduce((s, b) => s + b.created, 0),
    totalClosed: buckets.reduce((s, b) => s + b.closed, 0)
  }
})

// Both helpers reduce to "items filtered by isOpen" — the heavy filtering (priority /
// backlog / stale) is already done at the `allItems` layer. Kept as named aliases so
// the consuming computeds read like English ("active workload" vs "open list").
const openItems = computed(() => items.value.filter(isOpen))
const activeOpenItems = openItems

const filterTags = (withStale) => {
  const parts = []
  if (excludeBacklog.value) parts.push('non-backlog')
  if (withStale && staleDays.value > 0) parts.push(`idle ≤ ${staleDays.value}d`)
  return parts.length ? 'open · ' + parts.join(' · ') : 'open'
}
const activeFilterSubtitle = computed(() => filterTags(true))
const openFilterSubtitle   = computed(() => filterTags(false))

const workloadCfg = computed(() => settings.uiState.kiosk?.modeConfig?.workload || {})
const workload = computed(() => {
  const topN = Math.max(1, Number(workloadCfg.value.topN) || 12)
  const stacks = new Map()
  const bumpFor = (name, bucket) => {
    let s = stacks.get(name)
    if (!s) { s = { name, total: 0 }; for (const b of PRIORITY_BUCKETS) s[b] = 0; stacks.set(name, s) }
    s.total++
    s[bucket]++
  }
  for (const n of activeOpenItems.value) {
    const raw = n._raw || {}
    const bucket = priorityBucket(getScopedLabelValue(raw.labels, 'Priority'))
    const names = getAssigneeNames(raw)
    if (!names.length) bumpFor('(Unassigned)', bucket)
    else for (const name of names) bumpFor(name, bucket)
  }
  return [...stacks.values()].sort((a, b) => b.total - a.total).slice(0, topN)
})
const workloadMax = computed(() => Math.max(1, ...workload.value.map(r => r.total)))
// Buckets actually present (non-zero) across the visible rows — used to build the legend.
const workloadActiveBuckets = computed(() => {
  const present = new Set()
  for (const row of workload.value) for (const b of PRIORITY_BUCKETS) if (row[b]) present.add(b)
  return PRIORITY_BUCKETS.filter(b => present.has(b))
})
const workloadSubtitle = computed(() => activeFilterSubtitle.value)

const PRIORITY_COLOR = {
  blocking: '#d32f2f', critical: '#d32f2f', high: '#f57c00',
  medium: '#fbc02d', normal: '#fbc02d', low: '#7cb342', lowest: '#9e9e9e'
}
const priorityCfg = computed(() => settings.uiState.kiosk?.modeConfig?.priority || {})
const priorityData = computed(() => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const groups = new Map()
  const showNone = priorityCfg.value.showNoPriority !== false
  for (const n of activeOpenItems.value) {
    const raw = n._raw || {}
    const p = getScopedLabelValue(raw.labels, 'Priority') || '(No priority)'
    if (!showNone && p === '(No priority)') continue
    if (!groups.has(p)) groups.set(p, { label: p, count: 0, oldestDays: 0 })
    const g = groups.get(p)
    g.count++
    const c = safeDate(raw.created_at)
    if (c) g.oldestDays = Math.max(g.oldestDays, Math.floor((now - c) / day))
  }
  const order = ['blocking', 'critical', 'high', 'medium', 'normal', 'low', 'lowest']
  const rank = (label) => {
    const k = String(label).toLowerCase()
    for (let i = 0; i < order.length; i++) if (k.includes(order[i])) return i
    return order.length + 1
  }
  return [...groups.values()]
    .map(g => ({ ...g, color: PRIORITY_COLOR[String(g.label).toLowerCase().replace(/^.*?(blocking|critical|high|medium|normal|low|lowest).*$/, '$1')] || '#1e88e5' }))
    .sort((a, b) => (rank(a.label) - rank(b.label)) || (b.count - a.count))
})
const priorityMax = computed(() => Math.max(1, ...priorityData.value.map(r => r.count)))
const priorityTotal = computed(() => priorityData.value.reduce((s, r) => s + r.count, 0))

// Status breakdown (open · stale-filtered) with per-status average idle days.
// Average idle = avg (now − updated_at), surfaces bottlenecks like "Ready for Review"
// piling up at 5+ days idle on average.
const statusCfg = computed(() => settings.uiState.kiosk?.modeConfig?.status || {})
const statusData = computed(() => {
  const showNone = !!statusCfg.value.showNoStatus
  const groups = new Map()
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  for (const n of activeOpenItems.value) {
    const raw = n._raw || {}
    const s = currentStatusOfRaw(raw) || '(No status)'
    if (!showNone && s === '(No status)') continue
    if (!groups.has(s)) groups.set(s, { label: s, count: 0, idleSum: 0 })
    const g = groups.get(s)
    g.count++
    const upd = safeDate(raw.updated_at) || safeDate(raw.created_at) || 0
    if (upd) g.idleSum += (now - upd) / day
  }
  return [...groups.values()]
    .map(g => ({ label: g.label, count: g.count, avgIdleDays: g.count ? Math.round(g.idleSum / g.count) : 0 }))
    .sort((a, b) => b.count - a.count)
})
const statusMax = computed(() => Math.max(1, ...statusData.value.map(r => r.count)))
const statusTotal = computed(() => statusData.value.reduce((s, r) => s + r.count, 0))

// Type:: scoped label breakdown (open · stale-filtered)
const typeCfg = computed(() => settings.uiState.kiosk?.modeConfig?.type || {})
const typeData = computed(() => {
  const showNone = !!typeCfg.value.showNoType
  const counts = new Map()
  for (const n of activeOpenItems.value) {
    const raw = n._raw || {}
    const t = getScopedLabelValue(raw.labels, 'Type') || '(No type)'
    if (!showNone && t === '(No type)') continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))
})
const typeMax = computed(() => Math.max(1, ...typeData.value.map(r => r.count)))
const typeTotal = computed(() => typeData.value.reduce((s, r) => s + r.count, 0))

// Aging buckets (open · NOT stale-filtered — the point is to show old work)
const AGE_BUCKETS = [
  { id: 'd1',  label: '< 1 day',     maxDays: 1,         color: '#43a047' },
  { id: 'd7',  label: '1–7 days',    maxDays: 7,         color: '#7cb342' },
  { id: 'w4',  label: '1–4 weeks',   maxDays: 28,        color: '#fbc02d' },
  { id: 'm3',  label: '1–3 months',  maxDays: 90,        color: '#fb8c00' },
  { id: 'm12', label: '3–12 months', maxDays: 365,       color: '#e53935' },
  { id: 'y1',  label: '> 1 year',    maxDays: Infinity,  color: '#8e24aa' }
]
const agingData = computed(() => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const buckets = AGE_BUCKETS.map(b => ({ ...b, count: 0 }))
  for (const n of openItems.value) {
    const c = safeDate(n._raw?.created_at)
    if (!c) continue
    const age = (now - c) / day
    for (const b of buckets) {
      if (age < b.maxDays) { b.count++; break }
    }
  }
  return buckets
})
const agingMax = computed(() => Math.max(1, ...agingData.value.map(b => b.count)))
const agingTotal = computed(() => agingData.value.reduce((s, b) => s + b.count, 0))

// "Hot labels" — labels appearing on tickets with activity in the last N hours.
// Excludes scoped labels (Priority::, Type::, …) by default since they have their own modes.
const hotLabelsCfg = computed(() => settings.uiState.kiosk?.modeConfig?.hotLabels || {})
const hotLabels = computed(() => {
  const hours = Math.max(1, Number(hotLabelsCfg.value.hours) || 24)
  const topN = Math.max(3, Number(hotLabelsCfg.value.topN) || 15)
  const includeScoped = !!hotLabelsCfg.value.includeScoped
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  const counts = new Map()
  let activeTickets = 0
  for (const n of items.value) {
    const raw = n._raw || {}
    const c = safeDate(raw.created_at) || 0
    const u = safeDate(raw.updated_at) || 0
    const cl = safeDate(raw.closed_at) || 0
    if (Math.max(c, u, cl) < cutoff) continue
    activeTickets++
    const labels = Array.isArray(raw.labels) ? raw.labels : []
    for (const l of labels) {
      if (typeof l !== 'string' || !l) continue
      if (!includeScoped && isScopedLabel(l)) continue
      counts.set(l, (counts.get(l) || 0) + 1)
    }
  }
  return {
    list: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([label, count]) => ({ label, count })),
    activeTickets,
    hours
  }
})
const hotLabelsMax = computed(() => Math.max(1, ...hotLabels.value.list.map(r => r.count)))

// Pinned "target" milestone (e.g. the version we're driving toward).
const targetMilestone = computed(() => String(settings.uiState.kiosk?.targetMilestone || '').trim())

// Milestones — completion % per active milestone (open + closed counted)
const milestonesCfg = computed(() => settings.uiState.kiosk?.modeConfig?.milestones || {})
const milestonesData = computed(() => {
  const topN = Math.max(1, Number(milestonesCfg.value.topN) || 8)
  const ms = new Map()
  // Use unscoped list — milestones mode must compare across all milestones.
  for (const n of allItems.value) {
    const raw = n._raw || {}
    const m = raw.milestone
    if (!m || !m.title) continue
    const state = String(m.state || '').toLowerCase()
    const isTarget = m.title === targetMilestone.value
    // Keep closed milestones in the list only if they're the active target.
    if (state && state !== 'active' && state !== 'opened' && !isTarget) continue
    const key = m.title
    if (!ms.has(key)) ms.set(key, { title: key, due: m.due_date || null, open: 0, closed: 0, isTarget })
    const bucket = ms.get(key)
    if (isOpen(n)) bucket.open++; else bucket.closed++
  }
  const list = [...ms.values()].map(m => {
    const total = m.open + m.closed
    return { ...m, total, pct: total ? Math.round((m.closed / total) * 100) : 0 }
  })
  list.sort((a, b) => (b.isTarget ? 1 : 0) - (a.isTarget ? 1 : 0) || b.total - a.total)
  return list.slice(0, topN)
})

// Dedicated "target" focus view — big completion bar, day countdown, top open items.
const targetData = computed(() => {
  const title = targetMilestone.value
  if (!title) return null
  let due = null, startDate = null, state = ''
  let open = 0, closed = 0
  // Track per-ticket created/closed timestamps for the rich-bar split.
  const ticketTimes = []
  const openList = []
  // Use unscoped list — even though `items` is already scoped to the target when set,
  // explicit allItems keeps this independent if the scope logic ever changes.
  for (const n of allItems.value) {
    const raw = n._raw || {}
    const m = raw.milestone
    if (!m || m.title !== title) continue
    if (!due && m.due_date) due = m.due_date
    if (!startDate && m.start_date) startDate = m.start_date
    if (!state && m.state) state = String(m.state).toLowerCase()
    const created = safeDate(raw.created_at) || 0
    const closedAt = safeDate(raw.closed_at) || 0
    ticketTimes.push({ created, closedAt, isOpen: isOpen(n) })
    if (isOpen(n)) {
      open++
      openList.push({
        iid: raw.iid != null ? String(raw.iid) : '',
        title: raw.title || n.name,
        url: raw.web_url || '',
        priority: getScopedLabelValue(raw.labels, 'Priority') || '',
        assignees: getAssigneeNames(raw),
        updatedAt: safeDate(raw.updated_at) || 0
      })
    } else {
      closed++
    }
  }
  const total = open + closed
  const pct = total ? Math.round((closed / total) * 100) : 0
  // Split open tickets into "original scope" (created on/before milestone start) vs
  // "added after start" (scope creep). When start_date is unknown, fall back to the
  // earliest created_at among milestone tickets so "added" is always 0.
  const startMs = startDate
    ? new Date(startDate).getTime()
    : (ticketTimes.length ? Math.min(...ticketTimes.filter(t => t.created).map(t => t.created)) : 0)
  let openOriginal = 0, openAdded = 0, closedOriginal = 0, closedAdded = 0
  for (const t of ticketTimes) {
    const wasAdded = startMs && t.created && t.created > startMs
    if (t.isOpen) { wasAdded ? openAdded++ : openOriginal++ }
    else { wasAdded ? closedAdded++ : closedOriginal++ }
  }
  let dueLabel = ''
  let dueClass = ''
  if (due) {
    const day = 24 * 60 * 60 * 1000
    const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
    const dueMs = new Date(due).getTime()
    const diff = Math.round((dueMs - today0) / day)
    if (diff > 0) { dueLabel = `${diff} day${diff === 1 ? '' : 's'} to go`; dueClass = diff <= 7 ? 'k-target-soon' : '' }
    else if (diff === 0) { dueLabel = 'Due today'; dueClass = 'k-target-soon' }
    else { dueLabel = `${-diff} day${diff === -1 ? '' : 's'} overdue`; dueClass = 'k-target-overdue' }
  }
  // Sort by: has priority first (high → low), then most-recently-updated.
  const priRank = (p) => {
    const k = String(p || '').toLowerCase()
    if (!k) return 99
    if (k.includes('blocking') || k.includes('critical')) return 0
    if (k.includes('high')) return 1
    if (k.includes('medium') || k.includes('normal')) return 2
    if (k.includes('low')) return 3
    return 4
  }
  openList.sort((a, b) => priRank(a.priority) - priRank(b.priority) || b.updatedAt - a.updatedAt)
  return {
    title, total, open, closed, pct, due, dueLabel, dueClass, state,
    startDate, startMs,
    openOriginal, openAdded, closedOriginal, closedAdded,
    openList: openList.slice(0, 12),
    // Saved for the burnup mode so it doesn't have to re-iterate every node.
    _ticketTimes: ticketTimes
  }
})

// "How fast are we burning down the target?" — projects an ETA from the last 14 days of
// closure / add rate.
const TARGET_LOOKBACK_DAYS = 14
const targetForecast = computed(() => {
  if (!targetData.value || !targetMilestone.value) return null
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const cutoff = now - TARGET_LOOKBACK_DAYS * day
  let closedRecent = 0, addedRecent = 0
  for (const n of allItems.value) {
    const raw = n._raw || {}
    if (raw?.milestone?.title !== targetMilestone.value) continue
    const c = safeDate(raw.created_at)
    const cl = safeDate(raw.closed_at)
    if (c && c >= cutoff) addedRecent++
    if (cl && cl >= cutoff) closedRecent++
  }
  const closedPerWeek = (closedRecent / TARGET_LOOKBACK_DAYS) * 7
  const addedPerWeek = (addedRecent / TARGET_LOOKBACK_DAYS) * 7
  const netPerWeek = closedPerWeek - addedPerWeek
  const open = targetData.value.open
  const round1 = (n) => Math.round(n * 10) / 10
  const out = {
    lookbackDays: TARGET_LOOKBACK_DAYS,
    closedRecent, addedRecent,
    closedPerWeek: round1(closedPerWeek),
    addedPerWeek: round1(addedPerWeek),
    netPerWeek: round1(netPerWeek),
    open
  }
  if (open === 0) { out.status = 'done'; out.message = 'All tickets in this milestone are closed.'; return out }
  if (netPerWeek <= 0) {
    out.status = 'stalled'
    out.message = addedPerWeek > closedPerWeek
      ? `Scope growing faster than closures — adding ${out.addedPerWeek}/wk vs closing ${out.closedPerWeek}/wk.`
      : 'No net progress in the last ' + TARGET_LOOKBACK_DAYS + ' days.'
    return out
  }
  const weeksToShip = open / netPerWeek
  const etaMs = now + weeksToShip * 7 * day
  out.weeksToShip = round1(weeksToShip)
  out.eta = new Date(etaMs).toISOString().slice(0, 10)
  if (targetData.value.due) {
    const dueMs = new Date(targetData.value.due).getTime()
    if (etaMs <= dueMs) {
      const slackDays = Math.max(0, Math.round((dueMs - etaMs) / day))
      out.status = 'on-track'
      out.message = slackDays > 0 ? `On track · ${slackDays}d slack vs due date` : 'On track · landing on the due date'
    } else {
      const lateDays = Math.round((etaMs - dueMs) / day)
      out.status = 'late'
      out.lateDays = lateDays
      out.message = `Projected ${lateDays}d late vs due date`
    }
  } else {
    out.status = 'no-deadline'
    out.message = 'No due date set on the milestone'
  }
  return out
})

// Cumulative scope vs closed over the milestone's active window. The chart is anchored
// to a sensible window (`start_date` if reasonable → otherwise N days before due_date →
// otherwise earliest ticket) so legacy backlog tickets retagged into the milestone don't
// stretch the X axis to years of dead space. Tickets that already exist at the window
// start contribute to Day 1 baseline counts.
//
// We rebuild the lines from `created_at` / `closed_at` events on the currently-loaded
// ticket data — there are no historical snapshots, so retroactive label changes etc.
// can't be reconstructed.
// viewBox dimensions are matched to the container's actual pixel size (via the
// ResizeObserver below) so `preserveAspectRatio="none"` doesn't squish text or strokes.
// Padding sized for the larger kiosk font sizes used in the labels below.
const burnupSize = ref({ w: 800, h: 320 })
const burnupSvgRef = ref(null)
const BURNUP_PAD = { top: 28, right: 28, bottom: 48, left: 58 }
const burnupCfg = computed(() => settings.uiState.kiosk?.modeConfig?.burnup || {})
const targetBurnup = computed(() => {
  const td = targetData.value
  if (!td || !td._ticketTimes?.length) return null
  const tickets = td._ticketTimes
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const windowDays = Math.max(7, Number(burnupCfg.value.windowDays) || 90)
  const minCreated = Math.min(...tickets.filter(t => t.created).map(t => t.created))
  const dueMs = td.due ? new Date(td.due).getTime() : null

  // Anchor the chart start. Honor milestone.start_date only if it's within
  // 2× windowDays of the due_date — otherwise fall back to a rolling window so we don't
  // get a 6-year flat stretch from a re-used milestone.
  let start
  if (td.startMs && dueMs && (dueMs - td.startMs) / day > 0 && (dueMs - td.startMs) / day <= windowDays * 2) {
    start = td.startMs
  } else if (dueMs) {
    start = dueMs - windowDays * day
  } else {
    start = Math.max(minCreated, now - windowDays * day)
  }
  const end = Math.max(now, dueMs || (start + windowDays * day))
  if (!Number.isFinite(start) || start >= end) return null

  // Baseline counts at `start` (pre-existing tickets become Day 1 starting values).
  let scopeBaseline = 0
  let closedBaseline = 0
  for (const t of tickets) {
    if (t.created && t.created < start) scopeBaseline++
    if (t.closedAt && t.closedAt < start) closedBaseline++
  }

  // Only events within the window need to drive the line — pre-baseline events are
  // already accounted for in the starting counts.
  const createdEvents = tickets.filter(t => t.created && t.created >= start).map(t => t.created).sort((a, b) => a - b)
  const closedEvents  = tickets.filter(t => t.closedAt && t.closedAt >= start).map(t => t.closedAt).sort((a, b) => a - b)

  const sampleEnd = Math.min(now, end)
  const dayCount = Math.max(1, Math.ceil((sampleEnd - start) / day))
  const points = []
  let scopeAcc = scopeBaseline, closedAcc = closedBaseline, ci = 0, cli = 0
  for (let d = 0; d <= dayCount; d++) {
    const ts = start + d * day
    while (ci < createdEvents.length && createdEvents[ci] <= ts) { scopeAcc++; ci++ }
    while (cli < closedEvents.length && closedEvents[cli] <= ts) { closedAcc++; cli++ }
    points.push({ ts, scope: scopeAcc, closed: closedAcc })
  }
  if (sampleEnd < end) points.push({ ts: end, scope: scopeAcc, closed: closedAcc })

  // Scales — driven by current container size so 1 user-space unit = 1 screen pixel.
  const vbW = Math.max(400, burnupSize.value.w)
  const vbH = Math.max(200, burnupSize.value.h)
  const maxY = Math.max(1, scopeAcc)
  const innerW = vbW - BURNUP_PAD.left - BURNUP_PAD.right
  const innerH = vbH - BURNUP_PAD.top - BURNUP_PAD.bottom
  const xFor = (ts) => BURNUP_PAD.left + ((ts - start) / (end - start)) * innerW
  const yFor = (n)  => BURNUP_PAD.top + innerH - (n / maxY) * innerH

  const stepPath = (key) => {
    let d = ''
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const x = xFor(p.ts)
      const y = yFor(p[key])
      if (i === 0) d += `M${x},${y}`
      else d += ` H${x} V${y}`
    }
    return d
  }
  const areaPath = () => {
    if (!points.length) return ''
    let top = ''
    let bottom = ''
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const x = xFor(p.ts)
      const yScope  = yFor(p.scope)
      const yClosed = yFor(p.closed)
      if (i === 0) { top += `M${x},${yScope}`; bottom = `L${x},${yClosed}` }
      else { top += ` H${x} V${yScope}`; bottom = ` V${yClosed} H${x}` + bottom }
    }
    return top + bottom + ' Z'
  }

  // Ideal-burn guideline: straight line from (start, closedBaseline) to (due, totalScope).
  // Gives the room an at-a-glance pacing target. Skipped when there's no due_date.
  let idealPath = ''
  if (dueMs && dueMs > start) {
    const x0 = xFor(start), y0 = yFor(closedBaseline)
    const x1 = xFor(dueMs), y1 = yFor(scopeAcc)
    idealPath = `M${x0},${y0} L${x1},${y1}`
  }

  // Date ticks: ~5 evenly across the window
  const ticks = []
  const tickCount = 5
  for (let i = 0; i <= tickCount; i++) {
    const ts = start + (i / tickCount) * (end - start)
    ticks.push({ ts, x: xFor(ts), label: new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })
  }
  const yTicks = []
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((i / 4) * maxY)
    yTicks.push({ v, y: yFor(v) })
  }

  // Risk colouring for the open-work band: amber by default, dim red when closed is
  // tracking visibly behind ideal (≥ 15 tickets late).
  let onTrack = true
  if (dueMs && dueMs > start) {
    const idealAtToday = closedBaseline + ((Math.min(now, dueMs) - start) / (dueMs - start)) * (scopeAcc - closedBaseline)
    onTrack = closedAcc >= idealAtToday - 15
  }

  return {
    scopePath: stepPath('scope'),
    closedPath: stepPath('closed'),
    areaPath: areaPath(),
    idealPath,
    onTrack,
    ticks, yTicks,
    todayX: now >= start && now <= end ? xFor(now) : null,
    dueX: dueMs && dueMs >= start && dueMs <= end ? xFor(dueMs) : null,
    startLabel: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    endLabel: new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    totalScope: scopeAcc,
    totalClosed: closedAcc,
    scopeBaseline, closedBaseline,
    windowDays,
    maxY,
    vbWidth: vbW, vbHeight: vbH,
    innerLeft: BURNUP_PAD.left, innerTop: BURNUP_PAD.top,
    innerRight: vbW - BURNUP_PAD.right, innerBottom: vbH - BURNUP_PAD.bottom
  }
})

// Recently closed / opened lists inside the target milestone (last 14 days).
const targetRecent = computed(() => {
  const title = targetMilestone.value
  if (!title) return { closed: [], added: [] }
  const day = 24 * 60 * 60 * 1000
  const cutoff = Date.now() - TARGET_LOOKBACK_DAYS * day
  const closed = []
  const added = []
  for (const n of allItems.value) {
    const raw = n._raw || {}
    if (raw?.milestone?.title !== title) continue
    const base = {
      iid: raw.iid != null ? String(raw.iid) : '',
      title: raw.title || n.name,
      url: raw.web_url || ''
    }
    const c = safeDate(raw.created_at)
    const cl = safeDate(raw.closed_at)
    if (cl && cl >= cutoff) closed.push({ ...base, ts: cl, who: raw.closed_by?.name || '' })
    if (c && c >= cutoff)  added.push ({ ...base, ts: c,  who: raw.author?.name || '' })
  }
  closed.sort((a, b) => b.ts - a.ts)
  added.sort ((a, b) => b.ts - a.ts)
  return { closed: closed.slice(0, 6), added: added.slice(0, 6) }
})

const activityCfg = computed(() => settings.uiState.kiosk?.modeConfig?.activity || {})
const activityFeed = computed(() => {
  const limit = Math.max(1, Number(activityCfg.value.limit) || 22)
  const includeUpdates = activityCfg.value.includeUpdates !== false
  const ev = []
  for (const n of items.value) {
    const raw = n._raw || {}
    const title = raw.title || n.name || (raw.iid ? `#${raw.iid}` : '(untitled)')
    const iid = raw.iid != null ? String(raw.iid) : ''
    const url = raw.web_url || ''
    const notes = Number(raw.user_notes_count) || 0
    const c = safeDate(raw.created_at)
    const u = safeDate(raw.updated_at)
    const cl = safeDate(raw.closed_at)
    if (c) ev.push({ ts: c, kind: 'opened', title, iid, who: raw.author?.name || '', url, notes })
    if (cl) ev.push({ ts: cl, kind: 'closed', title, iid, who: raw.closed_by?.name || '', url, notes })
    // `updated_at` is GitLab's catch-all "last activity" timestamp (covers comments,
    // label changes, assignment changes, edits, etc.). Skip when it matches another
    // event we already emitted so we don't get duplicate rows on freshly-created or
    // just-closed tickets.
    if (includeUpdates && u && u !== c && u !== cl) {
      ev.push({ ts: u, kind: 'updated', title, iid, who: '', url, notes })
    }
  }
  ev.sort((a, b) => b.ts - a.ts)
  return ev.slice(0, limit)
})

const FEED_ICON  = { opened: 'mdi-plus-circle', closed: 'mdi-check-circle', updated: 'mdi-pencil-circle' }
const FEED_LABEL = { opened: 'OPENED',          closed: 'CLOSED',          updated: 'UPDATED' }
const ETA_ICON = {
  'on-track':    'mdi-rocket-launch',
  'late':        'mdi-clock-alert-outline',
  'no-deadline': 'mdi-calendar-question',
  'stalled':     'mdi-alert',
  'done':        'mdi-trophy'
}

// Stable per-name color (hashed → HSL) so the same person keeps the same avatar tone
// across renders without us maintaining a palette map.
const initialsOf = (name) => {
  const s = String(name || '').trim()
  if (!s) return '?'
  return s.split(/\s+/).filter(Boolean).map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('')
}
const avatarColor = (name) => {
  const s = String(name || '')
  if (!s) return 'hsl(0, 0%, 35%)'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360}, 42%, 42%)`
}

// Blockers: open tickets with Priority::Blocking|Critical, Severity::Critical, a
// `blocker`/`blocked` label, or a status containing "Blocked". The "fire alarm" mode.
const blockersCfg = computed(() => settings.uiState.kiosk?.modeConfig?.blockers || {})
const isBlockerRaw = (raw) => {
  const labels = Array.isArray(raw?.labels) ? raw.labels : []
  if (labels.some(l => typeof l === 'string' && /^(blocker|blocked)$/i.test(l.trim()))) return true
  if (/blocking|critical/i.test(getScopedLabelValue(labels, 'Priority') || '')) return true
  if (/critical/i.test(getScopedLabelValue(labels, 'Severity') || '')) return true
  if (/blocked/i.test(currentStatusOfRaw(raw) || '')) return true
  return false
}
const blockers = computed(() => {
  const limit = Math.max(1, Number(blockersCfg.value.limit) || 12)
  const maxAge = Math.max(0, Number(blockersCfg.value.maxAgeDays) || 0)
  const out = []
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  for (const n of items.value) {
    if (!isOpen(n)) continue
    const raw = n._raw || {}
    if (!isBlockerRaw(raw)) continue
    const created = safeDate(raw.created_at) || 0
    const ageDays = created ? Math.max(0, Math.floor((now - created) / day)) : 0
    if (maxAge > 0 && ageDays > maxAge) continue
    out.push({
      iid: raw.iid != null ? String(raw.iid) : '',
      title: raw.title || n.name,
      url: raw.web_url || '',
      ageDays,
      priority: getScopedLabelValue(raw.labels, 'Priority') || getScopedLabelValue(raw.labels, 'Severity') || '',
      assignees: getAssigneeNames(raw),
      updatedAt: safeDate(raw.updated_at) || 0
    })
  }
  // Oldest first — old blockers are the biggest red flag.
  out.sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0))
  return { list: out.slice(0, limit), total: out.length, maxAgeDays: maxAge }
})

// Stale WIP — tickets actively in "in progress" / "doing" / "wip" status that haven't
// seen any update activity in N days. Highlights forgotten work.
const wipStaleCfg = computed(() => settings.uiState.kiosk?.modeConfig?.wipStale || {})
const wipStale = computed(() => {
  const days = Math.max(1, Number(wipStaleCfg.value.days) || 5)
  const limit = Math.max(1, Number(wipStaleCfg.value.limit) || 12)
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const cutoff = now - days * day
  const out = []
  for (const n of items.value) {
    if (!isOpen(n)) continue
    const raw = n._raw || {}
    const status = currentStatusOfRaw(raw) || ''
    if (!/in[\s_-]*progress|doing|wip/i.test(status)) continue
    const upd = safeDate(raw.updated_at) || safeDate(raw.created_at) || 0
    if (!upd || upd >= cutoff) continue
    out.push({
      iid: raw.iid != null ? String(raw.iid) : '',
      title: raw.title || n.name,
      url: raw.web_url || '',
      idleDays: Math.floor((now - upd) / day),
      assignees: getAssigneeNames(raw),
      status
    })
  }
  out.sort((a, b) => b.idleDays - a.idleDays)
  return { list: out.slice(0, limit), total: out.length, thresholdDays: days }
})

// Recently closed: morale / celebration view of last N hours of closures.
const closedCfg = computed(() => settings.uiState.kiosk?.modeConfig?.closed || {})
const closedRecently = computed(() => {
  const hours = Math.max(1, Number(closedCfg.value.hours) || 48)
  const limit = Math.max(1, Number(closedCfg.value.limit) || 18)
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  const out = []
  for (const n of items.value) {
    const raw = n._raw || {}
    const cl = safeDate(raw.closed_at)
    if (!cl || cl < cutoff) continue
    out.push({
      ts: cl,
      iid: raw.iid != null ? String(raw.iid) : '',
      title: raw.title || n.name,
      url: raw.web_url || '',
      who: raw.closed_by?.name || ''
    })
  }
  out.sort((a, b) => b.ts - a.ts)
  return { list: out.slice(0, limit), total: out.length, hours }
})

const risksCfg = computed(() => settings.uiState.kiosk?.modeConfig?.risks || {})
const risks = computed(() => {
  const staleThreshold = Math.max(1, Number(risksCfg.value.staleListDays) || 14)
  const listLimit = Math.max(1, Number(risksCfg.value.listLimit) || 10)
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const overdue = []
  const stale = []
  let unassigned = 0
  let noDueDate = 0
  for (const n of openItems.value) {
    const raw = n._raw || {}
    const url = raw.web_url || ''
    const title = raw.title || n.name
    const due = safeDate(raw.due_date)
    if (due && due < now) overdue.push({ title, url, ageDays: Math.max(1, Math.floor((now - due) / day)) })
    else if (!due) noDueDate++
    const upd = safeDate(raw.updated_at)
    if (upd && (now - upd) > staleThreshold * day) stale.push({ title, url, ageDays: Math.floor((now - upd) / day) })
    if (!getAssigneeNames(raw).length) unassigned++
  }
  overdue.sort((a, b) => b.ageDays - a.ageDays)
  stale.sort((a, b) => b.ageDays - a.ageDays)
  return { overdue: overdue.slice(0, listLimit), stale: stale.slice(0, listLimit), staleThreshold, unassigned, noDueDate }
})

// --- Deep-link actions (click → filter or open issue) ---
const openIssue = (url) => { if (url) window.open(url, '_blank') }
// All kiosk deep-link filters also propagate the target-milestone scope + priority
// filter so the graph the user lands on matches what they were just looking at.
// Maps our bucket ids ('blocking'/'high'/...) to the readable Priority:: label values
// the main filter uses ("0 - Blocking", "1 - High", …) by inferring them from the
// loaded data — falls back to the bucket id when nothing matches.
const applyFilter = (patch) => {
  const finalPatch = { ...(patch || {}) }
  if (targetMilestone.value && !finalPatch.selectedMilestones) {
    finalPatch.selectedMilestones = [targetMilestone.value]
  }
  if (priorityFilter.value.length && !finalPatch.selectedPriorities) {
    const allowed = new Set(priorityFilter.value)
    const seen = new Set()
    for (const n of allItems.value) {
      const p = getScopedLabelValue(n?._raw?.labels || [], 'Priority')
      if (!p) continue
      if (allowed.has(priorityBucket(p))) seen.add(p)
    }
    if (seen.size) finalPatch.selectedPriorities = [...seen]
  }
  emit('apply-filter', finalPatch)
}
const filterByAssignee = (name) => {
  if (!name) return
  applyFilter({
    selectedAssignees: name === '(Unassigned)' ? ['@unassigned'] : [name]
  })
}
const filterByPriority = (label) => {
  if (!label || /^\(/.test(label)) return // skip "(No priority)"
  applyFilter({ selectedPriorities: [label] })
}
const filterByLabel = (label) => {
  if (!label) return
  applyFilter({ selectedLabels: [label] })
}
const filterCreatedToday = () => applyFilter({ includeClosed: true, dateFilters: { createdMode: 'last_x_days', createdDays: 1 } })
const filterUpdatedToday = () => applyFilter({ includeClosed: true, dateFilters: { updatedMode: 'last_x_days', updatedDays: 1 } })
const filterOpen   = () => applyFilter({})
const filterByDay = (dayIso) => applyFilter({
  includeClosed: true,
  dateFilters: { createdMode: 'between', createdAfter: dayIso, createdBefore: dayIso }
})
const filterUnassigned = () => applyFilter({ selectedAssignees: ['@unassigned'] })
const filterNoDueDate  = () => applyFilter({ dueStatus: 'none' })

const relTime = (ts) => {
  const diff = Math.max(0, nowTick.value - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
</script>

<style scoped>
.kiosk {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
  outline: none;
}

.kiosk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  flex-shrink: 0;
}
.kiosk-head-left, .kiosk-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.kiosk-tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.kiosk-mode-label {
  font-size: clamp(16px, 1.6vw, 22px);
  font-weight: 600;
  opacity: 0.9;
}
.kiosk-scope-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  border: 1px solid rgba(var(--v-theme-primary), 0.4);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kiosk-scope-chip-priority {
  background: rgba(245, 124, 0, 0.15);
  color: #ffa726;
  border-color: rgba(245, 124, 0, 0.4);
}
.kiosk-clock { font-variant-numeric: tabular-nums; opacity: 0.85; font-size: 14px; }
.kiosk-refresh-eta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: inherit;
  color: inherit;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(127, 127, 127, 0.12);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.kiosk-refresh-eta:hover:not(:disabled) { background: rgba(127, 127, 127, 0.22); border-color: rgba(127, 127, 127, 0.3); }
.kiosk-refresh-eta:disabled { cursor: default; opacity: 0.7; }
.kiosk-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.kiosk-icon-btn:hover { background: rgba(127, 127, 127, 0.15); }

.spinning { animation: spin 1.2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.kiosk-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 24px 32px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.kiosk-foot {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  border-top: 1px solid rgba(127, 127, 127, 0.18);
}
.kiosk-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(127, 127, 127, 0.4);
  cursor: pointer;
  transition: background 0.2s;
}
.kiosk-dot.active { background: rgb(var(--v-theme-primary)); }

.k-section-title {
  font-size: clamp(14px, 1.4vw, 20px);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 16px;
}
.k-section-sub {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
  opacity: 0.7;
  margin-left: 10px;
}

.k-empty {
  opacity: 0.5;
  font-style: italic;
  font-size: clamp(16px, 1.6vw, 22px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 32px 16px;
  flex: 1;
  min-height: 120px;
}

/* Hover affordances for click-throughs */
.k-clickable { cursor: pointer; transition: background 0.15s, transform 0.1s; }
.k-clickable:hover { background: rgba(127, 127, 127, 0.14); }
.k-clickable:active { transform: translateY(1px); }
.k-stat-click { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.k-stat-click:hover { background: rgba(127, 127, 127, 0.12); border-color: rgba(var(--v-theme-primary), 0.5); }

/* Target milestone (focus view) */
.k-target { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; }
.k-target-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.k-target-title {
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: none;
  font-size: clamp(20px, 2.4vw, 36px);
  letter-spacing: 0;
  opacity: 1;
  margin-bottom: 4px;
}
.k-target-state {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.2);
  opacity: 0.8;
}
.k-target-due {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: clamp(13px, 1.2vw, 16px);
  opacity: 0.85;
}
.k-target-soon    { color: #ffb300; }
.k-target-overdue { color: #ef5350; font-weight: 600; }
.k-target-pct {
  font-size: clamp(64px, 10vw, 140px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--v-theme-primary));
}
.k-target-pct span { font-size: 0.4em; opacity: 0.65; margin-left: 2px; }
.k-target-bar {
  height: 18px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.15);
  overflow: hidden;
}
.k-target-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #43a047, #66bb6a);
  border-radius: 10px;
  transition: width 0.6s ease;
}
.k-target-bar-rich { display: flex; height: 18px; }
.k-trb-seg { height: 100%; transition: width 0.5s ease; }
.k-trb-seg.k-trb-closed { background: linear-gradient(90deg, #43a047, #66bb6a); }
.k-trb-seg.k-trb-open   { background: rgba(127, 127, 127, 0.3); }
.k-trb-seg.k-trb-added  { background: repeating-linear-gradient(45deg, #ffb300, #ffb300 6px, #ffa000 6px, #ffa000 12px); }
.k-trb-seg:first-child  { border-radius: 10px 0 0 10px; }
.k-trb-seg:last-child   { border-radius: 0 10px 10px 0; }
.k-trb-seg:only-child   { border-radius: 10px; }
.k-trb-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  opacity: 0.85;
  margin-top: 4px;
}
.k-trb-legend .k-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 5px; vertical-align: middle; }
.k-trb-legend .k-swatch.k-trb-closed { background: #66bb6a; }
.k-trb-legend .k-swatch.k-trb-open   { background: rgba(127, 127, 127, 0.5); }
.k-trb-legend .k-swatch.k-trb-added  { background: repeating-linear-gradient(45deg, #ffb300, #ffb300 4px, #ffa000 4px, #ffa000 8px); }
.k-target-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.k-target-stats .k-stat { padding: 16px; }
.k-target-stats .k-stat-num { font-size: clamp(36px, 6vw, 88px); }
.k-target-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }

.k-target-head-l { display: flex; flex-direction: column; gap: 4px; }
.k-stat-sub {
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
  text-align: center;
}
.k-target-eta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  border-left: 4px solid transparent;
  background: rgba(127, 127, 127, 0.08);
  font-size: clamp(13px, 1.2vw, 16px);
}
.k-target-eta-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; min-width: 0; }
.k-target-eta-main strong { font-size: clamp(16px, 1.6vw, 22px); font-weight: 700; }
.k-target-eta-date { opacity: 0.85; font-variant-numeric: tabular-nums; }
.k-target-eta-msg  { opacity: 0.7; }
.k-target-eta.is-on-track    { border-left-color: #66bb6a; background: rgba(102, 187, 106, 0.08); }
.k-target-eta.is-on-track    .v-icon { color: #66bb6a; }
.k-target-eta.is-late        { border-left-color: #ef5350; background: rgba(239, 83, 80, 0.08); }
.k-target-eta.is-late        .v-icon { color: #ef5350; }
.k-target-eta.is-stalled     { border-left-color: #ffb300; background: rgba(255, 179, 0, 0.08); }
.k-target-eta.is-stalled     .v-icon { color: #ffb300; }
.k-target-eta.is-no-deadline { border-left-color: #90a4ae; }
.k-target-eta.is-no-deadline .v-icon { color: #90a4ae; }
.k-target-eta.is-done        { border-left-color: #43a047; background: rgba(67, 160, 71, 0.12); }
.k-target-eta.is-done        .v-icon { color: #ffd54f; }

.k-target-recent {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
}
.k-target-recent-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(127, 127, 127, 0.04);
  overflow: hidden;
}
.k-target-recent-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: clamp(13px, 1.2vw, 16px);
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  text-transform: uppercase;
  opacity: 0.85;
}
.k-target-recent-closed { color: #66bb6a; }
.k-target-recent-added  { color: #5c6bc0; }
.k-target-feed.k-target-feed-compact li {
  grid-template-columns: 56px minmax(0, 1fr) 30px 64px;
  padding: 5px 8px;
}
.k-empty-compact { font-size: 13px; opacity: 0.55; padding: 4px 6px; }

@media (max-width: 900px) {
  .k-target-recent { grid-template-columns: 1fr; }
}
.k-target-feed {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 5px;
  overflow: auto;
}
.k-target-feed li {
  display: grid;
  grid-template-columns: 90px 56px minmax(0, 1fr) auto auto;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  align-items: center;
}
.k-target-pri {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.18);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-target-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 8px; opacity: 0.6;
}
.k-target-empty-title { font-size: clamp(20px, 2vw, 28px); font-weight: 600; }
.k-target-empty-sub { font-size: 14px; }

.k-bar-pinned {
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding-left: 6px;
  background: rgba(var(--v-theme-primary), 0.04);
  border-radius: 6px;
}

/* Today */
.k-today {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  flex: 1;
}
.k-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;
  border-radius: 14px;
  border: 1px solid rgba(127, 127, 127, 0.2);
  background: rgba(127, 127, 127, 0.05);
}
.k-stat { position: relative; }
.k-stat-icon {
  position: absolute;
  top: 10px;
  left: 12px;
  opacity: 0.45;
}
.k-stat-num {
  font-size: clamp(48px, 9vw, 160px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.k-stat-lbl {
  font-size: clamp(14px, 1.4vw, 22px);
  opacity: 0.7;
  margin-top: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.k-stat-pos .k-stat-num { color: #4caf50; }
.k-stat-neg .k-stat-num { color: #ef5350; }
.k-stat-warn .k-stat-num { color: #ffb300; }

/* Velocity */
.k-velocity { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.k-velocity-chart {
  display: grid;
  gap: 8px;
  flex: 1;
  align-items: end;
}
.k-vel-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.k-vel-bars {
  width: 100%;
  display: flex;
  align-items: end;
  gap: 4px;
  justify-content: center;
}
.k-vel-bar {
  width: 30%;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.4s ease;
}
.k-vel-created { background: #66bb6a; }
.k-vel-closed { background: #9e9e9e; }
.k-vel-num {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.k-vel-lbl { font-size: 13px; opacity: 0.7; }
.k-vel-today .k-vel-lbl { color: rgb(var(--v-theme-primary)); font-weight: 700; opacity: 1; }
.k-vel-today { position: relative; }
.k-vel-today::after {
  content: '';
  position: absolute;
  inset: -4px -2px;
  border: 1px dashed rgba(var(--v-theme-primary), 0.45);
  border-radius: 6px;
  pointer-events: none;
}
.k-legend {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.8;
}
.k-legend-spacer { flex: 1; }
.k-legend i.k-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 4px;
  border-radius: 3px;
  vertical-align: middle;
}
.k-swatch.k-vel-created { background: #66bb6a; }
.k-swatch.k-vel-closed { background: #9e9e9e; }

/* Bar lists (workload, priority) */
.k-bar-list { display: flex; flex-direction: column; gap: 10px; overflow: auto; }
.k-bar-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 3fr auto auto auto;
  gap: 16px;
  align-items: center;
}
.k-bar-name {
  font-size: clamp(14px, 1.4vw, 20px);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-bar-name-with-avatar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.k-bar-name-with-avatar .k-feed-avatar { flex-shrink: 0; width: 22px; height: 22px; font-size: 11px; }
.k-bar-name-with-avatar .k-bar-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.k-bar-pct { font-variant-numeric: tabular-nums; opacity: 0.55; min-width: 38px; }
.k-bar-track {
  height: 18px;
  background: rgba(127, 127, 127, 0.15);
  border-radius: 9px;
  overflow: hidden;
}
.k-bar-track-stacked {
  display: flex;
  align-items: stretch;
  background: rgba(127, 127, 127, 0.15);
  height: 18px;
  transition: width 0.4s ease;
}
.k-bar-seg {
  min-width: 2px;
  transition: flex-grow 0.4s ease;
}
.k-bar-seg:first-child  { border-radius: 9px 0 0 9px; }
.k-bar-seg:last-child   { border-radius: 0 9px 9px 0; }
.k-bar-seg:only-child   { border-radius: 9px; }
.k-bar-side-warn { color: #ef5350 !important; opacity: 1 !important; font-weight: 600; }
.k-workload-legend { font-size: 12px; opacity: 0.8; margin-top: 12px; }

/* Stale WIP — warm amber */
.k-wip-title { color: #ffb300; }
.k-wip-pri   { background: rgba(255, 179, 0, 0.2); color: #ffb300; font-weight: 700; }
.k-wip-idle  { color: #ffb300; font-weight: 600; }
.k-bar-fill {
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 9px;
  transition: width 0.4s ease;
}
.k-bar-count {
  font-size: clamp(18px, 1.8vw, 28px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
  text-align: right;
}
.k-bar-side { font-size: 12px; opacity: 0.6; min-width: 70px; text-align: right; }

/* Milestone burnup */
.k-burnup-section { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-burnup-title { display: flex; align-items: center; gap: 8px; text-transform: none; font-size: clamp(18px, 1.8vw, 24px); letter-spacing: 0; opacity: 1; }
.k-burnup-svg { flex: 1; min-height: 0; width: 100%; height: 100%; }
.k-burnup-legend { display: flex; gap: 20px; flex-wrap: wrap; font-size: 15px; opacity: 0.9; font-weight: 500; }
.k-burnup-legend .k-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
.k-burnup-legend .k-swatch-dotted {
  background: transparent !important;
  border-top: 2px dashed rgba(255, 255, 255, 0.55);
  height: 0; border-radius: 0;
  width: 16px;
  vertical-align: middle;
  margin-top: 5px;
}
.k-burnup-legend .k-legend-spacer { flex: 1; }
.k-burnup-warn { color: #ef5350; font-weight: 600; }

/* Blockers (fire-alarm) */
.k-blockers { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-blockers-title {
  display: flex; align-items: center; gap: 8px;
  color: #ef5350;
  text-transform: none;
  font-size: clamp(18px, 2vw, 28px);
  letter-spacing: 0;
  opacity: 1;
}
.k-blockers .k-target-feed li { border-left: 3px solid #ef5350; background: rgba(239, 83, 80, 0.06); }
.k-blockers-pri { background: rgba(239, 83, 80, 0.22); color: #ef5350; font-weight: 800; }
.k-blockers-age { color: #ef5350; font-weight: 600; }

/* Recently closed (celebration) */
.k-closed { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-closed-title {
  display: flex; align-items: center; gap: 8px;
  color: #66bb6a;
  text-transform: none;
  font-size: clamp(18px, 2vw, 28px);
  letter-spacing: 0;
  opacity: 1;
}
.k-feed-closed-cel { border-left-color: #66bb6a !important; background: rgba(102, 187, 106, 0.07) !important; }
.k-feed-closed-cel .k-feed-icon, .k-feed-closed-cel .k-feed-tag { color: #66bb6a; }
.k-feed-closed-cel .k-feed-tag { background: rgba(76, 175, 80, 0.18); }

/* Activity feed */
.k-feed { list-style: none; padding: 0; margin: 0; overflow: auto; display: flex; flex-direction: column; gap: 5px; flex: 1; }
.k-feed li {
  display: grid;
  grid-template-columns: 22px 80px 56px minmax(0, 1fr) 56px 150px 68px;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  border-left: 3px solid transparent;
  align-items: center;
}
.k-feed-opened  { border-left-color: #66bb6a; }
.k-feed-closed  { border-left-color: #5c6bc0; }
.k-feed-updated { border-left-color: #ffb300; }
.k-feed-icon { opacity: 0.9; }
.k-feed-opened  .k-feed-icon { color: #66bb6a; }
.k-feed-closed  .k-feed-icon { color: #7986cb; }
.k-feed-updated .k-feed-icon { color: #ffb300; }
.k-feed-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
}
.k-feed-opened  .k-feed-tag { background: rgba(76, 175, 80, 0.18);  color: #66bb6a; }
.k-feed-closed  .k-feed-tag { background: rgba(92, 107, 192, 0.18); color: #7986cb; }
.k-feed-updated .k-feed-tag { background: rgba(255, 179, 0, 0.18);  color: #ffb300; }
.k-feed-notes {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  font-size: 11px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.k-feed-iid {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  opacity: 0.65;
  text-align: right;
}
.k-feed-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(14px, 1.3vw, 18px); }
.k-feed-who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.85;
  min-width: 0;
  overflow: hidden;
}
.k-feed-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.k-feed-who-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-feed-when {
  font-size: 12px;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
@media (max-width: 900px) {
  .k-feed li { grid-template-columns: 22px 80px minmax(0, 1fr) 56px 68px; }
  .k-feed-iid, .k-feed-who { display: none; }
}

/* Risks */
.k-risks { flex: 1; min-height: 0; }
.k-risks-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 18px;
  height: 100%;
}
.k-risks-card {
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 10px;
  padding: 16px;
  background: rgba(127, 127, 127, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.k-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; overflow: auto; }
.k-list li { display: flex; gap: 12px; align-items: center; }
.k-list-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.k-list-side { font-size: 12px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.k-list-bad { color: #ef5350; opacity: 1; }
.k-risks-stats { display: flex; flex-direction: column; gap: 16px; justify-content: center; }
.k-risks-stats .k-stat { padding: 14px; }
.k-risks-stats .k-stat-num { font-size: clamp(36px, 6vw, 90px); }

@media (max-width: 900px) {
  .k-today { grid-template-columns: repeat(2, 1fr); }
  .k-risks-grid { grid-template-columns: 1fr; }
}
</style>
