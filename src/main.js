import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import './services/localforageConfig'
import App from './App.vue'

// Capture JS warnings/errors for diagnostics (small ring buffer)
if (!window.__glvConsoleCaptureInstalled) {
  window.__glvConsoleCaptureInstalled = true
  const MAX = 200
  const buf = []
  window.__glvConsole = buf

  const push = (level, args) => {
    try {
      const safe = (Array.isArray(args) ? args : [args]).map(a => {
        if (a instanceof Error) return a.stack || a.message || String(a)
        if (typeof a === 'string') return a
        try { return JSON.stringify(a) } catch { return String(a) }
      })
      buf.push({ ts: Date.now(), level: String(level), msg: safe.join(' ') })
      if (buf.length > MAX) buf.splice(0, buf.length - MAX)
    } catch {
      // ignore
    }
  }

  const origWarn = console.warn
  const origError = console.error
  console.warn = (...args) => { push('warn', args); origWarn.apply(console, args) }
  console.error = (...args) => { push('error', args); origError.apply(console, args) }

  window.addEventListener('error', (e) => {
    push('error', [e?.message || 'window.error', e?.error?.stack || ''])
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason
    push('error', ['unhandledrejection', (r && (r.stack || r.message)) || String(r || '')])
  })
}

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: { dark: false },
      dark: { dark: true }
    }
  }
})

const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  if (window.__glvConsole) {
    try {
      window.__glvConsole.push({
        ts: Date.now(),
        level: 'error',
        msg: `vue.errorHandler: ${info || ''} ${(err && (err.stack || err.message)) || String(err)}`
      })
    } catch {
      // ignore
    }
  }
  // let it still surface in devtools
  console.error(err)
}
app.use(vuetify)
app.mount('#app')
