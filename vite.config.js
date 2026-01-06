import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Read package version
import pkg from './package.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gitlabTarget = String(env.VITE_GITLAB_PROXY_TARGET || '').trim()
  const svnTarget = String(env.VITE_SVN_PROXY_TARGET || '').trim()

  const proxy = {}
  if (svnTarget) {
    proxy['/svn'] = {
      target: svnTarget,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/svn/, '')
    }
  }
  if (gitlabTarget) {
    proxy['/gitlab'] = {
      target: gitlabTarget,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/gitlab/, '')
    }
  }

  return {
    base: './',
    plugins: [
      vue(),
      vuetify({ autoImport: true }),
      viteSingleFile()
    ],
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
      '__BUILD_TIME__': JSON.stringify(new Date().toISOString())
    },
    test: {
      environment: 'jsdom',
      globals: true
    },
    server: {
      proxy
    }
  }
})
