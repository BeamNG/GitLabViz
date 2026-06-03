# Changelog

## [0.13.4] - 2026-06-03
- **Flake History: open the local viewer via a custom scheme command instead of a file path.** A new **"Use command listener trigger"** setting (in the Flake History settings dialog and the first-run form) switches how a heatmap click opens the viewer: rather than opening a local file (`shell.openPath` / `file://`), GitLabViz fires a configurable scheme URL that your local tooling can handle. The command is set by **"Command listener call"** (default `command:v1/run_custom_command`, a neutral placeholder you override for your environment) and is fired verbatim — in the desktop build through the OS handler (`shell.openExternal`), in the browser through a best-effort anchor-click. The existing file-based open stays the default (toggle off), so nothing changes unless you opt in.
- **New "open viewer on click" toggle in the app bar.** A per-session switch (top-right, monitor icon) controls whether a left-click also opens the viewer at all. It defaults **on** every time the page loads and is intentionally **not** persisted — when off, clicking a cell only downloads the artifacts (or opens the pipeline once they've expired) without surfacing the viewer.
- **Right-click context menu on heatmap cells.** Right-clicking a cell now offers **Download artifact** (disabled once artifacts have expired or when none was published) and **Go to pipeline** (disabled when the run has no pipeline URL) — the same two actions a left-click chooses between, now available explicitly.

## [0.13.3] - 2026-06-02
- **Flake History: "Build health" cards below the heatmap.** The right panel is now split — the heatmap keeps the top two-thirds, and a row of per-suite status cards fills the bottom third. One card per suite present in the bundle (e.g. smoketest / continuous / nightly), each summing across all gfx configs:
  - A big **days-without-failures** count for that suite. It counts whole days from the suite's last *broken* build to the bundle's `generated_at` (so it's stable for a published bundle, not a drifting wall-clock number); `0` when the latest build is itself broken. A build counts as broken when any test failed in it — `run.status` only distinguishes complete/interrupted, so failure is derived from the test results.
  - A **per-gfx subtitle** (`dx11: 3/26, dx12: 21/26, vulkan: 21/26`) showing `passed/total` tests from each gfx config's most recent run of that suite.
  - A **status colour** driven by the latest build: green when every gfx passed 100%, orange when some but not all gfx have failures, red when all of them do, grey when there's no data.
- The cards are a fixed status dashboard — intentionally independent of the heatmap's suite / gfx / search / last-N filters.

## [0.13.2] - 2026-06-02
- **Flake History: clicking a live artifact now also opens your local results viewer.** Previously a heatmap cell with downloadable artifacts only triggered the download; you then had to find and open the viewer yourself. Now, on the same click, GitLabViz also opens a local viewer file so the results are one step away. In the desktop (Electron) build this uses the OS default handler (`shell.openPath`); in the browser build it makes a best-effort `file://` open, which most browsers block — so this is primarily a desktop convenience. Expired / no-URL cells are unchanged: they still just open the pipeline (there's nothing freshly downloaded to view).
- **New configuration button on the Flake History page.** A gear in the app bar opens a settings dialog for the flake screens (project ID/path, package name, refresh interval) — previously only editable through the first-run "not configured" form, which disappeared once a bundle loaded.
- **Two new settings drive the viewer open:**
  - **Game install folder** (`gameInstallPath`) — the root where the game is installed (e.g. `D:\BeamNG.drive`). Empty = the auto-open feature is off; download-only behaviour is unchanged.
  - **Viewer file** (`viewerRelPath`, default `game/test-viewer.html`) — the viewer path *relative to* the install folder, joined onto the root. Override it to point elsewhere, e.g. `graphic_viewer.html` opens `<root>/graphic_viewer.html`. Empty falls back to the default.

## [0.13.1] - 2026-05-30
- **Heatmap cells link straight to a run's downloadable artifacts.** The bundle schema gains an optional `artifacts_url` on `runs[]`; when present, clicking a cell downloads that run's artifacts instead of only opening its pipeline. Producers that don't publish artifact URLs are unaffected — those cells keep opening the pipeline.
- **Expiry-aware click behaviour.** Artifacts don't live forever, so the viewer estimates per-suite expiry windows and shades expired cells distinctly (same pass/fail hue, darker). A click on a live cell downloads; once a run's artifacts have expired the direct URL would 404, so it falls back to opening the pipeline — the prior behaviour, and where runs without any URL land too.
- **Tests grouped across suites in the heatmap.** A test that runs under multiple suites is now shown as a single grouped row (its per-suite ids are preserved for cross-highlighting with the leaderboard) rather than fragmented across rows.

## [0.13.0] - 2026-05-26
- **New Flake History view + kiosk mode + public bundle schema.** GitLabViz can now read a `flake-history-bundle.v1.json` published by any CI source and render two new screens for it:
  - A **desktop view** (sidebar → Flake) with a top-100 leaderboard, a per-test × per-run heatmap, suite + gfx facets, a last-N-runs slider, free-text search across test name / module / test_id (filters both panels in lockstep), and click-to-open-pipeline on every heatmap cell. The classification chip (`stable` / `intermittent` / `actively_flaky` / `broken`) is computed from the *facet-filtered* pass/fail counts so filtering to e.g. `suite=smoketest` shows how flaky the test is in that scope specifically, not the bundler's across-all-suites label. A new **Runs** column shows `pass/total` for the active facet so a small-denominator "intermittent" is visually distinguishable from a heavy one. An info dialog spells out the four thresholds; "Show all tests" flips the leaderboard between top-100-flaky and the unbounded list including stable rows.
  - A **kiosk panel** (`flake` mode, opt-in) tuned for legibility-at-distance: "Currently broken" + "Top flaky" lists with 5-run dot sparklines on the flaky side.
  - A **public producer contract** under `docs/flake-history-bundle.v1.schema.json` (JSON Schema draft-2020-12) with a worked `fixtures/flake-history-bundle-sample.json` and `docs/flake-history-integration.md` explaining how to publish a bundle from any CI — `pipeline_url` is optional, `additionalProperties: true` everywhere so producers can ship experimental fields without breaking validation. The schema is the only surface the viewer commits to.
- Settings live under **Configuration → Flake History** (`projectId`, `packageName`, `refreshMinutes`); URL + token reuse the existing GitLab settings. First-time users get an inline configuration form inside the view.
- **Fix:** `#/flake` is now a real, bookmarkable hash route. Previously `useHashRouting` only knew `main / config / chattools / kiosk`, so clicking the Flake sidebar button briefly rendered the view and then the router resynced `activePage` back to `main` — the screen flashed and bounced back to "No data loaded". Two regression tests pin the no-bounce behavior and the inbound-hash sync.
- **UX polish on the new view:** split toolbar (primary app-bar with back / title / search / theme / info / refresh, secondary filter row), heatmap cells redesigned as padded tiles with hover scale + soft shadow so they read as clickable instead of a fused band, leaderboard and heatmap each in their own rounded surface card, theme toggle reuses the global light → dark → system → schedule cycle, data table paginates at 50/page, redundant checkbox column dropped (row click already selects, heatmap cross-highlight unchanged).
- **Note for producers:** the four classification thresholds in `src/services/flake.js → classifyFromCounts()` are kept in sync with `bundle_flake_history.py → _flake_classification` on the producer side. If you publish your own bundles, mirror those thresholds or your "broken" labels will disagree with the viewer's chips.

## [0.12.54] - 2026-05-21
- **Kiosk: media play/pause key now toggles the cycle timer.** Keyboards with a dedicated play/pause button (and the Fn-combo equivalents on most laptops) fire `MediaPlayPause` / `MediaPlay` / `MediaPause` key events; the kiosk now treats these the same as the existing **Space** hotkey, so you can pause and resume the page-flip rotation without finding the spacebar. Works as long as the kiosk window has keyboard focus — on some setups the OS routes media keys to a background media player first.

## [0.12.53] - 2026-05-19
- **Burndown: now shows the future + a projection line, drawn with Chart.js.** The inline-SVG chart is replaced with a Chart.js canvas — the x-axis now extends past today to the **DUE** date (or projected **ETA**, whichever is later), the **ideal-burn** dashed line runs the full `(start, initialOpen) → (due, 0)` instead of stopping at today, and a new dashed **projection** line continues from today using the same 14-day burn rate that drives the ETA chip on the Target screen (amber when burning down, red when stalled / scope-growing). The projection ends at y=0 on the ETA date when the team is shipping, or extends to chart end at the current slope when stalled. Also fixed: the apparent "line goes back at today" artifact — the final data point is now anchored exactly at `now` so a late-day delta doesn't get projected to the next day boundary under the step rendering. TODAY / DUE / ETA each get their own coloured vertical marker + label badge along the top of the plot; everything past TODAY is faintly shaded as "the future". All existing features kept (data-unavailable hatch + cutoff badge, behind-ideal red tint, end-of-line value badges, on-track / behind status, fallback warnings, due-date subtitle).

## [0.12.52] - 2026-05-19
- Fix `Invalid prop: type check failed for prop "viewLayout". Expected String ... got Number with value 2` Vue warning on app boot. An old build that briefly wired a third Kiosk button into the layout `<v-btn-toggle>` could persist a numeric index into `uiState.view.layout`; the loader now coerces anything that isn't exactly `'list'` back to `'graph'` so stale localStorage no longer leaks an unexpected type into `AppSidebar` / `SidebarFilterControls`.

## [0.12.51] - 2026-05-19
- **Kiosk Velocity calendar: flipped net sign so `+` = bad (red), `−` = good (green).** Previously the daily NET was computed as `closed − created`, so a productive shipping day rendered as e.g. "+28" in green — which most readers parse as "+28 added to the backlog" (= bad), the opposite of what the colour says. Now matches the "Today's pulse" convention (`net = created − closed`): a `+N` cell in red means N tickets were added to the backlog that day, a `−N` cell in green means the backlog shrank by N. Colour-to-meaning mapping is unchanged (green = closing > creating, red = creating > closing); only the sign on the number flips. Legend updated to spell it out: "−N: backlog shrank · +N: backlog grew".

## [0.12.50] - 2026-05-19
- **ETA details panel: theme-aware in light mode + less squashed + less wasted space + scales with viewport.** The rich ETA breakdown (floating tooltip + always-expanded inline panel on the Kiosk Target screen) was tuned for dark backgrounds — `#e6e6e6` text, white-tinted borders/cell backgrounds (`rgba(255,255,255,0.04…0.08)`), a near-black inline panel (`rgba(20,20,22,0.55)`) and tooltip wrap (`rgba(20,22,26,0.97)`) — all of which ranged from low-contrast to outright unreadable on a light theme. Switched the panel chrome to Vuetify's on-surface tokens (`rgba(var(--v-theme-on-surface), x)`) and the floating wrapper to `rgb(var(--v-theme-surface))` so it auto-adapts. The inline SVG neutrals (axis line, peak/date labels, timeline rail, "today" tick text) now use `currentColor` + `*-opacity` so they inherit the theme-aware text colour; semantic green / red / amber / blue stays explicit. Bumped the bar-chart viewBox height (92→130) and the timeline viewBox height (38→56) so the always-expanded panel fills its grid instead of leaving the daily bars and timeline ribbon-thin in the wasted space below the formula column. Inline mode also now (a) hides the panel's own head row — it just repeated the chip directly above with a wide empty band on the right — and (b) lays the four throughput cells out 2×2 instead of 1×4, so the throughput column's height matches the chart / formula columns rather than ending with a big white gap below it. Finally, the panel's base `font-size` is now `clamp(12.5px, 0.95vw, 16px)` and every descendant size / padding / gap is `em`-relative, so on wider kiosks / wall displays the cell numbers, formula text, section titles and inner spacing all scale up together (capped at 16px base so it never goes wild on 4K) instead of leaving the content tiny in a wide panel.

## [0.12.49] - 2026-05-19
- **Heatmaps theme-aware in light mode.** The Activity heatmap, Activity-by-label heatmap and Velocity calendar were tuned for dark backgrounds — empty cells (`rgba(127,127,127,0.12)`) dissolved into the white page in light mode, and the dark reds / greens read like ink stains. Each kind now ships a parallel light-mode palette (pastel-to-deep ramps inspired by the Material palette) plus theme-appropriate empty-cell and balanced-day greys. The label-hashed palette and the by-label legend got the same treatment. Switches live via the existing `app-theme-changed` event — no reload needed when the schedule flips.

## [0.12.48] - 2026-05-19
- New **Always show ETA details** option in Configuration → Kiosk → Target. When on, the rich ETA breakdown (14-day spark-bar, throughput grid, formula, timeline) renders inline below the chip on the Target screen instead of being hidden behind a hover tooltip — useful for wall displays where the room can't hover. The chip's "info" hint icon and hover affordance are suppressed in inline mode. Default off (existing hover-only behaviour preserved).

## [0.12.47] - 2026-05-19
- **Config back-arrow returns to where you came from.** Opening Configuration from the kiosk and then clicking back now restores the kiosk instead of dumping you to the main page. Same fix applies symmetrically for ChatTools → Config → back. The previous page is captured at the moment Config opens, so URL-paste entries (`#/config/...`) still fall back to main.

## [0.12.46] - 2026-05-19
- New **Schedule** option in the Theme dropdown (Configuration → Display) — light theme during configurable office hours, dark theme outside. Two extra hour fields appear when selected (default 7..19); `start === end` means always dark, `start > end` wraps midnight (e.g. 18..6 = light overnight). The theme re-evaluates every minute so the wall flips automatically when crossing the boundary, with no reload needed. Toggle hotkey now cycles light → dark → system → schedule.

## [0.12.45] - 2026-05-19
- **Tighter `?v=` cleanup after auto-update reload.** The cache-bust query param is now stripped synchronously at the very top of the page-load script (was: only after a successful version-check fetch, and only when the value matched `LOCAL_VERSION` exactly). The dirty URL is therefore visible only for the duration of the navigation flash — no longer than strictly necessary. Captured the original value before stripping so the loop-prevention guard ("server is stale, don't reload again") still works.

## [0.12.44] - 2026-05-19
- **Kiosk: daily 3am safety reload when auto-update is broken.** Belt-and-suspenders against walls getting stuck on a stale build because the version-check channel itself is broken (DNS hiccup, proxy intercepting `current_version.json`, server down). Once per day during the 3am hour the kiosk force-reloads the page — but only when no successful version-check has happened in the last hour, so healthy kiosks never see it. Last reload date persisted in `localStorage` so the post-reload run doesn't loop.

## [0.12.43] - 2026-05-19
- **List view avatars: graceful fallback on broken images.** Author / assignee photos that fail to load (404, CORS-blocked, GitLab avatar host hiccups) now silently swap to the initials+colour bubble instead of rendering as a broken-image icon. Tracks failed URLs in a small in-memory set so other rows sharing the same URL also fall back without re-trying. Working photos continue to render as before.

## [0.12.42] - 2026-05-19
- Fix `Cannot access 'pt' before initialization` crash on kiosk mount in 0.12.41 — the new data-age / refresh-failure computeds referenced `relTime` which was declared later in the same setup block (TDZ). Moved the helper above its consumers.

## [0.12.41] - 2026-05-19
- **Kiosk header surfaces data age + refresh failures.** A new "data: 5m ago" chip in the header keeps the room aware of how stale the wall is, and refresh failures no longer go quietly — when a sync fails (offline, GitLab down, expired token) a pulsing red "Refresh failed Xm ago" chip appears next to the clock, the refresh button itself flips red, and the tooltip shows the underlying error plus the timestamp of the first failure since the last success. The chip clears automatically on the next successful sync.

## [0.12.40] - 2026-05-19
- **App-wide auto-update.** Always-on tabs / kiosks pick up new deploys automatically. The bootstrap update check (poll `current_version.json`, hard-reload via `?v=<newVersion>` cache-buster on a strictly-newer version) is no longer GitHub-Pages-only — it now runs on any HTTP host (internal Apache/nginx/IIS deployments included) and is skipped on `file://` (Electron) where there's no remote deploy to compare against. New **Check for app updates** combo box in Configuration → Display lets you set the poll interval (Disabled / 1m / 5m / 15m / 30m / 1h / 6h, default 5m). Reload only fires when a newer version is detected, so short intervals are safe — no churn while idle. Setting changes take effect immediately (no app restart needed).

## [0.12.39] - 2026-05-18
- New **Leaderboard** kiosk mode — five side-by-side podiums highlighting the team from different angles: **Most closed today**, **Most opened today**, **Most active · 7d** (combined closures + opens), **Top discussion** (sum of comment counts on tickets they raised — GitLab doesn't expose per-user note counts so author is the cleanest proxy), and **Heaviest workload** (current open assigned). Each card highlights its top 3 with gold/silver/bronze medals; the overall "Most active today" person gets a crown banner up top with a quick-glance summary of their closed/opened/workload counts. Click any row to filter the graph by that person. Per-category row count is configurable in Configuration → Kiosk → Leaderboard (default 5).

## [0.12.38] - 2026-05-18
- **Broken tickets:** "Hide empty categories" now defaults to **on** so the screen only shows cards with actual offenders. Flip it off in Configuration → Kiosk → Broken tickets if you want the full grid back.

## [0.12.37] - 2026-05-18
- **Burndown:** widened the chart's right padding so the "TODAY" badge at the right edge of the plot is no longer clipped off the SVG. Added end-of-line value badges at today — a coloured dot at each line's endpoint plus the current Closed and Remaining counts in the line colour (with a dark text-outline for legibility against any background). Labels are clamped below the TODAY pill and pushed apart vertically when the two lines end close to each other, so the numbers are readable without scanning down to the legend. The TODAY vertical line itself is now a thin dashed translucent white instead of a solid bright stroke, so it sits in the background and doesn't compete with the data lines.

## [0.12.36] - 2026-05-18
- **Burndown is now event-accurate.** The loader fetches `resource_milestone_events` for every ticket with a milestone (open + closed, was open-only), persists the dated `{ts, action, title}` events on `_raw.milestoneEvents`, and the burndown computation now uses them to build real "in milestone T" intervals per ticket. Scope at time *t* counts tickets whose intervals contain *t* (= they were actually in the milestone then), instead of guessing from `created_at`. This fixes the over-counted "added" line on milestones that receive tickets from other milestones mid-flight — a ticket created Feb 1 in another milestone and moved to 0.39 in May now appears in 0.39's scope at the May date, not Feb. Tickets that have left the milestone correctly drop out of scope at their `remove` event. Subtitle reports the now-accurate `(+N added, −M closed)` for the window; a fallback warning shows in the legend when some tickets haven't been enriched yet (reload to refresh).

## [0.12.35] - 2026-05-18
- List view rows now share the graph's right-click context menu (open URL, close/reopen, assign/unassign me, copy shorthand/URL/markdown/summary, filter by author/assignee/milestone/status/priority/type, filter by label, "same label combo"). Extracted as a reusable `IssueContextMenu` so the two views stay in sync — the row header strip is tinted with the same colour pip the user is right-clicking. Row left-click still opens the issue URL; row right-click opens the menu (header right-click keeps the column controls menu unchanged). The active row gets a yellow glow while its menu is open so it's obvious which ticket the actions apply to.
- New **List view: single-click row** setting under Configuration → Appearance — choose between "Open the ticket" (existing behaviour, single-click navigates to GitLab) and "Select the row" (single-click highlights the row with a primary-coloured glow, double-click opens). Double-click always opens regardless of the setting; right-click still opens the context menu either way.

## [0.12.34] - 2026-05-18
- **Burndown** y-axis now includes the closed line — was only sized to `max(initialOpen, peakRemaining)`, so when cumulative closures exceeded that (common when the team ships a lot and/or scope grows mid-milestone) the green line drew off the top of the chart.

## [0.12.33] - 2026-05-18
- New `selectedIids` filter — explicit iid whitelist for deep-linking to a specific set of tickets. Used by the Evergreen kiosk card: clicking it now opens the **list view** filtered to the exact evergreen iids (was a popover in 0.12.32). The kiosk's apply-filter patch also accepts a `layout` field that switches the main view to `graph` or `list` on landing. `resetFilters` clears `selectedIids`; the URL share codec deliberately ignores it (ephemeral, not worth sharing).
- New **Deactivated owner** broken-tickets card — flags open tickets whose assignee `state` isn't `active` (blocked / deactivated / banned / ldap_blocked: work stuck on someone who left). Clicking applies `selectedAssignees: ['@deactivated']` (existing token in the main filter).
- **List view rework.** The Sidebar Columns panel is gone — column controls are now exclusively on the header right-click menu (sort asc/desc, clear sort, add to multi-sort, move to start/end, reset width, hide; full column list with drag-reorder, show-all/hide-all/reset-all, clear-sorts). The colour pip moved into its own narrow always-on column so the strip aligns regardless of iid width. Group headers show a leading dot or avatar, the label, a vertical pill chart of row colours within the group, and the count; when grouping is active pagination is disabled (`-1` per page, footer hidden) so groups don't get split. New colour modes: tag, author, assignee, milestone, epic, iteration, weight, age, last_updated, time_estimate, time_spent, time_ratio, budget_status, estimate_bucket, task_completion, upvotes, merge_requests, comments, timeline_(created|updated|closed). New grouping modes: state, tag, weight, epic, iteration, stale, scoped:* (any scoped-label prefix), timeline_(created|updated|closed). A clickable colour legend below the table lets you hover/pin a colour to highlight matching rows and dim the rest (group rows + their pills track the same focus). Sticky-header cells now render with an opaque theme-aware background so scrolled rows don't bleed through. The "None" colour mode now paints the open/closed pip (matching the menu label "None (Open/Closed)") instead of leaving it transparent.
- Profile photos in the list view — `INCLUDE_AVATARS` is on, `slimIssue` keeps `avatar_url` for author / assignee / assignees, IssueList renders the photo (with initial-fallback) in the assignee / author cells and in assignee / author group headers.

## [0.12.32] - 2026-05-18
- **Broken tickets** cards are all explorable now. **Lost milestone** is clickable — it collects every distinct closed/expired milestone title seen in the open-ticket data and applies them as `selectedMilestones` (with `includeClosed`). **Evergreen** has no clean main-view filter (no "milestone_move_count" predicate exists), so the card now opens a popover listing every evergreen ticket — `#iid · moved Nx · title`, each row opens GitLab directly. Per-card hover tooltips on every card preview the first 14 ticket iids (`#13675, #13678, … (+5 more)`) so the room can spot specific tickets without leaving the screen.

## [0.12.31] - 2026-05-18
- **Rich ETA hover** on the target-milestone header. Replaces the plain `Projected 435d late vs due date` line with a hover card that explains *how* the ETA is derived:
  - Headline with status icon + ETA date and the slack/late delta.
  - 14-day spark-bar (green = closes ↑, red = adds ↓ around a centre axis) so the trend the projection is built from is visible at a glance.
  - 4-cell throughput grid: closed-in-Nd, added-in-Nd, net/wk, open remaining.
  - Formula box `open ÷ net/wk = weeks → ETA <date>`.
  - Mini timeline with markers for today, due, and ETA — coloured segment between due and ETA (red = late, green = slack).
  - Footer caveat explaining it's a linear extrapolation. Hover only (`info` icon hint on the chip); the chip itself stays the same one-line summary so the wall view is unchanged.

## [0.12.30] - 2026-05-18
- Main view layout is now a URL **path segment** like the other pages: `#/list/q=foo` instead of `#/layout=list/q=foo`. `graph` is the default and stays implicit (no segment); `list` is explicit. Old `layout=list` kv-form URLs continue to decode for back-compat but the share button emits the new form. Toggling Graph ↔ List via the sidebar button (or the Shift+V hotkey) updates the URL live.

## [0.12.29] - 2026-05-18
- **Shareable list-view URLs.** The view-share codec now encodes/decodes the list-view state alongside filters + display: `layout=list` toggles the layout, `cols=…` carries column order, `colsHide=…` carries the hidden set, `colsW=key~px,…` carries per-column widths, and `sort=key~asc,key~desc,…` carries the multi-sort spec. Each piece is only emitted when it diverges from the defaults so URLs stay short. Existing graph URLs continue to work; new keys are validated on decode (unknown column keys are silently dropped). `getCurrentConfigSnapshot` includes the full `listColumns` object, and `applyConfiguration` merges over the user's saved state so a partial URL (e.g. just a sort) doesn't wipe their other customisations.
- More columns added to the list view (Author, Labels, Comments, Weight, Epic, Iteration, Estimate, Spent, Closed) — all hidden by default. Existing users get them hidden automatically on first encounter via `sanitizeIssueListState`.
- Group rows: click anywhere on the row toggles the group (chevron is now icon-only). Ticket count pushed to the right edge so multiple group rows have their counts in a vertical column.
- Drag-reorder shows a primary-coloured drop-target highlight on the header you're about to drop onto. Right-click any header opens a context menu with Show/Hide checkboxes for every column + Reset.

## [0.12.28] - 2026-05-18
- List view polished:
  - **Draggable column reorder** — grab any column header and drop it on another to swap positions. Same drag works on the rows in the "Columns" menu.
  - **Show / hide columns** via a new "Columns" menu in the toolbar (top-right of the table). Checkbox per column + a Reset button to restore defaults.
  - **Multi-column sort** — Vuetify's `multi-sort` enabled. Shift-click a column header to add a secondary sort; the header shows numbered badges for sort order.
  - **Column widths fixed** so titles no longer wrap to 8-line stacks. Each column has an explicit width; Title is the flex column and uses single-line ellipsis (full title in tooltip). Table scrolls horizontally if cramped instead of squeezing everything.
  - All three (order / hidden / sortBy) are persisted to `settings.uiState.view.listColumns` so the layout survives reloads.
- **Graph ↔ List switcher moved** from the canvas overlay (where it overlapped the legend / sample-data watermark / kiosk header chips) into the sidebar, right above the Presets section. Same Shift+V hotkey.

## [0.12.27] - 2026-05-18
- New **list view** for tickets alongside the existing issue graph. Same `filteredNodes` powers both views, so switching has no data lag — just a render swap. Sortable `v-data-table` with columns for #, Title, State, Status, Priority, Type, Assignee, Milestone, Due, Updated, Created. Priority cells colour by canonical bucket (Blocking/High/Medium/Low/Other), assignees show as avatar + first name, dates render relative (`2h ago`, `3d ago`), closed tickets get a strike-through. Row click opens the issue in GitLab. Floating top-right toggle (`<v-btn-toggle>`) switches Graph ↔ List; hotkey **Shift+V** does the same; the choice persists via `settings.uiState.view.layout`.
- Extracted `priorityBucket` + colour/label maps from `KioskPage.vue` into `src/utils/priorityBucket.js` so both kiosk and list view share the same canonical bucketing (no duplicate code per the no-dupes rule).

## [0.12.26] - 2026-05-18
- **Evergreen** detector now uses real history. The loader fetches each open ticket's `resource_milestone_events` (REST, concurrency 20) and stores `milestone_move_count = (distinct milestones the ticket has lived in) − 1` on `node._raw`. Chip reads `moved 3×` instead of the heuristic `~142d carry`. Fetched only for open issues that currently have a milestone; closed tickets and milestone-less ones are skipped. Cached counts survive incremental syncs (only re-fetched when the ticket itself was updated). Falls back to the original 90d-before-milestone-start heuristic when the count isn't available yet (older cache, fetch failure).
- **Hide empty categories** toggle in Configuration → Kiosk → Broken tickets: when on, broken-ticket category cards with a count of 0 collapse out of the grid so the wall stays focused on what's actually wrong. A small "All categories clean" badge replaces the grid when everything's 0.

## [0.12.25] - 2026-05-18
- **Broken tickets** mode gains an **Evergreen** category — tickets that have been carried across multiple milestones and never seem to ship. Detection uses an `(milestone.start_date − ticket.created_at) > 90 days` heuristic: a ticket born well before its current milestone even started must have lived in a previous one before being moved here. Detail chip shows the carry-over in days (`carried 142d`). No-click card because there's no clean main-view filter for "carried days" — but the offender list surfaces them with the chip so users can drill in. Lossless alternative would be fetching `resourceMilestoneEvents` per ticket via GraphQL; the heuristic catches the same population at zero extra API cost.

## [0.12.24] - 2026-05-18
- **Broken tickets** mode expanded with three more invalid states (now 8 categories total, ordered by severity in the card grid):
  - **Status mismatch** — open ticket whose work-item status is `Done` / `Won't do` / `Duplicate` / `Resolved` / `Verified` / `Invalid` / `Completed` / `Closed`. Pure workflow leak — they should have been closed. Click filters to those statuses on opened tickets.
  - **Critical · no owner** — `Priority::Blocking` (or `Critical`) ticket with no assignee. Fire-alarm signal. Click filters to those priority labels + unassigned.
  - **Zombie** — created > 365 days ago AND not updated > 90 days. Long-abandoned. Click filters by `updatedMode='before'` past the idle threshold.
- Status-mismatch and Critical-unowned click filters collect the *actual* label / status values seen in the loaded data (so project-specific spellings like `0 - Blocking` vs `Blocking` both work) before applying.

## [0.12.23] - 2026-05-18
- New kiosk mode **Broken tickets** — surfaces tickets that have leaked out of the workflow and are likely to be forgotten. Five categories on one screen: **Lost milestone** (open ticket whose milestone is closed/expired), **No milestone** (open ticket with no milestone), **WIP · no owner** ("in progress"-ish status but nobody assigned), **Forgotten** (no priority AND no assignee — truly invisible), **No type** (no `Type::` label). Each card shows the count; clickable cards filter the main graph by the matching condition (`@none` milestone / unassigned / `@none` type / unassigned + `@none` priority). Below the cards, the worst-offender list shows tickets ranked by problem count + severity score with one chip per problem reason — same shape as Ticket health. Surfaces workflow leaks the existing modes don't.
- Renamed "Blockers" → "Blocked issues" everywhere user-facing (kiosk section title, mode list, Configuration). Internal id `blockers` unchanged so URLs / settings stay stable.

## [0.12.22] - 2026-05-15
- Velocity calendar: today's cell now has a bright yellow ring with a slow pulsing glow (honors `prefers-reduced-motion`) so the room can find "now" at a glance even when neighbour cells are loud red/green.
- Milestone progress sorted properly: target pinned first, then milestones by due date (closest first), then no-deadline ones (TBD / Backlog) at the bottom. Total count is the final tiebreaker.
- Hot labels bar restored to the **stacked-by-priority** layout — bar splits into Blocking / High / Medium / Low / Other / No-priority segments with the matching legend. (The 0.12.11 work had been lost during a merge.)
- Target progress bar: striped "added after start" segment now loops seamlessly. The barber-pole shift is `16.97px` (= 12 × √2, one full stripe period along the 45° gradient axis) instead of the slightly-off `17px` that produced a visible micro-jump every cycle. The closed segment also gains a slow green-gradient shimmer to match.
- Stale WIP and Blockers headlines now share the same large mixed-case style — they were previously inconsistent sizes.
- Off-hours dim default end hour bumped 19 → 21 — most offices empty out closer to 9pm than 7pm.
- **Kiosk always starts at the first enabled mode** when opened from inside the app (Shift+K hotkey, "Open kiosk" config button) instead of resuming wherever the cycle had drifted last session. URL-based entries (`#/kiosk/burndown/…`) still respect the URL.
- **URL stays in sync with what's displayed** on page transitions. The previous "kiosk → main" path could either show an "Unknown URL key paused" snackbar (the kiosk's `paused=1` arg leaked into the main view's share decoder) or, after the first fix, leave the URL empty even though main-view filters were still applied. Now the routing layer clears the old page's keyspace on transition AND the main page re-publishes its current filter/view state on arrival (via `nextTick` to defer past the clear).
- Loading status in the sidebar rebuilt: messages are now emitted as `headline\ndetail` (e.g. `Issues` / `page 5 / 20 · 25%`) and rendered as two lines — primary headline on top, dim tabular-numeral detail below. Always reserves 2 rows of height so the sidebar doesn't visibly jump when the loader cycles between short ("Starting…") and long ("Closed issues / page 21 · 8400 fetched") messages. Affected emitters: REST + GraphQL issue paginate, GraphQL field enrichment, REST epic enrichment, SVN log, issue links, Mattermost validation, and the data loader's own status lines.

## [0.12.21] - 2026-05-15
- **Screen burn-in protection** for always-on office kiosks. Two opt-in safeguards in Configuration → Kiosk:
  - **Pixel shift** (default ON): nudges the kiosk view by ±3px every ~60 seconds with a slow 1.6s transition. Imperceptible at normal viewing distance, but no single pixel stays the same colour for more than a minute — the industry-standard mitigation for OLED retention on signage.
  - **Dim outside working hours** (default OFF): configurable hours window (`start..end`, 0–23, local time; `end < start` wraps midnight for night shifts), plus a brightness slider (0 = fully black, 1 = no dim, default 0.05). Single biggest burn-in win for displays in offices that aren't 24/7. Data still refreshes and modes still cycle in the background — the wall just gets very dark.

## [0.12.20] - 2026-05-14
- Velocity calendar re-laid-out as a proper month-view: **ISO-week-number column on the left**, **Mon..Sun headers across the top**, week rows underneath. Each cell now shows the **date number** in the top-left (with the short month name prepended on the 1st of each month, e.g. `May 1`) and the daily net (+N / -N) centred. Same red/green/grey coloring rules. Looks and reads like Google Calendar / Outlook's month grid rather than a raw heatmap.

## [0.12.19] - 2026-05-14
- Burndown chart cleaned up. **No more future projection** — the x-axis ends at today instead of stretching to the due date, the future-zone dim overlay and the DUE on-chart marker are gone, and the dashed ideal-burn line is **capped at today** rather than projecting all the way to `(due, 0)`. Due-date context now lives in the title subtitle (`due Jun 30 · 47d to go` / `12d overdue`). **Cumulative closed line readded** alongside the remaining line so the room sees both "how much is left" (primary) and "how much has been shipped" (secondary, thinner & slightly transparent). Legend updated to match.

## [0.12.18] - 2026-05-14
- **Velocity** kiosk mode redesigned again — now a **single calendar** of the last N weeks (default 8 ≈ 2 months) where each day is coloured by its **daily net (closed − created)**: green when more closed than created (shipping), red when more created than closed (drowning), neutral grey when balanced, and faint when quiet. Intensity scales with `|net|` against the window's peak swing. Each cell shows the net number (`+N` / `-N`) so the room can read both the colour vibe and the precise gap. Replaces the previous two-side-by-side heatmaps that needed reading two grids to compute "are we ahead or behind today?" Inline legend swatches in the subtitle explain the colour direction; click-to-filter behaviour preserved.

## [0.12.17] - 2026-05-14
- Target-milestone stat cards (Closed / Open / Total) are now **clickable** to deep-link the main graph: Closed filters to that milestone's closed tickets only, Open to its open tickets only, Total opens it with both states visible. Powered by a small new `selectedState` filter ('opened' / 'closed' / '') so the kiosk can pick the precise subset rather than approximating via `selectedStatuses` (which couldn't distinguish "Done" from re-opened tickets). Existing `includeClosed` keeps working unchanged; `selectedState` overrides it when set, and `resetFilters()` clears both.

## [0.12.16] - 2026-05-14
- **Cache footprint slashed.** Each issue's `_raw` payload is now slimmed to just the ~20 fields the app actually reads — dropping `description`, `description_html`, `_links`, `time_stats`, `task_completion_status`, `discussion_locked`, `subscribed`, and a long tail of fields GitLab returns but nothing in the UI consumes. On a typical project with 5000+ closed tickets this cuts IndexedDB cache size and cold-start JSON-parse time by 50-80% (description alone is often 1-10KB per issue). Applied uniformly to open and closed issues, on the initial fetch and on every per-issue mutation (assignee change, close/reopen). Existing users get an immediate in-memory cleanup on next app load (the slim pass runs over the cached nodes); the disk cache rewrites in slim form on the next sync.

## [0.12.15] - 2026-05-14
- Milestone-progress screen redesigned. Each milestone now renders as its own card with a clearer hierarchy: title row (target flag + checkmark for 100% complete), a stacked bar (closed green / open grey), a tabular `N closed / M total · K open` count, and a colour-coded **percent badge** sized to read from across the room (green ≥80% / amber ≥50% / red below). Below the bar, a chip-row surfaces information the old single-line layout couldn't fit:
  - **Due chip**: `47d to go` (green/amber/red shading by 30d/7d/overdue thresholds), `Due today`, `Xd overdue`, or `no deadline`.
  - **ETA chip**: projects 14-day closures-per-day velocity against remaining open work and compares the projection to the due date — emits `On track`, `Nd late` (split into mild and severe), `Stalled` (no velocity + no recent adds), or `Trophy · Complete` when everything's closed.
  - **Scope-creep chip**: `+N added · 14d`, only when additions match-or-outpace closures (otherwise it's just noise).
  - **Velocity chip**: `N closed · 14d` so the room can see how busy the milestone has been recently.
  Cards are clickable to filter the main graph by that milestone. Target milestone gets a primary-color left border and tinted background; completed milestones dim slightly. Replaces the previous one-line bar layout that had no due context beyond a raw date.

## [0.12.14] - 2026-05-14
- Kiosk auto-pauses cycling whenever the user navigates manually (‹ / ›, Arrow keys, clicking a mode dot at the bottom). No more "I was reading that — it just jumped away" surprises. The play/pause button briefly **pulses** (scale + primary-colored glow, 3 alternations over ~1.6s) so the room sees the cycle stopped. Manually toggling pause / resume cancels the pulse immediately so users who already noticed aren't blinked at. Honors `prefers-reduced-motion`.

## [0.12.13] - 2026-05-14
- **Milestone burnup → burndown**. The chart now plots a single line: remaining open work (scope − closed) over time, dropping toward zero. The dashed white ideal-burn guideline runs straight from (start, initialOpen) to (due, 0) using classic Scrum semantics, so scope creep visibly drifts the actual line above the ideal even when closures are on pace. Line is green when on track and red when ≥15 tickets behind ideal at today; the filled area underneath shifts amber → red the same way. Header subtitle now reads `M open at start → N now`. The Today / Due markers, future-zone dimming, and incomplete-closed-history hatched zone are preserved. Mode id renamed `burnup → burndown` everywhere (defaults, settings store, ConfigPage); existing users are auto-migrated (enable flag + `windowDays` carried over, legacy keys dropped). Old `#/kiosk/burnup/...` URLs fall back to the first enabled mode.

## [0.12.12] - 2026-05-14
- Target-milestone progress bar's striped "added after start" segment now **slides** (barber-pole effect) — a subtle 2.4s linear loop on the diagonal stripes. Makes the wall feel live without being distracting, and naturally draws the eye to the scope-creep portion of the bar (the segment that matters most). Honors `prefers-reduced-motion`.

## [0.12.11] - 2026-05-14
- Hot labels bar is now **stacked by priority** — the bar for each label splits into Blocking / High / Medium / Low / Other / No-priority segments (same buckets and colors as the Workload screen), with a matching legend below. Same data, but now the room sees not just which areas are noisy but *how critical* that noise is. Solid-blue bars become red-heavy where the load is dangerous and grey-heavy where it's just chatter.

## [0.12.10] - 2026-05-14
- Hot labels window default bumped from **24h → 168h (7 days)** — a single day was too narrow on most projects to surface meaningful label clusters. Header now pretty-prints the window as `7d` / `3d 12h` instead of `168h` so the section title stays readable for any value users dial in. Existing users still sitting on the old 24h default get a one-time auto-bump (anything they explicitly chose, including 24h after this version, is preserved).

## [0.12.9] - 2026-05-14
- **Velocity** kiosk mode rebuilt from a row of vertical bars into **two side-by-side GitHub-style mini heatmaps** (Created on the left, Closed on the right). Each grid is 7 rows (Mon..Sun) × N week columns with square-ish cells colored by the same red/green palettes as the Activity heatmap. Default window is now 4 weeks (was 7 days). Each side has its own intensity scale so a low-volume week is still readable. Cells show the day's count when > 0, today's cell gets a dashed outline, and clicking a cell still filters the main graph to that day. Config option renamed `Days window` → `Weeks window` (1..12, default 4); existing users with `velocity.days` are migrated to a rounded `velocity.weeks` value.

## [0.12.8] - 2026-05-14
- Target milestone header now shows **how many days the milestone has been running** alongside the countdown, e.g. `73 days in · 47 days to go · 2026-06-30`. Uses the milestone's `start_date` when set, falls back to the earliest ticket `created_at` (the same heuristic the rich progress bar already uses), and is hidden if the milestone hasn't started yet. Gives the wall a sense of pacing — "we've already spent X days, are we X% done?".

## [0.12.7] - 2026-05-14
- Activity-by-label heatmap cells made larger and more readable: cap raised from **14 → 18 px**, minimum bumped to **7 px**, vertical inter-block gap tightened from 8 → 4 px, top padding 26 → 24. If the configured top-N would force cells below the 7px floor (e.g. 19 labels on a portrait kiosk), the heatmap automatically drops labels from the tail until each block's squares are at least 7px, and the section header reflects the actual rendered count so "top 19" doesn't lie when only 12 fit. No more pixel-soup label rows on cramped kiosks.

## [0.12.6] - 2026-05-14
- Activity-by-label heatmap rebuilt as **one GitHub/GitLab-style mini heatmap per label** instead of a single linear strip of daily cells. Each label gets its own 7-row (Mon..Sun) × N-week grid with SQUARE cells (cap 14px, matching the main Activity heatmap density), stacked vertically. Cell size auto-picks the smaller of width-fit and height-fit so 365d at 10 labels lands around ~9px cells and 120d at 10 labels lands around ~14px cells — uses the available vertical space instead of leaving the lower 70% of the screen empty. Start is Monday-aligned so columns line up across labels; pre-window padding cells are drawn faintly like in the main heatmap. Click filters still target the single day clicked.

## [0.12.5] - 2026-05-14
- Activity by label heatmap switched from **weeks → days** to match the main Activity heatmap resolution. Each cell is now one day (cap 8px wide, 1px gap) instead of one Mon–Sun week (was cap 14px, 3px gap), so a 365-day window fits horizontally and short windows (120d) actually fill the row. Header now reads "peak N/day" instead of "/week", and a click on a cell filters the graph to that label + that single day. Month labels lock to the first day of each month rather than the nearest week.

## [0.12.4] - 2026-05-14
- The three "Open by …" kiosk modes (Priority overview / Status breakdown / Type breakdown) are merged into a single **Open by priority / status / type** screen — all three breakdowns stack vertically and share the body's vertical space (each block flex-shrinks rather than pushing the next off-screen). Cuts the cycle from three near-identical bar-list screens to one denser screen so the wall spends more time on other modes. Priority bars are still clickable to filter the graph. The three legacy `showNo*` toggles live together under a single "Include (No …) bucket" row in Configuration → Kiosk, and existing users are migrated: if any of the three legacy modes was enabled, the new combined mode comes up enabled.

## [0.12.3] - 2026-05-14
- Heatmap cells are now clickable in both kiosk heatmap modes. **Activity heatmap**: clicking a day in the *Tickets created* row opens the main graph filtered to issues created on that day; clicking a day in the *Tickets closed* or *All activity* rows filters by `updated_at` for that day (the main view has no `closedMode`, and a close always bumps `updated_at`). **Activity by label**: clicking a week cell filters by the row's label + the Mon–Sun range it represents. All click filters carry the kiosk's target-milestone scope and priority filter through, so the graph you land on matches what you were looking at. Empty / out-of-range cells stay non-interactive; hovering a clickable cell shows a subtle white outline.

## [0.12.2] - 2026-05-14
- Kiosk screens now animate on data refresh: stat numbers (Target / Today's pulse / Ticket health), the milestone progress bar, and the workload / priority / status / type / aging bars briefly pulse and brighten when fresh data lands. Activity and Recently-closed feeds use enter/leave/move transitions so new items slide in from the top, old items slide off to the right, and existing rows glide to their new position instead of snapping. Stable keys (`kind-iid-ts`) ensure the diff is correct.

## [0.12.1] - 2026-05-14
- Heatmaps:
  - Cells capped to 14px (Activity heatmap) / 14×22px (Activity by label) for a tighter GitHub-style density on wide kiosks — no more chunky squares.
  - **Tickets created = red**, **tickets closed = green** across the whole kiosk: heatmap palettes, velocity bars, activity-feed border/icon/tag colors, today's-pulse "Opened" / "Closed" cards, and the burnup scope line.
  - Activity-by-label rows are now colored by a **deterministic hash of the label name** — each label gets its own stable hue (5-step intensity palette derived from `hsl(hue, …)`), and the label text on the left is tinted to match. Legend gradient switched to neutral grey since the cell color now communicates "which label" instead of "intensity bucket".

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
