<template>
  <div
    class="kiosk"
    :class="{ 'is-refreshed': justRefreshed, 'kiosk-off-hours': isOffHours }"
    :style="{ '--kiosk-shift-x': pixelShift.x + 'px', '--kiosk-shift-y': pixelShift.y + 'px', '--kiosk-off-dim': offHoursDim }"
    tabindex="0" ref="root"
  >
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
        <span class="kiosk-data-age" :title="lastRefreshTitle">
          <v-icon icon="mdi-database-clock-outline" size="x-small" />
          {{ dataAgeLabel }}
        </span>
        <span v-if="lastFailedAt" class="kiosk-fail-chip" :title="failureTitle">
          <v-icon icon="mdi-cloud-alert" size="x-small" />
          Refresh failed {{ failureLabel }}
        </span>
        <button
          type="button"
          class="kiosk-refresh-eta"
          :class="{ 'is-failing': lastFailedAt }"
          :title="lastFailedAt ? `${failureTitle}\nClick to retry now` : `${lastRefreshTitle} — click to refresh now`"
          :disabled="loading"
          @click="onManualRefresh"
        >
          <v-icon icon="mdi-refresh" size="small" :class="{ spinning: loading }" />
          {{ refreshLabel }}
        </button>
        <button class="kiosk-icon-btn" title="Previous (←)" @click="prevMode">‹</button>
        <button class="kiosk-icon-btn" title="Next (→)" @click="nextMode">›</button>
        <button class="kiosk-icon-btn" :class="{ 'pulse-attention': pauseFlash }" :title="paused ? 'Resume cycling (Space)' : 'Pause cycling (Space)'" @click="togglePause">
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
              <div v-if="targetData.dueLabel || targetData.ageLabel" class="k-target-due" :class="targetData.dueClass">
                <v-icon icon="mdi-calendar" size="small" />
                <template v-if="targetData.ageLabel">{{ targetData.ageLabel }}</template>
                <template v-if="targetData.ageLabel && targetData.dueLabel"> · </template>
                <template v-if="targetData.dueLabel">{{ targetData.dueLabel }}</template>
                <template v-if="targetData.due"> · {{ targetData.due }}</template>
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
            <div
              class="k-stat k-stat-pos k-stat-click"
              @click="applyFilter({ selectedState: 'closed' })"
              :title="`Show the ${fmtNum(targetData.closed)} closed tickets in this milestone`"
            >
              <v-icon icon="mdi-check-circle" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.closed) }}</div>
              <div class="k-stat-lbl">Closed</div>
              <div v-if="targetForecast" class="k-stat-sub">+{{ fmtNum(targetForecast.closedRecent) }} last {{ targetForecast.lookbackDays }}d</div>
            </div>
            <div
              class="k-stat k-stat-click"
              @click="applyFilter({ selectedState: 'opened' })"
              :title="`Show the ${fmtNum(targetData.open)} open tickets in this milestone`"
            >
              <v-icon icon="mdi-circle-outline" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.open) }}</div>
              <div class="k-stat-lbl">Open</div>
              <div v-if="targetForecast" class="k-stat-sub">{{ targetForecast.closedPerWeek }} closed/wk · {{ targetForecast.addedPerWeek }} added/wk</div>
            </div>
            <div
              class="k-stat k-stat-click"
              @click="applyFilter({ includeClosed: true })"
              :title="`Show all ${fmtNum(targetData.total)} tickets in this milestone`"
            >
              <v-icon icon="mdi-sigma" size="24" class="k-stat-icon" />
              <div class="k-stat-num">{{ fmtNum(targetData.total) }}</div>
              <div class="k-stat-lbl">Total</div>
              <div v-if="targetForecast" class="k-stat-sub">+{{ fmtNum(targetForecast.addedRecent) }} added last {{ targetForecast.lookbackDays }}d</div>
            </div>
          </div>

          <v-tooltip
            v-if="targetForecast"
            location="bottom start"
            :open-delay="120" :close-delay="80"
            content-class="k-eta-tip-wrap"
          >
            <template #activator="{ props: tipProps }">
              <div
                v-bind="tipProps"
                class="k-target-eta k-eta-hoverable"
                :class="`is-${targetForecast.status}`"
              >
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
                <v-icon icon="mdi-information-outline" size="16" class="k-eta-info" />
              </div>
            </template>

            <div class="k-eta-tip" :class="`is-${targetForecast.status}`">
              <div class="k-eta-tip-head">
                <v-icon :icon="ETA_ICON[targetForecast.status]" />
                <div class="k-eta-tip-head-text">
                  <div class="k-eta-tip-title">
                    <template v-if="targetForecast.status === 'done'">Milestone complete</template>
                    <template v-else-if="targetForecast.status === 'stalled'">No ETA · stalled</template>
                    <template v-else-if="targetForecast.status === 'on-track'">On track · ETA {{ targetForecast.eta }}</template>
                    <template v-else-if="targetForecast.status === 'late'">{{ targetForecast.lateDays }}d late · ETA {{ targetForecast.eta }}</template>
                    <template v-else>ETA {{ targetForecast.eta }} · no due date</template>
                  </div>
                  <div class="k-eta-tip-sub">{{ targetForecast.message }}</div>
                </div>
              </div>

              <div class="k-eta-tip-section">
                <div class="k-eta-tip-section-title">
                  Last {{ targetForecast.lookbackDays }} days
                  <span class="k-eta-tip-legend">
                    <i class="k-eta-sw k-eta-sw-closed" /> closed
                    <i class="k-eta-sw k-eta-sw-added" /> added
                  </span>
                </div>
                <svg v-if="etaTipChart" :viewBox="`0 0 ${etaTipChart.W} ${etaTipChart.H}`" class="k-eta-tip-svg">
                  <line
                    :x1="etaTipChart.padL" :x2="etaTipChart.W - etaTipChart.padR"
                    :y1="etaTipChart.axisY" :y2="etaTipChart.axisY"
                    stroke="rgba(200,200,200,0.25)" stroke-width="1"
                  />
                  <g v-for="b in etaTipChart.bars" :key="b.i">
                    <rect v-if="b.cH > 0" :x="b.x" :y="b.cY" :width="b.w" :height="b.cH" fill="#66bb6a" rx="1" />
                    <rect v-if="b.aH > 0" :x="b.x" :y="b.aY" :width="b.w" :height="b.aH" fill="#ef5350" rx="1" />
                  </g>
                  <text :x="etaTipChart.padL" :y="etaTipChart.H - 4" font-size="10" fill="rgba(200,200,200,0.7)">{{ etaTipChart.leftLabel }}</text>
                  <text :x="etaTipChart.W - etaTipChart.padR" :y="etaTipChart.H - 4" font-size="10" text-anchor="end" fill="rgba(200,200,200,0.7)">{{ etaTipChart.rightLabel }}</text>
                  <text :x="etaTipChart.padL - 4" :y="etaTipChart.padT + 8" font-size="10" text-anchor="end" fill="rgba(200,200,200,0.5)">peak {{ etaTipChart.max }}</text>
                </svg>
              </div>

              <div class="k-eta-tip-section">
                <div class="k-eta-tip-section-title">Throughput</div>
                <div class="k-eta-tip-grid">
                  <div class="k-eta-tip-cell">
                    <div class="k-eta-tip-cell-num k-eta-pos">{{ targetForecast.closedRecent }}</div>
                    <div class="k-eta-tip-cell-lbl">closed in {{ targetForecast.lookbackDays }}d</div>
                    <div class="k-eta-tip-cell-sub">≈ {{ targetForecast.closedPerWeek }}/wk</div>
                  </div>
                  <div class="k-eta-tip-cell">
                    <div class="k-eta-tip-cell-num k-eta-neg">{{ targetForecast.addedRecent }}</div>
                    <div class="k-eta-tip-cell-lbl">added in {{ targetForecast.lookbackDays }}d</div>
                    <div class="k-eta-tip-cell-sub">≈ {{ targetForecast.addedPerWeek }}/wk</div>
                  </div>
                  <div class="k-eta-tip-cell">
                    <div class="k-eta-tip-cell-num" :class="targetForecast.netPerWeek > 0 ? 'k-eta-pos' : 'k-eta-neg'">
                      {{ targetForecast.netPerWeek > 0 ? '+' : '' }}{{ targetForecast.netPerWeek }}
                    </div>
                    <div class="k-eta-tip-cell-lbl">net /wk</div>
                    <div class="k-eta-tip-cell-sub">closed − added</div>
                  </div>
                  <div class="k-eta-tip-cell">
                    <div class="k-eta-tip-cell-num">{{ targetForecast.open }}</div>
                    <div class="k-eta-tip-cell-lbl">open</div>
                    <div class="k-eta-tip-cell-sub">remaining</div>
                  </div>
                </div>
              </div>

              <div v-if="targetForecast.weeksToShip != null" class="k-eta-tip-section">
                <div class="k-eta-tip-section-title">How the ETA is calculated</div>
                <div class="k-eta-tip-formula">
                  <code>open ÷ net/wk = weeks</code><br>
                  <code>{{ targetForecast.open }} ÷ {{ targetForecast.netPerWeek }} = {{ targetForecast.weeksToShip }}w</code>
                  → <strong>{{ targetForecast.eta }}</strong>
                </div>
                <svg v-if="etaTipTimeline" :viewBox="`0 0 ${etaTipTimeline.W} ${etaTipTimeline.H}`" class="k-eta-tip-svg k-eta-tip-timeline">
                  <line :x1="0" :x2="etaTipTimeline.W" :y1="etaTipTimeline.y" :y2="etaTipTimeline.y" stroke="rgba(200,200,200,0.2)" />
                  <rect
                    v-for="(s, si) in etaTipTimeline.segs" :key="'s' + si"
                    :x="Math.min(s.x1, s.x2)" :y="s.y - 4"
                    :width="Math.abs(s.x2 - s.x1)" :height="8"
                    :fill="s.kind === 'late' ? 'rgba(239,83,80,0.55)' : 'rgba(102,187,106,0.5)'"
                    rx="2"
                  />
                  <g v-for="(t, ti) in etaTipTimeline.ticks" :key="'t' + ti">
                    <circle
                      :cx="t.x" :cy="etaTipTimeline.y" r="4"
                      :fill="t.kind === 'today' ? '#90a4ae' : (t.kind === 'due' ? '#ffd54f' : '#42a5f5')"
                      stroke="rgba(0,0,0,0.5)" stroke-width="0.5"
                    />
                    <text
                      :x="t.x" :y="etaTipTimeline.y + 16"
                      font-size="10" text-anchor="middle"
                      :fill="t.kind === 'today' ? 'rgba(200,200,200,0.8)' : (t.kind === 'due' ? '#ffd54f' : '#90caf9')"
                    >{{ t.label }}</text>
                  </g>
                </svg>
              </div>

              <div class="k-eta-tip-foot">
                Linear extrapolation from the last {{ targetForecast.lookbackDays }} days · doesn't account for holidays / team changes.
              </div>
            </div>
          </v-tooltip>

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

      <!-- Milestone burndown: remaining open work over time, with ideal-burn guideline -->
      <section v-else-if="currentMode === 'burndown'" class="k-burndown-section">
        <div v-if="!targetMilestone" class="k-empty">
          <v-icon icon="mdi-flag-outline" size="48" />
          <div>No target milestone set (Configuration → Kiosk).</div>
        </div>
        <div v-else-if="targetData && targetData._ticketTimes && targetData._ticketTimes.length === 0" class="k-empty">
          <v-icon icon="mdi-tray" size="48" />
          <div>No tickets in this milestone yet.</div>
        </div>
        <template v-else>
          <div class="k-section-title k-burndown-title">
            <v-icon icon="mdi-chart-areaspline" />
            {{ targetMilestone }} · burndown
            <span v-if="targetBurndown" class="k-section-sub">
              {{ targetBurndown.startLabel }} → today ({{ targetBurndown.windowDays }}d window)
              · {{ targetBurndown.initialOpen }} open at start → {{ targetBurndown.currentOpen }} now
              (+{{ fmtNum(targetBurndown.addedInWindow) }} added, −{{ fmtNum(targetBurndown.closedInWindow) }} closed)
              <template v-if="targetBurndown.dueLabel"> · due {{ targetBurndown.dueLabel }}</template>
            </span>
          </div>
          <svg
            ref="burndownSvgRef"
            class="k-burndown-svg"
            :viewBox="targetBurndown ? `0 0 ${targetBurndown.vbWidth} ${targetBurndown.vbHeight}` : '0 0 800 320'"
          >
            <template v-if="targetBurndown">
            <!-- horizontal grid -->
            <line
              v-for="(t, i) in targetBurndown.yTicks" :key="'yg' + i"
              :x1="targetBurndown.innerLeft" :x2="targetBurndown.innerRight"
              :y1="t.y" :y2="t.y"
              stroke="rgba(127,127,127,0.18)" stroke-dasharray="3 4"
            />
            <text
              v-for="(t, i) in targetBurndown.yTicks" :key="'yt' + i"
              :x="targetBurndown.innerLeft - 8" :y="t.y + 6"
              text-anchor="end" font-size="18" fill="rgba(200,200,200,0.85)"
              font-weight="600"
            >{{ t.v }}</text>

            <!-- remaining work area (under the burndown line). Amber when on track,
                 red-tinted when actual is visibly above ideal at today. -->
            <path :d="targetBurndown.areaPath" :fill="targetBurndown.onTrack ? 'rgba(255, 179, 0, 0.22)' : 'rgba(239, 83, 80, 0.26)'" />

            <!-- "Incomplete closed history" zone — left of the gitlabClosedDays cutoff.
                 Hatched + dim so users know the remaining line in that range is unreliable
                 (closures from before the cutoff are missing, inflating the line). -->
            <pattern id="k-burndown-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="rgba(0, 0, 0, 0.25)" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255, 179, 0, 0.35)" stroke-width="2" />
            </pattern>
            <rect
              v-if="targetBurndown.closedCutoffX != null"
              :x="targetBurndown.innerLeft"
              :y="targetBurndown.innerTop"
              :width="targetBurndown.closedCutoffX - targetBurndown.innerLeft"
              :height="targetBurndown.innerBottom - targetBurndown.innerTop"
              fill="url(#k-burndown-hatch)"
            />
            <g v-if="targetBurndown.closedCutoffX != null">
              <line
                :x1="targetBurndown.closedCutoffX" :x2="targetBurndown.closedCutoffX"
                :y1="targetBurndown.innerTop" :y2="targetBurndown.innerBottom"
                stroke="#ffb300" stroke-width="2" stroke-dasharray="6 4"
              />
              <rect
                :x="targetBurndown.closedCutoffX - 78" :y="targetBurndown.innerTop + 56"
                width="156" height="22" rx="4" ry="4"
                fill="rgba(255, 179, 0, 0.9)"
              />
              <text
                :x="targetBurndown.closedCutoffX" :y="targetBurndown.innerTop + 71"
                text-anchor="middle" font-size="13" font-weight="700"
                fill="#212121"
              >Data available from here</text>
            </g>

            <!-- ideal burn guideline (dotted) — straight line from (start, initialOpen)
                 toward (due, 0), capped at today so it never projects into the future. -->
            <path
              v-if="targetBurndown.idealPath"
              :d="targetBurndown.idealPath"
              stroke="rgba(255, 255, 255, 0.55)" stroke-width="2.5" fill="none"
              stroke-dasharray="8 6"
            />

            <!-- cumulative closed line — green, shows shipping momentum -->
            <path
              :d="targetBurndown.closedPath"
              stroke="#66bb6a" stroke-width="2.5" fill="none" stroke-linejoin="round"
              opacity="0.85"
            />

            <!-- actual remaining line — green when on track, red when behind ideal -->
            <path
              :d="targetBurndown.remainingPath"
              :stroke="targetBurndown.onTrack ? '#66bb6a' : '#ef5350'"
              stroke-width="3.5" fill="none" stroke-linejoin="round"
            />

            <!-- today marker at the right edge of the chart -->
            <g>
              <line
                :x1="targetBurndown.todayX" :x2="targetBurndown.todayX"
                :y1="targetBurndown.innerTop" :y2="targetBurndown.innerBottom"
                stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-dasharray="5 5"
              />
              <rect
                :x="targetBurndown.todayX - 42" :y="targetBurndown.innerTop - 4"
                width="84" height="26" rx="5" ry="5"
                fill="rgba(255, 255, 255, 0.92)"
              />
              <text
                :x="targetBurndown.todayX" :y="targetBurndown.innerTop + 14"
                text-anchor="middle" font-size="16" font-weight="800"
                fill="#212121"
                letter-spacing="0.5"
              >TODAY</text>
            </g>

            <!-- end-of-line value badges at today (line endpoint -> readable count) -->
            <g>
              <circle :cx="targetBurndown.todayX" :cy="targetBurndown.closedEndY" r="4" fill="#66bb6a" />
              <text
                :x="targetBurndown.todayX + 7" :y="targetBurndown.closedLabelY + 5"
                font-size="16" font-weight="800" fill="#66bb6a"
                style="paint-order: stroke; stroke: #181818; stroke-width: 4px; stroke-linejoin: round;"
              >{{ fmtNum(targetBurndown.totalClosed) }}</text>

              <circle :cx="targetBurndown.todayX" :cy="targetBurndown.remainEndY" r="4" :fill="targetBurndown.onTrack ? '#66bb6a' : '#ef5350'" />
              <text
                :x="targetBurndown.todayX + 7" :y="targetBurndown.remainLabelY + 5"
                font-size="16" font-weight="800" :fill="targetBurndown.onTrack ? '#66bb6a' : '#ef5350'"
                style="paint-order: stroke; stroke: #181818; stroke-width: 4px; stroke-linejoin: round;"
              >{{ fmtNum(targetBurndown.currentOpen) }}</text>
            </g>

            <!-- x axis ticks -->
            <text
              v-for="(t, i) in targetBurndown.ticks" :key="'xt' + i"
              :x="t.x" :y="targetBurndown.innerBottom + 28"
              text-anchor="middle" font-size="16" fill="rgba(200,200,200,0.85)"
              font-weight="600"
            >{{ t.label }}</text>
            </template>
          </svg>
          <div v-if="targetBurndown" class="k-burndown-legend">
            <span><i class="k-swatch" :style="{ background: targetBurndown.onTrack ? '#66bb6a' : '#ef5350' }" />Remaining — {{ fmtNum(targetBurndown.currentOpen) }}</span>
            <span><i class="k-swatch" style="background: #66bb6a; opacity: 0.85;" />Closed — {{ fmtNum(targetBurndown.totalClosed) }}</span>
            <span v-if="targetBurndown.idealPath"><i class="k-swatch k-swatch-dotted" />Ideal burn (to today)</span>
            <span v-if="!targetBurndown.closedHistoryComplete" class="k-burndown-warn-data">
              <v-icon icon="mdi-alert-outline" size="x-small" />
              <template v-if="targetBurndown.closedDays === 0">
                No historical data — set "Include closed issues" in Configuration → GitLab.
              </template>
              <template v-else>
                Data only available since {{ targetBurndown.closedCutoffLabel }} (last {{ targetBurndown.closedDays }}d) — earlier portion may be incomplete.
              </template>
            </span>
            <span v-if="targetBurndown.entriesFromFallback > 0" class="k-burndown-warn-data">
              <v-icon icon="mdi-alert-outline" size="x-small" />
              {{ targetBurndown.entriesFromFallback }} of {{ targetBurndown.entriesFromFallback + targetBurndown.entriesFromEvents }} tickets fall back to `created_at` (milestone history not fetched yet — reload to refresh).
            </span>
            <span class="k-legend-spacer" />
            <span :class="targetBurndown.onTrack ? '' : 'k-burndown-warn'">
              {{ targetBurndown.onTrack ? 'Tracking ideal burn' : 'Behind ideal burn' }}
            </span>
          </div>
        </template>
      </section>

      <!-- Blockers: fire-alarm list (critical priority / severity / blocked) -->
      <section v-else-if="currentMode === 'blockers'" class="k-blockers">
        <div class="k-section-title k-blockers-title">
          <v-icon icon="mdi-alert-octagon" />
          Blocked issues · {{ blockers.total }}
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
        <div class="k-stat k-stat-neg k-stat-click" @click="filterCreatedToday" title="Filter graph to issues created today">
          <v-icon icon="mdi-plus-circle" size="28" class="k-stat-icon" />
          <div class="k-stat-num">{{ fmtNum(today.opened) }}</div>
          <div class="k-stat-lbl">Opened today</div>
        </div>
        <div class="k-stat k-stat-pos">
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
      <!-- Velocity = month-view calendar over the last N weeks (default 8 ≈
           2 months). Rows = ISO weeks (number on left), columns = Mon..Sun.
           Each cell shows the date plus the daily NET: green = more closed
           than created, red = more created than closed, grey = balanced/quiet.
           Cells are clickable to filter the main graph to that day. -->
      <section v-else-if="currentMode === 'velocity'" class="k-velocity">
        <div class="k-section-title">
          Last {{ velocity.weeks }} weeks · daily net
          <span class="k-section-sub">
            <i class="k-swatch" style="background: #43a047;" /> closing &gt; creating ·
            <i class="k-swatch" style="background: #d32f2f;" /> creating &gt; closing ·
            Σ created {{ fmtNum(velocity.totalCreated) }} · Σ closed {{ fmtNum(velocity.totalClosed) }} · peak swing ±{{ fmtNum(velocity.peakAbs) }}/day
          </span>
        </div>
        <div class="k-vel-cal">
          <div class="k-vel-corner" />
          <div v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d" class="k-vel-dow">{{ d }}</div>
          <template v-for="row in velocity.weekRows" :key="row.week">
            <div class="k-vel-weeknum">{{ row.num }}</div>
            <div
              v-for="c in row.cells" :key="c.iso"
              class="k-vel-cell"
              :class="{ 'k-clickable': c.inRange && (c.created || c.closed), 'k-vel-cell-today': c.isToday, 'k-vel-cell-outside': !c.inRange }"
              :style="{ background: c.bg }"
              @click="c.inRange && (c.created || c.closed) && filterByDay(c.iso)"
              :title="`${c.iso} · ${c.created} created · ${c.closed} closed${c.created || c.closed ? ' · net ' + (c.net >= 0 ? '+' : '') + c.net : ''}`"
            >
              <div class="k-vel-cell-date">
                <template v-if="c.monthShort">{{ c.monthShort }} {{ c.dom }}</template>
                <template v-else>{{ c.dom }}</template>
              </div>
              <div v-if="c.inRange && (c.created || c.closed)" class="k-vel-cell-net">
                {{ c.net > 0 ? '+' : '' }}{{ c.net }}
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- Activity heatmap (GitHub contribution-graph style; 3 rows stacked: created / closed / all) -->
      <section
        v-else-if="currentMode === 'heatmap' && heatmaps"
        class="k-heatmap-section k-heatmap-stack"
      >
        <div class="k-section-title">
          <v-icon icon="mdi-view-grid" />
          Activity heatmap · last {{ heatmapSummary?.days }} days
          <span v-if="heatmapSummary" class="k-section-sub">Σ {{ fmtNum(heatmapSummary.total) }} events · peak {{ fmtNum(heatmapSummary.peak) }}/day</span>
        </div>

        <div
          v-for="(row, idx) in heatmaps" :key="row.id"
          class="k-heatmap-row"
        >
          <div class="k-heatmap-row-title" :style="{ color: HEATMAP_CONFIGS[row.id].palette[4] }">
            {{ HEATMAP_CONFIGS[row.id].label }}
          </div>
          <svg
            :ref="idx === 0 ? setHeatmapSvgRef : undefined"
            class="k-heatmap-svg"
            :viewBox="row.data ? `0 0 ${row.data.vbW} ${row.data.vbH}` : '0 0 800 140'"
          >
            <template v-if="row.data">
              <!-- Month labels along the top (only on the first row to save space) -->
              <text
                v-if="idx === 0"
                v-for="m in row.data.monthLabels" :key="'hm-m-' + row.id + '-' + m.week"
                :x="row.data.padLeft + m.week * (row.data.cellSize + row.data.gap)"
                :y="row.data.padTop - 8"
                font-size="11" fill="rgba(200,200,200,0.7)" font-weight="600"
              >{{ m.label }}</text>

              <!-- Day-of-week labels on the left (Mon / Wed / Fri) -->
              <text
                v-for="lbl in HEATMAP_DAY_LABELS" :key="'hm-d-' + row.id + '-' + lbl"
                :x="row.data.padLeft - 8"
                :y="row.data.padTop + HEATMAP_DAY_IDX[lbl] * (row.data.cellSize + row.data.gap) + row.data.cellSize - 2"
                text-anchor="end" font-size="10" fill="rgba(200,200,200,0.6)"
              >{{ lbl }}</text>

              <!-- Cells. `<title>` skipped on empty cells to keep the DOM light — 365×3
                   rows + day padding can mean ~1100 cells per heatmap render. -->
              <rect
                v-for="c in row.data.cells" :key="`hm-${row.id}-${c.week}-${c.dow}`"
                :x="c.x" :y="c.y"
                :width="row.data.cellSize" :height="row.data.cellSize"
                rx="2" ry="2"
                :fill="c.inRange ? row.data.cfg.palette[c.level] : 'rgba(127,127,127,0.04)'"
                :class="{ 'k-hm-clickable': c.inRange && c.count > 0 }"
                @click="onHeatmapCellClick(row.id, c)"
              ><title v-if="c.count > 0">{{ c.label }}: {{ c.count }}</title></rect>
            </template>
          </svg>
        </div>

        <div class="k-heatmap-legend">
          <span>Less</span>
          <i v-for="i in [0, 1, 2, 3, 4]" :key="'hm-leg-' + i" class="k-hm-swatch" :style="{ background: HEATMAP_CONFIGS.heatmapAll.palette[i] }" />
          <span>More</span>
        </div>
      </section>

      <!-- Activity by label heatmap: rows = top-N labels, cols = days -->
      <section v-else-if="currentMode === 'heatmapByLabel'" class="k-heatmap-section">
        <div class="k-section-title">
          <v-icon icon="mdi-view-grid-outline" />
          Activity by label · top {{ heatmapByLabel?.topN || 10 }} · last {{ heatmapByLabel?.days || 365 }} days
          <span v-if="heatmapByLabel" class="k-section-sub">Σ {{ fmtNum(heatmapByLabel.total) }} events · peak {{ fmtNum(heatmapByLabel.max) }}/day</span>
        </div>
        <svg
          :ref="setHeatmapByLabelSvgRef"
          class="k-heatmap-svg"
          :viewBox="heatmapByLabel ? `0 0 ${heatmapByLabel.vbW} ${heatmapByLabel.vbH}` : '0 0 800 320'"
        >
          <template v-if="heatmapByLabel">
            <!-- Month labels along the top -->
            <text
              v-for="m in heatmapByLabel.monthLabels" :key="'hbl-m-' + m.week"
              :x="m.x" :y="heatmapByLabel.padTop - 8"
              font-size="11" fill="rgba(200,200,200,0.7)" font-weight="600"
            >{{ m.label }}</text>

            <!-- Each label = its own GitHub-style 7×N-week mini heatmap. Label
                 text is centered to the left of the block. Out-of-range cells
                 (padding to align Mon-start / today-end) get a faint background. -->
            <g v-for="row in heatmapByLabel.rows" :key="'hbl-r-' + row.label">
              <text
                :x="heatmapByLabel.padLeft - 8"
                :y="row.y + row.height / 2 + 4"
                text-anchor="end"
                font-size="12" font-weight="600"
                :fill="`hsl(${row.hue}, 70%, 75%)`"
              >{{ row.label }}</text>
              <rect
                v-for="(c, ci) in row.cells" :key="'hbl-c-' + ci"
                :x="c.x" :y="c.y"
                :width="c.w" :height="c.h"
                rx="2" ry="2"
                :fill="c.inRange ? row.palette[c.level] : 'rgba(127,127,127,0.04)'"
                :class="{ 'k-hm-clickable': c.inRange && c.count > 0 }"
                @click="onHeatmapByLabelCellClick(row.label, c)"
              ><title v-if="c.count > 0">{{ row.label }}: {{ c.count }} events</title></rect>
            </g>
          </template>
        </svg>
        <div v-if="heatmapByLabel" class="k-heatmap-legend">
          <span>Less</span>
          <i v-for="i in [0, 1, 2, 3, 4]" :key="'hbl-leg-' + i" class="k-hm-swatch" :style="{ background: HEATMAP_BY_LABEL_LEGEND[i] }" />
          <span>More</span>
          <span style="opacity: 0.6; margin-left: 12px;">· each row tinted by label hash</span>
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

      <!-- Combined breakdown: priority / status / type stacked into one screen. -->
      <section v-else-if="currentMode === 'breakdown'" class="k-breakdown">
        <!-- Priority -->
        <div class="k-breakdown-block">
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
        </div>

        <!-- Status (with avg-idle column to surface review/queue bottlenecks) -->
        <div class="k-breakdown-block">
          <div class="k-section-title">
            Open by status
            <span class="k-section-sub">avg idle = days since last update</span>
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
        </div>

        <!-- Type -->
        <div class="k-breakdown-block">
          <div class="k-section-title">
            Open by Type
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
        </div>
      </section>

      <!-- Hot labels (recent activity window) — bar split by priority bucket so
           the room sees not just which areas are hot but how critical they are. -->
      <section v-else-if="currentMode === 'hotLabels'" class="k-priority">
        <div class="k-section-title">
          Hot labels · last {{ hotLabels.windowLabel }}
          <span class="k-section-sub">{{ hotLabels.activeTickets }} active ticket{{ hotLabels.activeTickets === 1 ? '' : 's' }} · stacked by priority</span>
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
            <div class="k-bar-track k-bar-track-stacked" :style="{ width: (row.count / hotLabelsMax * 100) + '%' }">
              <template v-for="b in PRIORITY_BUCKETS" :key="b">
                <div
                  v-if="row[b]"
                  class="k-bar-seg"
                  :style="{ flexGrow: row[b], background: PRIORITY_BUCKET_COLOR[b] }"
                  :title="`${row[b]} ${PRIORITY_BUCKET_LABEL[b]}`"
                />
              </template>
            </div>
            <div class="k-bar-count">{{ fmtNum(row.count) }}</div>
            <div class="k-bar-side k-bar-pct">{{ pctOf(row.count, hotLabels.activeTickets) }}%</div>
          </div>
        </div>
        <div v-if="hotLabelsActiveBuckets.length" class="k-legend k-workload-legend">
          <span v-for="b in hotLabelsActiveBuckets" :key="b">
            <i class="k-swatch" :style="{ background: PRIORITY_BUCKET_COLOR[b] }" />
            {{ PRIORITY_BUCKET_LABEL[b] }}
          </span>
        </div>
      </section>

      <!-- Milestone progress — one card per milestone with stacked bar (closed
           green / open grey), big % badge, and chip-row showing due context,
           ETA from 14d velocity, and scope-creep when adds outpace closures. -->
      <section v-else-if="currentMode === 'milestones'" class="k-milestones">
        <div class="k-section-title">Milestone progress · active milestones</div>
        <div v-if="!milestonesData.length" class="k-empty">No active milestones with tickets.</div>
        <div v-else class="k-ms-list">
          <div
            v-for="m in milestonesData" :key="m.title"
            class="k-ms-row k-clickable"
            :class="{ 'k-ms-target-row': m.isTarget, 'k-ms-complete': m.complete }"
            @click="filterByMilestone(m.title)"
            :title="`Filter graph by milestone: ${m.title}`"
          >
            <div class="k-ms-head">
              <div class="k-ms-title">
                <v-icon v-if="m.isTarget" icon="mdi-flag" size="small" />
                <v-icon v-else-if="m.complete" icon="mdi-check-decagram" size="small" style="color: #66bb6a" />
                <span>{{ m.title }}</span>
              </div>
              <div class="k-ms-counts">
                <span class="k-ms-closed-n">{{ fmtNum(m.closed) }}</span>
                <span class="k-ms-divider"> / </span>
                <span class="k-ms-total-n">{{ fmtNum(m.total) }}</span>
                <span v-if="m.open" class="k-ms-open-n"> · {{ fmtNum(m.open) }} open</span>
              </div>
              <div class="k-ms-pct" :class="m.pct >= 80 ? 'k-ms-pct-good' : m.pct >= 50 ? 'k-ms-pct-warn' : 'k-ms-pct-low'">{{ m.pct }}%</div>
            </div>
            <div class="k-ms-bar">
              <div v-if="m.closed" class="k-ms-seg k-ms-seg-closed" :style="{ flexGrow: m.closed }" />
              <div v-if="m.open"   class="k-ms-seg k-ms-seg-open"   :style="{ flexGrow: m.open }" />
            </div>
            <div class="k-ms-chips">
              <span class="k-ms-chip" :class="m.dueClass">
                <v-icon icon="mdi-calendar" size="x-small" />
                {{ m.dueChip }}<template v-if="m.due"> · {{ m.due }}</template>
              </span>
              <span v-if="m.etaChip" class="k-ms-chip" :class="m.etaClass">
                <v-icon :icon="m.etaIcon" size="x-small" />
                {{ m.etaChip }}
              </span>
              <span v-if="m.scopeChip" class="k-ms-chip" :class="m.scopeClass">
                <v-icon icon="mdi-plus-circle-outline" size="x-small" />
                {{ m.scopeChip }}
              </span>
              <span v-if="m.closedRecent" class="k-ms-chip k-ms-velocity">
                <v-icon icon="mdi-flash" size="x-small" />
                {{ m.closedRecent }} closed · 14d
              </span>
            </div>
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
        <TransitionGroup v-else tag="ul" name="k-feed-anim" class="k-feed">
          <li
            v-for="e in activityFeed"
            :key="`${e.kind}-${e.iid}-${e.ts}`"
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
        </TransitionGroup>
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
        <TransitionGroup v-else tag="ul" name="k-feed-anim" class="k-feed">
          <li
            v-for="e in closedRecently.list"
            :key="`closed-${e.iid}-${e.ts}`"
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
        </TransitionGroup>
      </section>

      <!-- Leaderboard: multi-category podiums (closed / opened / active7d /
           top discussion / workload). Each row is clickable to filter the
           graph by that person. -->
      <section v-else-if="currentMode === 'leaderboard'" class="k-leaderboard">
        <div class="k-section-title k-leaderboard-title">
          <v-icon icon="mdi-trophy" />
          Leaderboard
          <span class="k-section-sub">click any row to filter graph by that person</span>
        </div>
        <div v-if="!leaderboardHasData" class="k-empty">
          <v-icon icon="mdi-trophy-outline" size="48" />
          <div>No activity yet — leaderboards populate once tickets are created or closed.</div>
        </div>
        <template v-else>
          <div v-if="leaderboardMVP" class="k-lb-mvp">
            <v-icon icon="mdi-crown" class="k-lb-mvp-crown" />
            <div class="k-lb-mvp-text">
              <div class="k-lb-mvp-label">Most active today</div>
              <div class="k-lb-mvp-name">
                <span class="k-feed-avatar k-lb-mvp-avatar" :style="{ background: avatarColor(leaderboardMVP.name) }">{{ initialsOf(leaderboardMVP.name) }}</span>
                <span class="k-lb-mvp-name-text">{{ leaderboardMVP.name }}</span>
              </div>
            </div>
            <div class="k-lb-mvp-pills">
              <span class="k-lb-mvp-pill"><strong>{{ fmtNum(leaderboardMVP.closedToday) }}</strong> closed</span>
              <span class="k-lb-mvp-pill"><strong>{{ fmtNum(leaderboardMVP.openedToday) }}</strong> opened</span>
              <span class="k-lb-mvp-pill"><strong>{{ fmtNum(leaderboardMVP.workload) }}</strong> active</span>
            </div>
          </div>
          <div class="k-lb-grid">
            <div
              v-for="cat in leaderboardCategories" :key="cat.id"
              class="k-lb-card"
              :style="{ '--lb-accent': cat.accent }"
            >
              <div class="k-lb-card-title">
                <v-icon :icon="cat.icon" />
                <span>{{ cat.label }}</span>
              </div>
              <div v-if="!cat.list.length" class="k-lb-card-empty">No data yet.</div>
              <ul v-else class="k-lb-card-list">
                <li
                  v-for="r in cat.list" :key="r.name"
                  class="k-clickable"
                  :class="r.medal ? `k-lb-medal-${r.medal}` : ''"
                  @click="filterByAssignee(r.name)"
                  :title="`Filter graph by ${r.name}`"
                >
                  <span class="k-lb-rank-mini">
                    <v-icon v-if="r.medal" icon="mdi-medal" class="k-lb-medal-icon" />
                    <template v-else>{{ r.rank }}</template>
                  </span>
                  <span class="k-feed-avatar k-lb-avatar" :style="{ background: avatarColor(r.name) }">{{ initialsOf(r.name) }}</span>
                  <span class="k-lb-name-text" :title="r.name">{{ r.name }}</span>
                  <span class="k-lb-card-num">{{ fmtNum(r[cat.field]) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </template>
      </section>

      <!-- Ticket health: problem categories + worst-offender list -->
      <section v-else-if="currentMode === 'risks'" class="k-health">
        <div class="k-health-grid">
          <button type="button" class="k-health-card k-clickable" @click="filterOverdue" title="Filter graph to overdue tickets">
            <v-icon :icon="PROBLEM_ICONS.overdue" class="k-health-icon" :style="{ color: PROBLEM_COLORS.overdue }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.overdue) }}</div>
            <div class="k-health-lbl">Overdue</div>
          </button>
          <div class="k-health-card">
            <v-icon :icon="PROBLEM_ICONS.stale" class="k-health-icon" :style="{ color: PROBLEM_COLORS.stale }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.stale) }}</div>
            <div class="k-health-lbl">Stale &gt; {{ risks.staleThreshold }}d</div>
          </div>
          <button type="button" class="k-health-card k-clickable" @click="filterUnassigned" title="Filter graph to unassigned open tickets">
            <v-icon :icon="PROBLEM_ICONS.unassigned" class="k-health-icon" :style="{ color: PROBLEM_COLORS.unassigned }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.unassigned) }}</div>
            <div class="k-health-lbl">Unassigned</div>
          </button>
          <div class="k-health-card">
            <v-icon :icon="PROBLEM_ICONS.noPriority" class="k-health-icon" :style="{ color: PROBLEM_COLORS.noPriority }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.noPriority) }}</div>
            <div class="k-health-lbl">No priority</div>
          </div>
          <button type="button" class="k-health-card k-clickable" @click="filterNoDueDate" title="Filter graph to open tickets with no due date">
            <v-icon :icon="PROBLEM_ICONS.noDueDate" class="k-health-icon" :style="{ color: PROBLEM_COLORS.noDueDate }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.noDueDate) }}</div>
            <div class="k-health-lbl">No due date</div>
          </button>
          <button type="button" class="k-health-card k-clickable" @click="filterBlocked" title="Filter graph to blocked tickets">
            <v-icon :icon="PROBLEM_ICONS.blocked" class="k-health-icon" :style="{ color: PROBLEM_COLORS.blocked }" />
            <div class="k-health-num">{{ fmtNum(risks.stats.blocked) }}</div>
            <div class="k-health-lbl">Blocked</div>
          </button>
        </div>

        <div class="k-section-title k-health-title">
          Most problematic · {{ risks.offenders.length }} ticket{{ risks.offenders.length === 1 ? '' : 's' }} with 2+ problems
        </div>
        <div v-if="!risks.offenders.length" class="k-empty">
          <v-icon icon="mdi-shield-check-outline" size="48" />
          <div>No tickets with multiple problems — health is good.</div>
        </div>
        <ul v-else class="k-target-feed k-health-feed">
          <li
            v-for="(t, i) in risks.offenders" :key="i"
            :class="{ 'k-clickable': !!t.url }"
            @click="openIssue(t.url)"
            :title="t.url ? 'Open in GitLab' : ''"
          >
            <span class="k-target-pri">{{ t.priority || '—' }}</span>
            <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
            <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
            <span class="k-health-tags">
              <span
                v-for="(p, pi) in t.problems" :key="pi"
                class="k-health-tag"
                :style="{ background: `${PROBLEM_COLORS[p.kind]}22`, color: PROBLEM_COLORS[p.kind] }"
              >{{ p.detail }}</span>
            </span>
            <span class="k-feed-who" :title="t.assignees && t.assignees.length ? t.assignees[0] : ''">
              <template v-if="t.assignees && t.assignees.length">
                <span class="k-feed-avatar" :style="{ background: avatarColor(t.assignees[0]) }">{{ initialsOf(t.assignees[0]) }}</span>
              </template>
            </span>
          </li>
        </ul>
      </section>

      <!-- Broken tickets: workflow leaks (orphaned milestones, no type, ghost
           WIP, truly forgotten tickets). Cards + worst-offender list, same
           shape as Ticket health. -->
      <section v-else-if="currentMode === 'broken'" class="k-health">
        <div class="k-health-grid">
          <button v-if="!brokenHideEmpty || broken.stats.lostMilestone" type="button" class="k-health-card k-clickable" @click="filterLostMilestone" :title="brokenCardTitle('lostMilestone', 'Filter graph to tickets in closed/expired milestones')">
            <v-icon :icon="BROKEN_ICONS.lostMilestone" class="k-health-icon" :style="{ color: BROKEN_COLORS.lostMilestone }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.lostMilestone) }}</div>
            <div class="k-health-lbl">Lost milestone</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.statusMismatch" type="button" class="k-health-card k-clickable" @click="filterStatusMismatch" :title="brokenCardTitle('statusMismatch', `Filter graph to open tickets whose status says Done / Won't do / Duplicate / etc.`)">
            <v-icon :icon="BROKEN_ICONS.statusMismatch" class="k-health-icon" :style="{ color: BROKEN_COLORS.statusMismatch }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.statusMismatch) }}</div>
            <div class="k-health-lbl">Status mismatch</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.criticalUnowned" type="button" class="k-health-card k-clickable" @click="filterCriticalUnowned" :title="brokenCardTitle('criticalUnowned', 'Filter graph to Blocking/Critical priority tickets with no assignee')">
            <v-icon :icon="BROKEN_ICONS.criticalUnowned" class="k-health-icon" :style="{ color: BROKEN_COLORS.criticalUnowned }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.criticalUnowned) }}</div>
            <div class="k-health-lbl">Critical · no owner</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.deactivatedAssignee" type="button" class="k-health-card k-clickable" @click="filterDeactivatedAssignee" :title="brokenCardTitle('deactivatedAssignee', 'Filter graph to tickets assigned to deactivated / blocked accounts')">
            <v-icon :icon="BROKEN_ICONS.deactivatedAssignee" class="k-health-icon" :style="{ color: BROKEN_COLORS.deactivatedAssignee }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.deactivatedAssignee) }}</div>
            <div class="k-health-lbl">Deactivated owner</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.forgotten" type="button" class="k-health-card k-clickable" @click="filterForgotten" :title="brokenCardTitle('forgotten', 'Filter graph to tickets with no priority AND no assignee')">
            <v-icon :icon="BROKEN_ICONS.forgotten" class="k-health-icon" :style="{ color: BROKEN_COLORS.forgotten }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.forgotten) }}</div>
            <div class="k-health-lbl">Forgotten</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.wipUnassigned" type="button" class="k-health-card k-clickable" @click="filterUnassigned" :title="brokenCardTitle('wipUnassigned', 'Filter graph to unassigned open tickets')">
            <v-icon :icon="BROKEN_ICONS.wipUnassigned" class="k-health-icon" :style="{ color: BROKEN_COLORS.wipUnassigned }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.wipUnassigned) }}</div>
            <div class="k-health-lbl">WIP · no owner</div>
          </button>
          <!-- Evergreen has no clean predicate in the main view, so clicking opens the
               list view filtered to the exact iids via `selectedIids`. -->
          <button v-if="!brokenHideEmpty || broken.stats.evergreen" type="button" class="k-health-card k-clickable" @click="filterEvergreen" :title="brokenCardTitle('evergreen', 'Open the list view filtered to evergreen tickets (carried across multiple milestones)')">
            <v-icon :icon="BROKEN_ICONS.evergreen" class="k-health-icon" :style="{ color: BROKEN_COLORS.evergreen }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.evergreen) }}</div>
            <div class="k-health-lbl">Evergreen</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.noMilestone" type="button" class="k-health-card k-clickable" @click="filterNoMilestone" :title="brokenCardTitle('noMilestone', 'Filter graph to open tickets with no milestone')">
            <v-icon :icon="BROKEN_ICONS.noMilestone" class="k-health-icon" :style="{ color: BROKEN_COLORS.noMilestone }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.noMilestone) }}</div>
            <div class="k-health-lbl">No milestone</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.zombie" type="button" class="k-health-card k-clickable" @click="filterZombie" :title="brokenCardTitle('zombie', `Filter graph to tickets not updated in >${90}d (default zombie idle threshold)`)">
            <v-icon :icon="BROKEN_ICONS.zombie" class="k-health-icon" :style="{ color: BROKEN_COLORS.zombie }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.zombie) }}</div>
            <div class="k-health-lbl">Zombie</div>
          </button>
          <button v-if="!brokenHideEmpty || broken.stats.noType" type="button" class="k-health-card k-clickable" @click="filterNoType" :title="brokenCardTitle('noType', 'Filter graph to tickets without a Type:: label')">
            <v-icon :icon="BROKEN_ICONS.noType" class="k-health-icon" :style="{ color: BROKEN_COLORS.noType }" />
            <div class="k-health-num">{{ fmtNum(broken.stats.noType) }}</div>
            <div class="k-health-lbl">No type</div>
          </button>
          <div v-if="brokenHideEmpty && brokenAllEmpty" class="k-empty k-empty-inline">
            <v-icon icon="mdi-shield-check-outline" size="36" />
            <div>All categories clean.</div>
          </div>
        </div>

        <div class="k-section-title k-health-title">
          Most broken · {{ broken.offenders.length }} ticket{{ broken.offenders.length === 1 ? '' : 's' }} with workflow leaks
        </div>
        <div v-if="!broken.offenders.length" class="k-empty">
          <v-icon icon="mdi-shield-check-outline" size="48" />
          <div>Nothing broken — workflow is clean.</div>
        </div>
        <ul v-else class="k-target-feed k-health-feed">
          <li
            v-for="(t, i) in broken.offenders" :key="i"
            :class="{ 'k-clickable': !!t.url }"
            @click="openIssue(t.url)"
            :title="t.url ? 'Open in GitLab' : ''"
          >
            <span class="k-target-pri">{{ t.priority || '—' }}</span>
            <span class="k-feed-iid">{{ t.iid ? '#' + t.iid : '' }}</span>
            <span class="k-feed-title" :title="t.title">{{ t.title }}</span>
            <span class="k-health-tags">
              <span
                v-for="(p, pi) in t.problems" :key="pi"
                class="k-health-tag"
                :style="{ background: `${BROKEN_COLORS[p.kind]}22`, color: BROKEN_COLORS[p.kind] }"
              >{{ p.detail }}</span>
            </span>
            <span class="k-feed-who" :title="t.assignees && t.assignees.length ? t.assignees[0] : ''">
              <template v-if="t.assignees && t.assignees.length">
                <span class="k-feed-avatar" :style="{ background: avatarColor(t.assignees[0]) }">{{ initialsOf(t.assignees[0]) }}</span>
              </template>
            </span>
          </li>
        </ul>
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
import { priorityBucket, PRIORITY_BUCKETS, PRIORITY_BUCKET_COLOR, PRIORITY_BUCKET_LABEL } from '../utils/priorityBucket'
import { currentStatusOfRaw } from '../composables/useGraphDerivedState'

const props = defineProps({
  nodes: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  lastUpdated: { type: Number, default: null }, // ms epoch
  error: { type: String, default: '' },        // last loader error (empty = healthy)
  onRefresh: { type: Function, default: null },
  mode: { type: String, default: '' },         // current mode id (driven by URL via parent)
  viewParam: { type: String, default: '' }     // 'paused=1/cycle=10/refresh=2'
})
const emit = defineEmits(['close', 'update:mode', 'update:viewParam', 'apply-filter', 'open-config'])

const { settings } = useSettingsStore()
const root = ref(null)

const ALL_MODES = [
  { id: 'target',         label: 'Target milestone' },
  { id: 'burndown',       label: 'Milestone burndown' },
  { id: 'blockers',       label: 'Blocked issues' },
  { id: 'wipStale',       label: 'Stale WIP' },
  { id: 'today',          label: "Today's pulse" },
  { id: 'velocity',       label: 'Velocity' },
  { id: 'heatmap',        label: 'Activity heatmap' },
  { id: 'heatmapByLabel', label: 'Activity by label' },
  { id: 'workload',   label: 'Workload by assignee' },
  { id: 'breakdown',  label: 'Open by priority / status / type' },
  { id: 'hotLabels',  label: 'Hot labels' },
  { id: 'milestones', label: 'Milestone progress' },
  { id: 'aging',      label: 'Aging buckets' },
  { id: 'activity',   label: 'Recent activity' },
  { id: 'closed',     label: 'Recently closed' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'risks',          label: 'Ticket health' },
  { id: 'broken',         label: 'Broken tickets' }
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

// Auto-pause when the user navigates manually. Someone at the wall who steps
// through with ‹ / › or clicks a dot doesn't want the timer yanking them back to
// the next cycled mode 8s later. We also briefly pulse the play/pause button via
// `pauseFlash` so they notice the cycle stopped.
const pauseFlash = ref(false)
let pauseFlashTimer = null
const userMoved = () => {
  if (cycleSec.value > 0 && !paused.value) {
    paused.value = true
    pauseFlash.value = true
    if (pauseFlashTimer) clearTimeout(pauseFlashTimer)
    pauseFlashTimer = setTimeout(() => { pauseFlash.value = false }, 1600)
  }
}
const togglePause = () => {
  paused.value = !paused.value
  pauseFlash.value = false
  if (pauseFlashTimer) { clearTimeout(pauseFlashTimer); pauseFlashTimer = null }
}
const setMode = (id) => { userMoved(); currentMode.value = id }
const indexOfCurrent = () => activeModes.value.findIndex(m => m.id === currentMode.value)
// `byUser` defaults to true so all template `@click="nextMode"` bindings (which
// pass an Event arg, truthy) and hotkey calls auto-pause. The cycle timer is the
// one place that calls `nextMode(false)` to advance without pausing itself.
const nextMode = (byUser = true) => {
  if (byUser) userMoved()
  const list = activeModes.value
  if (!list.length) return
  const i = indexOfCurrent()
  currentMode.value = list[(i + 1 + list.length) % list.length].id
}
const prevMode = (byUser = true) => {
  if (byUser) userMoved()
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
let safetyReloadTimer = null
// Belt-and-suspenders: if the auto-update channel is broken (DNS issue, proxy
// intercepting current_version.json, server down) the wall could sit on a stale
// build indefinitely. Once a day, during the 3am hour, force a hard reload — but
// ONLY when the version check has been failing (no successful poll in the last
// hour). Healthy kiosks never see this. Date stamp persisted in localStorage so
// the post-reload run doesn't loop.
const SAFETY_RELOAD_KEY = 'glv_kiosk_last_safety_reload'
const checkSafetyReload = () => {
  const now = new Date()
  if (now.getHours() !== 3) return
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  let last = ''
  try { last = localStorage.getItem(SAFETY_RELOAD_KEY) || '' } catch {}
  if (last === today) return
  const lastOk = Number(window.__glvLastVersionCheckOk) || 0
  if (lastOk && (Date.now() - lastOk) < 60 * 60 * 1000) return
  try { localStorage.setItem(SAFETY_RELOAD_KEY, today) } catch {}
  location.reload()
}
const startCycle = () => {
  if (cycleTimer) clearInterval(cycleTimer)
  if (!cycleSec.value) return
  cycleTimer = setInterval(() => { if (!paused.value) nextMode(false) }, cycleSec.value * 1000)
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

// Defined here (not later) so the data-age / failure computeds below can call it
// without hitting a TDZ error when the template renders during setup.
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

// Surface refresh failures (offline / token expiry / GitLab down) on the wall instead
// of letting them fail silently. Stamp the first failure since the last success; clear
// it on the next successful sync (lastUpdated bumps).
const lastFailedAt = ref(null)
watch(() => props.error, (e) => {
  if (e && !props.loading && !lastFailedAt.value) lastFailedAt.value = Date.now()
})
watch(() => props.lastUpdated, () => { lastFailedAt.value = null })
const dataAgeLabel = computed(() => props.lastUpdated ? relTime(props.lastUpdated) : 'never')
const failureLabel = computed(() => lastFailedAt.value ? relTime(lastFailedAt.value) : '')
const failureTitle = computed(() => {
  if (!lastFailedAt.value) return ''
  const since = new Date(lastFailedAt.value).toLocaleString()
  return `Refresh failing since ${since}\n${props.error || 'unknown error'}`
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
  if (e.key === ' ')              { e.preventDefault(); togglePause(); return }
  if (toggleKioskCombo.value && getEventCombo(e) === toggleKioskCombo.value) {
    e.preventDefault(); emit('close')
  }
}

// Track each per-mode SVG's actual pixel size — keeps viewBox 1:1 with screen so text
// and strokes never get squished. Re-attaches when the relevant mode becomes current.
let burndownRO = null
let heatmapRO = null
let heatmapByLabelRO = null
const observeSize = (existing, el, sizeRef) => {
  if (existing) existing.disconnect()
  if (!el || typeof ResizeObserver === 'undefined') return null
  const update = () => {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) sizeRef.value = { w: Math.round(r.width), h: Math.round(r.height) }
  }
  update()
  const ro = new ResizeObserver(update)
  ro.observe(el)
  return ro
}
// SVG refs + size refs need to be declared here so the watcher below can reference
// them — the actual mode sections later in the file just use these same refs.
const burndownSvgRef = ref(null)
const burndownSize = ref(null)  // null until ResizeObserver has measured the SVG
const heatmapSvgRef = ref(null)
const heatmapSize = ref(null)
const heatmapByLabelSvgRef = ref(null)
const heatmapByLabelSize = ref(null)
// Function refs used inside v-for'd <svg>s. Only set the ref — observer attachment is
// handled by the watcher below. Doing extra work here re-runs on every component
// update and trips a ResizeObserver loop (subpixel rounding feedback).
const setHeatmapSvgRef        = (el) => { heatmapSvgRef.value = el }
const setHeatmapByLabelSvgRef = (el) => { heatmapByLabelSvgRef.value = el }

// Brief "data just refreshed" pulse — adds .is-refreshed to the kiosk root for
// 800ms whenever props.lastUpdated changes, which CSS keyframes pick up to flash
// stat numbers / progress bar. Subtle, but it tells the room "yes the wall is live".
const justRefreshed = ref(false)
let justRefreshedTimer = null
watch(() => props.lastUpdated, (newVal, oldVal) => {
  if (!newVal || newVal === oldVal) return
  justRefreshed.value = true
  if (justRefreshedTimer) clearTimeout(justRefreshedTimer)
  justRefreshedTimer = setTimeout(() => { justRefreshed.value = false }, 800)
})

// --- Burn-in protection -----------------------------------------------------
// Pixel shift: every ~60s, nudge the whole kiosk by ±3px on each axis. Slow
// CSS transition makes the shift imperceptible to viewers but stops any
// single pixel from being the same colour for hours on end (OLED retention).
const burnInCfg = computed(() => settings.uiState.kiosk?.burnIn || {})
const pixelShift = ref({ x: 0, y: 0 })
let pixelShiftTimer = null
const tickPixelShift = () => {
  if (!burnInCfg.value.pixelShift) { pixelShift.value = { x: 0, y: 0 }; return }
  const r = 3
  pixelShift.value = {
    x: Math.round((Math.random() * 2 - 1) * r),
    y: Math.round((Math.random() * 2 - 1) * r)
  }
}
// Off-hours dim: outside the configured working hours window, drop the screen
// to a low `brightness()` value. `start === end` = 24h (never dims). `start >
// end` wraps midnight (e.g., a 22→6 night shift). `dim: 0` = fully black,
// `dim: 1` = no dim at all.
const isOffHours = computed(() => {
  const oh = burnInCfg.value.offHours
  if (!oh || !oh.enabled) return false
  const start = ((Number(oh.start) || 0) % 24 + 24) % 24
  const end   = ((Number(oh.end)   || 0) % 24 + 24) % 24
  if (start === end) return false
  const hour = new Date(nowTick.value).getHours()
  const inWork = start < end ? (hour >= start && hour < end) : (hour >= start || hour < end)
  return !inWork
})
const offHoursDim = computed(() => {
  const v = Number(burnInCfg.value.offHours?.dim)
  if (!Number.isFinite(v)) return 0.05
  return Math.max(0, Math.min(1, v))
})

const watchModeSvgs = () => {
  burndownRO       = observeSize(burndownRO,       burndownSvgRef.value,       burndownSize)
  heatmapRO        = observeSize(heatmapRO,        heatmapSvgRef.value,        heatmapSize)
  heatmapByLabelRO = observeSize(heatmapByLabelRO, heatmapByLabelSvgRef.value, heatmapByLabelSize)
}
watch(
  () => [currentMode.value, burndownSvgRef.value, heatmapSvgRef.value, heatmapByLabelSvgRef.value],
  () => nextTick(watchModeSvgs)
)

onMounted(() => {
  if (props.error && !props.loading) lastFailedAt.value = Date.now()
  startCycle()
  startRefresh()
  safetyReloadTimer = setInterval(checkSafetyReload, 60 * 1000)
  nowTickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
  pixelShiftTimer = setInterval(tickPixelShift, 60000)
  tickPixelShift()
  window.addEventListener('keydown', handleWindowKey)
  if (root.value && typeof root.value.focus === 'function') root.value.focus()
  nextTick(watchModeSvgs)
})
onUnmounted(() => {
  if (cycleTimer) clearInterval(cycleTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (safetyReloadTimer) clearInterval(safetyReloadTimer)
  if (nowTickTimer) clearInterval(nowTickTimer)
  window.removeEventListener('keydown', handleWindowKey)
  if (burndownRO)       { burndownRO.disconnect();       burndownRO = null }
  if (heatmapRO)        { heatmapRO.disconnect();        heatmapRO = null }
  if (heatmapByLabelRO) { heatmapByLabelRO.disconnect(); heatmapByLabelRO = null }
  if (justRefreshedTimer) { clearTimeout(justRefreshedTimer); justRefreshedTimer = null }
  if (pixelShiftTimer)    { clearInterval(pixelShiftTimer);   pixelShiftTimer = null }
  if (pauseFlashTimer)    { clearTimeout(pauseFlashTimer);    pauseFlashTimer = null }
})

// Priority buckets — declared up here because the global `priorityFilter` setting
// classifies every ticket into one of them before any mode-specific computation.
// priorityBucket + colour/label maps live in src/utils/priorityBucket.js so the
// list view and any future surface can use the same canonical bucketing.

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
// burndown, milestones progress, today's pulse, every count list, every feed) reflects
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
// ISO week number — used to label the week-of-year column.
const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
// Velocity = month-view calendar over the last N weeks (default 8 ≈ 2 months).
// Rows = ISO weeks, columns = Mon..Sun. Each cell shows the date number plus
// the daily NET (closed − created): green when more closed than created
// (shipping), red when more created than closed (drowning), grey when balanced
// or quiet. Intensity scales with |net| against the window's peak swing.
const velocity = computed(() => {
  const weeks = Math.min(12, Math.max(1, Number(velocityCfg.value.weeks) || 8))
  const dayMs = 24 * 60 * 60 * 1000
  const today0 = startOfToday()
  const dowMon = (ts) => (new Date(ts).getDay() + 6) % 7
  // Last `weeks` weeks ending with the week that contains today. Start = Mon of
  // (weeks-1) weeks ago.
  const alignedStart = today0 - dowMon(today0) * dayMs - (weeks - 1) * 7 * dayMs
  const totalDays = weeks * 7
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)
  // Pre-build the grid: cells[d] for d in 0..totalDays. Each cell carries its
  // week/dow indices, day-of-month, and first-of-month marker so the template
  // can render the date label without recomputing.
  const cells = Array.from({ length: totalDays }, (_, d) => {
    const ts = alignedStart + d * dayMs
    const date = new Date(ts)
    const dom = date.getDate()
    return {
      ts, iso: isoDay(ts), week: Math.floor(d / 7), dow: d % 7,
      inRange: ts <= today0,
      isToday: ts === today0,
      created: 0, closed: 0,
      dom,
      monthShort: dom === 1 ? date.toLocaleDateString(undefined, { month: 'short' }) : null
    }
  })
  for (const n of items.value) {
    const raw = n._raw || {}
    const c = safeDate(raw.created_at); if (c) {
      const d = Math.floor((c - alignedStart) / dayMs)
      if (d >= 0 && d < totalDays) cells[d].created++
    }
    const cl = safeDate(raw.closed_at); if (cl) {
      const d = Math.floor((cl - alignedStart) / dayMs)
      if (d >= 0 && d < totalDays) cells[d].closed++
    }
  }
  // Net daily change + intensity scaling against the window's peak |net|.
  let peakAbs = 1
  for (const c of cells) {
    c.net = c.closed - c.created
    const abs = Math.abs(c.net)
    if (abs > peakAbs) peakAbs = abs
  }
  const t1 = Math.max(1, Math.round(peakAbs * 0.10))
  const t2 = Math.max(t1 + 1, Math.round(peakAbs * 0.25))
  const t3 = Math.max(t2 + 1, Math.round(peakAbs * 0.50))
  const paletteCreated = HEATMAP_CONFIGS.heatmapCreated.palette
  const paletteClosed  = HEATMAP_CONFIGS.heatmapClosed.palette
  for (const c of cells) {
    const abs = Math.abs(c.net)
    let level = 0
    if (abs > 0) {
      if (abs <= t1) level = 1
      else if (abs <= t2) level = 2
      else if (abs <= t3) level = 3
      else level = 4
    }
    c.level = level
    if (!c.inRange || (c.created === 0 && c.closed === 0)) {
      c.bg = 'rgba(127,127,127,0.04)'
    } else if (c.net > 0) {
      c.bg = paletteClosed[level]
    } else if (c.net < 0) {
      c.bg = paletteCreated[level]
    } else {
      // Equal volume of creates and closes — a balanced day, neutral grey.
      c.bg = 'rgba(127,127,127,0.22)'
    }
  }
  // Group into week rows for the calendar layout: { num: ISO-week, cells: [Mon..Sun] }.
  const weekRows = []
  for (let w = 0; w < weeks; w++) {
    const monTs = alignedStart + w * 7 * dayMs
    weekRows.push({
      week: w,
      num: isoWeek(new Date(monTs)),
      cells: cells.slice(w * 7, w * 7 + 7)
    })
  }
  return {
    cells, weeks, weekRows, peakAbs,
    totalCreated: cells.reduce((s, c) => s + c.created, 0),
    totalClosed:  cells.reduce((s, c) => s + c.closed,  0)
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
// Combined breakdown config — shared by the priority / status / type sub-blocks
// of the `breakdown` mode (showNo* toggles whether the "(No X)" bucket appears).
const breakdownCfg = computed(() => settings.uiState.kiosk?.modeConfig?.breakdown || {})
const priorityData = computed(() => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const groups = new Map()
  const showNone = breakdownCfg.value.showNoPriority !== false
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
const statusData = computed(() => {
  const showNone = !!breakdownCfg.value.showNoStatus
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
const typeData = computed(() => {
  const showNone = !!breakdownCfg.value.showNoType
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
  const hours = Math.max(1, Number(hotLabelsCfg.value.hours) || 168)
  const topN = Math.max(3, Number(hotLabelsCfg.value.topN) || 15)
  const includeScoped = !!hotLabelsCfg.value.includeScoped
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  // labelStats: { label, count, blocking, high, medium, low, other, none } so the bar can
  // stack by priority bucket — same data shape (and same colours) as the Workload screen.
  const labelStats = new Map()
  let activeTickets = 0
  for (const n of items.value) {
    const raw = n._raw || {}
    const c = safeDate(raw.created_at) || 0
    const u = safeDate(raw.updated_at) || 0
    const cl = safeDate(raw.closed_at) || 0
    if (Math.max(c, u, cl) < cutoff) continue
    activeTickets++
    const bucket = priorityBucket(getScopedLabelValue(raw.labels, 'Priority'))
    const labels = Array.isArray(raw.labels) ? raw.labels : []
    for (const l of labels) {
      if (typeof l !== 'string' || !l) continue
      if (!includeScoped && isScopedLabel(l)) continue
      let s = labelStats.get(l)
      if (!s) { s = { label: l, count: 0 }; for (const b of PRIORITY_BUCKETS) s[b] = 0; labelStats.set(l, s) }
      s.count++
      s[bucket]++
    }
  }
  // Pretty-print the window: "7d" / "3d 12h" / "12h" so larger windows are readable
  // (default 168h = 7d reads better than "168h").
  const windowLabel = hours >= 24
    ? (hours % 24 === 0 ? `${hours / 24}d` : `${Math.floor(hours / 24)}d ${hours % 24}h`)
    : `${hours}h`
  return {
    list: [...labelStats.values()].sort((a, b) => b.count - a.count).slice(0, topN),
    activeTickets,
    hours, windowLabel
  }
})
const hotLabelsMax = computed(() => Math.max(1, ...hotLabels.value.list.map(r => r.count)))
// Buckets actually present across visible rows — drives the legend (mirror of workloadActiveBuckets).
const hotLabelsActiveBuckets = computed(() => {
  const present = new Set()
  for (const row of hotLabels.value.list) for (const b of PRIORITY_BUCKETS) if (row[b]) present.add(b)
  return PRIORITY_BUCKETS.filter(b => present.has(b))
})

// Pinned "target" milestone (e.g. the version we're driving toward).
const targetMilestone = computed(() => String(settings.uiState.kiosk?.targetMilestone || '').trim())

// Milestones — completion % per active milestone (open + closed counted)
const milestonesCfg = computed(() => settings.uiState.kiosk?.modeConfig?.milestones || {})
const milestonesData = computed(() => {
  const topN = Math.max(1, Number(milestonesCfg.value.topN) || 8)
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const recentDays = 14
  const recentCutoff = now - recentDays * day
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
    if (!ms.has(key)) {
      ms.set(key, {
        title: key, due: m.due_date || null,
        open: 0, closed: 0,
        closedRecent: 0, addedRecent: 0,
        isTarget
      })
    }
    const bucket = ms.get(key)
    if (isOpen(n)) bucket.open++; else bucket.closed++
    const closedAt = safeDate(raw.closed_at)
    if (closedAt && closedAt >= recentCutoff) bucket.closedRecent++
    const created = safeDate(raw.created_at)
    if (created && created >= recentCutoff) bucket.addedRecent++
  }
  const list = [...ms.values()].map(m => {
    const total = m.open + m.closed
    const pct = total ? Math.round((m.closed / total) * 100) : 0

    // Due chip — text + class capture both the message and its severity.
    let dueDays = null, dueChip = null, dueClass = 'k-ms-neutral'
    if (m.due) {
      const dueMs = new Date(m.due).getTime()
      dueDays = Math.round((dueMs - now) / day)
      if (dueDays > 0) {
        dueChip = `${dueDays}d to go`
        dueClass = dueDays <= 7 ? 'k-ms-soon' : (dueDays <= 30 ? 'k-ms-warn' : 'k-ms-neutral')
      } else if (dueDays === 0) {
        dueChip = 'Due today'; dueClass = 'k-ms-soon'
      } else {
        dueChip = `${-dueDays}d overdue`; dueClass = 'k-ms-late'
      }
    } else {
      dueChip = 'no deadline'
    }

    // ETA — closures-per-day from the 14d window projected against remaining open work.
    let etaChip = null, etaClass = 'k-ms-neutral', etaIcon = 'mdi-rocket-launch-outline'
    if (pct === 100 || m.open === 0) {
      etaChip = 'Complete'; etaClass = 'k-ms-done'; etaIcon = 'mdi-trophy'
    } else {
      const vel = m.closedRecent / recentDays
      if (vel > 0) {
        const daysToFinish = m.open / vel
        const etaMs = now + daysToFinish * day
        const dueMs = m.due ? new Date(m.due).getTime() : null
        if (!dueMs) {
          etaChip = `ETA ${Math.round(daysToFinish)}d`
        } else if (etaMs <= dueMs) {
          etaChip = 'On track'; etaClass = 'k-ms-on-track'; etaIcon = 'mdi-rocket-launch'
        } else if (etaMs <= dueMs + 14 * day) {
          etaChip = `${Math.round((etaMs - dueMs) / day)}d late`; etaClass = 'k-ms-warn'
          etaIcon = 'mdi-clock-alert-outline'
        } else {
          etaChip = `${Math.round((etaMs - dueMs) / day)}d late`; etaClass = 'k-ms-late'
          etaIcon = 'mdi-clock-alert'
        }
      } else if (m.addedRecent > 0) {
        etaChip = 'No closures yet'; etaClass = 'k-ms-warn'; etaIcon = 'mdi-clock-outline'
      } else {
        etaChip = 'Stalled'; etaClass = 'k-ms-late'; etaIcon = 'mdi-alert'
      }
    }

    // Scope-creep chip — only when added > closed in the window (otherwise the
    // milestone is shrinking and the chip would just be noise).
    let scopeChip = null, scopeClass = 'k-ms-neutral'
    if (m.addedRecent > 0 && m.addedRecent >= m.closedRecent) {
      scopeChip = `+${m.addedRecent} added · ${recentDays}d`
      scopeClass = m.addedRecent > m.closedRecent * 1.5 ? 'k-ms-late' : 'k-ms-warn'
    }

    return {
      ...m, total, pct, dueDays, dueChip, dueClass,
      etaChip, etaClass, etaIcon,
      scopeChip, scopeClass,
      complete: pct === 100 || m.open === 0
    }
  })
  // Target pinned first; then real milestones by due date ascending (closest
  // deadline first); milestones without a due date (TBD / Backlog / etc.) sink
  // to the bottom via the Infinity fallback. Total count is the final tiebreaker.
  list.sort((a, b) => {
    if (a.isTarget !== b.isTarget) return b.isTarget ? 1 : -1
    const aDue = a.due ? new Date(a.due).getTime() : Infinity
    const bDue = b.due ? new Date(b.due).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    return b.total - a.total
  })
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
  const day = 24 * 60 * 60 * 1000
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  let dueLabel = ''
  let dueClass = ''
  if (due) {
    const dueMs = new Date(due).getTime()
    const diff = Math.round((dueMs - today0) / day)
    if (diff > 0) { dueLabel = `${diff} day${diff === 1 ? '' : 's'} to go`; dueClass = diff <= 7 ? 'k-target-soon' : '' }
    else if (diff === 0) { dueLabel = 'Due today'; dueClass = 'k-target-soon' }
    else { dueLabel = `${-diff} day${diff === -1 ? '' : 's'} overdue`; dueClass = 'k-target-overdue' }
  }
  // Days since milestone start (start_date if set, else earliest ticket creation).
  // Shown alongside the countdown so the team sees how far into the milestone they are.
  let ageLabel = ''
  if (startMs && startMs <= today0) {
    const ageDays = Math.max(0, Math.round((today0 - startMs) / day))
    ageLabel = `${ageDays} day${ageDays === 1 ? '' : 's'} in`
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
    title, total, open, closed, pct, due, dueLabel, dueClass, ageLabel, state,
    startDate, startMs,
    openOriginal, openAdded, closedOriginal, closedAdded,
    openList: openList.slice(0, 12),
    // Saved for the burndown mode so it doesn't have to re-iterate every node.
    _ticketTimes: ticketTimes
  }
})

// "How fast are we burning down the target?" — projects an ETA from the last 14 days of
// closure / add rate. Also builds a per-day histogram of closes/adds so the ETA hover
// can show a sparkline of the trend the projection is built from.
const TARGET_LOOKBACK_DAYS = 14
const targetForecast = computed(() => {
  if (!targetData.value || !targetMilestone.value) return null
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  const startDay = today0 - (TARGET_LOOKBACK_DAYS - 1) * day
  const cutoff = now - TARGET_LOOKBACK_DAYS * day
  let closedRecent = 0, addedRecent = 0
  const dailyClosed = new Array(TARGET_LOOKBACK_DAYS).fill(0)
  const dailyAdded  = new Array(TARGET_LOOKBACK_DAYS).fill(0)
  for (const n of allItems.value) {
    const raw = n._raw || {}
    if (raw?.milestone?.title !== targetMilestone.value) continue
    const c = safeDate(raw.created_at)
    const cl = safeDate(raw.closed_at)
    if (c && c >= cutoff) {
      addedRecent++
      const bin = Math.floor((c - startDay) / day)
      if (bin >= 0 && bin < TARGET_LOOKBACK_DAYS) dailyAdded[bin]++
    }
    if (cl && cl >= cutoff) {
      closedRecent++
      const bin = Math.floor((cl - startDay) / day)
      if (bin >= 0 && bin < TARGET_LOOKBACK_DAYS) dailyClosed[bin]++
    }
  }
  const closedPerWeek = (closedRecent / TARGET_LOOKBACK_DAYS) * 7
  const addedPerWeek = (addedRecent / TARGET_LOOKBACK_DAYS) * 7
  const netPerWeek = closedPerWeek - addedPerWeek
  const open = targetData.value.open
  const round1 = (n) => Math.round(n * 10) / 10
  const dueMs = targetData.value.due ? new Date(targetData.value.due).getTime() : null
  const out = {
    lookbackDays: TARGET_LOOKBACK_DAYS,
    closedRecent, addedRecent,
    closedPerWeek: round1(closedPerWeek),
    addedPerWeek: round1(addedPerWeek),
    netPerWeek: round1(netPerWeek),
    open,
    dailyClosed, dailyAdded, dailyStartMs: startDay,
    dueMs, dueIso: targetData.value.due || null,
    todayMs: today0
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
  out.etaMs = etaMs
  out.eta = new Date(etaMs).toISOString().slice(0, 10)
  if (dueMs != null) {
    if (etaMs <= dueMs) {
      const slackDays = Math.max(0, Math.round((dueMs - etaMs) / day))
      out.status = 'on-track'
      out.slackDays = slackDays
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

// Geometry for the rich ETA hover. Pure derived state — daily bars (closed up, added
// down) and a today / due / ETA timeline. Kept here (not inline in the template) so
// the SVG markup stays readable.
const etaTipChart = computed(() => {
  const f = targetForecast.value
  if (!f || !Array.isArray(f.dailyClosed)) return null
  const n = f.dailyClosed.length
  const max = Math.max(1, ...f.dailyClosed, ...f.dailyAdded)
  const W = 360, H = 92, padL = 22, padR = 8, padT = 6, padB = 16
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const mid = padT + innerH / 2
  const colW = innerW / n
  const barW = Math.max(2, colW * 0.62)
  const half = (innerH / 2) - 2
  const bars = []
  for (let i = 0; i < n; i++) {
    const cx = padL + colW * (i + 0.5)
    const cH = (f.dailyClosed[i] / max) * half
    const aH = (f.dailyAdded[i]  / max) * half
    bars.push({
      i,
      x: cx - barW / 2, w: barW,
      cY: mid - cH, cH,
      aY: mid,      aH,
      closed: f.dailyClosed[i],
      added:  f.dailyAdded[i],
      ts: f.dailyStartMs + i * 24 * 3600 * 1000
    })
  }
  return { W, H, padL, padR, padT, padB, mid, max, bars, axisY: mid, leftLabel: `${n}d ago`, rightLabel: 'today' }
})

const etaTipTimeline = computed(() => {
  const f = targetForecast.value
  if (!f) return null
  const day = 24 * 60 * 60 * 1000
  const W = 360, H = 38, padL = 10, padR = 10, padT = 6, padB = 18
  const innerW = W - padL - padR
  const y = padT + 8
  const today = f.todayMs
  const due = f.dueMs
  const eta = f.etaMs
  if (!due && !eta) return null
  const rightMs = Math.max(today, due || 0, eta || 0) + day
  const leftMs  = Math.min(today, due || today, eta || today) - day
  const span = Math.max(1, rightMs - leftMs)
  const xOf = (ms) => padL + ((ms - leftMs) / span) * innerW
  const fmt = (ms) => new Date(ms).toISOString().slice(0, 10)
  const segs = []
  if (due && eta && eta > due) {
    segs.push({ kind: 'late', x1: xOf(due), x2: xOf(eta), y })
  } else if (due && eta) {
    segs.push({ kind: 'slack', x1: xOf(eta), x2: xOf(due), y })
  }
  const ticks = [
    { ms: today, kind: 'today', label: 'today', x: xOf(today) }
  ]
  if (due) ticks.push({ ms: due, kind: 'due', label: 'due ' + fmt(due), x: xOf(due) })
  if (eta) ticks.push({ ms: eta, kind: 'eta', label: 'ETA ' + fmt(eta), x: xOf(eta) })
  return { W, H, y, segs, ticks }
})

// Cumulative scope vs closed over the milestone's active window. The chart is anchored
// to a sensible window (`start_date` if reasonable → otherwise N days before due_date →
// otherwise earliest ticket-in-milestone event) so legacy backlog tickets retagged into
// the milestone don't stretch the X axis to years of dead space.
//
// Lines are reconstructed from each ticket's `resource_milestone_events` (loader stores
// `_raw.milestoneEvents`), giving us real "in milestone T" intervals over time. Tickets
// without fetched events yet fall back to `created_at`-as-entry.
// `burndownSvgRef` + `burndownSize` are declared near the top of the script
// alongside the other mode SVG refs so the global `watchModeSvgs` watcher can
// reference them.
const BURNDOWN_PAD = { top: 28, right: 50, bottom: 48, left: 58 }
const burndownCfg = computed(() => settings.uiState.kiosk?.modeConfig?.burndown || {})
// Burndown = remaining open work (scope − closed) over time, with a classic-Scrum
// ideal straight line from (start, initialOpen) → (due, 0). Uses the real
// `resource_milestone_events` (fetched by the loader) so a ticket that moved INTO
// the milestone mid-flight is counted as scope at the move date — not at its
// `created_at`, which is what the previous heuristic used (and badly over-counted
// the "added" line in projects that re-tag tickets between milestones). Tickets
// that have never had their events fetched fall back to the old `created_at`
// heuristic so the chart still renders sensibly on first paint.
const targetBurndown = computed(() => {
  const title = targetMilestone.value
  if (!title) return null
  const td = targetData.value
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const windowDays = Math.max(7, Number(burndownCfg.value.windowDays) || 90)
  const dueMs = td?.due ? new Date(td.due).getTime() : null

  // Per-ticket "in milestone T" intervals derived from events. An interval ends on
  // either an explicit `remove T` event or an `add OTHER` event (moving to another
  // milestone implicitly removes from the current one). If the last event leaves
  // the ticket in T, the interval is open-ended (`end: null`).
  let entriesFromEvents = 0, entriesFromFallback = 0
  const entries = []
  for (const n of allItems.value) {
    const raw = n._raw || {}
    const events = raw.milestoneEvents
    const intervals = []
    if (Array.isArray(events) && events.length) {
      let entry = null
      for (const ev of events) {
        const isTarget = ev.title === title
        if (ev.action === 'add' && isTarget) {
          if (entry == null) entry = ev.ts
        } else if (ev.action === 'remove' && isTarget && entry != null) {
          intervals.push({ start: entry, end: ev.ts }); entry = null
        } else if (ev.action === 'add' && !isTarget && entry != null) {
          intervals.push({ start: entry, end: ev.ts }); entry = null
        }
      }
      if (entry != null) intervals.push({ start: entry, end: null })
      if (intervals.length) entriesFromEvents++
    } else if (raw.milestone?.title === title) {
      const c = safeDate(raw.created_at) || 0
      if (c) { intervals.push({ start: c, end: null }); entriesFromFallback++ }
    }
    if (!intervals.length) continue
    entries.push({
      intervals,
      created: safeDate(raw.created_at) || 0,
      closed: safeDate(raw.closed_at) || 0
    })
  }
  if (!entries.length) return null

  // Anchor the chart start. Honor milestone.start_date only if it's within
  // 2× windowDays of the due_date — otherwise fall back to a rolling window so we
  // don't get a 6-year flat stretch from a re-used milestone.
  let start
  if (td?.startMs && dueMs && (dueMs - td.startMs) / day > 0 && (dueMs - td.startMs) / day <= windowDays * 2) {
    start = td.startMs
  } else if (dueMs) {
    start = dueMs - windowDays * day
  } else {
    let earliest = Infinity
    for (const e of entries) for (const iv of e.intervals) if (iv.start < earliest) earliest = iv.start
    start = Math.max(earliest, now - windowDays * day)
  }
  const end = now
  if (!Number.isFinite(start) || start >= end) return null

  // Convert intervals into (Δscope, Δclosed) timeline events. Scope deltas span
  // the whole interval; closed deltas span [closed_at .. end] within the interval
  // (and cancel at interval end if the ticket leaves the milestone before today).
  const deltas = []
  for (const e of entries) {
    for (const iv of e.intervals) {
      const sIn = Math.max(iv.start, e.created)
      deltas.push({ ts: sIn, ds: 1, dc: 0 })
      if (iv.end != null) deltas.push({ ts: iv.end, ds: -1, dc: 0 })
      if (e.closed) {
        const cIn = Math.max(sIn, e.closed)
        if (iv.end == null || cIn < iv.end) {
          deltas.push({ ts: cIn, ds: 0, dc: 1 })
          if (iv.end != null) deltas.push({ ts: iv.end, ds: 0, dc: -1 })
        }
      }
    }
  }
  deltas.sort((a, b) => a.ts - b.ts)

  // Apply pre-window deltas to get baseline at `start`, then sample per-day.
  let scopeAcc = 0, closedAcc = 0, di = 0
  while (di < deltas.length && deltas[di].ts < start) {
    scopeAcc += deltas[di].ds; closedAcc += deltas[di].dc; di++
  }
  const scopeBaseline = scopeAcc, closedBaseline = closedAcc

  const dayCount = Math.max(1, Math.ceil((end - start) / day))
  const points = []
  for (let d = 0; d <= dayCount; d++) {
    const ts = start + d * day
    while (di < deltas.length && deltas[di].ts <= ts) {
      scopeAcc += deltas[di].ds; closedAcc += deltas[di].dc; di++
    }
    points.push({ ts, closed: closedAcc, remaining: Math.max(0, scopeAcc - closedAcc) })
  }

  // In-window event counts for the subtitle — now reflect actual scope changes,
  // not "tickets currently in milestone whose created_at falls in window".
  let addedInWindow = 0, closedInWindow = 0
  for (const ev of deltas) {
    if (ev.ts < start || ev.ts > end) continue
    if (ev.ds > 0) addedInWindow += ev.ds
    if (ev.dc > 0) closedInWindow += ev.dc
  }

  // Scales — driven by current container size so 1 user-space unit = 1 screen pixel.
  if (!burndownSize.value) return null
  const vbW = Math.max(400, burndownSize.value.w)
  const vbH = Math.max(200, burndownSize.value.h)
  const initialOpen = Math.max(0, scopeBaseline - closedBaseline)
  const currentOpen = Math.max(0, scopeAcc - closedAcc)
  // y-axis must contain both plotted lines — remaining can spike above initialOpen
  // from scope creep, and cumulative closed can exceed peak remaining when lots of
  // work ships. Missing `p.closed` here was clipping the green line off the top.
  const maxY = Math.max(1, initialOpen, ...points.map(p => Math.max(p.remaining, p.closed)))
  const innerW = vbW - BURNDOWN_PAD.left - BURNDOWN_PAD.right
  const innerH = vbH - BURNDOWN_PAD.top - BURNDOWN_PAD.bottom
  const xFor = (ts) => BURNDOWN_PAD.left + ((ts - start) / (end - start)) * innerW
  const yFor = (n)  => BURNDOWN_PAD.top + innerH - (n / maxY) * innerH

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
  // Filled area under the remaining line, baseline at y=0 (innerBottom). Drops
  // toward the x-axis as work burns down.
  const areaPath = () => {
    if (!points.length) return ''
    let d = ''
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const x = xFor(p.ts)
      const y = yFor(p.remaining)
      if (i === 0) d += `M${x},${y}`
      else d += ` H${x} V${y}`
    }
    const lastX = xFor(points[points.length - 1].ts)
    const firstX = xFor(points[0].ts)
    const baseY = yFor(0)
    return d + ` L${lastX},${baseY} L${firstX},${baseY} Z`
  }

  // Ideal-burn guideline: classic Scrum line from (start, initialOpen) toward
  // (due, 0). We don't draw past today — instead we cap the line at today using
  // the linearly-interpolated value, so it reads as "where remaining SHOULD be
  // right now if we were on pace", not a forward prediction.
  let idealPath = ''
  if (dueMs && dueMs > start) {
    const idealAtTodayY = initialOpen * (1 - (Math.min(now, dueMs) - start) / (dueMs - start))
    const x0 = xFor(start), y0 = yFor(initialOpen)
    const x1 = xFor(Math.min(now, dueMs)), y1 = yFor(Math.max(0, idealAtTodayY))
    idealPath = `M${x0},${y0} L${x1},${y1}`
  }

  // Date ticks: ~5 evenly across the window. Year is shown on the first tick and
  // whenever a tick crosses into a new calendar year so multi-year windows aren't
  // ambiguous.
  const ticks = []
  const tickCount = 5
  let lastTickYear = -1
  for (let i = 0; i <= tickCount; i++) {
    const ts = start + (i / tickCount) * (end - start)
    const d = new Date(ts)
    const showYear = d.getFullYear() !== lastTickYear
    ticks.push({
      ts, x: xFor(ts),
      label: showYear
        ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    })
    lastTickYear = d.getFullYear()
  }
  const yTicks = []
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((i / 4) * maxY)
    yTicks.push({ v, y: yFor(v) })
  }

  // "Data available since" marker — when `gitlabClosedDays` < chart window, closures
  // older than (now − gitlabClosedDays) were never fetched. The closed line for that
  // historical range is fake-flat; we draw a dim overlay + vertical marker so the team
  // sees which portion of the chart is unreliable.
  const closedDays = Math.max(0, Number(settings.config.gitlabClosedDays) || 0)
  const closedAvailableMs = closedDays > 0 ? now - closedDays * day : null
  const closedCutoffX = (closedAvailableMs != null && closedAvailableMs > start && closedAvailableMs <= end)
    ? xFor(closedAvailableMs) : null
  const closedHistoryComplete = closedDays === 0
    ? false
    : (closedAvailableMs != null && closedAvailableMs <= start)
  const closedCutoffLabel = closedAvailableMs != null
    ? new Date(closedAvailableMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  // Risk colouring for the area: amber by default, dim red when the actual
  // remaining is visibly above ideal at today (≥ 15 tickets behind).
  let onTrack = true
  if (dueMs && dueMs > start) {
    const idealAtToday = initialOpen * (1 - (Math.min(now, dueMs) - start) / (dueMs - start))
    onTrack = currentOpen <= idealAtToday + 15
  }

  // Surface the due date in the subtitle instead of as an on-chart marker (since
  // the chart no longer extends past today). Format: "Jun 30 · 47d to go".
  let dueLabel = null
  if (dueMs) {
    const diff = Math.round((dueMs - now) / day)
    const date = new Date(dueMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    dueLabel = diff > 0
      ? `${date} · ${diff}d to go`
      : (diff === 0 ? `${date} · due today` : `${date} · ${-diff}d overdue`)
  }

  // End-of-line value labels at today. Clamp below the TODAY badge (which sits at
  // innerTop − 4 + 26 high) and above the bottom; if the two lines end within
  // ~22px vertically the labels would overlap, so push them apart while the
  // connector dot still sits exactly on the line.
  const remainEndY = yFor(currentOpen)
  const closedEndY = yFor(closedAcc)
  const labelMinY = BURNDOWN_PAD.top + 30
  const labelMaxY = vbH - BURNDOWN_PAD.bottom - 6
  const clampY = (y) => Math.max(labelMinY, Math.min(labelMaxY, y))
  let remainLabelY = clampY(remainEndY)
  let closedLabelY = clampY(closedEndY)
  if (Math.abs(remainLabelY - closedLabelY) < 22) {
    if (remainLabelY <= closedLabelY) { remainLabelY = clampY(remainLabelY - 11); closedLabelY = clampY(closedLabelY + 11) }
    else                              { remainLabelY = clampY(remainLabelY + 11); closedLabelY = clampY(closedLabelY - 11) }
  }

  return {
    remainingPath: stepPath('remaining'),
    closedPath: stepPath('closed'),
    areaPath: areaPath(),
    idealPath,
    onTrack,
    ticks, yTicks,
    todayX: xFor(now),
    remainEndY, closedEndY,
    remainLabelY, closedLabelY,
    startLabel: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    endLabel: new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    dueLabel,
    initialOpen, currentOpen,
    totalScope: scopeAcc,
    totalClosed: closedAcc,
    scopeBaseline, closedBaseline,
    addedInWindow, closedInWindow,
    // How many tickets contributed via real events vs `created_at` fallback.
    // Surfaces a "milestone history not fully fetched yet" warning when most
    // tickets are still on the fallback so the room knows numbers may shift.
    entriesFromEvents, entriesFromFallback,
    windowDays,
    maxY,
    closedCutoffX, closedDays, closedHistoryComplete, closedCutoffLabel,
    vbWidth: vbW, vbHeight: vbH,
    innerLeft: BURNDOWN_PAD.left, innerTop: BURNDOWN_PAD.top,
    innerRight: vbW - BURNDOWN_PAD.right, innerBottom: vbH - BURNDOWN_PAD.bottom
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

// --- Activity heatmap (GitHub contribution-graph style) ----------------------------
// Three sibling modes (heatmapCreated / heatmapClosed / heatmapAll) share one helper
// and only differ in which event kinds they count + which palette they use.
// Color semantics across the kiosk: created = red (incoming work / backlog growth),
// closed = green (completed / good), all-activity = purple (neutral).
const HEATMAP_CONFIGS = {
  heatmapCreated: { kinds: ['opened'], label: 'Tickets created',
    palette: ['rgba(127,127,127,0.12)', '#5d1a1a', '#8c1d1d', '#d32f2f', '#ef5350'] },
  heatmapClosed:  { kinds: ['closed'],  label: 'Tickets closed',
    palette: ['rgba(127,127,127,0.12)', '#0e4429', '#006d32', '#26a641', '#39d353'] },
  heatmapAll:     { kinds: ['opened', 'closed'], label: 'All ticket activity',
    palette: ['rgba(127,127,127,0.12)', '#3a1d5b', '#553098', '#a371f7', '#d2a8ff'] }
}
const heatmapCfg = computed(() => settings.uiState.kiosk?.modeConfig?.heatmap || {})
// `heatmapSvgRef`, `heatmapSize`, `setHeatmapSvgRef` are declared up top alongside the
// burndown refs so the shared `watchModeSvgs` watcher can reference them safely.

const HEATMAP_DAY_LABELS = ['Mon', 'Wed', 'Fri']  // sparse like GitHub
const HEATMAP_DAY_IDX    = { Mon: 1, Wed: 3, Fri: 5 }

const computeHeatmapFor = (modeId) => {
  const cfg = HEATMAP_CONFIGS[modeId]
  if (!cfg) return null
  const wantOpened = cfg.kinds.includes('opened')
  const wantClosed = cfg.kinds.includes('closed')
  const days = Math.max(60, Math.min(730, Number(heatmapCfg.value.days) || 365))
  const dayMs = 24 * 60 * 60 * 1000
  const today0 = startOfToday()
  const earliest = today0 - (days - 1) * dayMs
  // Align grid to a Monday before/at the earliest day (column = ISO week, row = day-of-week).
  // JS getDay(): 0=Sun..6=Sat → we want Mon=0..Sun=6.
  const dowMon = (ts) => (new Date(ts).getDay() + 6) % 7
  const alignedStart = earliest - dowMon(earliest) * dayMs
  const totalDays = Math.floor((today0 - alignedStart) / dayMs) + 1
  const totalWeeks = Math.ceil(totalDays / 7)

  // Build the grid
  const cells = new Array(totalWeeks * 7)
  for (let i = 0; i < cells.length; i++) {
    const ts = alignedStart + i * dayMs
    cells[i] = { ts, dow: i % 7, week: Math.floor(i / 7), count: 0, inRange: ts >= earliest && ts <= today0 }
  }

  // Tally events
  for (const n of items.value) {
    const raw = n._raw || {}
    const stamps = []
    if (wantOpened) { const c = safeDate(raw.created_at); if (c) stamps.push(c) }
    if (wantClosed) { const c = safeDate(raw.closed_at);  if (c) stamps.push(c) }
    for (const ts of stamps) {
      if (ts < earliest || ts > today0 + dayMs) continue
      const idx = Math.floor((ts - alignedStart) / dayMs)
      if (cells[idx]) cells[idx].count++
    }
  }

  const maxCount = Math.max(1, ...cells.map(c => c.count))
  // Use sqrt-spaced thresholds so a busy day stands out without flattening the lows.
  const t1 = Math.max(1, Math.round(maxCount * 0.10))
  const t2 = Math.max(t1 + 1, Math.round(maxCount * 0.25))
  const t3 = Math.max(t2 + 1, Math.round(maxCount * 0.50))
  for (const c of cells) {
    if (!c.inRange || c.count === 0) c.level = 0
    else if (c.count <= t1) c.level = 1
    else if (c.count <= t2) c.level = 2
    else if (c.count <= t3) c.level = 3
    else c.level = 4
  }

  // Month labels at the top: position at the first cell of each new month (week column).
  // Year is appended at the first label and whenever a new year starts so a 365 / 730d
  // window doesn't leave the viewer wondering which year a "Jan" tick refers to.
  const monthLabels = []
  let lastMonth = -1
  let lastYear = -1
  for (let w = 0; w < totalWeeks; w++) {
    const cell = cells[w * 7]
    if (!cell) continue
    const d = new Date(cell.ts)
    if (d.getMonth() !== lastMonth) {
      const month = d.toLocaleDateString(undefined, { month: 'short' })
      const showYear = d.getFullYear() !== lastYear
      monthLabels.push({ week: w, label: showYear ? `${month} ${d.getFullYear()}` : month })
      lastMonth = d.getMonth()
      lastYear = d.getFullYear()
    }
  }

  // Pixel layout — adapts to container size.
  if (!heatmapSize.value) return null
  const vbW = Math.max(400, heatmapSize.value.w)
  const vbH = Math.max(160, heatmapSize.value.h)
  const padLeft = 36, padTop = 28, padRight = 8, padBottom = 8, gap = 3
  // Cap cell size so the grid stays tight on wide kiosk screens (GitHub-style cell
  // density rather than chunky squares).
  const cellSize = Math.max(4, Math.min(14, Math.floor(Math.min(
    (vbW - padLeft - padRight - gap * (totalWeeks - 1)) / totalWeeks,
    (vbH - padTop - padBottom - gap * 6) / 7
  ))))
  const xFor = (w) => padLeft + w * (cellSize + gap)
  const yFor = (dow) => padTop + dow * (cellSize + gap)
  // Skip the date label format for cells that won't render a <title> (empty days)
  // — `new Date().toLocaleDateString()` on every cell adds up fast for 365×3 rows.
  const positionedCells = cells.map(c => ({
    ...c, x: xFor(c.week), y: yFor(c.dow),
    label: c.count > 0 ? new Date(c.ts).toLocaleDateString() : ''
  }))

  // Total events counted (for the title)
  const total = positionedCells.reduce((s, c) => s + (c.inRange ? c.count : 0), 0)

  return {
    cfg, cells: positionedCells, monthLabels, totalWeeks, cellSize, gap,
    vbW, vbH, padLeft, padTop, days, total, maxCount
  }
}

// All three datasets at once — rendered as a stack of 3 rows in the single
// `heatmap` mode. Each row gets its own slice of the SVG, hence its own size.
const HEATMAP_ROWS = ['heatmapCreated', 'heatmapClosed', 'heatmapAll']
const heatmaps = computed(() => {
  if (currentMode.value !== 'heatmap') return null
  return HEATMAP_ROWS.map(id => ({ id, data: computeHeatmapFor(id) }))
})
const heatmapSummary = computed(() => {
  if (!heatmaps.value) return null
  const total = heatmaps.value.reduce((s, h) => s + (h.data?.total || 0), 0)
  const peak = Math.max(0, ...heatmaps.value.map(h => h.data?.maxCount || 0))
  return { total, peak, days: (heatmaps.value[0]?.data?.days) || 0 }
})

// "Activity by label" — heatmap rows are top-N labels, columns are weeks within the
// window. Each row gets its OWN palette derived from a hash of the label name so labels
// have stable, distinguishable colors across renders without us maintaining a palette
// map. Intensity is still global (max events/week across all rows) so a busy week
// reads brighter regardless of which label it's on.
const _labelHueCache = new Map()
const labelHue = (s) => {
  const key = String(s || '')
  let v = _labelHueCache.get(key)
  if (v !== undefined) return v
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  // Golden-ratio multiplier spreads hues evenly around the wheel for nearby names.
  v = Math.floor((Math.abs(h) * 137.508) % 360)
  _labelHueCache.set(key, v)
  return v
}
const labelHashedPalette = (label) => {
  const hue = labelHue(label)
  return [
    'rgba(127,127,127,0.12)',
    `hsl(${hue}, 45%, 22%)`,
    `hsl(${hue}, 55%, 36%)`,
    `hsl(${hue}, 65%, 52%)`,
    `hsl(${hue}, 72%, 68%)`
  ]
}
const HEATMAP_BY_LABEL_LEGEND = ['rgba(127,127,127,0.12)', 'rgba(160,160,160,0.25)', 'rgba(180,180,180,0.45)', 'rgba(200,200,200,0.65)', 'rgba(220,220,220,0.85)']
const heatmapByLabelCfg = computed(() => settings.uiState.kiosk?.modeConfig?.heatmapByLabel || {})
const heatmapByLabel = computed(() => {
  if (currentMode.value !== 'heatmapByLabel') return null
  if (!heatmapByLabelSize.value) return null
  const cfg = heatmapByLabelCfg.value
  const days = Math.max(60, Math.min(730, Number(cfg.days) || 365))
  const topN = Math.max(3, Math.min(30, Number(cfg.topN) || 10))
  const includeScoped = !!cfg.includeScoped
  const dayMs = 24 * 60 * 60 * 1000
  const today0 = startOfToday()
  const earliest = today0 - (days - 1) * dayMs
  // Mon-aligned start so every label block's columns line up with calendar weeks
  // (same convention as the main Activity heatmap).
  const dowMon = (ts) => (new Date(ts).getDay() + 6) % 7
  const alignedStart = earliest - dowMon(earliest) * dayMs
  const totalDays = Math.floor((today0 - alignedStart) / dayMs) + 1
  const totalWeeks = Math.ceil(totalDays / 7)

  // Per-label tally — one bucket per day in the aligned window.
  const labelStats = new Map()
  for (const n of items.value) {
    const raw = n._raw || {}
    const labels = Array.isArray(raw.labels) ? raw.labels : []
    if (!labels.length) continue
    const stamps = []
    const c = safeDate(raw.created_at); if (c) stamps.push(c)
    const cl = safeDate(raw.closed_at); if (cl) stamps.push(cl)
    const u = safeDate(raw.updated_at); if (u && u !== c && u !== cl) stamps.push(u)
    for (const ts of stamps) {
      if (ts < alignedStart || ts > today0 + dayMs) continue
      const dayIdx = Math.floor((ts - alignedStart) / dayMs)
      if (dayIdx < 0 || dayIdx >= totalDays) continue
      for (const l of labels) {
        if (typeof l !== 'string' || !l) continue
        if (!includeScoped && isScopedLabel(l)) continue
        let entry = labelStats.get(l)
        if (!entry) { entry = { total: 0, daily: new Array(totalDays).fill(0) }; labelStats.set(l, entry) }
        entry.total++
        entry.daily[dayIdx]++
      }
    }
  }

  const sorted = [...labelStats.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, topN)
  if (!sorted.length) return { rows: [], totalWeeks: 0, monthLabels: [], total: 0, max: 0, days, topN, vbW: heatmapByLabelSize.value.w, vbH: heatmapByLabelSize.value.h }

  // Global max so all label blocks share the same intensity scale.
  let max = 1
  for (const [, e] of sorted) for (const v of e.daily) if (v > max) max = v
  const t1 = Math.max(1, Math.round(max * 0.10))
  const t2 = Math.max(t1 + 1, Math.round(max * 0.25))
  const t3 = Math.max(t2 + 1, Math.round(max * 0.50))

  // Pixel layout — each label gets its OWN GitHub-style 7-row (Mon..Sun) × N-week
  // mini heatmap with SQUARE cells. cellSize is the smaller of width-fit and
  // height-fit, capped at MAX_CELL. If the requested topN would force cells below
  // MIN_CELL we drop labels from the tail until they fit, so the wall always shows
  // readable squares (header still reads "top N" honestly via the actual count).
  const vbW = Math.max(400, heatmapByLabelSize.value.w)
  const vbH = Math.max(160, heatmapByLabelSize.value.h)
  const padLeft = 110, padTop = 24, padRight = 8, padBottom = 8
  const cellGap = 1   // within a block
  const blockGap = 4  // between label blocks
  const MIN_CELL = 7
  const MAX_CELL = 18
  const widthFit  = Math.floor((vbW - padLeft - padRight - cellGap * (totalWeeks - 1)) / totalWeeks)
  const heightFitFor = (n) => Math.floor((vbH - padTop - padBottom - blockGap * Math.max(0, n - 1) - cellGap * n * 6) / (n * 7))
  let labelN = sorted.length
  while (labelN > 1 && Math.min(widthFit, heightFitFor(labelN)) < MIN_CELL) labelN--
  if (labelN < sorted.length) sorted.length = labelN
  const heightFit = heightFitFor(labelN)
  const cellSize = Math.max(MIN_CELL, Math.min(MAX_CELL, widthFit, heightFit))
  const blockHeight = 7 * cellSize + 6 * cellGap

  const rows = sorted.map(([label, e], rowIdx) => {
    const yOffset = padTop + rowIdx * (blockHeight + blockGap)
    const palette = labelHashedPalette(label)
    const cells = e.daily.map((count, d) => {
      const week = Math.floor(d / 7)
      const dow = d % 7
      const ts = alignedStart + d * dayMs
      const inRange = ts >= earliest && ts <= today0
      let level = 0
      if (inRange && count > 0) {
        if (count <= t1) level = 1
        else if (count <= t2) level = 2
        else if (count <= t3) level = 3
        else level = 4
      }
      return {
        x: padLeft + week * (cellSize + cellGap),
        y: yOffset + dow * (cellSize + cellGap),
        w: cellSize, h: cellSize,
        count, level, inRange,
        startTs: ts, endTs: ts
      }
    })
    return { label, total: e.total, cells, y: yOffset, height: blockHeight, palette, hue: labelHue(label) }
  })

  // Month labels at the first week containing a new month — placed above the
  // first label block. Year is appended on the first label and year transitions.
  const monthLabels = []
  let lastMonth = -1
  let lastYear = -1
  for (let w = 0; w < totalWeeks; w++) {
    const ts = alignedStart + w * 7 * dayMs
    const date = new Date(ts)
    if (date.getMonth() !== lastMonth) {
      const month = date.toLocaleDateString(undefined, { month: 'short' })
      const showYear = date.getFullYear() !== lastYear
      monthLabels.push({
        week: w,
        x: padLeft + w * (cellSize + cellGap),
        label: showYear ? `${month} ${date.getFullYear()}` : month
      })
      lastMonth = date.getMonth()
      lastYear = date.getFullYear()
    }
  }

  return {
    rows, monthLabels, totalWeeks, days,
    // Reflect the actual rendered count rather than the configured topN — if we
    // had to trim labels to keep cells readable, "top 10" should say "top 10".
    topN: rows.length,
    total: sorted.reduce((s, [, e]) => s + e.total, 0),
    max,
    cellSize, padLeft, padTop, vbW, vbH
  }
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

// Leaderboard — multiple ranking categories side by side: today's closers and
// openers, week-long activity, ticket-discussion volume, current workload.
// Each row is clickable to filter the graph by that person.
// Data sources (no per-user comment history available, so we proxy):
//   - closed_by      → closures
//   - author         → opens + discussion credit (sum of user_notes_count on
//                      tickets they raised)
//   - assignees      → current workload (open only)
const leaderboardCfg = computed(() => settings.uiState.kiosk?.modeConfig?.leaderboard || {})
const LEADERBOARD_MEDALS = ['gold', 'silver', 'bronze']

const leaderboardStats = computed(() => {
  const day = 24 * 60 * 60 * 1000
  const today0 = startOfToday()
  const week0 = Date.now() - 7 * day
  const stats = new Map()
  const bump = (name, field, by = 1) => {
    if (!name) return
    let s = stats.get(name)
    if (!s) {
      s = { name, closedToday: 0, openedToday: 0, closed7d: 0, opened7d: 0,
            workload: 0, comments: 0 }
      stats.set(name, s)
    }
    s[field] += by
  }
  for (const n of items.value) {
    const raw = n._raw || {}
    const created = safeDate(raw.created_at) || 0
    const closed = safeDate(raw.closed_at) || 0
    const notes = Number(raw.user_notes_count) || 0
    const author = raw.author?.name
    const closer = raw.closed_by?.name
    if (created >= today0) bump(author, 'openedToday')
    if (created >= week0)  bump(author, 'opened7d')
    if (closed >= today0)  bump(closer, 'closedToday')
    if (closed >= week0)   bump(closer, 'closed7d')
    // GitLab doesn't expose per-user comment counts. Author owns the ticket's
    // chatter signal — closer might never have commented; assignees could shift.
    if (notes > 0) bump(author, 'comments', notes)
    if (isOpen(n)) for (const name of getAssigneeNames(raw)) bump(name, 'workload')
  }
  // Combined activity scores (closures weighted heaviest — shipping > raising).
  for (const s of stats.values()) {
    s.activeToday = s.closedToday * 3 + s.openedToday
    s.active7d    = s.closed7d   * 3 + s.opened7d
  }
  return stats
})

const leaderboardCategories = computed(() => {
  const lim = Math.max(3, Number(leaderboardCfg.value.topN) || 5)
  const rows = [...leaderboardStats.value.values()]
  const top = (field) => rows
    .filter(r => r[field] > 0)
    .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name))
    .slice(0, lim)
    .map((r, i) => ({ ...r, rank: i + 1, medal: i < 3 ? LEADERBOARD_MEDALS[i] : null }))
  return [
    { id: 'closedToday', label: 'Most closed · today', icon: 'mdi-trophy',           accent: '#66bb6a', field: 'closedToday', list: top('closedToday') },
    { id: 'openedToday', label: 'Most opened · today', icon: 'mdi-plus-circle',      accent: '#ef5350', field: 'openedToday', list: top('openedToday') },
    { id: 'active7d',    label: 'Most active · 7d',    icon: 'mdi-fire',             accent: '#ff9800', field: 'active7d',    list: top('active7d') },
    { id: 'comments',    label: 'Top discussion',      icon: 'mdi-comment-multiple', accent: '#ba68c8', field: 'comments',    list: top('comments') },
    { id: 'workload',    label: 'Heaviest workload',   icon: 'mdi-briefcase',        accent: '#26c6da', field: 'workload',    list: top('workload') }
  ]
})

const leaderboardMVP = computed(() => {
  const rows = [...leaderboardStats.value.values()]
    .filter(r => r.activeToday > 0)
    .sort((a, b) => b.activeToday - a.activeToday || a.name.localeCompare(b.name))
  return rows[0] || null
})

const leaderboardHasData = computed(() => leaderboardCategories.value.some(c => c.list.length))

// "Ticket health" — problem-focused dashboard. Each open ticket is checked against a
// list of common problems (overdue / stale / unassigned / no priority / no due date /
// blocked) and assigned a severity score. The Most Problematic list surfaces the top
// score-summing tickets so the wall flags the worst offenders at a glance.
const risksCfg = computed(() => settings.uiState.kiosk?.modeConfig?.risks || {})
const PROBLEM_WEIGHTS  = { overdue: 3, blocked: 3, stale: 2, unassigned: 1, noPriority: 1, noDueDate: 1 }
const PROBLEM_COLORS   = { overdue: '#ef5350', blocked: '#ef5350', stale: '#ffb300', unassigned: '#ffb300', noPriority: '#90a4ae', noDueDate: '#90a4ae' }
const PROBLEM_LABELS   = { overdue: 'Overdue', stale: 'Stale', unassigned: 'Unassigned', noPriority: 'No priority', noDueDate: 'No due date', blocked: 'Blocked' }
const PROBLEM_ICONS    = { overdue: 'mdi-calendar-alert', stale: 'mdi-timer-sand', unassigned: 'mdi-account-off-outline', noPriority: 'mdi-alert-circle-outline', noDueDate: 'mdi-calendar-question', blocked: 'mdi-cancel' }

const risks = computed(() => {
  const staleThreshold = Math.max(1, Number(risksCfg.value.staleListDays) || 14)
  const listLimit = Math.max(1, Number(risksCfg.value.listLimit) || 12)
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const stats = { overdue: 0, stale: 0, unassigned: 0, noPriority: 0, noDueDate: 0, blocked: 0 }
  const offenders = []
  for (const n of openItems.value) {
    const raw = n._raw || {}
    const due = safeDate(raw.due_date)
    const upd = safeDate(raw.updated_at) || safeDate(raw.created_at) || 0
    const assignees = getAssigneeNames(raw)
    const priorityVal = getScopedLabelValue(raw.labels, 'Priority') || ''
    const status = currentStatusOfRaw(raw) || ''

    const problems = []
    if (due && due < now) {
      stats.overdue++; problems.push({ kind: 'overdue', detail: `${Math.max(1, Math.floor((now - due) / day))}d overdue` })
    }
    if (!due) {
      stats.noDueDate++; problems.push({ kind: 'noDueDate', detail: 'no due date' })
    }
    if (upd && (now - upd) > staleThreshold * day) {
      stats.stale++; problems.push({ kind: 'stale', detail: `${Math.floor((now - upd) / day)}d stale` })
    }
    if (!assignees.length) { stats.unassigned++; problems.push({ kind: 'unassigned', detail: 'unassigned' }) }
    if (!priorityVal)      { stats.noPriority++; problems.push({ kind: 'noPriority', detail: 'no priority' }) }
    if (/blocked/i.test(status)) { stats.blocked++; problems.push({ kind: 'blocked', detail: 'blocked' }) }

    if (problems.length >= 2) {
      offenders.push({
        iid: raw.iid != null ? String(raw.iid) : '',
        title: raw.title || n.name,
        url: raw.web_url || '',
        priority: priorityVal,
        assignees,
        problems,
        score: problems.reduce((s, p) => s + (PROBLEM_WEIGHTS[p.kind] || 1), 0)
      })
    }
  }
  offenders.sort((a, b) => b.score - a.score)
  return { stats, offenders: offenders.slice(0, listLimit), staleThreshold }
})

// Broken tickets — tickets that have leaked out of the workflow and are likely
// to be forgotten. Different from `risks` (which flags actionable problems like
// "overdue" or "stale"): these are *workflow leaks*. Categories:
//  - lostMilestone:        open ticket, milestone state is 'closed'/'expired' (orphaned)
//  - statusMismatch:       open + status says Done / Won't do / Duplicate / etc. (should be closed)
//  - criticalUnowned:      Priority::Blocking|Critical with no assignee (fire-alarm)
//  - deactivatedAssignee:  assignee account is blocked / deactivated / banned (work stuck on someone who left)
//  - forgotten:            no priority AND no assignee (truly invisible)
//  - wipUnassigned:        "in progress"-ish status but nobody assigned (ghost WIP)
//  - evergreen:            ticket much older than its current milestone (= carried over multiple sprints)
//  - noMilestone:          no milestone at all (drifting work)
//  - zombie:               created > 365d ago AND not updated > 90d (long abandoned)
//  - noType:               no Type:: label (workflow tag missing)
const BROKEN_KINDS = ['lostMilestone', 'statusMismatch', 'criticalUnowned', 'deactivatedAssignee', 'forgotten', 'wipUnassigned', 'evergreen', 'noMilestone', 'zombie', 'noType']
const BROKEN_LABELS  = { lostMilestone: 'Lost milestone', statusMismatch: 'Status mismatch', criticalUnowned: 'Critical · no owner', deactivatedAssignee: 'Deactivated owner', forgotten: 'Forgotten', wipUnassigned: 'WIP · no owner', evergreen: 'Evergreen', noMilestone: 'No milestone', zombie: 'Zombie', noType: 'No type' }
const BROKEN_ICONS   = { lostMilestone: 'mdi-flag-remove-outline', statusMismatch: 'mdi-alert-decagram-outline', criticalUnowned: 'mdi-fire-alert', deactivatedAssignee: 'mdi-account-cancel-outline', forgotten: 'mdi-ghost-outline', wipUnassigned: 'mdi-account-question-outline', evergreen: 'mdi-leaf-circle-outline', noMilestone: 'mdi-flag-off-outline', zombie: 'mdi-skull-outline', noType: 'mdi-tag-off-outline' }
const BROKEN_COLORS  = { lostMilestone: '#ef5350', statusMismatch: '#ef5350', criticalUnowned: '#ef5350', deactivatedAssignee: '#ef5350', forgotten: '#ef5350', wipUnassigned: '#ffb300', evergreen: '#ffb300', noMilestone: '#ffb300', zombie: '#ffb300', noType: '#90a4ae' }
const BROKEN_WEIGHTS = { lostMilestone: 3, statusMismatch: 3, criticalUnowned: 3, deactivatedAssignee: 3, forgotten: 3, wipUnassigned: 2, evergreen: 2, noMilestone: 2, zombie: 2, noType: 1 }
// GitLab user states that indicate the account is no longer usable —
// `active` is the only healthy state; anything else means tickets assigned
// there have effectively no owner.
const DEAD_USER_STATE_RE = /^(blocked|deactivated|banned|ldap_blocked)$/i
// Common "this should have been closed" status names. Matched case-insensitively
// against `currentStatusOfRaw()` so any of the popular workflow plugins works.
const CLOSED_STATUS_RE = /^(done|closed|won['’]?t ?do|wont ?do|duplicate|resolved|verified|invalid|completed)$/i
const ZOMBIE_AGE_DAYS = 365
const ZOMBIE_IDLE_DAYS = 90
// Evergreen: prefer the real move count from `resource_milestone_events`
// (loader sets `_raw.milestone_move_count`). When that's missing (pre-fetch /
// older cache), fall back to a "born >90d before its current milestone started"
// heuristic — same population, no API cost.
const EVERGREEN_CARRY_DAYS = 90
const brokenCfg = computed(() => settings.uiState.kiosk?.modeConfig?.broken || {})
const brokenHideEmpty = computed(() => !!brokenCfg.value.hideEmpty)
const brokenAllEmpty = computed(() => BROKEN_KINDS.every(k => !broken.value.stats[k]))
// Memory cap on per-kind drill-down lists. 500 covers every realistic project
// without ballooning the reactive state when one category dominates.
const BROKEN_KIND_CAP = 500
const broken = computed(() => {
  const listLimit = Math.max(1, Number(brokenCfg.value.listLimit) || 12)
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const stats = { lostMilestone: 0, statusMismatch: 0, criticalUnowned: 0, deactivatedAssignee: 0, forgotten: 0, wipUnassigned: 0, evergreen: 0, noMilestone: 0, zombie: 0, noType: 0 }
  const ticketsByKind = { lostMilestone: [], statusMismatch: [], criticalUnowned: [], deactivatedAssignee: [], forgotten: [], wipUnassigned: [], evergreen: [], noMilestone: [], zombie: [], noType: [] }
  const lostMilestoneTitles = new Set()
  const offenders = []
  for (const n of openItems.value) {
    const raw = n._raw || {}
    const m = raw.milestone
    const milestoneTitle = m?.title || ''
    const milestoneState = String(m?.state || '').toLowerCase()
    const milestoneStart = safeDate(m?.start_date) || 0
    const assignees = getAssigneeNames(raw)
    const priorityVal = getScopedLabelValue(raw.labels, 'Priority') || ''
    const priBucket = priorityBucket(priorityVal)
    const typeVal = getScopedLabelValue(raw.labels, 'Type') || ''
    const status = currentStatusOfRaw(raw) || ''
    const created = safeDate(raw.created_at) || 0
    const updated = safeDate(raw.updated_at) || created

    const problems = []
    if (milestoneTitle && milestoneState && milestoneState !== 'active' && milestoneState !== 'opened') {
      stats.lostMilestone++; problems.push({ kind: 'lostMilestone', detail: `${milestoneTitle} (${milestoneState})` })
      lostMilestoneTitles.add(milestoneTitle)
    } else if (!milestoneTitle) {
      stats.noMilestone++; problems.push({ kind: 'noMilestone', detail: 'no milestone' })
    }
    if (status && CLOSED_STATUS_RE.test(status)) {
      stats.statusMismatch++; problems.push({ kind: 'statusMismatch', detail: `status: ${status}` })
    }
    if (priBucket === 'blocking' && !assignees.length) {
      stats.criticalUnowned++; problems.push({ kind: 'criticalUnowned', detail: 'critical · unassigned' })
    }
    // Deactivated owner — any assignee whose `state` isn't 'active'. Slim_raw
    // preserves `assignees[].state` from the GitLab REST payload, so we can
    // check directly without a separate user-state map lookup.
    const rawAssignees = Array.isArray(raw.assignees) ? raw.assignees : []
    const dead = rawAssignees.filter(a => a && a.state && DEAD_USER_STATE_RE.test(a.state))
    if (dead.length) {
      stats.deactivatedAssignee++
      const names = dead.map(a => a.name).filter(Boolean).slice(0, 2).join(', ')
      problems.push({ kind: 'deactivatedAssignee', detail: names ? `${names} (${dead[0].state})` : 'deactivated owner' })
    }
    if (/in.?progress|doing|wip/i.test(status) && !assignees.length) {
      stats.wipUnassigned++; problems.push({ kind: 'wipUnassigned', detail: 'WIP · no owner' })
    }
    if (!priorityVal && !assignees.length) {
      stats.forgotten++; problems.push({ kind: 'forgotten', detail: 'no priority + no owner' })
    }
    const moveCount = Number(raw.milestone_move_count)
    if (Number.isFinite(moveCount)) {
      if (moveCount > 0) {
        stats.evergreen++; problems.push({ kind: 'evergreen', detail: `moved ${moveCount}×` })
      }
    } else if (milestoneTitle && milestoneStart && created && milestoneStart - created > EVERGREEN_CARRY_DAYS * day) {
      const carriedDays = Math.floor((milestoneStart - created) / day)
      stats.evergreen++; problems.push({ kind: 'evergreen', detail: `~${carriedDays}d carry` })
    }
    if (created && updated &&
        (now - created) > ZOMBIE_AGE_DAYS * day &&
        (now - updated) > ZOMBIE_IDLE_DAYS * day) {
      stats.zombie++; problems.push({ kind: 'zombie', detail: `${Math.floor((now - updated) / day)}d untouched` })
    }
    if (!typeVal) {
      stats.noType++; problems.push({ kind: 'noType', detail: 'no Type::' })
    }

    if (problems.length) {
      const iid = raw.iid != null ? String(raw.iid) : ''
      const title = raw.title || n.name
      const url = raw.web_url || ''
      // Per-kind drill-down lists (used by card hover tooltips + the Evergreen popover).
      for (const p of problems) {
        const arr = ticketsByKind[p.kind]
        if (arr && arr.length < BROKEN_KIND_CAP) arr.push({ iid, title, url, detail: p.detail })
      }
      offenders.push({
        iid, title, url,
        milestone: milestoneTitle,
        priority: priorityVal,
        assignees,
        problems,
        score: problems.reduce((s, p) => s + (BROKEN_WEIGHTS[p.kind] || 1), 0)
      })
    }
  }
  // Worst-offender list = tickets with ≥2 problems first, then by score desc.
  offenders.sort((a, b) => (b.problems.length >= 2 ? 1 : 0) - (a.problems.length >= 2 ? 1 : 0) || b.score - a.score)
  return {
    stats,
    offenders: offenders.slice(0, listLimit),
    kinds: BROKEN_KINDS,
    ticketsByKind,
    lostMilestoneTitles: [...lostMilestoneTitles]
  }
})

// "#13675, #13678, #13680 (+5 more)" — capped preview for the card-hover title tooltip.
const iidListShort = (tickets, max = 14) => {
  const list = Array.isArray(tickets) ? tickets : []
  if (!list.length) return 'No tickets'
  const head = list.slice(0, max).map(t => `#${t.iid}`).join(', ')
  return list.length > max ? `${head}  (+${list.length - max} more)` : head
}
const brokenCardTitle = (kind, hint) => {
  const tickets = broken.value.ticketsByKind[kind]
  const ids = iidListShort(tickets)
  return hint ? `${hint}\n\n${ids}` : ids
}

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
const filterByMilestone = (title) => {
  if (!title) return
  applyFilter({ selectedMilestones: [title], includeClosed: true })
}
const filterCreatedToday = () => applyFilter({ includeClosed: true, dateFilters: { createdMode: 'last_x_days', createdDays: 1 } })
const filterUpdatedToday = () => applyFilter({ includeClosed: true, dateFilters: { updatedMode: 'last_x_days', updatedDays: 1 } })
const filterOpen   = () => applyFilter({})
const filterByDay = (dayIso) => applyFilter({
  includeClosed: true,
  dateFilters: { createdMode: 'between', createdAfter: dayIso, createdBefore: dayIso }
})

// Local-timezone YYYY-MM-DD — the main filter compares against the issue's
// created/updated string which is local-date keyed via Date parsing.
const tsToYmd = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Activity heatmap cell click: open the main graph filtered to this row's date
// type for the single day clicked. The main view has no "closedMode" — we use
// updatedMode for Closed/All rows since closing a ticket bumps updated_at.
const onHeatmapCellClick = (rowId, cell) => {
  if (!cell || !cell.inRange || cell.count === 0) return
  const dayIso = tsToYmd(cell.ts)
  if (rowId === 'heatmapCreated') {
    applyFilter({ includeClosed: true, dateFilters: { createdMode: 'between', createdAfter: dayIso, createdBefore: dayIso } })
  } else {
    applyFilter({ includeClosed: true, dateFilters: { updatedMode: 'between', updatedAfter: dayIso, updatedBefore: dayIso } })
  }
}

// Activity-by-label cell click: filter the graph to that label + that week's range.
const onHeatmapByLabelCellClick = (rowLabel, cell) => {
  if (!rowLabel || !cell || !cell.count) return
  applyFilter({
    selectedLabels: [rowLabel],
    includeClosed: true,
    dateFilters: { updatedMode: 'between', updatedAfter: tsToYmd(cell.startTs), updatedBefore: tsToYmd(cell.endTs) }
  })
}
const filterUnassigned = () => applyFilter({ selectedAssignees: ['@unassigned'] })
const filterNoMilestone = () => applyFilter({ selectedMilestones: ['@none'] })
const filterNoType      = () => applyFilter({ selectedTypes: ['@none'] })
const filterForgotten   = () => applyFilter({ selectedAssignees: ['@unassigned'], selectedPriorities: ['@none'] })
// Collect actual values from the currently-loaded data, then filter — the
// project-specific Priority::/status label spellings vary, and `selectedStatuses`
// / `selectedPriorities` expect literal matches.
const filterStatusMismatch = () => {
  const seen = new Set()
  for (const n of openItems.value) {
    const s = currentStatusOfRaw(n._raw || {}) || ''
    if (s && CLOSED_STATUS_RE.test(s)) seen.add(s)
  }
  applyFilter({ selectedStatuses: [...seen], selectedState: 'opened' })
}
const filterCriticalUnowned = () => {
  const seen = new Set()
  for (const n of openItems.value) {
    const p = getScopedLabelValue(n._raw?.labels || [], 'Priority')
    if (p && priorityBucket(p) === 'blocking') seen.add(p)
  }
  applyFilter({ selectedPriorities: [...seen], selectedAssignees: ['@unassigned'] })
}
const filterZombie = () => {
  const day = 24 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - ZOMBIE_IDLE_DAYS * day).toISOString().slice(0, 10)
  applyFilter({ dateFilters: { updatedMode: 'before', updatedBefore: cutoff } })
}
// `@deactivated` is a recognised token in useGraphDerivedState — filters the
// main graph to tickets whose assignee account is not 'active'.
const filterDeactivatedAssignee = () => applyFilter({ selectedAssignees: ['@deactivated'] })
// Each lost-milestone ticket may sit in a different closed/expired milestone — collect
// every distinct title we saw and filter by all of them at once.
const filterLostMilestone = () => {
  const titles = broken.value.lostMilestoneTitles
  if (!titles.length) return
  applyFilter({ selectedMilestones: [...titles], includeClosed: true })
}
// Evergreen has no clean predicate (no "milestone_move_count" in the filter UI), so
// we deep-link by exact iid list and open the list view since that's the right
// shape for "browse these specific tickets".
const filterEvergreen = () => {
  const iids = (broken.value.ticketsByKind.evergreen || []).map(t => t.iid).filter(Boolean)
  if (!iids.length) return
  applyFilter({ selectedIids: iids, layout: 'list', includeClosed: true })
}
const filterNoDueDate  = () => applyFilter({ dueStatus: 'none' })
const filterOverdue    = () => applyFilter({ dueStatus: 'overdue' })
const filterBlocked    = () => applyFilter({ selectedStatuses: ['Blocked', 'On Hold/Blocked'] })

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
  /* Burn-in protection: slow ±3px nudge every ~60s (set via the inline custom
     properties on the root element); dim the whole screen when outside the
     configured working hours. */
  transform: translate(var(--kiosk-shift-x, 0), var(--kiosk-shift-y, 0));
  transition: transform 1.6s ease, filter 2s ease;
}
.kiosk.kiosk-off-hours { filter: brightness(var(--kiosk-off-dim, 0.05)); }

/* "Just refreshed" pulse — root toggles .is-refreshed for ~800ms whenever the
   `lastUpdated` prop changes. CSS keyframes pick this up to lightly flash the
   stat numbers and progress bar so the wall acknowledges the data flip. */
.kiosk.is-refreshed .k-stat-num,
.kiosk.is-refreshed .k-target-pct,
.kiosk.is-refreshed .k-health-num,
.kiosk.is-refreshed .k-bar-count {
  animation: kiosk-pulse 0.7s ease-out;
}
.kiosk.is-refreshed .k-target-bar-fill,
.kiosk.is-refreshed .k-trb-seg,
.kiosk.is-refreshed .k-bar-fill,
.kiosk.is-refreshed .k-bar-seg {
  animation: kiosk-bar-glow 0.9s ease-out;
}
@keyframes kiosk-pulse {
  0%   { transform: scale(1);   filter: brightness(1); }
  35%  { transform: scale(1.06); filter: brightness(1.3); }
  100% { transform: scale(1);   filter: brightness(1); }
}
@keyframes kiosk-bar-glow {
  0%   { filter: brightness(1); }
  40%  { filter: brightness(1.35); }
  100% { filter: brightness(1); }
}

/* Activity / Recently-closed feed list animations — items slide in from above and
   fade, slide out to the right and fade; existing items glide to their new row. */
.k-feed-anim-enter-active,
.k-feed-anim-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.k-feed-anim-enter-from  { opacity: 0; transform: translateY(-12px); }
.k-feed-anim-leave-to    { opacity: 0; transform: translateX(24px); }
.k-feed-anim-leave-active { position: absolute; right: 12px; left: 12px; }
.k-feed-anim-move        { transition: transform 0.4s ease; }

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
.kiosk-refresh-eta.is-failing {
  background: rgba(244, 67, 54, 0.18);
  border-color: rgba(244, 67, 54, 0.5);
  color: #ef9a9a;
}
.kiosk-data-age {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; opacity: 0.8;
  font-variant-numeric: tabular-nums;
}
.kiosk-fail-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(244, 67, 54, 0.18);
  border: 1px solid rgba(244, 67, 54, 0.5);
  color: #ef9a9a;
  font-variant-numeric: tabular-nums;
  animation: kiosk-fail-pulse 2.4s ease-in-out infinite;
}
@keyframes kiosk-fail-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
  50%      { box-shadow: 0 0 0 4px rgba(244, 67, 54, 0.18); }
}
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
/* Brief attention pulse on the play/pause button when manual navigation has
   auto-paused cycling — tells the room "cycling stopped, I'm in control now". */
.kiosk-icon-btn.pulse-attention {
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.7);
  animation: kiosk-attn 0.55s ease-in-out 3 alternate;
}
@keyframes kiosk-attn {
  from { transform: scale(1);    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0); }
  to   { transform: scale(1.18); box-shadow: 0 0 10px 2px rgba(var(--v-theme-primary), 0.55); }
}
@media (prefers-reduced-motion: reduce) {
  .kiosk-icon-btn.pulse-attention { animation: none; }
}

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
  position: relative;
}
/* Slow shine sweep so the wall feels alive between refreshes. */
.k-target-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg,
    transparent 0%,
    transparent 38%,
    rgba(255, 255, 255, 0.18) 50%,
    transparent 62%,
    transparent 100%);
  pointer-events: none;
  transform: translateX(-100%);
}
.k-target-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #43a047, #66bb6a);
  border-radius: 10px;
  transition: width 0.6s ease;
}
.k-target-bar-rich { display: flex; height: 18px; }
.k-trb-seg { height: 100%; transition: width 0.5s ease; }
/* Closed segment: a wider green gradient is sized to 200% and slowly slides
   back and forth — a subtle living shimmer to match the stripes' motion. */
.k-trb-seg.k-trb-closed {
  background: linear-gradient(90deg, #2e7d32, #43a047, #66bb6a, #43a047, #2e7d32);
  background-size: 200% 100%;
  background-position: 0 0;
}
.k-trb-seg.k-trb-open   { background: rgba(127, 127, 127, 0.3); }
.k-trb-seg.k-trb-added  { background: repeating-linear-gradient(45deg, #ffb300, #ffb300 6px, #ffa000 6px, #ffa000 12px); }
@media (prefers-reduced-motion: no-preference) {
  .k-target-bar::after    { animation: kiosk-bar-shine    7s ease-in-out infinite; }
  .k-trb-seg.k-trb-added  { animation: kiosk-stripe-slide 1.6s linear infinite; }
  .k-trb-seg.k-trb-closed { animation: kiosk-green-slide  9s ease-in-out infinite; }
}
@keyframes kiosk-bar-shine {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
/* For a 45° gradient with a 12px gradient-axis period, the horizontal
   screen-space period is exactly 12 × √2 ≈ 16.97056px. Anything else (17px,
   12px -12px, …) drifts and the loop point snaps visibly. The float value
   here lets the browser interpolate with sub-pixel precision. */
@keyframes kiosk-stripe-slide {
  from { background-position: 0 0; }
  to   { background-position: 16.97056px 0; }
}
@keyframes kiosk-green-slide {
  0%, 100% { background-position: 0% 0; }
  50%      { background-position: 100% 0; }
}
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
.k-eta-hoverable { cursor: help; position: relative; }
.k-eta-hoverable .k-eta-info { opacity: 0.45; margin-left: auto; }
.k-eta-hoverable:hover .k-eta-info { opacity: 0.85; }

/* Rich ETA hover (the outer .k-eta-tip-wrap is Vuetify-rendered outside this
   component's scope — its rule lives in a separate unscoped <style> block.) */
.k-eta-tip { color: #e6e6e6; font-size: 12.5px; line-height: 1.45; padding: 12px 14px; }
.k-eta-tip-head { display: flex; align-items: flex-start; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.k-eta-tip-head .v-icon { font-size: 22px !important; flex-shrink: 0; margin-top: 2px; }
.k-eta-tip-head-text { min-width: 0; }
.k-eta-tip-title { font-size: 14px; font-weight: 700; }
.k-eta-tip-sub { opacity: 0.75; margin-top: 2px; }
.k-eta-tip.is-on-track .k-eta-tip-head .v-icon { color: #66bb6a; }
.k-eta-tip.is-late     .k-eta-tip-head .v-icon { color: #ef5350; }
.k-eta-tip.is-stalled  .k-eta-tip-head .v-icon { color: #ffb300; }
.k-eta-tip.is-no-deadline .k-eta-tip-head .v-icon { color: #90a4ae; }
.k-eta-tip.is-done     .k-eta-tip-head .v-icon { color: #ffd54f; }
.k-eta-tip-section { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.k-eta-tip-section:last-of-type { border-bottom: none; padding-bottom: 4px; }
.k-eta-tip-section-title {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em;
  opacity: 0.6; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;
}
.k-eta-tip-legend { display: inline-flex; gap: 10px; text-transform: none; letter-spacing: 0; font-size: 10.5px; opacity: 0.85; }
.k-eta-sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; vertical-align: -1px; margin-right: 3px; }
.k-eta-sw-closed { background: #66bb6a; }
.k-eta-sw-added  { background: #ef5350; }
.k-eta-tip-svg { width: 100%; height: auto; display: block; }
.k-eta-tip-timeline { margin-top: 4px; }
.k-eta-tip-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.k-eta-tip-cell { background: rgba(255,255,255,0.04); border-radius: 8px; padding: 6px 8px; text-align: center; }
.k-eta-tip-cell-num { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
.k-eta-tip-cell-lbl { font-size: 10.5px; opacity: 0.7; }
.k-eta-tip-cell-sub { font-size: 10px; opacity: 0.5; font-variant-numeric: tabular-nums; }
.k-eta-pos { color: #66bb6a; }
.k-eta-neg { color: #ef5350; }
.k-eta-tip-formula {
  background: rgba(255,255,255,0.04); border-radius: 6px; padding: 6px 8px;
  font-variant-numeric: tabular-nums; font-size: 12px;
}
.k-eta-tip-formula code { background: transparent; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
.k-eta-tip-foot { font-size: 10.5px; opacity: 0.5; padding-top: 8px; font-style: italic; }

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
  /* auto-sized chip + iid (collapse to 0 when empty) keep the title as wide as
     possible. minmax(160px, 1fr) prevents the title from shrinking to a few
     letters on narrow / portrait kiosks. */
  grid-template-columns: auto auto minmax(160px, 1fr) auto auto;
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
  max-width: 110px;
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

/* Milestones screen — richer per-milestone card (head row, stacked bar, chips). */
.k-milestones { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-ms-list { display: flex; flex-direction: column; gap: 10px; overflow: auto; min-height: 0; }
.k-ms-row {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 14px; border-radius: 8px;
  background: rgba(127, 127, 127, 0.05);
  border-left: 3px solid transparent;
  transition: background 0.2s ease;
}
.k-ms-row.k-clickable:hover { background: rgba(127, 127, 127, 0.1); }
.k-ms-target-row { background: rgba(var(--v-theme-primary), 0.08); border-left-color: rgb(var(--v-theme-primary)); }
.k-ms-complete { opacity: 0.78; }

.k-ms-head { display: grid; grid-template-columns: 1fr auto auto; align-items: baseline; gap: 14px; }
.k-ms-title { display: flex; align-items: center; gap: 6px; font-size: clamp(15px, 1.4vw, 18px); font-weight: 700; min-width: 0; }
.k-ms-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.k-ms-counts { font-size: 13px; opacity: 0.8; font-variant-numeric: tabular-nums; white-space: nowrap; }
.k-ms-closed-n { color: #66bb6a; font-weight: 700; }
.k-ms-divider { opacity: 0.5; margin: 0 1px; }
.k-ms-total-n { font-weight: 600; }
.k-ms-open-n { opacity: 0.7; }
.k-ms-pct {
  font-size: clamp(20px, 2vw, 26px); font-weight: 800;
  font-variant-numeric: tabular-nums; line-height: 1; min-width: 56px; text-align: right;
}
.k-ms-pct-good { color: #66bb6a; }
.k-ms-pct-warn { color: #ffb300; }
.k-ms-pct-low  { color: #ef5350; }

.k-ms-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: rgba(127, 127, 127, 0.15); }
.k-ms-seg { height: 100%; transition: flex-grow 0.5s ease; }
.k-ms-seg-closed { background: linear-gradient(90deg, #43a047, #66bb6a); }
.k-ms-seg-open   { background: rgba(127, 127, 127, 0.28); }

.k-ms-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.k-ms-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; padding: 2px 9px;
  border-radius: 12px; background: rgba(127, 127, 127, 0.12);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.k-ms-chip.k-ms-on-track { background: rgba(102, 187, 106, 0.18); color: #66bb6a; }
.k-ms-chip.k-ms-done     { background: rgba(102, 187, 106, 0.22); color: #43a047; }
.k-ms-chip.k-ms-warn     { background: rgba(255, 179, 0, 0.18);  color: #ffb300; }
.k-ms-chip.k-ms-soon     { background: rgba(255, 138, 0, 0.22);  color: #ff8a00; }
.k-ms-chip.k-ms-late     { background: rgba(239, 83, 80, 0.18);  color: #ef5350; }
.k-ms-chip.k-ms-velocity { background: rgba(33, 150, 243, 0.14); color: #64b5f6; }
.k-ms-chip.k-ms-neutral  { background: rgba(127, 127, 127, 0.12); }

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
.k-velocity { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 12px; }
.k-velocity .k-section-sub .k-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 2px 0 2px; vertical-align: middle; }
/* Calendar grid: ISO-week-number column on the left, Mon..Sun headers on top,
   then N week rows × 7 day cells. Each cell shows the date number top-left and
   the daily net centered. */
.k-vel-cal {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: 36px repeat(7, 1fr);
  grid-template-rows: auto;
  grid-auto-rows: 1fr;
  gap: 4px;
}
.k-vel-corner {}
.k-vel-dow {
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; letter-spacing: 0.04em;
  opacity: 0.6; text-transform: uppercase;
}
.k-vel-weeknum {
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; opacity: 0.5; font-variant-numeric: tabular-nums;
}
.k-vel-cell {
  position: relative;
  border-radius: 4px;
  min-width: 0; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  transition: filter 0.2s ease;
}
.k-vel-cell-date {
  position: absolute; top: 4px; left: 6px;
  font-size: 11px; font-weight: 500; opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.k-vel-cell-net {
  font-size: clamp(15px, 1.7vw, 26px);
  font-weight: 700; color: rgba(255,255,255,0.94);
  font-variant-numeric: tabular-nums;
}
.k-vel-cell.k-clickable { cursor: pointer; }
.k-vel-cell.k-clickable:hover { filter: brightness(1.25); outline: 1px solid rgba(255,255,255,0.5); }
/* Today's cell — bright yellow ring with a pulsing glow so the room can find
   "now" at a glance even when the daily-net colours are loud. z-index lifts it
   above neighbour outlines on hover. */
.k-vel-cell-today {
  outline: 3px solid #ffd54f;
  outline-offset: 2px;
  z-index: 1;
  box-shadow:
    0 0 0 1px rgba(255, 213, 79, 0.55),
    0 0 14px 4px rgba(255, 213, 79, 0.55),
    0 0 28px 6px rgba(255, 213, 79, 0.25);
}
@media (prefers-reduced-motion: no-preference) {
  .k-vel-cell-today { animation: kiosk-today-glow 2.4s ease-in-out infinite; }
}
@keyframes kiosk-today-glow {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(255, 213, 79, 0.45),
      0 0 12px 3px rgba(255, 213, 79, 0.4),
      0 0 24px 6px rgba(255, 213, 79, 0.18);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 213, 79, 0.75),
      0 0 22px 6px rgba(255, 213, 79, 0.7),
      0 0 40px 10px rgba(255, 213, 79, 0.35);
  }
}
.k-vel-cell-outside .k-vel-cell-date { opacity: 0.35; }
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

/* Milestone burndown */
.k-burndown-section { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-burndown-title { display: flex; align-items: center; gap: 8px; text-transform: none; font-size: clamp(18px, 1.8vw, 24px); letter-spacing: 0; opacity: 1; }
.k-burndown-svg { flex: 1; min-height: 0; width: 100%; height: 100%; }
.k-burndown-legend { display: flex; gap: 20px; flex-wrap: wrap; font-size: 15px; opacity: 0.9; font-weight: 500; }
.k-burndown-legend .k-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
.k-burndown-legend .k-swatch-dotted {
  background: transparent !important;
  border-top: 2px dashed rgba(255, 255, 255, 0.55);
  height: 0; border-radius: 0;
  width: 16px;
  vertical-align: middle;
  margin-top: 5px;
}
.k-burndown-legend .k-legend-spacer { flex: 1; }
.k-burndown-warn { color: #ef5350; font-weight: 600; }
.k-burndown-warn-data {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #ffb300;
  font-weight: 600;
}

/* Activity heatmap */
.k-heatmap-section { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-heatmap-stack { gap: 6px; }
.k-heatmap-row {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 2px;
}
.k-heatmap-row-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
  padding-left: 36px;
}
.k-heatmap-svg { flex: 1; min-height: 0; width: 100%; height: 100%; }
.k-heatmap-svg .k-hm-clickable { cursor: pointer; }
.k-heatmap-svg .k-hm-clickable:hover { stroke: rgba(255,255,255,0.6); stroke-width: 1.5; }

/* Combined breakdown screen: stack the three blocks (priority / status / type)
   vertically and share the body's vertical space. Each block gets a flex share
   so longer lists shrink rather than push the next block off-screen. */
.k-breakdown { flex: 1; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
.k-breakdown-block { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
.k-breakdown-block .k-section-title { margin-bottom: 6px; }
.k-breakdown-block .k-bar-list { flex: 1; min-height: 0; }
.k-heatmap-legend {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; opacity: 0.75; justify-content: flex-end;
}
.k-heatmap-legend .k-hm-swatch {
  display: inline-block; width: 12px; height: 12px;
  border-radius: 2px;
}
.k-heatmap-legend span:first-child { margin-right: 4px; }
.k-heatmap-legend span:last-child  { margin-left: 4px; }

/* Blockers (fire-alarm) */
.k-blockers { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.k-blockers-title,
.k-wip-title {
  display: flex; align-items: center; gap: 8px;
  text-transform: none;
  font-size: clamp(18px, 2vw, 28px);
  letter-spacing: 0;
  opacity: 1;
}
.k-blockers-title { color: #ef5350; }
.k-wip-title { color: #ffb300; }
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

/* Leaderboard — MVP banner + grid of per-category podium cards.
   Each card has its own accent colour via --lb-accent (set inline on the card)
   so titles, numbers and the top border share the metric's identity colour. */
.k-leaderboard { display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; }
.k-leaderboard-title { display: flex; align-items: center; gap: 8px; text-transform: none; font-size: clamp(18px, 2vw, 28px); letter-spacing: 0; opacity: 1; color: #ffd54f; }
.k-leaderboard-title .v-icon { color: #ffd54f; }

.k-lb-mvp {
  display: flex; align-items: center; gap: 18px;
  padding: 14px 22px; border-radius: 14px;
  background: linear-gradient(90deg, rgba(255, 213, 79, 0.16), rgba(255, 167, 38, 0.06));
  border: 1px solid rgba(255, 213, 79, 0.35);
  flex-shrink: 0;
}
.k-lb-mvp-crown { color: #ffd54f; font-size: 36px !important; flex-shrink: 0; }
.k-lb-mvp-text { flex: 1; min-width: 0; }
.k-lb-mvp-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.7; }
.k-lb-mvp-name { display: flex; align-items: center; gap: 12px; font-size: clamp(20px, 2.2vw, 32px); font-weight: 800; margin-top: 4px; min-width: 0; }
.k-lb-mvp-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.k-lb-mvp-avatar { width: 36px !important; height: 36px !important; font-size: 13px !important; flex-shrink: 0; }
.k-lb-mvp-pills { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
.k-lb-mvp-pill {
  display: inline-flex; align-items: baseline; gap: 4px;
  padding: 6px 12px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 12px; opacity: 0.85;
  font-variant-numeric: tabular-nums;
}
.k-lb-mvp-pill strong { font-size: 18px; font-weight: 800; color: rgb(var(--v-theme-on-background)); }

.k-lb-grid {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  overflow: auto;
}
.k-lb-card {
  display: flex; flex-direction: column;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-top: 3px solid var(--lb-accent, rgb(var(--v-theme-primary)));
  border-radius: 10px;
  padding: 12px 12px 10px;
  background: rgba(127, 127, 127, 0.04);
  min-height: 0;
}
.k-lb-card-title {
  display: flex; align-items: center; gap: 6px;
  font-size: clamp(12px, 1.1vw, 14px); font-weight: 700;
  margin-bottom: 8px;
  color: var(--lb-accent, rgb(var(--v-theme-primary)));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.k-lb-card-empty { opacity: 0.5; font-style: italic; font-size: 13px; padding: 6px 2px; }
.k-lb-card-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; overflow: auto; min-height: 0; }
.k-lb-card-list li {
  display: grid;
  grid-template-columns: 22px 22px minmax(0, 1fr) auto;
  gap: 8px; align-items: center;
  padding: 5px 8px; border-radius: 6px;
  background: rgba(127, 127, 127, 0.05);
  border-left: 3px solid transparent;
}
.k-lb-card-list li.k-lb-medal-gold   { background: rgba(255, 213, 79, 0.13); border-left-color: #ffd54f; }
.k-lb-card-list li.k-lb-medal-silver { background: rgba(200, 200, 200, 0.10); border-left-color: #cfd8dc; }
.k-lb-card-list li.k-lb-medal-bronze { background: rgba(205, 127, 50, 0.12); border-left-color: #cd7f32; }
.k-lb-rank-mini {
  font-size: 12px; font-weight: 700; text-align: center;
  font-variant-numeric: tabular-nums; opacity: 0.7;
  display: flex; align-items: center; justify-content: center;
}
.k-lb-medal-icon { font-size: 18px !important; }
.k-lb-medal-gold   .k-lb-medal-icon { color: #ffd54f; }
.k-lb-medal-silver .k-lb-medal-icon { color: #cfd8dc; }
.k-lb-medal-bronze .k-lb-medal-icon { color: #cd7f32; }
.k-lb-avatar { width: 22px !important; height: 22px !important; font-size: 10px !important; }
.k-lb-name-text {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: 600;
}
.k-lb-card-num {
  font-size: 16px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--lb-accent, inherit);
}

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
.k-feed-opened  { border-left-color: #ef5350; }
.k-feed-closed  { border-left-color: #66bb6a; }
.k-feed-updated { border-left-color: #ffb300; }
.k-feed-icon { opacity: 0.9; }
.k-feed-opened  .k-feed-icon { color: #ef5350; }
.k-feed-closed  .k-feed-icon { color: #66bb6a; }
.k-feed-updated .k-feed-icon { color: #ffb300; }
.k-feed-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
}
.k-feed-opened  .k-feed-tag { background: rgba(239, 83, 80, 0.18); color: #ef5350; }
.k-feed-closed  .k-feed-tag { background: rgba(102, 187, 106, 0.18); color: #66bb6a; }
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

/* Ticket health (problems dashboard) */
.k-health { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; }
.k-health-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.k-empty-inline { grid-column: 1 / -1; padding: 10px 0; }
.k-health-card {
  appearance: none;
  text-align: left;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(127, 127, 127, 0.05);
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: default;
}
.k-health-card.k-clickable { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.k-health-card.k-clickable:hover { background: rgba(127, 127, 127, 0.14); border-color: rgba(var(--v-theme-primary), 0.45); }
.k-health-icon { opacity: 0.85; }
.k-health-num {
  font-size: clamp(28px, 4vw, 52px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
}
.k-health-lbl {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  font-weight: 600;
}

.k-health-title { text-transform: none; font-size: clamp(16px, 1.6vw, 22px); letter-spacing: 0; opacity: 0.95; }
.k-health-feed { flex: 1; min-height: 0; }
.k-target-feed.k-health-feed li {
  grid-template-columns: 90px 60px minmax(0, 1fr) minmax(0, 2fr) 30px;
}
.k-health-tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.k-health-tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .k-today { grid-template-columns: repeat(2, 1fr); }
  .k-health-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .k-health-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>

<!-- Unscoped: the v-tooltip body is teleported to <body>, so its outer wrapper
     (`content-class="k-eta-tip-wrap"`) is not reachable from scoped CSS. -->
<style>
.k-eta-tip-wrap {
  max-width: 440px !important;
  padding: 0 !important;
  background: rgba(20, 22, 26, 0.97) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55) !important;
  opacity: 1 !important;
}
</style>
