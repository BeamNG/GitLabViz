# GitLab Viz

![Main View](misc/usage.gif)

Graph display of your gitlab issues.

- single page application
- no installation needed, no server needed
- runs completely in your browser only

# GitLabViz 🚀

- **View Live**
  
  https://beamng.github.io/GitLabViz/

- **Download**
  
  https://github.com/BeamNG/GitLabViz/releases/latest/download/GitLabViz.html
  
  (and open the html file it in your browser)

## Key Features

### 🕸️ Interactive Graph Visualization
Move beyond list views. See how your issues connect with a physics-based force-directed layout.

- **Zoom**: see the issue in all details or zoom out and see the general overview

  <img src="misc/issue2.png" width="45%" />

  Double-clicking the issue will open them in a new tab.

- **Dependency Tracking**: Visual arrows clearly show `blocks`, `is_blocked_by`, and `related_to` relationships.

  <img src="misc/arrows.png" width="45%" />

- **Status Coloring**: Nodes are color-coded by status (To Do, In Progress, Done) or customized based on your view settings.

  <img src="misc/color-modes.gif" width="25%" />

- **Color Legend**

  <img src="misc/color-legend.gif" />

  Hover legend items to highlight matching issues and sort items
  
  <img src="misc/color-gradient.png" />

  Gradient coloring for some data fields

### 🔍 Powerful Filtering & Search
Slice and dice your data to find exactly what you need.
- **Multi-faceted Filtering**: Filter by Label, Author, Assignee, Milestone, Priority, Type, and more.

  <img src="misc/filters.gif" width="25%" />

- **Deep Search**: Instantly find issues by ID, title, or content.

  <img src="misc/search.gif" width="100%" />

- **Date Filters**: Filter by Created / Updated / Due Date with `after`, `before`, `between`, and `last X days`.

  <img src="misc/datefilter.gif" width="25%" />

### 📊 Advanced Grouping & Layouts
Organize the chaos.
- **Smart Grouping**: Cluster nodes by Status, Assignee, Author, Milestone, or any scoped label (e.g., `Priority::*`, `Type::*`).

  <img src="misc/grouping.gif" />

- **Customizable Physics**: Tweak gravity, repulsion, link strength/distance, friction, and optional grid magnet in real-time.

### 💾 Productivity Tools

- **Preset sharing**: Copy/paste presets as JSON via clipboard (handy for sharing setups with teammates).

- **Custom Presets**: Save your complex filter and view configurations as named presets for quick access.

- **Built-in presets** (one-click starting points):

  <img src="misc/default_presets.png" width="35%" />

  - **Priorities**: Colors issues by Priority.
  - **Blocking Issues**: Focuses on priority `0 - Blocking` issues.
  - **By me**: Shows issues authored by you (`@me`) using a timeline-style view.
  - **Assigned to me**: Shows issues assigned to you (`@me`) using a timeline-style view.
  - **Links**: Emphasizes dependency links (good for visualizing connections).
  - **Labels**: Colors + groups by Label.
  - **Authors**: Colors + groups by Author.
  - **Assignees**: Colors + groups by Assignee.
  - **Milestones**: Colors + groups by Milestone.
  - **Issue Types**: Colors + groups by Type.
  - **New Tickets (60d)**: Shows recently created issues (last 60 days), grouped by Author.
  - **Updated (30d)**: Shows recently updated issues (last 30 days), grouped by Author.
  - **Ticket Age**: Buckets by staleness / last-updated age for spotting stale tickets.
  - **timeline - created**: Timeline view grouped by Created date.
  - **timeline - updated**: Timeline view grouped by Updated date.

- **Dark/Light Mode**: precise support for Light, Dark, and System themes.

  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
    <img src="misc/dark_mode.png" width="45%" />
    <img src="misc/light_mode.png" width="45%" />
  </div>

- **Local caching**: Local caching ensures your graph loads instantly on reloads/F5.

  <img src="misc/cache.png" />

- **Backup / restore**: Export/import cached graph data as a `.json` file for backups or moving between machines.

- **Open behavior**: Choose whether opening an issue uses a new tab, a reusable tab, or the current tab.

- **Support diagnostics**: One-click “Copy diagnostics” for bug reports (version + platform + recent warnings/errors).

- **Single page application**: One HTML page, no server needed


## Getting Started

Download the html from above and open it :)

## Prerequisites / Compatibility

- **GitLab**: Works with **GitLab.com (cloud)** and **self-managed/hosted GitLab** as long as the **REST API v4** is available (the app uses `/api/v4/...` endpoints like issues + issue links). Practically, that means **GitLab 11.0+** (API v3 was removed in 11.0, leaving v4 as the supported REST API).
- **Token**: A **Personal Access Token** is required for loading data. Recommended scopes: **`read_api`** (and **`read_user`** for the “By me / Assigned to me” presets).
- **Network access**: Your machine must be able to reach your GitLab API URL (company VPN / firewall rules apply).

## Privacy / Data Handling

- **No backend**: GitLab Viz runs entirely in your browser. There is no GitLab Viz server.
- **Network requests**: **GitLab**: When enabled, the app calls your configured GitLab API URL directly from your machine and renders the data locally.
- **Local storage**: Settings and cached graph data are stored in your browser storage (IndexedDB via `localforage`) under keys like `settings`, `gitlab_nodes`, `gitlab_edges`, `gitlab_meta`.


## Security Notes

- Treat your **GitLab token** like a password.
- **Token-at-rest obfuscation**: The GitLab token is stored **obfuscated** using **XOR + base64** with a fixed app key. This is **not encryption** and only helps against casual inspection of backups/local storage.
- On shared machines, prefer using the browser build in a separate profile and clear site data when done.

## Development

For instructions on how to build and run the project locally, please see [BUILDING.md](BUILDING.md).
