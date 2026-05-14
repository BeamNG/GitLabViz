# Changelog

## [0.3.38] - 2026-05-14
- Fix: graph disappeared / flickered while the sidebar was opening or closing. Setting
  `canvas.width/height` clears the canvas, and the resize was double-deferred through two
  `requestAnimationFrame` hops, so the canvas stayed blank for ~2 frames every resize tick
  during Vuetify's drawer transition. The resize now runs synchronously inside the
  `ResizeObserver` callback (before paint) and redraws immediately, and we skip the work
  entirely when the size hasn't actually changed.

## [0.3.37] - 2026-05-14
- Graph legend is now collapsible: click the chevron next to "Legend" to fold it down to
  just the title row (handy when the swatch list is long and covering nodes). The
  collapsed/expanded state is persisted in `uiState.view.legendCollapsed` so F5 keeps it.

## [0.3.36] - 2026-05-13
- Filter dropdown UX polish: width pinned per-dropdown via JS (no more jitter as long
  labels scroll into view; Vuetify virtualizes the list so CSS-only sizing didn't help),
  taller menu (~13 rows visible), tighter row height, subtle border + drop shadow, zebra
  striping for horizontal scanability.
- Sensible date-input defaults: picking "Before" / "After" / "Between" / "Last X Days"
  pre-fills the date fields (past 7 days for Created/Updated, next 7 days for Due Date)
  so they don't render as blank `dd/mm/yyyy`.
- Active-filter affordance: focused field gets a 2px primary outline, non-focused filters
  fade to ~35% opacity so the eye lands on the input you're working with.
- Date-mode dropdown rows are now icon-coloured (Before / After / Between / Last X Days)
  matching the rest of the filter palette.

## [0.3.35] - 2026-05-13
- Filter dropdowns now sort options by ticket count (descending), so frequently-used values
  surface first and unused / deprecated ones sink to the bottom. Applied to Status, Labels
  (Include/Exclude), Author, Assignee, Participants, Milestone, Priority, Type. Sentinels
  (`@me`, `@none`, `@unassigned`, `@deactivated`, subheaders) stay pinned at the top.
  Categorical dropdowns with semantic order (Subscribed, MR, Due, Spent, Budget, Estimate,
  Tasks) keep their existing order.
- Status dropdown: dedicated icons (e.g. `mdi-eye-outline` for "Ready for Review") are only
  shown when the status is actually used in the current data. Unused standard statuses get
  a generic muted dot, so canonical-but-unused names don't outshine project-specific ones.
  Avoids the GitLab-quirk where "Ready for Review" (standard, often empty) and "For Review"
  (custom, actually used) competed visually for the same slot.
- `currentStatusOfRaw()` returns ONLY the raw value present on the ticket (`status_display`
  / `work_item_status` / `Status::` scoped label) — no closed→Done / opened→To do fallback.
  Tickets without an explicit status simply don't appear under any status (in the dropdown,
  the filter, the legend, or the "Group by Status" graph).

## [0.3.34] - 2026-05-13
- Fix #16649 (Status filter showed nothing for "In progress" / "On Hold/Blocked" / etc.):
  the REST `/projects/:id/issues` endpoint never returns work-item status, and the GraphQL
  enrichment pass wasn't requesting it. Probe `Issue.status { name }` and (when supported)
  fetch via `project.issues(iids:)` — counts in this project's fixture went from 1798 "To do"
  + 154 "Done" + 40 "Backlog" to a real distribution (1486 / 163 / 112 / 73 / 152 / 4).
  Previously, `Query.nodes(ids:)` was used for the bulk lookup but isn't exposed on
  self-managed installs ("Field 'nodes' doesn't exist on type 'Query'"); switched to
  `project.issues(iids:)` which is universally supported. Restricted-introspection setups
  also work now (probe-based capability detection always runs, not just when introspection
  fails).
