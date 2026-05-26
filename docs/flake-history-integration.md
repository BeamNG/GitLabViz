# Flake history integration

GitLabViz can render a heatmap and leaderboard of your test suite's flake history when a compatible JSON **bundle** is published as a GitLab Generic Package. This document is the public contract: it describes the bundle's schema, how the viewer fetches it, and how to write a producer that emits a compatible bundle.

The bundle is the only contract. Producers are free to compute it however they like; the viewer is free to evolve its UI; both sides agree only on the JSON shape defined in [`flake-history-bundle.v1.schema.json`](./flake-history-bundle.v1.schema.json).

## What this is

When tests run across many machines and many pipelines, individual failures are easy to dismiss as "just flaky" until somebody collates the data. This integration:

1. Reads a single bundle JSON describing every recorded run and every test's per-context pass/fail history.
2. Renders a heatmap (tests × runs) and a leaderboard (most-flaky tests first).
3. Provides a kiosk variant for studio dashboards: "currently broken" + "top flaky."

The viewer makes no assumptions about *where* the data came from. Any team running any CI on any platform can produce the bundle; the only requirement is that the published artifact match the schema and live at a Generic Package URL the viewer can reach.

## Setup (consumer side)

In GitLabViz, open **Settings → Flake history source** and fill in:

| Field | Description |
|---|---|
| GitLab project ID or path | The numeric project ID, or `group/project`. The same project that hosts the bundle's Generic Package. |
| Package name | Defaults to `flake-history`. Override if your bundler publishes under a different name. |
| Refresh interval | Minutes between automatic refreshes. `0` = manual only. |

The GitLab URL and personal access token from the existing GitLab settings panel are reused; the token needs at least `read_api` scope.

When unset the Flake History view shows a "Not configured" empty state with a link back here. GitLabViz never has a default project baked in.

## Schema reference

Bundles are versioned: `schema_version: 1` is the current shape. Additive changes (new optional fields) stay in v1; breaking changes bump to v2 and the viewer will refuse to read v2 until it is updated. Always declare the version you produce — bundles without `schema_version` are rejected.

Full JSON Schema: [`flake-history-bundle.v1.schema.json`](./flake-history-bundle.v1.schema.json). Annotated example: [`../fixtures/flake-history-bundle-sample.json`](../fixtures/flake-history-bundle-sample.json).

### Top-level structure

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-21T15:00:00Z",
  "generator": { "name": "your-bundler", "version": "1.0.0" },
  "window": {
    "retention_days": 14,
    "oldest_run_uploaded_at": "...",
    "newest_run_uploaded_at": "..."
  },
  "runs": [ /* one entry per test-suite run */ ],
  "tests": [ /* one entry per distinct test */ ]
}
```

### `runs[]`

Each entry describes one distinct execution of the test suite. Test results reference these by `run_id`.

| Field | Type | Notes |
|---|---|---|
| `run_id` | string, required | Producer-stable identifier. Referenced from test cells. |
| `suite` | string | Suite label, e.g. `"smoketest"`. |
| `gfx_api`, `quality`, `custom_profile_hash` | string | Optional facet labels used to bucket cells. |
| `source_revision`, `source_branch` | string | VCS state under test. Strings, so SVN revisions and git SHAs both fit. |
| `pipeline_id` | integer | The CI pipeline that contributed this run. |
| `pipeline_url` | string (uri) | **Optional.** When present the viewer renders cells as clickable links to this URL. Omit if you don't have GitLab pipeline URLs — viewer will show a non-clickable cell. |
| `started_at`, `finished_at` | ISO 8601 UTC | `finished_at` may be `null` for an interrupted run. |
| `duration_seconds` | integer ≥ 0 | Optional; derivable from start/finish if you'd rather not store it. |
| `runner_id` | string | Whatever identifies the host. |
| `status` | enum | `"complete"`, `"interrupted"`, or `"unknown"`. Drives the heatmap's "interrupted" rendering (hollow red border) for cells from these runs. |

### `tests[]`

Each entry is one test, with per-context aggregates and overall stats.

| Field | Type | Notes |
|---|---|---|
| `test_id` | string, required | Opaque primary key. Conventionally `<suite>::<module>::<test_name>`. |
| `name`, `module`, `suite` | string | Display labels. |
| `results_by_context` | array | One entry per `(gfx_api, quality, custom_profile_hash)` under which the test was observed. |
| `overall` | object | Aggregated counts, `is_flaky`, and `flake_classification`. |

Within `results_by_context[]`:

| Field | Type | Notes |
|---|---|---|
| `passing_run_ids`, `failing_run_ids` | string[] | References into `runs[].run_id`. The viewer joins on these to render heatmap cells. |
| `pass_count`, `fail_count`, `pass_rate` | numbers | Derived; the viewer trusts the producer's values rather than recomputing. |
| `last_status`, `last_run_id` | enum, string | The most recent outcome in this context. |

### `flake_classification` enum

The viewer treats this as an opaque label and uses it only for grouping/colour. Producers pick whatever thresholds suit their data. The reference bundler uses:

| Class | Condition |
|---|---|
| `stable` | No failures, or `pass_rate ≥ 0.95`. |
| `intermittent` | `0.5 ≤ pass_rate < 0.95`. |
| `actively_flaky` | `0 < pass_rate < 0.5`. |
| `broken` | No passes recorded (`pass_rate == 0` and `fail_count > 0`). |

## Producer side — publishing a compatible bundle

Anything that can `PUT` a file to a GitLab Generic Package can be a producer. The smallest possible producer is a `curl` invocation from CI:

```bash
curl --upload-file bundle.json \
     --header "JOB-TOKEN: $CI_JOB_TOKEN" \
     "$CI_API_V4_URL/projects/$CI_PROJECT_ID/packages/generic/flake-history/$(date +%s)/bundle.json"
```

That's it. The viewer fetches the newest version under the configured package name and renders it.

Most teams will produce the bundle by walking their own per-runner or per-job test results and folding them into the `runs[]` + `tests[]` shape. Practical advice:

- **Use Unix-timestamp versions** (or any monotonically increasing string). The viewer's "newest" lookup sorts by `created_at`, so collisions are tolerated, but monotonic versions make manual debugging easier.
- **Keep at least a week of bundles.** Prune older versions in the same job.
- **Don't fail the build on a bundling error.** Flake history is observability, not a gate.

## FAQ

**Can I use a non-GitLab source?** Today the viewer's fetch path assumes GitLab's Generic Package API. A "custom URL source" mode is on the roadmap. The schema is portable — your producer can already emit bundles to any storage, you just can't yet point the viewer at S3 / a static host.

**My producer doesn't have pipeline URLs.** Omit `pipeline_url`. The viewer renders a non-clickable cell.

**My runs don't have `quality` or `gfx_api`.** Set them to `null`. The viewer's facet filters collapse to "all" for those bundles.

**How big can the bundle be?** No fixed cap, but the viewer loads it entirely into memory. A year of nightly runs is typically well under 5 MB JSON. If you push past that, consider stricter retention rather than streaming.

## License + contributions

GitLabViz is released under the licence in the repository root. The schema and sample data are part of the same repo and same licence. If you change the schema — even an additive change — please update [`flake-history-bundle.v1.schema.json`](./flake-history-bundle.v1.schema.json), the [sample bundle](../fixtures/flake-history-bundle-sample.json), and this document in the same commit.
