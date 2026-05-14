# Changelog

## [0.12.0] - 2026-05-14
- New kiosk mode **Activity by label** — GitHub-style heatmap where each row is one of the top labels (department / component / area / customer / …) and columns are weeks within the window. Cell intensity = events touching that label in that week. Great for spotting which areas of the project have been moving over the past year. Configurable in Configuration → Kiosk: window (60–730 days, default 365), top-N (3–30, default 10), include-scoped-labels toggle.
- Year labels added to both heatmaps (Activity heatmap + Activity by label) and the burnup chart's x-axis ticks. First label and any year transition now show `Jan 2026` instead of bare `Jan`, so multi-year windows (730d) and year-spanning 365d charts aren't ambiguous.

## [0.11.9] - 2026-05-14
- Fix: Activity heatmap kiosk page was hanging the browser. Three layers stacked into a perfect ResizeObserver loop: the v-for'd SVG used a function ref that called `nextTick(watchModeSvgs)` on every render, the watcher re-attached the observer, the observer's synchronous `update()` could shift `heatmapSize` by a subpixel from layout rounding, that re-rendered the SVG, the function ref fired again, … forever. Stripped the function ref down to just setting the ref value; the existing watcher already handles observer attachment when the ref changes.
- Also reduced heatmap DOM weight: skip the `<title>` tooltip and the `new Date().toLocaleDateString()` formatting on empty cells (most of the ~1100 cells per render). The grid stays visually identical but the DOM is roughly half the elements and the recompute is faster.

## [0.11.8] - 2026-05-14
- Kiosk feed rows (Blockers / Stale WIP / Target open list) layout cleaned up: priority chip and iid columns now auto-size to their content (collapsing to 0 when empty), and the title column has a 160px minimum so titles don't truncate to a few letters on narrow / portrait kiosks. Priority chip width is also capped at 110px so an unusually long Priority label can't dominate.

## [0.11.7] - 2026-05-14
- Fix: `ReferenceError: Cannot access 'burnupSvgRef' before initialization` on kiosk mount. The `watchModeSvgs` watcher tracked `burnupSvgRef` / `heatmapSvgRef` but those refs were declared lower in the file, hitting JS's temporal dead zone when the watcher's getter ran during `setup()`. Moved both pairs of refs (and the heatmap function-ref setter) up next to the watcher.

## [0.11.6] - 2026-05-14
- Activity heatmap consolidated: the three separate Heatmap modes (Created / Closed / All) are merged into a single **Activity heatmap** mode that stacks all three rows in one view — green for creates, blue for closes, purple for combined. Better use of vertical space than the previous "one mode per heatmap" approach. Header still shows the totals/peaks across all three. Existing users who had any of the legacy modes enabled are auto-migrated to the new combined mode.

## [0.11.5] - 2026-05-14
- Fix: a normal Refresh now reliably picks up the wider closed-history window. The previous detection relied on a Vue watcher firing as the value changed; if two synchronous mutations (e.g., the migration bumping 7 → 180 right after `Object.assign` had set it to 7) batched into a single tick that ended at the same value Vue had seen before, the watcher never fired. Replaced with a robust check: every successful sync remembers the `gitlabClosedDays` it ran under (`meta.lastSyncClosedDays`), and the next `loadData` compares against the current setting — different ⇒ force full. No watcher timing involved.

## [0.11.4] - 2026-05-14
- Fix: burnup and heatmap charts no longer visibly resize a frame after the kiosk mode is entered (or the page is reloaded with `Ctrl+R`). The chart used to render once at a fallback viewBox and then snap to the real container size when the ResizeObserver caught up. The SVG content now only renders after the observer has measured the container, so it appears at the correct size in one go.

## [0.11.3] - 2026-05-14
- The default "Include closed issues" window is now **Last 180 days (6 months)** instead of 7 days. Existing users still sitting on the old 7-day default get a one-time bump to 180; anyone who explicitly picked a different value (14 / 30 / 90 / etc.) is preserved. The auto-full-sync watcher kicks in afterwards, so the next refresh actually fetches the newly-included history.

