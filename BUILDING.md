# Building and Running GitLab Viz

## Development

```bash
npm ci
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

### SVN (no Electron) via proxy

SVN WebDAV methods (`PROPFIND` / `REPORT`) usually fail from the browser due to CORS. For web/dev mode, run the app behind a same-origin proxy.

- Set `VITE_SVN_PROXY_TARGET` to your SVN base URL (example: `https://svn.example.com/repo`)
- Restart `npm run dev`
- In the app, enable SVN and set the repo URL to that same base URL

The dev server will proxy browser requests from `http://localhost:5173/svn/...` to your SVN server.

## Build

```bash
npm ci
npm run build
```

The output will be in the `dist/` directory.

### CI / Deployment

This repo builds and deploys the SPA to **GitHub Pages** via **GitHub Actions**.
- Deploy trigger: **push a version tag** like `v0.3.21` (or run the workflow manually)
- Build command: `npm run build`
- Output directory: `dist/`