- Status filter, dropdown, graph color and group-by-Status now share a single
  `currentStatusOfRaw()` helper that returns ONLY the raw value present on the ticket
  (`status_display` / `work_item_status` / `Status::` scoped label). No state-based
  fallbacks — a ticket with no explicit status simply doesn't appear under any status.
- Filter dropdowns gained per-row ticket counts. Counts are **contextual** (GitLab-style):
  each dropdown's numbers reflect all OTHER active filters, so picking Author=X immediately
  narrows Status / Priority / Milestone / etc. counts to that author's tickets — but the
  Author dropdown itself stays unfiltered so deselection / multi-select still makes sense.
- Filter dropdown rows now have varied per-option icons + semantic colors (success / info /
  warning / error / muted) for Status, Priority, Type, Milestone, Subscribed, Merge Requests,
  Due, Time spent, Budget, Estimate bucket, Tasks, and the Created / Updated / Due Date
  mode pickers. Previously many rows shared one icon (e.g. estimate buckets all `mdi-timer-sand`).
- Date-range filters auto-fill sensible defaults when a mode is picked: past-dated dimensions
  (Created / Updated) default to the last 7 days, future-dated (Due Date) to the next 7 days.
  No more empty `dd/mm/yyyy` inputs that silently invalidate the filter.
- "Sample data" notice promoted from a small inline alert to a top app bar matching the
  token-expired banner style — much harder to miss when running without GitLab configured.
- GitLab URL config accepts shorthand: `gitlab.example.com` → `https://gitlab.example.com/api/v4`.
  Preserves `http://`, custom ports, sub-paths, and the existing `/api/vN` suffix; idempotent.
  6 new tests for `normalizeGitLabApiBaseUrl`.
- "Create token" link warns to bump the expiration to the maximum (GitLab silently caps PAT
  prefill URLs to ~30 days; the `expires_at` query param is ignored upstream).
- Refactored the 250-line inline filter into `passesFilters(node, skip)` — single source of
  truth used by both `filteredNodes` and `filterCounts`. Removes drift risk and dedupes the
  date-range branches.
- Dev-only debug shortcut `Ctrl+Shift+E` exports the current graph + filter state to
  `gitlabviz-export-<timestamp>.unittestdata.json`. Stripped from production builds
  (`import.meta.env.DEV`-gated). Files matching `*.unittestdata.json` are gitignored and
  auto-discovered by a new fixture-backed regression suite (`useGraphDerivedState.fixture.test.js`).
  The suite runs ~30 dynamic assertions per fixture against every filter dimension,
  predicates derived from the data so counts never need to be hardcoded.
- 5 new tests in total this release.

## [0.3.33] - 2026-05-13
- Status filter: always lists all 7 standard GitLab work-item statuses (`To do`, `In progress`, `Ready for Review`, `On Hold/Blocked`, `Done`, `Won't do`, `Duplicate`) plus any project-specific custom statuses from the loaded data. Previously only statuses present in currently-loaded issues were filterable.
- Group / Color by "Label" now excludes scoped labels (e.g. `Priority::High`, `Type::Bug`, `Component::core engine`) — those have their own dedicated grouping modes. New `isScopedLabel()` helper in `utils/scopedLabels.js`.
- URL aliases the internal value `tag` to `label` for `color=` and `group=` (UI already calls it "Label"). Decoding accepts both `label` and `tag` so existing URLs still work.
- 43 new unit tests for the URL share codec covering encode/decode roundtrip, percent-encoding, unicode/emoji, validation, warnings, and edge cases (legacy `?`/`&` rejection, malformed segments, invalid enums, etc.).

## [0.3.32] - 2026-05-13
- Fix: when grouping by assignee + filtering by specific assignees, multi-assignee tickets were spawning clones in EVERY co-assignee's group (incl. people not in the filter). Clones are now intersected with the active assignee filter (handles `@me`, `@unassigned`, `@deactivated` correctly).
- URL share parser: drops legacy `?` / `&` syntax (no backward compatibility) — clearly errors out if such a URL is opened.