## [0.11.2] - 2026-05-14
- Burnup chart now flags the portion of the timeline that pre-dates GitLab's `Include closed issues` window. The old portion gets an amber-hatched overlay + a dashed vertical marker labeled "Closed data starts here", and the legend carries an `mdi-alert` warning ("Closed data only available since May 7 (last 7d) — earlier portion may be incomplete" or "Closed data not loaded — set Include closed issues in Configuration → GitLab" when the value is 0). Without this, the closed line looked flat-then-spiking and made teams think they hadn't closed anything for months when really we just hadn't fetched it.

## [0.11.1] - 2026-05-14
- "Overdue / stale / unassigned" mode redesigned as **Ticket health**:
  - Six problem-category stat cards at the top — Overdue / Stale / Unassigned / No priority / No due date / Blocked — each click-throughs into the corresponding main-graph filter where applicable.
  - **Most problematic** list below — every open ticket gets scored against all six problem categories; tickets hitting 2+ problems are listed sorted by severity (weighted: overdue & blocked count higher than missing metadata). Each row shows the priority pill, iid, title, all matching problem tags (colored chips), and assignee avatar — click opens in GitLab.
  - Respects all global kiosk filters (target milestone + priority + stale + exclude-backlog) like every other mode.

## [0.11.0] - 2026-05-14
- Three new kiosk modes — GitHub-style activity heatmaps:
  - **Heatmap · created** (green) — tickets created per day
  - **Heatmap · closed** (blue) — tickets closed per day
  - **Heatmap · all** (purple) — combined opens + closes per day

  Default window is 365 days (configurable 60–730). Cells are intensity-bucketed against the busiest day so spikes stand out, month labels run along the top, Mon/Wed/Fri labels on the left. Less ↔ More legend in the bottom-right. All three modes share one `days` config in Configuration → Kiosk and cycle naturally as part of the kiosk rotation — the wall flips through the three colors over time.

## [0.10.12] - 2026-05-14
- Changing "Include closed issues" now auto-triggers a full re-sync on the next normal refresh — no more needing Ctrl+Refresh to actually fetch the newly-included history.
- New options in the dropdown: Last 180 days (6 months), Last 365 days (1 year).

