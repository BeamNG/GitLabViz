# Building and Running GitLab Viz

## Development

```bash
npm ci
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## Build

```bash
npm ci
npm run build
```

The output will be in the `dist/` directory.

### CI / Deployment

This repo builds the SPA in **GitHub Actions**.
- Build command: `npm run build`
- Output directory: `dist/` (publish this directory to your static host of choice)

