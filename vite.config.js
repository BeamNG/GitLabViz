import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'

// Read package version
import pkg from './package.json'

export default defineConfig(({ mode }) => {
  const isVitest =
    mode === 'test' ||
    String(process.env.NODE_ENV || '').toLowerCase() === 'test' ||
    String(process.env.VITEST || '').toLowerCase() === 'true' ||
    String(process.env.npm_lifecycle_event || '').toLowerCase() === 'test' ||
    process.argv.some(a => String(a || '').toLowerCase().includes('vitest'))
  const isProdBuild = mode === 'production' && !isVitest
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

  const safeExec = (cmd) => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      return ''
    }
  }

  const gitCommit = safeExec('git rev-parse --short HEAD')
  const gitBranch = safeExec('git rev-parse --abbrev-ref HEAD')
  const gitRepo = safeExec('git config --get remote.origin.url')
  const gitDirty = !!safeExec('git status --porcelain')

  // GitHub Actions metadata (only present on runners)
  const isGitHubActions = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true'
  const ghRepo = String(process.env.GITHUB_REPOSITORY || '').trim()
  const ghServerUrl = String(process.env.GITHUB_SERVER_URL || '').trim()
  const ghRunId = String(process.env.GITHUB_RUN_ID || '').trim()
  const ghRunNumber = String(process.env.GITHUB_RUN_NUMBER || '').trim()
  const ghRunAttempt = String(process.env.GITHUB_RUN_ATTEMPT || '').trim()
  const ghWorkflow = String(process.env.GITHUB_WORKFLOW || '').trim()
  const ghRefName = String(process.env.GITHUB_REF_NAME || '').trim()
  const ghSha = String(process.env.GITHUB_SHA || '').trim()

  const buildTime = new Date().toISOString()
  const versionInfo = {
    version: pkg.version,
    buildTime
  }

  const currentVersionPlugin = () => ({
    name: 'gitlabviz-current-version',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_VERSION%', String(versionInfo.version || ''))
        .replaceAll('%BUILD_TIME%', String(versionInfo.buildTime || ''))
        .replaceAll('%IS_PROD_BUILD%', isProdBuild ? 'true' : 'false')
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'current_version.json',
        source: JSON.stringify(versionInfo, null, 2) + '\n'
      })
    }
  })

  return {
    base: './',
    plugins: [
      vue(),
      // Tests run in Node; Vuetify auto-import injects component imports that pull in CSS (e.g. VIcon.css),
      // which Node can't load. For unit tests we don't need Vuetify, so skip the plugin.
      ...(isVitest ? [] : [vuetify({ autoImport: true })]),
      viteSingleFile(),
      currentVersionPlugin()
    ],
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
      '__BUILD_TIME__': JSON.stringify(buildTime),
      '__GIT_COMMIT__': JSON.stringify(gitCommit || ''),
      '__GIT_BRANCH__': JSON.stringify(gitBranch || ''),
      '__GIT_REPO__': JSON.stringify(gitRepo || ''),
      '__GIT_DIRTY__': JSON.stringify(gitDirty),
      '__CI_PROVIDER__': JSON.stringify(isGitHubActions ? 'github' : ''),
      '__GITHUB_REPOSITORY__': JSON.stringify(ghRepo),
      '__GITHUB_SERVER_URL__': JSON.stringify(ghServerUrl),
      '__GITHUB_RUN_ID__': JSON.stringify(ghRunId),
      '__GITHUB_RUN_NUMBER__': JSON.stringify(ghRunNumber),
      '__GITHUB_RUN_ATTEMPT__': JSON.stringify(ghRunAttempt),
      '__GITHUB_WORKFLOW__': JSON.stringify(ghWorkflow),
      '__GITHUB_REF_NAME__': JSON.stringify(ghRefName),
      '__GITHUB_SHA__': JSON.stringify(ghSha)
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/vitest.setup.js'],
      // Ensure jsdom has an origin so localStorage is available (localforage fallback driver).
      environmentOptions: {
        jsdom: {
          url: 'http://localhost/'
        }
      }
    },
    server: {
      proxy
    }
  }
})
