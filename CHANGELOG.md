# Changelog

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