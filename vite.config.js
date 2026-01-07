import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'

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

  return {
    base: './',
    plugins: [
      vue(),
      vuetify({ autoImport: true }),
      viteSingleFile()
    ],
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
      '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
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
      globals: true
    },
    server: {
      proxy
    }
  }
})