## [0.3.31] - 2026-05-13
- URL share format: switched from query-string (`?key=val&key=val`) to path-style segments (`#/key=val/key=val`) so the URL reads cleanly without `?` or `&` and matches the existing `#/config/...` route style.

## [0.3.30] - 2026-05-13
- Shareable views via URL: the address bar now always reflects the current filters + view (color mode, grouping, link mode, etc.). Copy the URL to share your exact view.
- Human-readable params (e.g. `#/group=assignee/color=priority/label=Bug,Critical/due=overdue`). Defaults are omitted to keep URLs short.
- Opening a shared URL applies the encoded view on top of local settings — back/forward navigation also restores prior views.

## [0.3.29] - 2026-05-13
- Type filter now has a "(No type)" entry — same fix as priority/milestone in 0.3.27 (tickets without a Type scoped label were unfindable).
- Audited the rest of the filters: Status defaults to "To do" when missing so every ticket has a value; Author/Participants are always present; Subscription / MR / Due / Spent / Budget / Estimate / Task already expose explicit "none" options. Labels (Include) intentionally left as-is (different multi-value semantics).

## [0.3.28] - 2026-05-13
- Multi-assignee tickets are now treated correctly across the app (filter fix in 0.3.26 was only half the story):
  - Grouping by assignee duplicates a multi-assignee ticket into each assignee's group/cluster (same cloning pattern already used for tag / priority / type / scoped labels).
  - Color mode "assignee" colors each clone by its own assignee.
  - Legend / group counts include the ticket in every assignee's bucket.
  - Display label and copy summary list all assignees, not just the first.
  - New `Duplicate multi-assignee tickets` toggle in the sidebar (shown only when grouping by assignee) — defaults on; disable to fall back to the legacy single-clone behavior.
- Shared helper `src/utils/issueFields.js#getAssigneeNames` used by both `useGraphDerivedState` and `IssueGraph` (no more duplicated singular/plural fallback logic).

## [0.3.27] - 2026-05-13
- Fix #16648 (no way to filter tickets with no priority/milestone): Milestone and Priority filters now have a "(No milestone)" / "(No priority)" entry (`@none` sentinel, same pattern as Unassigned) so tickets without one can be found.

## [0.3.26] - 2026-05-13
- Fix #16647 (filter by assignee on multi-assignee tickets): Assignee dropdown and filter were only looking at `_raw.assignee` (the first/legacy assignee). The filter now uses the full `_raw.assignees` array and matches if ANY assignee on the ticket matches the selected filter. The Assignee dropdown also lists every co-assignee.

## [0.3.25] - 2026-05-13
- GitLab token expiry detection: on startup the app now introspects the PAT (`/personal_access_tokens/self`) to read scopes + `expires_at`.
- Top warning banner when the token expires in ≤7 days or is already expired; click → opens Config → GitLab tab.
- Config → GitLab alert shows expiry date and remaining days; turns warning (≤14d) and error (expired).
- When the token is expired and only sample data is loaded, a full-screen **TOKEN EXPIRED** message replaces the demo (with a "Create new token" CTA). Real cached data stays browsable.
- "Create token" button now uses `api` scope in the prefilled form (full read + write) instead of `read_api,read_user`.
- Fix: "Create token" button click was swallowed by `v-text-field`'s `append-inner` slot — moved next to the field so the link works.
- Fix: starting a fetch now immediately clears any sample/mock data so it's not visible during loading.

## [0.3.24] - 2026-05-13
- Deps: bump to Vuetify 4, Vite 8, Electron 42, jsdom 29, Vitest 4.1, plugin-vue 6, plus latest patches; 0 known vulnerabilities (was 27).
- Vuetify 4 migration: `v-row dense` → `density="compact"`, `justify="end"` → utility class, select/autocomplete `item.raw` → `item` (v4 unwraps to raw).
- Config → GitLab: simplified token UX — "Create token" button inline in the PAT field (prefilled form), removed the long instructions block.
- Fix: `loadData` race — set loading flag before the first await; refuse to start while another load is running, including SVN cache updates.
- Fix: `IssueGraph` save-transform timeout was not cleared on unmount (could write settings after teardown).
- Fix: non-Error rejections no longer log "undefined" in error/cache/SVN/links paths.

