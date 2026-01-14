# Changelog

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