## [0.10.11] - 2026-05-14
- Graph legend widened from 220 → 250px and its title-bar controls (Groups checkbox + Name / # sort buttons) now wrap onto a second row if needed — the rightmost "#" sort button was being clipped at the default width.

## [0.10.10] - 2026-05-14
- Burnup chart fonts bumped for wall readability: Y axis 13→18, X axis 13→16, Today/Due pills 12→16, legend 12→15. Lines bumped to 3px / 3.5px and the ideal-burn dash stretched to 8/6 so they read from across the room.
- Fix: dropped `preserveAspectRatio="none"` on the burnup SVG — combined with the `ResizeObserver` that already pins viewBox to actual pixel size, this means strokes and text are now rendered at native resolution with no axis-asymmetric stretching.

## [0.10.9] - 2026-05-14
- Burnup chart: the future zone (everything right of "today") is now dimmed with a translucent black overlay so the eye stays on the past where the actual data lives. The Today and Due markers are now solid pills (white for Today, red for Due) instead of thin dashed lines + tiny text, so they pop from across the room.

## [0.10.8] - 2026-05-14
- Burnup chart: SVG viewBox is now matched to the container's actual pixel size via a `ResizeObserver`, so text and stroke widths render uniformly (no horizontal squish / vertical stretch on wide kiosk screens). Axis label font bumped from 10 → 13 to match the new 1:1 scaling, with a wee bit more padding so labels don't crowd the chart edge.

## [0.10.7] - 2026-05-14
- Fix: kiosk now operates on the full ticket set instead of inheriting the main sidebar's filters. Click-throughs in earlier sessions left `includeClosed: false` (or other) on the sidebar; closed tickets were never reaching the kiosk dashboard. Kiosk owns its own filters (target milestone / priority / stale / backlog) so the sidebar doesn't need to scope it any more.

## [0.10.6] - 2026-05-14
- Fix: kiosk Priority filter was hiding closed tickets that had no Priority:: label, making the closed counts and velocity / activity feeds collapse. The filter now applies to open tickets only — same treatment as the Stale and Exclude-Backlog filters — so closed work still shows up as historical events.

## [0.10.5] - 2026-05-14
- Kiosk polish pass:
  - Every big number now uses thousands separators (`1,799` instead of `1799`) so totals are easier to read from across the room.
  - Today's pulse, Target stats, and Risks cards each get a small `mdi-` icon in the corner (plus / check / trending / pencil / sigma / account-off / calendar-question) for instant scanning.
  - Workload rows now show a colored initials avatar next to each name (same hashed-color pattern as the activity feed) so people are recognizable without reading.
  - Priority / Status / Type / Hot labels / Aging bar lists got a `% of total` side column so the relative share of each bucket is visible alongside the absolute count.
  - Velocity highlights the rightmost "Today" bar with a dashed primary border so the current day reads instantly.
  - Empty states are friendlier: 48px `mdi-` icon + centered text (e.g., `No blockers — clear sailing` with `mdi-check-decagram-outline`).

## [0.10.4] - 2026-05-14
- Kiosk global filters (Stale threshold, Exclude Backlog, Priority filter, Target milestone) now affect **every** kiosk screen — including target focus, burnup chart, milestone progress, today's pulse, velocity, recent activity feed, recently closed, blockers, stale WIP, etc. Previously stale + backlog only applied to count modes. Config hints updated to reflect the new global scope.

## [0.10.3] - 2026-05-14
- Burnup chart overhaul:
  - **Smart window** — anchors to the milestone's `start_date` only when it's within 2× the configured window (default 90 days, configurable). Otherwise rolls back from the due date, or falls back to recent activity. Tickets that pre-date the window become a Day-1 baseline so the chart starts at meaningful counts instead of zero.
  - **Ideal-burn guideline** — dashed white line from `(start, baseline-closed)` to `(due, scope)`, the visual target a developer can compare the green line against from across the room.
  - **Risk-zone fill** — open work area between scope and closed is amber by default; turns red when closures lag the ideal line by 15+ tickets, so "we're behind" jumps out.
  - **On-track / behind ideal burn** label in the legend.
- Note: chart lines are reconstructed from each ticket's `created_at` / `closed_at` — there are no daily historical snapshots, so retroactive label / milestone changes can't be reconstructed.

## [0.10.2] - 2026-05-14
- Burnup chart now anchors the X axis to the earliest ticket creation instead of the milestone's `start_date`. Re-used / old milestones often have a `start_date` years before the first real ticket lands, which left 99% of the chart flat at zero. The "Due" marker label is also offset below the "Today" label so they don't sit on top of each other when both fall near the chart's right edge.

## [0.10.1] - 2026-05-14
- New global kiosk **Priority filter** (Configuration → Kiosk → Active filter). Pick any combination of Blocking / High / Medium / Low / Other / No priority — when set, every kiosk mode counts only those tickets. Pair it with the target milestone for a "blocking work for v0.39" wall. Header shows an orange `Blocking + High` chip when active, and deep-link click-throughs carry the filter into the main graph too.

## [0.10.0] - 2026-05-14
- Target milestone screen: **rich segmented progress bar**. Three segments — green = closed, grey = open from the original scope (tickets created on/before milestone start_date), striped amber = scope creep (tickets added after start). Tiny legend underneath shows the counts. Falls back to a 2-segment view when the milestone has no `start_date`.
- New kiosk mode **Milestone burnup** — classic agile cumulative flow chart. Two lines (indigo "scope" / green "closed") with the open work shaded between them, vertical "Today" and "Due" markers, and date / count axes. Built as inline SVG so it scales cleanly to any kiosk screen.

## [0.9.3] - 2026-05-14
- Fix: false "Share URL: Unknown URL key 'paused' — ignored." warning that popped up when entering kiosk mode. The main view's share-codec was running on kiosk's URL args (`paused` / `cycle` / `refresh`) which don't belong to it; gated decode + encode on `activePage === 'main'`.

## [0.9.2] - 2026-05-14
- New kiosk mode **Stale WIP** — open tickets in "In progress" / "Doing" / "WIP" status that haven't been updated in N days (default 5). Amber theme, sorted by longest-idle first. Great for surfacing forgotten work in stand-ups.
- **Workload by assignee** bars are now **stacked by priority** (Blocking / High / Medium / Low / Other / No priority), so you can see at a glance who's drowning in critical work vs. routine items. Toggle off in Configuration → Kiosk if you prefer plain bars.
- **Status breakdown** now shows the **average idle days** per status — surfaces review / QA queue bottlenecks (e.g., "Ready for Review: 35 · avg idle 8d"). Red when > 14 days.
- **Blockers** mode: new "Only show blockers ≤ N days old" config — pair it with the default list to flip between fresh-blockers and the legacy long-tail.

## [0.9.1] - 2026-05-14
- Target milestone screen redesigned:
  - **ETA banner** — projects when the milestone will land using the last 14 days of closure / add rate. Color-coded: green "on track" with slack-days, red "X days late", amber "stalled" when scope is growing faster than closures, gold trophy "milestone complete", grey "no due date".
  - Stat cards now have rate sub-lines (closed last 14d · added last 14d · closed/wk vs added/wk).
  - Two new side-by-side panels: **Recently closed** and **Recently added** within the milestone (last 14 days, 6 each, clickable to open in GitLab).
  - Replaces the previous "Top open in milestone" list — use the Blockers / Activity modes for that.

## [0.9.0] - 2026-05-14
- When a target milestone is set, **the whole kiosk is now scoped to that milestone**. Today's pulse, velocity, workload, priority, status, type, hot labels, aging, activity, recently closed, blockers, and risks all only count tickets in that milestone. Milestone progress and the Target focus mode keep showing the full picture.
- The kiosk header shows a primary-colored flag chip with the active milestone name so it's obvious what's being filtered.
- Clicking through to the main graph from kiosk now also carries the milestone filter forward.

## [0.8.4] - 2026-05-14
- New kiosk mode **Hot labels** — plain labels appearing on tickets with any activity in the last 24h (configurable). Shows what topics the team is actually working on right now. Click a label to filter the graph by it.

## [0.8.3] - 2026-05-14
- Kiosk Recent activity: the right-side columns (comments, assignee, time) now line up neatly across rows instead of wobbling when a ticket has no comments or no assignee.

## [0.8.2] - 2026-05-14
- Configuration → Kiosk now has an "Open kiosk" button so you can preview the dashboard without leaving the page or remembering the hotkey.

## [0.8.1] - 2026-05-14
- Fix: graph legend no longer shows a horizontal scrollbar when label texts are long.

## [0.8.0] - 2026-05-14
- Two new kiosk modes (13 total):
  - **Blockers** — open tickets with blocking/critical priority, critical severity, or "blocked" status/label. Oldest first, red theme.
  - **Recently closed** — celebration view of tickets closed in the last 48h (configurable).

## [0.7.7] - 2026-05-14
- Kiosk config tab polished: grouped sections (Timing / Active filter / Target), per-mode cards with icons, "Enable all" / "Disable all" buttons, enabled count in the header.

## [0.7.6] - 2026-05-14
- Kiosk: pin a target milestone (Configuration → Kiosk).
  - New **Target milestone** mode with big completion %, due-date countdown, and top open tickets.
  - The Milestone progress mode pins it to the top.

## [0.7.5] - 2026-05-14
- Kiosk: new "Exclude Status::Backlog" setting (on by default) — drops backlog tickets from workload / priority / status / type / aging / risks.

## [0.7.4] - 2026-05-14
- Kiosk header: gear icon opens Configuration → Kiosk directly.

## [0.7.3] - 2026-05-14
- Kiosk Recent activity also shows "updated" events (comments, label changes, edits) and a comment-count badge per row. Toggleable in the kiosk config.

## [0.7.2] - 2026-05-14
- Kiosk: click the refresh pill in the header to refresh manually and reset the countdown.

## [0.7.1] - 2026-05-14
- Kiosk header clock now shows weekday, date, and timezone next to the time.

## [0.7.0] - 2026-05-14
- Kiosk: global "stale" filter (default 60 days) — excludes long-idle tickets from workload / priority / status / type counts. Set to 0 to count everything.
- Four new kiosk modes: **Status breakdown**, **Type breakdown**, **Milestone progress**, **Aging buckets**.
- Per-mode options (velocity days window, workload top-N, activity feed size, etc.).
- Configuration → Kiosk redesigned with per-mode cards.

## [0.6.0] - 2026-05-14
- Kiosk: shareable URLs (`#/kiosk/<mode>/paused=1/cycle=10/refresh=2`). Mode, pause state, and cycle/refresh overrides all live in the URL.
- Most rows and numbers in kiosk are clickable — deep-link into the main graph with the right filter applied, or open the issue in GitLab.

## [0.5.2] - 2026-05-14
- Kiosk Recent activity redesigned: colored borders, icons, issue numbers, and a circular initials avatar for the actor.

## [0.5.1] - 2026-05-14
- Kiosk workload mode now excludes backlog and long-idle tickets so the bars reflect active work.

## [0.5.0] - 2026-05-14
- New **Kiosk dashboard** mode for wall-mounted / always-on displays. Open with `Shift+K`. Auto-refreshes data and cycles through summary screens. Six initial modes: Today's pulse, 7-day velocity, Workload by assignee, Priority overview, Recent activity, Overdue / stale / unassigned.

## [0.4.6] - 2026-05-14
- Hotkeys settings: wider gap and a divider between the two columns.

## [0.4.5] - 2026-05-14
- Fix: cycle hotkeys (color / grouping / link mode) now wrap around at the end.
- New hotkeys: `]` expand all sidebar sections, `[` collapse all.

## [0.4.4] - 2026-05-14
- Focus mode now shows a small `×` in the bottom-left corner to exit without remembering the hotkey.

## [0.4.3] - 2026-05-14
- The `L` hotkey now also hides the bottom-right scale bar, leaving the canvas completely bare.

## [0.4.2] - 2026-05-14
- Hotkeys settings tab is more compact: two-column layout, indented rows.

## [0.4.1] - 2026-05-14
- Hotkeys grouped by category (Layout / Graph view / View modes / App) in the settings tab and `?` cheatsheet.

## [0.4.0] - 2026-05-14
- **Keyboard shortcuts**. Configuration → Hotkeys tab to view and rebind. Press `?` anywhere for a cheatsheet.
- Defaults: `B` sidebar, `F` focus mode, `L` hide legend, `Shift+L` collapse legend, `P` physics, `R` recenter, `Shift+F` fit, `Shift+R` reflow, `C` color mode, `Shift+C` grouping, `N` link mode, `U` hide unlinked, `Shift+X` reset filters, `T` theme, `,` open Configuration, `?` shortcuts.

## [0.3.39] - 2026-05-14
- Reflow Graph button uses a clearer icon (atom) so it doesn't look like the data Refresh button.

## [0.3.38] - 2026-05-14
- Fix: graph no longer disappears / flickers when opening or closing the sidebar.

## [0.3.37] - 2026-05-14
- Graph legend is now collapsible — click the chevron next to "Legend".

## [0.3.36] - 2026-05-13
- Filter dropdowns: pinned width (no more jitter), taller menu, zebra striping.
- Date inputs auto-fill sensible defaults when picking Before / After / Between / Last X Days.
- Active filter field highlighted, others dimmed.
- Colored icons on date-mode dropdown rows.

## [0.3.35] - 2026-05-13
- Filter dropdowns sort by ticket count — frequently-used values first.
- Status dropdown: dedicated icons only for statuses actually used in the data.
- Tickets without an explicit status no longer fall back to "Done" / "To do" — they don't appear under any status.

## [0.3.34] - 2026-05-13
- Fix: Status filter showed nothing for "In progress" / "On Hold/Blocked" / etc. on self-managed GitLab installs.
- Filter dropdowns show per-row ticket counts that react to the other active filters.
- Status / Priority / Type / Milestone / etc. dropdowns get distinct colored icons.
- Date-range filters auto-fill sensible defaults.
- "Sample data" notice promoted to a top app bar.
- GitLab URL config accepts shorthand (`gitlab.example.com`).
- "Create token" link warns to bump expiration to the maximum.

## [0.3.33] - 2026-05-13
- Status filter always lists all 7 standard GitLab work-item statuses plus any project-specific ones.
- "Group / Color by Label" excludes scoped labels (use the dedicated Priority / Type / Component modes).

## [0.3.32] - 2026-05-13
- Fix: grouping by assignee + filtering by specific assignees no longer spawns clones in every co-assignee's group.

## [0.3.31] - 2026-05-13
- Shareable view URL format switched to path-style segments for cleaner URLs.

## [0.3.30] - 2026-05-13
- Shareable views: the URL always reflects the current filters + view. Copy and share.
- Defaults are omitted from URLs to keep them short.

## [0.3.29] - 2026-05-13
- Type filter now has a "(No type)" entry for tickets without a Type scoped label.

## [0.3.28] - 2026-05-13
- Multi-assignee tickets handled properly across grouping, coloring, legend, and labels.
- Optional sidebar toggle to fall back to single-assignee clones.

## [0.3.27] - 2026-05-13
- Milestone and Priority filters now have "(No milestone)" / "(No priority)" entries.

## [0.3.26] - 2026-05-13
- Fix: filtering by assignee on multi-assignee tickets now matches any assignee on the ticket.

## [0.3.25] - 2026-05-13
- Warning banner when the GitLab token is about to expire or has already expired.
- Configuration shows token expiry date and remaining days.
- "Create token" button defaults to full `api` scope.

## [0.3.24] - 2026-05-13
- Dependency bump (Vuetify 4, Vite 8, Electron 42, …) — 0 known vulnerabilities.
- Simplified "Create token" UX in Configuration → GitLab.
- Fix: occasional duplicate / racing data loads.

## [0.3.23] - 2026-01-14
- Status dropdown now reflects the actual statuses present in loaded data (fixes missing "On Hold/Blocked", etc.).

## [0.3.22] - 2026-01-14
- Click a legend swatch to pick a custom color per item; Reset restores defaults.
- Priorities use a severity-aligned palette (red → green).

## [0.3.21] - 2026-01-14
- Closed issues now strictly respect "Include closed issues" — no more layout artifacts from hidden-but-present nodes.

## [0.3.20] - 2026-01-14
- Incremental refresh now picks up state transitions (open ↔ closed).
- Fix: grouping no longer occasionally collapses everything into a single "default" group after tab switching.

## [0.3.19] - 2026-01-09
- Faster physics + zoomed-out drawing on large graphs.
- Improved frame fit; deterministic group label positioning.
- Autocomplete for color and group selectors.
- New "Unassigned" filter option; Epic preset added.

## [0.3.18] - 2026-01-09
- Incremental GitLab refresh — only fetch updated issues (with a 12h overlap to avoid drift).

## [0.3.17] - 2026-01-09
- New filters and color modes: due date, time tracking, tasks.
- More filter dimensions: MR presence, participants, due status, spent, budget, estimate, task completion.
- User selectors show non-active states and "Me" / "Deactivated users" entries.

## [0.3.16] - 2026-01-08
- Fix: scoped labels.
- Pause / resume button for the physics simulation.
- Switched to GraphQL for richer field coverage.
- New "Component" preset.

## [0.3.15] - 2026-01-08
- Graph view is preserved during ticket changes.

## [0.3.14] - 2026-01-08
- Auto-update to prevent browser caching of stale builds.

## [0.3.13] - 2026-01-08
- Tiny context-menu border-radius polish.

## [0.3.12] - 2026-01-08
- Test suite fixes.

## [0.3.11] - 2026-01-08
- Detects whether your GitLab token can write, and warns when it can't.
- Context menu adds close / reopen / assign-to-me / unassign actions when the token allows.

## [0.3.10] - 2026-01-07
- Right-click context menu on issues.
- Sidebar: "Clear filters" moved next to the Filters header; "Fit to screen" added to the collapsed mini toolbar.

## [0.3.9] - 2026-01-07
- Navigation state better preserved in the URL.
- About page polish.

## [0.3.8] - 2026-01-07
- Fix: prevent duplicate GitLab fetches when "Save & Close / Reload" is triggered while a fetch is running.

## [0.3.7] - 2026-01-07
- Fix: token-at-rest obfuscation now stores under the correct key, keeping the runtime token plain.

## [0.3.6] - 2026-01-07
- GitLab token is stored obfuscated at rest (XOR + base64), no plain text in local storage / backups.

## [0.3.5] - 2026-01-06
- Initial public release on GitHub.
