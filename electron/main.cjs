const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const axios = require('axios')
const https = require('https')
const fs = require('fs')
const fsp = require('fs/promises')
const zlib = require('zlib')
const crypto = require('crypto')
const { spawn } = require('child_process')

// Put Chromium/Electron internals into a dedicated folder, separate from our own cache/settings.
// Base folder lives in Roaming/AppData to behave like a normal Windows app.
const BASE_DIR = path.join(app.getPath('appData'), 'GitLabVizData')
app.setPath('userData', path.join(BASE_DIR, 'electron_cache'))

// Disable SSL verification for self-signed certs if needed (common in some internal networks)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

function createWindow () {
  // Window/taskbar icon (especially important on Windows).
  // Use a stable path that exists both in dev and when packaged by electron-builder.
  const iconPath = path.join(__dirname, '../build/icon.ico')

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Keep renderer locked down; use IPC handlers in this file for cross-origin requests.
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // In production, load the local file. In dev, load the vite server.
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('open-devtools', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }
    win.webContents.openDevTools({ mode: 'detach' })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// IPC Handlers for network requests to bypass CORS
ipcMain.handle('svn-request', async (event, { method, url, username, password, data, headers }) => {
    try {
        const config = {
            method: method || 'GET',
            url: url,
            data: data,
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                ...headers
            },
            httpsAgent, // Use the lax agent
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: status => status < 500 // Resolve even on 404 to handle it in logic
        };

        console.log(`[SVN] Requesting: ${config.method} ${config.url}`);

        if (username && password) {
            config.auth = { username, password };
        }

        const response = await axios(config);
        return { 
            success: true, 
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            headers: response.headers
        };
    } catch (error) {
        console.error('SVN IPC Error:', error.message);
        return { 
            success: false, 
            error: error.message,
            details: error.response ? `${error.response.status} ${error.response.statusText}` : ''
        };
    }
});

