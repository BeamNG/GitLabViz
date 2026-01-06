# GitLab Viz

Handy Graph display of your gitlab issues.

- single page application
- no installation needed, no server needed
- runs completely in your browser only

![Main View](misc/usage.gif)

# GitLabViz 🚀

- [**View Live App**](https://beamng.github.io/GitLabViz/): https://beamng.github.io/GitLabViz/
- [**Download Desktop App**](https://github.com/BeamNG/GitLabViz/releases/latest/download/GitLabViz.html) (and open it in your browser)

## Key Features

### 🕸️ Interactive Graph Visualization
Move beyond list views. See how your issues connect with a physics-based force-directed layout.
- **Dependency Tracking**: Visual arrows clearly show `blocks`, `is_blocked_by`, and `related_to` relationships.

  <img src="misc/arrows.png" width="45%" />

- **Status Coloring**: Nodes are color-coded by status (To Do, In Progress, Done) or customized based on your view settings.

  <img src="misc/color_modes.gif" width="25%" />

### 🔍 Powerful Filtering & Search
Slice and dice your data to find exactly what you need.
- **Multi-faceted Filtering**: Filter by Label, Author, Assignee, Milestone, Priority, Type, and more.

  <img src="misc/filters.gif" width="25%" />

- **Deep Search**: Instantly find issues by ID, title, or content.

  <img src="misc/search.gif" width="55%" />

- **Date Filters**: Focus on what's new or what's due with flexible date range controls.

  <img src="misc/datefilter.gif" width="25%" />

### 📊 Advanced Grouping & Layouts
Organize the chaos.
- **Smart Grouping**: Cluster nodes by Status, Assignee, Author, Milestone, or any scoped label (e.g., `Priority::*`, `Type::*`).

  <img src="misc/grouping.gif" width="55%" />

- **Customizable Physics**: Tweak gravity, repulsion, and link strength in real-time to create the perfect visualization for your specific dataset.

### 💾 Productivity Tools
- Default and custom **Presets**: Save your complex filter and view configurations as named presets for quick access.

  <img src="misc/default_presets.png" width="35%" />

- **Dark/Light Mode**: precise support for Light, Dark, and System themes.

  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
    <img src="misc/dark_mode.png" width="45%" />
    <img src="misc/light_mode.png" width="45%" />
  </div>

- **Cached Performance**: Local caching ensures your graph loads instantly on return visits.

  <img src="misc/cache.png" width="45%" />

- **Single page application**: One HTML page, no server needed


## Getting Started

Download the html from the releases and open it :)

## Development

For instructions on how to build and run the project locally, please see [BUILDING.md](BUILDING.md).