## [0.3.23] - 2026-01-14
- Filters: Status dropdown is now derived from loaded issues (no longer hardcoded), fixing missing statuses like "On Hold/Blocked".

## [0.3.22] - 2026-01-14
- Legend: customizable per-item colors (saved in presets). Click a legend swatch to pick a color, with a Reset option to restore defaults.
- Priorities: default palette now matches severity (red → green).

## [0.3.21] - 2026-01-14
- Graph: removed the "force show closed issues regardless of filters" behavior (closed issues now strictly respect “Include closed issues”), preventing layout issues caused by hidden-but-still-present nodes.

## [0.3.20] - 2026-01-14
- GitLab sync: incremental refresh now includes state transitions (open/closed) by fetching updated issues with `state=all`; always updates issues already in cache/graph regardless of `gitlabClosedDays` (which only affects adding new closed issues).
- Fix: Graph grouping could collapse into one big `default` group after time/tab switching, because the "Group" mode value could sometimes become an object (instead of a string) and fail comparisons like `groupBy === 'author'`. We now normalize grouping mode to a safe string before computing group keys/links/stats.

## [0.3.19] - 2026-01-09
- Graph perf: speed up physics overlap resolution on large graphs; faster zoomed-out drawing (LOD) + cached group smudges; faster group label toggling.
- improved frame fit
- label group positioning now deterministic
- autocomplete for color and group now
- drawing all labels for all issues now - resulting in issues being multiple times on screen
- added Epic preset
- fixed Epics not working
- improved sync using REST again for speed
- added 'Unassigned' as filter option
- added group label setting in the legend window
- fixed browser warnings

## [0.3.18] - 2026-01-09
- GitLab sync: incremental refresh (only fetch updated issues) with a 12h overlap window to avoid clock/timezone drift; only refresh links for changed issues.

## [0.3.17] - 2026-01-09
- added more filters + color modes for due date / time tracking / tasks
- filters: merge request presence, participants, due status, spent, budget, estimate buckets, task completion
- show non-active user states in user selectors when available
- user selectors: add special entries "Me", "Deactivated users" section, and "Any deactivated user"

## [0.3.16] - 2026-01-08
- fixed scoped labels
- added start/stop button for the physics simulation
- using graphql API to catch more fields
- fixed autocomplete and filter selection
- added new component preset

## [0.3.15] - 2026-01-08
- preserving graph view during ticket changes

## [0.3.14] - 2026-01-08
- auto-update system to prevent browser caching

## [0.3.13] - 2026-01-08
- Improved border radius on context menus - tiny UX fix

## [0.3.12] - 2026-01-08
- Fixed tests :D

## [0.3.11] - 2026-01-08
- GitLab: detect token scopes and show a warning when write is disabled
- Context menu: add write actions (close/reopen, assign to me, unassign) when token allows.

## [0.3.10] - 2026-01-07
- added context menu for issues
- sidebar: move “Clear filters” next to Filters header; remove duplicate reset button.
- Collapsed sidebar mini toolbar: add “Fit to screen”.

## [0.3.9] - 2026-01-07
- Improved navigation state persistence in the URL
- Improved About page

## [0.3.8] - 2026-01-07
- Prevent duplicate GitLab fetches: ignore “Save & Close/Reload” triggers while an update is already running.

## [0.3.7] - 2026-01-07
- Fix token-at-rest obfuscation: store token under `config.tokenObfuscated` (not `config.token`), keep runtime token plain, and keep `glv-xor1:` format.

## [0.3.6] - 2026-01-07
- GitLab token is now stored obfuscated at rest (XOR + base64) to avoid plain text in local storage / backups.

## [0.3.5] - 2026-01-06
- initial release to the public via github :)