ipcMain.handle('fetch-svn-log', async (event, { url, username, password, limit }) => {
    try {
        // If limit is 0, use a very large number (e.g. 100000) as some servers might default to 1 if omitted
        const actualLimit = (limit && limit > 0) ? limit : 100000;

        const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<S:log-report xmlns:S="svn:" xmlns:D="DAV:">
<S:start-revision>HEAD</S:start-revision>
<S:end-revision>0</S:end-revision>
<S:limit>${actualLimit}</S:limit>
<S:discover-changed-paths/>
</S:log-report>`;

        const config = {
            method: 'REPORT',
            url: url,
            data: xmlBody,
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"'
                // Depth header removed
            },
            httpsAgent // Use the lax agent
        };

        console.log(`[SVN] Requesting: ${config.method} ${config.url}`); // Add logging

        if (username && password) {
            config.auth = { username, password };
        }

        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('SVN IPC Error:', error.message);
        if (error.response) {
             console.error('SVN Response Status:', error.response.status);
             console.error('SVN Response Data:', error.response.data);
        }
        return { 
            success: false, 
            error: error.message,
            details: error.response ? `${error.response.status} ${error.response.statusText}` : ''
        };
    }
});

// ----------------------
// Filesystem cache (gzip)
// ----------------------
// Our cache lives next to electron_cache:
// <BASE_DIR>/cache
const cacheRoot = () => path.join(BASE_DIR, 'cache')

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true })
}

const sha1 = (s) => crypto.createHash('sha1').update(String(s || ''), 'utf8').digest('hex')

const gzipBuffer = (buf) => new Promise((resolve, reject) => {
  zlib.gzip(buf, { level: 6 }, (err, out) => err ? reject(err) : resolve(out))
})

const gunzipBuffer = (buf) => new Promise((resolve, reject) => {
  zlib.gunzip(buf, (err, out) => err ? reject(err) : resolve(out))
})

const jsonPathForKey = (key) => {
  const safe = sha1(key)
  return path.join(cacheRoot(), 'json', `${safe}.json.gz`)
}

ipcMain.handle('cache-get-json', async (event, { key }) => {
  try {
    const p = jsonPathForKey(key)
    if (!fs.existsSync(p)) return { success: true, value: null }
    const gz = await fsp.readFile(p)
    const raw = await gunzipBuffer(gz)
    return { success: true, value: JSON.parse(raw.toString('utf8')) }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('cache-set-json', async (event, { key, value }) => {
  try {
    const dir = path.join(cacheRoot(), 'json')
    await ensureDir(dir)
    const p = jsonPathForKey(key)
    const gz = await gzipBuffer(Buffer.from(JSON.stringify(value), 'utf8'))
    await fsp.writeFile(p, gz)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('cache-delete', async (event, { key }) => {
  try {
    const p = jsonPathForKey(key)
    if (fs.existsSync(p)) await fsp.unlink(p)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ----------------------
// SVN log cache (chunked)
// ----------------------
const svnRepoDir = (repoUrl) => path.join(cacheRoot(), 'svn', sha1(repoUrl))
const svnManifestPath = (repoUrl) => path.join(svnRepoDir(repoUrl), 'manifest.json')

const readJsonFile = async (p, fallback) => {
  try {
    const s = await fsp.readFile(p, 'utf8')
    return JSON.parse(s)
  } catch {
    return fallback
  }
}

const writeJsonFileAtomic = async (p, obj) => {
  const tmp = `${p}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8')
  await fsp.rename(tmp, p)
}

const normalizeChunk = (chunk) => {
  // chunk: { startRev, endRev, commits: [...] } (descending)
  const startRev = Number(chunk.startRev)
  const endRev = Number(chunk.endRev)
  if (!Number.isFinite(startRev) || !Number.isFinite(endRev)) throw new Error('Invalid chunk revision range')
  const commits = Array.isArray(chunk.commits) ? chunk.commits : []
  return { startRev, endRev, commits }
}

ipcMain.handle('svn-cache-get-meta', async (event, { repoUrl }) => {
  try {
    const manifest = await readJsonFile(svnManifestPath(repoUrl), null)
    return { success: true, meta: manifest }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('svn-cache-clear', async (event, { repoUrl }) => {
  try {
    const dir = svnRepoDir(repoUrl)
    if (fs.existsSync(dir)) await fsp.rm(dir, { recursive: true, force: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('svn-cache-write-chunk', async (event, { repoUrl, chunk }) => {
  try {
    const { startRev, endRev, commits } = normalizeChunk(chunk)
    const dir = svnRepoDir(repoUrl)
    const chunksDir = path.join(dir, 'chunks')
    await ensureDir(chunksDir)

    const filename = `r${startRev}-r${endRev}.jsonl.gz`
    const filePath = path.join(chunksDir, filename)

    // Skip if exists (idempotent)
    if (!fs.existsSync(filePath)) {
      const jsonl = commits.map(c => JSON.stringify(c)).join('\n') + '\n'
      const gz = await gzipBuffer(Buffer.from(jsonl, 'utf8'))
      await fsp.writeFile(filePath, gz)
    }

    const manifestPath = svnManifestPath(repoUrl)
    const manifest = await readJsonFile(manifestPath, {
      repoUrl,
      totalCount: 0,
      newestRev: null,
      oldestRev: null,
      chunks: [] // [{ startRev, endRev, count, file }], sorted desc by startRev
    })

    // Avoid duplicates in manifest
    const exists = manifest.chunks.some(c => c.startRev === startRev && c.endRev === endRev)
    if (!exists) {
      manifest.chunks.push({ startRev, endRev, count: commits.length, file: filename })
      manifest.chunks.sort((a, b) => b.startRev - a.startRev)
      manifest.totalCount += commits.length
      manifest.newestRev = manifest.newestRev == null ? startRev : Math.max(manifest.newestRev, startRev)
      manifest.oldestRev = manifest.oldestRev == null ? endRev : Math.min(manifest.oldestRev, endRev)
      manifest.updatedAt = Date.now()
      await ensureDir(dir)
      await writeJsonFileAtomic(manifestPath, manifest)
    }

    return { success: true, file: filename, meta: manifest }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

const readChunkCommits = async (repoUrl, file) => {
  const p = path.join(svnRepoDir(repoUrl), 'chunks', file)
  const gz = await fsp.readFile(p)
  const raw = await gunzipBuffer(gz)
  const lines = raw.toString('utf8').split('\n').filter(Boolean)
  return lines.map(l => JSON.parse(l))
}

ipcMain.handle('svn-cache-read-page', async (event, { repoUrl, page, perPage }) => {
  try {
    const p = Math.max(1, Number(page) || 1)
    const n = Math.max(1, Math.min(Number(perPage) || 50, 500))
    const manifest = await readJsonFile(svnManifestPath(repoUrl), null)
    if (!manifest || !Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
      return { success: true, totalCount: 0, items: [] }
    }

    const startIndex = (p - 1) * n
    const endIndex = startIndex + n

    // Find which chunks cover this range (chunks are newest->oldest)
    let acc = 0
    const needed = []
    for (const c of manifest.chunks) {
      const next = acc + (c.count || 0)
      if (next > startIndex && acc < endIndex) {
        needed.push({ chunk: c, base: acc })
      }
      acc = next
      if (acc >= endIndex) break
    }

    const out = []
    for (const item of needed) {
      const commits = await readChunkCommits(repoUrl, item.chunk.file)
      const localStart = Math.max(0, startIndex - item.base)
      const localEnd = Math.min(commits.length, endIndex - item.base)
      for (let i = localStart; i < localEnd; i++) out.push(commits[i])
      if (out.length >= n) break
    }

    return { success: true, totalCount: manifest.totalCount || 0, items: out }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('svn-cache-get-stats', async (event, { repoUrl }) => {
  try {
    const dir = svnRepoDir(repoUrl)
    const manifest = await readJsonFile(svnManifestPath(repoUrl), null)
    if (!manifest) {
      return { success: true, stats: { exists: false, bytes: 0 } }
    }

    const chunksDir = path.join(dir, 'chunks')
    let bytes = 0

    // manifest size
    try {
      const st = await fsp.stat(svnManifestPath(repoUrl))
      bytes += st.size
    } catch { /* ignore */ }

    // sum chunk file sizes
    try {
      const files = await fsp.readdir(chunksDir)
      for (const f of files) {
        try {
          const st = await fsp.stat(path.join(chunksDir, f))
          if (st.isFile()) bytes += st.size
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    return {
      success: true,
      stats: {
        exists: true,
        bytes,
        totalCount: manifest.totalCount || 0,
        newestRev: manifest.newestRev ?? null,
        oldestRev: manifest.oldestRev ?? null,
        chunks: Array.isArray(manifest.chunks) ? manifest.chunks.length : 0,
        updatedAt: manifest.updatedAt ?? null
      }
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ----------------------
// Cache folder helpers
// ----------------------
ipcMain.handle('cache-get-path', async () => {
  try {
    return { success: true, path: cacheRoot() }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('cache-open-folder', async () => {
  try {
    const p = cacheRoot()
    await ensureDir(p)
    const result = await shell.openPath(p)
    if (result) return { success: false, error: result }
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ----------------------
// Settings on disk (with XOR obfuscation for secrets)
// ----------------------
const SETTINGS_XOR_KEY = 'gitlab-viz::xor::key::2025'
const settingsPath = () => path.join(BASE_DIR, 'settings.json')

const xorBuf = (buf, key) => {
  const keyBuf = Buffer.from(String(key || ''), 'utf8')
  if (!keyBuf.length) return buf
  const out = Buffer.allocUnsafe(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ keyBuf[i % keyBuf.length]
  return out
}

const obfuscate = (s) => {
  const str = String(s ?? '')
  if (!str) return ''
  return xorBuf(Buffer.from(str, 'utf8'), SETTINGS_XOR_KEY).toString('base64')
}

const deobfuscate = (s) => {
  const str = String(s ?? '')
  if (!str) return ''
  try {
    const buf = Buffer.from(str, 'base64')
    return xorBuf(buf, SETTINGS_XOR_KEY).toString('utf8')
  } catch {
    return ''
  }
}

const sanitizeSettingsForDisk = (settings) => {
  const s = settings && typeof settings === 'object' ? settings : {}
  const out = { ...s }

  // secrets live under out.config
  if (out.config && typeof out.config === 'object') {
    const c = out.config
    out.config = {
      ...c,
      token: c.token ? obfuscate(c.token) : '',
      // Mattermost / ChatTools secrets
      mattermostToken: c.mattermostToken ? obfuscate(c.mattermostToken) : '',
      svnUsername: c.svnUsername ? obfuscate(c.svnUsername) : '',
      svnPassword: c.svnPassword ? obfuscate(c.svnPassword) : '',
      // svnRepos are urls only; no per-repo credentials stored
      svnRepos: Array.isArray(c.svnRepos) ? c.svnRepos.map(r => ({ ...r })) : []
    }
  }

  return out
}

const hydrateSettingsFromDisk = (settings) => {
  const s = settings && typeof settings === 'object' ? settings : {}
  const out = { ...s }

  if (out.config && typeof out.config === 'object') {
    const c = out.config
    out.config = {
      ...c,
      token: c.token ? deobfuscate(c.token) : '',
      mattermostToken: c.mattermostToken ? deobfuscate(c.mattermostToken) : '',
      svnUsername: c.svnUsername ? deobfuscate(c.svnUsername) : '',
      svnPassword: c.svnPassword ? deobfuscate(c.svnPassword) : '',
      svnRepos: Array.isArray(c.svnRepos) ? c.svnRepos.map(r => ({ ...r })) : []
    }
  }

  return out
}

// ----------------------
// Mattermost IPC (ChatTools assimilation)
// ----------------------
const normalizeBaseUrl = (u) => String(u || '').trim().replace(/\/+$/, '')
const mmApiBase = (baseUrl) => `${normalizeBaseUrl(baseUrl)}/api/v4`

ipcMain.handle('mattermost-login', async (event, { baseUrl, email, password, mfaToken }) => {
  try {
    const url = normalizeBaseUrl(baseUrl)
    if (!url) return { success: false, error: 'Missing baseUrl' }
    if (!email || !password) return { success: false, error: 'Missing email or password' }

    const resp = await axios({
      method: 'POST',
      url: `${mmApiBase(url)}/users/login`,
      data: {
        login_id: email,
        password,
        ...(mfaToken ? { token: mfaToken } : {})
      },
      httpsAgent,
      timeout: 30000,
      validateStatus: status => status < 500
    })

    if (resp.status !== 200) {
      return { success: false, error: `Login failed: ${resp.status} ${resp.statusText}`, details: resp.data }
    }

    // Mattermost returns the auth token in a "Token" header; axios lowercases header keys.
    const token = resp.headers && (resp.headers.token || resp.headers.Token)
    if (!token) return { success: false, error: 'Login succeeded but no token header returned' }

    // Fetch user info
    const me = await axios({
      method: 'GET',
      url: `${mmApiBase(url)}/users/me`,
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent,
      timeout: 30000,
      validateStatus: status => status < 500
    })

    if (me.status !== 200) {
      return { success: false, error: `Login token invalid: ${me.status} ${me.statusText}` }
    }

    return { success: true, token, user: me.data }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('mattermost-request', async (event, { baseUrl, token, method, path, params, data, headers }) => {
  try {
    const url = normalizeBaseUrl(baseUrl)
    if (!url) return { success: false, error: 'Missing baseUrl' }
    const p = String(path || '').trim()
    if (!p) return { success: false, error: 'Missing path' }

    // Accept either "/users/me" or "/api/v4/users/me"
    const fullPath = p.startsWith('/api/v4/') ? p : `/api/v4${p.startsWith('/') ? '' : '/'}${p}`
    const fullUrl = `${url}${fullPath}`

    const resp = await axios({
      method: (method || 'GET').toUpperCase(),
      url: fullUrl,
      params: params || undefined,
      data: data || undefined,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {})
      },
      httpsAgent,
      timeout: 60000,
      validateStatus: status => status < 500
    })

    if (resp.status >= 400) {
      return { success: false, status: resp.status, statusText: resp.statusText, error: 'Request failed', data: resp.data }
    }

    return { success: true, status: resp.status, data: resp.data, headers: resp.headers }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ----------------------
// Ollama IPC (ChatTools AI features)
// ----------------------
const defaultOllamaHost = () => process.env.OLLAMA_HOST || 'http://localhost:11434'

ipcMain.handle('ollama-tags', async (event, { host } = {}) => {
  try {
    const h = String(host || defaultOllamaHost()).trim().replace(/\/+$/, '')
    const resp = await axios({
      method: 'GET',
      url: `${h}/api/tags`,
      timeout: 15000,
      validateStatus: status => status < 500
    })
    if (resp.status !== 200) return { success: false, error: `Ollama tags failed: ${resp.status} ${resp.statusText}` }
    const models = Array.isArray(resp.data?.models) ? resp.data.models.map(m => m?.name).filter(Boolean) : []
    return { success: true, models }
  } catch (e) {
    return { success: false, error: e.message, models: [] }
  }
})

ipcMain.handle('ollama-generate', async (event, { host, model, prompt } = {}) => {
  try {
    const h = String(host || defaultOllamaHost()).trim().replace(/\/+$/, '')
    if (!prompt) return { success: false, error: 'Missing prompt' }
    const resp = await axios({
      method: 'POST',
      url: `${h}/api/generate`,
      timeout: 120000,
      data: { model, prompt, stream: false },
      validateStatus: status => status < 500
    })
    if (resp.status !== 200) return { success: false, error: `Ollama generate failed: ${resp.status} ${resp.statusText}` }
    return { success: true, response: String(resp.data?.response || '').trim(), raw: resp.data }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ----------------------
// Git IPC (ChatTools3 team_progress support)
// ----------------------
ipcMain.handle('git-run', async (event, { cwd, args, timeoutMs } = {}) => {
  try {
    const a = Array.isArray(args) ? args.map(x => String(x)) : []
    if (a.length === 0) return { success: false, error: 'Missing args' }
    const workdir = cwd ? String(cwd) : undefined
    const timeout = Math.max(1000, Math.min(Number(timeoutMs) || 30000, 300000))

    return await new Promise((resolve) => {
      const child = spawn('git', a, {
        cwd: workdir,
        windowsHide: true
      })

      let stdout = ''
      let stderr = ''
      let killed = false

      const t = setTimeout(() => {
        killed = true
        try { child.kill('SIGKILL') } catch {}
      }, timeout)

      child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
      child.stderr.on('data', (d) => { stderr += d.toString('utf8') })
      child.on('error', (e) => {
        clearTimeout(t)
        resolve({ success: false, error: e.message })
      })
      child.on('close', (code) => {
        clearTimeout(t)
        resolve({
          success: code === 0 && !killed,
          code,
          stdout,
          stderr,
          error: killed ? 'git-run timed out' : (code === 0 ? '' : (stderr || stdout || 'git-run failed'))
        })
      })
    })
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('settings-get', async () => {
  try {
    const p = settingsPath()
    if (!fs.existsSync(p)) return { success: true, config: null }
    const raw = await fsp.readFile(p, 'utf8')
    const settings = JSON.parse(raw)
    return { success: true, settings: hydrateSettingsFromDisk(settings) }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('settings-set', async (event, { settings }) => {
  try {
    const p = settingsPath()
    await ensureDir(path.dirname(p))
    const toDisk = sanitizeSettingsForDisk(settings)
    const tmp = `${p}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(toDisk, null, 2), 'utf8')
    await fsp.rename(tmp, p)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Back-compat aliases (older renderer builds)
ipcMain.handle('config-get', async () => {
  const res = await ipcMain._invoke ? ipcMain._invoke : null
  // avoid internal invoke usage; just duplicate behavior
  try {
    const p = settingsPath()
    if (!fs.existsSync(p)) return { success: true, config: null }
    const raw = await fsp.readFile(p, 'utf8')
    const settings = JSON.parse(raw)
    const hydrated = hydrateSettingsFromDisk(settings)
    return { success: true, config: hydrated.config || null }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('config-set', async (event, { config }) => {
  try {
    const p = settingsPath()
    await ensureDir(path.dirname(p))
    // store under settings.config, preserve other fields if present
    let existing = null
    if (fs.existsSync(p)) {
      try { existing = JSON.parse(await fsp.readFile(p, 'utf8')) } catch { existing = null }
    }
    const hydratedExisting = hydrateSettingsFromDisk(existing || {})
    const merged = { ...hydratedExisting, config: config || {} }
    const toDisk = sanitizeSettingsForDisk(merged)
    const tmp = `${p}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(toDisk, null, 2), 'utf8')
    await fsp.rename(tmp, p)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

