<template>
  <div class="d-flex flex-column fill-height">
    <div class="d-flex flex-column fill-height config-max config-root">
      <v-toolbar color="primary" density="comfortable" class="app-toolbar">
        <v-btn icon="mdi-arrow-left" variant="text" @click="$emit('close')" />
        <v-toolbar-title class="font-weight-bold">Configuration</v-toolbar-title>
        <v-spacer />
      </v-toolbar>

      <v-tabs v-model="tab" color="primary" align-tabs="start">
        <v-tab value="display" prepend-icon="mdi-theme-light-dark">Display</v-tab>
        <v-tab value="presets" prepend-icon="mdi-tune-variant">Presets</v-tab>
        <v-tab value="gitlab" prepend-icon="mdi-gitlab">GitLab</v-tab>
        <v-tab v-if="isElectron" value="svn" prepend-icon="mdi-folder-network">SVN</v-tab>
        <v-tab v-if="isElectron" value="mattermost" prepend-icon="mdi-message-text">Mattermost</v-tab>
        <v-tab value="cache" prepend-icon="mdi-database">Cache</v-tab>
        <v-tab value="about" prepend-icon="mdi-information-outline">About</v-tab>
        <v-tab value="changelog" prepend-icon="mdi-text-box-outline">Changelog</v-tab>
      </v-tabs>

      <v-divider />

      <div v-if="updateStatus?.loading" class="pa-3 bg-surface">
        <v-alert type="info" variant="tonal" density="compact" icon="mdi-progress-clock">
          <div class="text-caption text-medium-emphasis text-truncate">
            <strong>{{ updateStatus.source || 'update' }}</strong>: {{ updateStatus.message || 'Working…' }}
          </div>
        </v-alert>
      </div>

      <div v-if="error" class="px-3 pt-3 bg-surface">
        <v-alert type="error" variant="tonal" density="compact" icon="mdi-alert">
          {{ error }}
        </v-alert>
      </div>

      <div class="flex-grow-1 config-scroll bg-background">
        <v-window
          v-model="tab"
          class="bg-background"
          transition="scroll-x-transition"
          reverse-transition="scroll-x-reverse-transition"
        >
      <!-- Display -->
      <v-window-item value="display">
        <v-container class="py-6 config-max">
          <v-card>
            <v-card-text>
              <v-select
                v-model="themeSetting"
                :items="themeItems"
                item-title="title"
                item-value="value"
                label="Theme"
                variant="outlined"
                density="comfortable"
                bg-color="surface"
                hide-details
              />
              <div class="text-caption text-medium-emphasis mt-2">
                System follows your browser/OS color scheme.
              </div>

              <v-divider class="my-4" />

              <v-select
                v-model="settings.uiState.view.issueOpenTarget"
                :items="[
                  { title: 'New tab', value: '_blank' },
                  { title: 'Reuse new tab', value: 'GitlabVizIssueTab' },
                  { title: 'This tab (current window)', value: '_self' }
                ]"
                item-title="title"
                item-value="value"
                label="Open GitLab issues"
                variant="outlined"
                density="comfortable"
                bg-color="surface"
                hide-details
              />
            </v-card-text>
          </v-card>
        </v-container>
      </v-window-item>

      <!-- Presets -->
      <v-window-item value="presets">
        <v-container class="py-6 config-max">
          <div class="text-caption text-medium-emphasis mb-4">
            Create presets using the <strong>+</strong> button in the sidebar.
          </div>

          <v-card>
            <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
              <span>Custom presets</span>
              <v-btn
                variant="tonal"
                size="small"
                class="text-none"
                prepend-icon="mdi-clipboard-arrow-down"
                @click="importPresetFromClipboard"
                title="Import preset JSON from clipboard"
              >
                Import
              </v-btn>
            </v-card-title>
            <v-card-text>
              <div v-if="!customPresets.length" class="text-caption text-medium-emphasis">
                No custom presets yet.
              </div>
              <v-list v-else density="compact">
                <v-list-item v-for="p in customPresets" :key="p.name" :title="p.name">
                  <template #append>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="medium-emphasis"
                      :title="`Copy ${p.name} to clipboard`"
                      @click="copyPreset(p)"
                    >
                      <v-icon icon="mdi-content-copy" />
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="error"
                      :title="`Delete ${p.name}`"
                      @click="deletePreset(p.name)"
                    >
                      <v-icon icon="mdi-delete" />
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-container>
      </v-window-item>

      <!-- GitLab -->
      <v-window-item value="gitlab">
        <v-container class="py-6 config-max">
          <div class="d-flex align-center justify-end mb-3">
            <v-switch v-model="settings.config.enableGitLab" color="success" hide-details inset label="Enable GitLab" />
          </div>

          <v-row dense class="mb-3">
            <v-col cols="12" sm="9">
              <v-text-field
                v-model="settings.config.gitlabApiBaseUrl"
                label="GitLab URL"
                variant="outlined"
                :disabled="!settings.config.enableGitLab"
                hint="e.g. https://gitlab.example.com"
                persistent-hint
                bg-color="surface"
              >
                <template #prepend-inner>
                  <v-icon icon="mdi-web" size="small" class="text-medium-emphasis" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="12" sm="3" class="d-flex">
              <v-btn
                variant="tonal"
                class="text-none align-self-start mt-1"
                block
                style="height: 56px;"
                :loading="gitlabTestLoading"
                :disabled="gitlabTestLoading || !settings.config.enableGitLab || !settings.config.gitlabApiBaseUrl"
                @click="testGitLabConnection"
              >
                Test connection
              </v-btn>
            </v-col>
          </v-row>

          <v-alert
            v-if="gitlabTestResult"
            :type="gitlabTestResult.type || (gitlabTestResult.ok ? 'success' : 'error')"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ gitlabTestResult.message }}
          </v-alert>

          <v-row dense class="mb-3">
            <v-col cols="12" sm="9">
              <v-text-field
                v-model="settings.config.token"
                label="Personal Access Token"
                type="password"
                variant="outlined"
                :disabled="!settings.config.enableGitLab"
                hint="Requires read_api and read_user scopes"
                persistent-hint
                bg-color="surface"
              >
                <template #prepend-inner>
                  <v-icon icon="mdi-key" size="small" class="text-medium-emphasis" />
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="12" sm="3" class="d-flex">
              <v-btn
                color="primary"
                variant="elevated"
                class="text-none font-weight-bold align-self-start mt-1"
                block
                style="height: 56px;"
                :loading="gitlabTestLoading"
                :disabled="gitlabTestLoading || !settings.config.enableGitLab"
                @click="saveAndReloadGitLab"
              >
                <v-icon start>mdi-refresh</v-icon>
                Save & Reload
              </v-btn>
            </v-col>
          </v-row>

          <v-text-field
            v-model="settings.config.projectId"
            label="Project ID / Path"
            variant="outlined"
            :disabled="!settings.config.enableGitLab"
            hint="e.g. 'group/project' or numeric ID"
            persistent-hint
            bg-color="surface"
          >
            <template #prepend-inner>
              <v-icon icon="mdi-identifier" size="small" class="text-medium-emphasis" />
            </template>
          </v-text-field>

          <v-select
            v-model="settings.config.gitlabClosedDays"
            :items="[
              { title: 'None (Opened only)', value: 0 },
              { title: 'Last 7 days', value: 7 },
              { title: 'Last 14 days', value: 14 },
              { title: 'Last 30 days', value: 30 },
              { title: 'Last 60 days', value: 60 },
              { title: 'Last 90 days', value: 90 }
            ]"
            label="Include closed issues"
            variant="outlined"
            density="comfortable"
            class="mt-3"
            :disabled="!settings.config.enableGitLab"
            bg-color="surface"
            hint="Fetch issues closed within the last X days"
            persistent-hint
          >
            <template #prepend-inner>
              <v-icon icon="mdi-archive-check-outline" size="small" class="text-medium-emphasis" />
            </template>
          </v-select>

          <v-alert
            v-if="settings.config.enableGitLab"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-4"
            icon="mdi-information"
          >
            <div class="text-subtitle-2 mb-1">How to create a GitLab token</div>
            <ol class="pl-4 text-caption">
              <li class="mb-1">
                Open
                <a
                  v-if="gitlabTokenHelpUrl"
                  :href="gitlabTokenHelpUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="text-decoration-none font-weight-bold"
                >GitLab → User Settings → Access Tokens</a>
                <span v-else><strong>GitLab → User Settings → Access Tokens</strong></span>.
              </li>
              <li class="mb-1">Click <strong>Add new token</strong>.</li>
              <li class="mb-1">Give it a name (e.g. <code>GitLab Viz</code>) and optionally set an expiry date.</li>
              <li class="mb-1">Tick these scopes: <code>read_api</code> and <code>read_user</code>.</li>
              <li class="mb-1">Click <strong>Create personal access token</strong>.</li>
              <li>Copy the token immediately (GitLab usually only shows it once), then paste it into <strong>Personal Access Token</strong> above.</li>
            </ol>
          </v-alert>
        </v-container>
      </v-window-item>

      <!-- SVN -->
      <v-window-item v-if="isElectron" value="svn">
        <v-container class="py-6 config-max">
          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <div class="text-h6 font-weight-bold">Subversion (SVN)</div>
              <div class="text-caption text-medium-emphasis">Configure SVN log ingestion and disk cache.</div>
            </div>
            <v-switch v-model="settings.config.enableSvn" color="success" hide-details inset />
          </div>

          <v-alert
            v-if="!isElectron && !isDev"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
            icon="mdi-alert"
          >
            SVN integration requires running in Electron mode to bypass CORS restrictions.
          </v-alert>

          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-2 font-weight-bold">Repositories</div>
            <div class="d-flex gap-2">
              <v-btn
                variant="tonal"
                class="text-none"
                prepend-icon="mdi-refresh"
                :loading="updateStatus?.loading && updateStatus?.source === 'svn'"
                :disabled="updateStatus?.loading || !isElectron || !settings.config.enableSvn || !(settings.config.svnRepos || []).some(r => r && r.url)"
                @click="emit('update-source', { source: 'svn', mode: 'all', urls: (settings.config.svnRepos || []).map(r => r && r.url).filter(Boolean), username: settings.config.svnUsername || '', password: settings.config.svnPassword || '' })"
              >
                Update cache (all)
              </v-btn>
              <v-btn
                variant="text"
                color="error"
                class="text-none"
                prepend-icon="mdi-delete"
                :disabled="updateStatus?.loading || !isElectron || !settings.config.enableSvn || !(settings.config.svnRepos || []).some(r => r && r.url)"
                @click="emit('clear-source', { source: 'svn', mode: 'all', urls: (settings.config.svnRepos || []).map(r => r && r.url).filter(Boolean) })"
              >
                Delete cache (all)
              </v-btn>
              <v-btn variant="tonal" class="text-none" prepend-icon="mdi-plus" :disabled="!settings.config.enableSvn" @click="addSvnRepo">
                Add URL
              </v-btn>
            </div>
          </div>

          <v-row class="mb-3">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="settings.config.svnUsername"
                label="Username (shared)"
                variant="outlined"
                density="comfortable"
                bg-color="surface"
                :disabled="!settings.config.enableSvn"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="settings.config.svnPassword"
                label="Password (shared)"
                type="password"
                variant="outlined"
                density="comfortable"
                bg-color="surface"
                :disabled="!settings.config.enableSvn"
              />
            </v-col>
          </v-row>

          <v-card v-for="repo in (settings.config.svnRepos || [])" :key="repo.id" class="mb-3" variant="outlined">
            <v-card-text>
              <div class="d-flex flex-wrap gap-2 align-center">
                <v-text-field
                  v-model="repo.url"
                  label="Repository URL"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  class="flex-grow-1"
                  bg-color="surface"
                  :disabled="!settings.config.enableSvn"
                />
                <v-btn
                  variant="text"
                  color="error"
                  class="text-none"
                  prepend-icon="mdi-trash-can"
                  :disabled="!settings.config.enableSvn"
                  @click="removeSvnRepo(repo.id)"
                >
                  Remove
                </v-btn>
              </div>

              <div class="text-caption text-medium-emphasis mt-2" v-if="svnStatsById[repo.id] && svnStatsById[repo.id].exists">
                Cached: {{ (svnStatsById[repo.id].totalCount || 0).toLocaleString() }} commits
                • Size: {{ formatBytes(svnStatsById[repo.id].bytes || 0) }}
                • Newest: r{{ svnStatsById[repo.id].newestRev ?? '?' }}
                • Updated: {{ svnStatsById[repo.id].updatedAt ? new Date(svnStatsById[repo.id].updatedAt).toLocaleString() : '?' }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2" v-else>
                No cache found for this URL yet.
              </div>
            </v-card-text>
          </v-card>
        </v-container>
      </v-window-item>

      <!-- Mattermost -->
      <v-window-item v-if="isElectron" value="mattermost">
        <v-container class="py-6 config-max">
          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <div class="text-h6 font-weight-bold">Mattermost</div>
              <div class="text-caption text-medium-emphasis">Configure ChatTools (Mattermost) login and refresh.</div>
            </div>
          </div>

          <v-alert
            v-if="!isElectron"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
            icon="mdi-alert"
          >
            Mattermost integration requires running in Electron mode to bypass CORS restrictions.
          </v-alert>

          <v-card class="mb-4" variant="tonal">
            <v-card-text class="d-flex flex-wrap gap-4 align-center">
              <div class="flex-grow-1">
                <div class="text-subtitle-2 font-weight-bold">Status</div>
                <div class="text-caption text-medium-emphasis">
                  <span v-if="settings.config.mattermostToken && settings.config.mattermostUser?.username">
                    Logged in as <strong>{{ settings.config.mattermostUser.username }}</strong>
                    <span v-if="stats?.mattermost?.updatedAt"> • Updated: {{ new Date(stats.mattermost.updatedAt).toLocaleString() }}</span>
                    <span v-if="stats?.mattermost?.teams != null"> • Teams: {{ stats.mattermost.teams }}</span>
                  </span>
                  <span v-else>
                    Not logged in yet.
                  </span>
                </div>
                <div v-if="updateStatus?.loading && updateStatus?.source === 'mattermost'" class="text-caption text-medium-emphasis mt-1">
                  Updating: {{ updateStatus.message }}
                </div>
                <div v-if="mmError" class="text-caption text-error mt-2">{{ mmError }}</div>
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  variant="tonal"
                  class="text-none"
                  prepend-icon="mdi-refresh"
                  :loading="updateStatus?.loading && updateStatus?.source === 'mattermost'"
                  :disabled="updateStatus?.loading || !isElectron || !settings.config.mattermostUrl || !settings.config.mattermostToken"
                  @click="emit('update-source', 'mattermost')"
                >
                  Validate / Refresh
                </v-btn>
                <v-btn
                  variant="text"
                  color="error"
                  class="text-none"
                  prepend-icon="mdi-logout"
                  :disabled="updateStatus?.loading || !settings.config.mattermostToken"
                  @click="logoutMattermost"
                >
                  Logout
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-text-field
            v-model="settings.config.mattermostUrl"
            label="Mattermost URL"
            variant="outlined"
            class="mb-3"
            bg-color="surface"
            :disabled="!isElectron"
            hint="e.g. https://chat.example.com"
            persistent-hint
          >
            <template #prepend-inner>
              <v-icon icon="mdi-link-variant" size="small" class="text-medium-emphasis" />
            </template>
          </v-text-field>

          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">Login</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="mmEmail" label="Email" variant="outlined" density="comfortable" bg-color="surface" :disabled="!isElectron" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="mmPassword" label="Password" type="password" variant="outlined" density="comfortable" bg-color="surface" :disabled="!isElectron" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="mmMfaToken" label="MFA Token (optional)" variant="outlined" density="comfortable" bg-color="surface" :disabled="!isElectron" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-btn color="primary" :loading="mmLoggingIn" :disabled="!isElectron || !settings.config.mattermostUrl" @click="loginMattermost">
                Login
              </v-btn>
              <v-spacer />
              <div v-if="settings.config.mattermostToken && settings.config.mattermostUser?.username" class="text-caption text-medium-emphasis">
                Logged in as <strong>{{ settings.config.mattermostUser.username }}</strong>
              </div>
            </v-card-actions>
          </v-card>
        </v-container>
      </v-window-item>

      <!-- Cache -->
      <v-window-item value="cache">
        <v-container class="py-6 config-max">
          <div class="text-caption text-medium-emphasis mb-4">
            <template v-if="isElectron">
              Disk-backed cache used for large datasets.
            </template>
            <template v-else>
              Browser cache stored locally (IndexedDB via localforage). Use export/import for backups.
            </template>
          </div>

          <v-card class="mb-4" variant="outlined" v-if="isElectron">
            <v-card-text class="d-flex align-center flex-wrap gap-4">
              <div class="flex-grow-1">
                <div class="text-subtitle-2 font-weight-bold">Disk cache (SVN + settings)</div>
                <div class="text-caption text-medium-emphasis" style="word-break: break-all;">
                  {{ cachePath || '…' }}
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  Backup: copy this folder to another machine/drive.
                </div>
              </div>
              <div class="d-flex gap-2">
                <v-btn variant="tonal" class="text-none" prepend-icon="mdi-folder-open" @click="openCacheFolder">
                  Open
                </v-btn>
                <v-btn variant="tonal" class="text-none" prepend-icon="mdi-content-copy" @click="copyCachePath">
                  Copy path
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <div class="text-subtitle-2 font-weight-bold mb-2">Cache contents</div>

          <v-card v-if="hasGitlabCache" class="mb-4">
            <v-card-text>
              <div class="text-subtitle-2 font-weight-bold">GitLab</div>
              <div class="text-caption text-medium-emphasis">
                Cached issues: {{ stats?.gitlabCache?.nodes?.toLocaleString?.() ?? 0 }}
                • Cached edgeslinks: {{ stats?.gitlabCache?.edges?.toLocaleString?.() ?? 0 }}
                <span v-if="stats?.gitlabCache?.updatedAt"> • Updated: {{ new Date(stats.gitlabCache.updatedAt).toLocaleString() }}</span>
                <span v-if="gitlabCacheDetails.bytes"> • Size: {{ formatBytes(gitlabCacheDetails.bytes) }}</span>
              </div>
              <div v-if="updateStatus?.loading && updateStatus?.source === 'gitlab'" class="text-caption text-medium-emphasis mt-1">
                Updating: {{ updateStatus.message }}
              </div>
            </v-card-text>
          </v-card>

          <v-card v-if="isElectron && hasSvnCache" class="mb-4" >
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-3">
                <div>
                  <div class="text-subtitle-2 font-weight-bold">SVN</div>
                  <div class="text-caption text-medium-emphasis">Per-repo commit cache stored on disk.</div>
                </div>
              </div>

              <div v-for="repo in (settings.config.svnRepos || [])" :key="repo.id" class="mb-2">
                <div class="text-caption font-weight-bold" style="word-break: break-all;">
                  {{ repo.url || '(no url)' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  <template v-if="svnStatsById[repo.id] && svnStatsById[repo.id].exists">
                    {{ (svnStatsById[repo.id].totalCount || 0).toLocaleString() }} commits
                    • Size: {{ formatBytes(svnStatsById[repo.id].bytes || 0) }}
                    • Newest: r{{ svnStatsById[repo.id].newestRev ?? '?' }}
                    • Updated: {{ svnStatsById[repo.id].updatedAt ? new Date(svnStatsById[repo.id].updatedAt).toLocaleString() : '?' }}
                  </template>
                  <template v-else>
                    No cache found for this URL yet.
                  </template>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <v-card v-if="hasMattermostInfo" class="mb-4" variant="outlined">
            <v-card-text>
              <div class="text-subtitle-2 font-weight-bold">Mattermost</div>
              <div class="text-caption text-medium-emphasis">
                No local cache (queries are live). Status:
                <span v-if="stats?.mattermost?.loggedIn">logged in</span>
                <span v-else>not logged in</span>
                <span v-if="stats?.mattermost?.updatedAt"> • Updated: {{ new Date(stats.mattermost.updatedAt).toLocaleString() }}</span>
                <span v-if="stats?.mattermost?.teams != null"> • Teams: {{ stats.mattermost.teams }}</span>
              </div>
            </v-card-text>
          </v-card>

          <v-card class="mt-6" variant="tonal">
            <v-card-text class="d-flex gap-2 flex-wrap justify-end">
              <v-btn
                variant="tonal"
                class="text-none"
                prepend-icon="mdi-refresh"
                :disabled="updateStatus?.loading"
                @click="updateAllCache"
              >
                Update
              </v-btn>
              &nbsp;
              <v-btn
                variant="text"
                color="error"
                class="text-none"
                prepend-icon="mdi-delete"
                :disabled="updateStatus?.loading"
                @click="deleteAllCache"
              >
                Delete
              </v-btn>
              &nbsp;
              <v-btn variant="tonal" class="text-none" prepend-icon="mdi-download" @click="backupAllCache">
                Backup
              </v-btn>
              &nbsp;
              <v-btn variant="tonal" class="text-none" prepend-icon="mdi-upload" @click="restoreAllCache">
                Restore
              </v-btn>
              <input ref="restoreInput" type="file" accept="application/json" style="display: none;" @change="onRestoreFile" />
            </v-card-text>
          </v-card>
        </v-container>
      </v-window-item>

      <!-- About -->
      <v-window-item value="about">
        <v-container class="py-6 config-max">
          <v-card v-if="!isElectron && !isDev" class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">Offline Use</v-card-title>
            <v-card-text>
              <div class="d-flex align-center justify-space-between">
                 <div class="text-body-2">
                   Want to run this offline or on your own machine?<br/>
                   Just download this html and open it in your browser locally.
                 </div>
                 <br/>
                 <v-btn
                  variant="outlined"
                  size="small"
                  color="primary"
                  class="text-none"
                  prepend-icon="mdi-download"
                  @click="downloadSpa"
                 >
                   Download this app (.html)
                 </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-card class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">Version</v-card-title>
            <v-card-text>
              <div class="d-flex flex-column gap-1">
                <div><strong>App</strong>: GitLab Viz v{{ appVersion }}</div>
                <div><strong>Runtime</strong>: {{ runtimeLabel }}</div>
                <div><strong>Mode</strong>: {{ buildMode }}</div>
                <div><strong>Build</strong>: {{ isDev ? 'development' : 'production' }}</div>
              </div>
            </v-card-text>
          </v-card>

          <v-card class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">Environment</v-card-title>
            <v-card-text>
              <div class="d-flex flex-column gap-1">
                <div><strong>Platform</strong>: {{ platform }}</div>
                <div><strong>User Agent</strong>: <span style="word-break: break-word;">{{ userAgent }}</span></div>
                <div><strong>Settings storage</strong>: {{ settingsStorage }}</div>
                <div><strong>Configured project</strong>: {{ settings.config.projectId || '(none)' }}</div>
              </div>
            </v-card-text>
          </v-card>

          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">Support</v-card-title>
            <v-card-text>
              <div class="text-body-2">
                If you need help, open an issue on the project repository and include the <strong>Copy diagnostics</strong> output above plus a short description of:
              </div>
              <ul class="pl-5 mt-2 text-body-2">
                <li>What you expected vs what happened</li>
                <li>Steps to reproduce</li>
                <li>Screenshot/video if it’s UI-related</li>
              </ul>
              <div class="text-caption text-medium-emphasis mt-3">
                Tip: If you’re using the reuse-tab option for issues, set <strong>Config → Display → Open GitLab issues</strong>.
              </div>
            </v-card-text>
          </v-card>

          <div class="d-flex gap-2 mt-4 justify-end">
            <v-btn
              v-if="isElectron"
              variant="tonal"
              class="text-none"
              prepend-icon="mdi-bug-outline"
              @click="openDevTools"
            >
              Open DevTools
            </v-btn>
            <v-btn
              variant="tonal"
              class="text-none"
              prepend-icon="mdi-content-copy"
              @click="copyDiagnostics"
            >
              Copy diagnostics
            </v-btn>
          </div>
        </v-container>
      </v-window-item>

      <!-- Changelog -->
      <v-window-item value="changelog">
        <v-container class="py-6 config-max">
          <v-card>
            <v-card-text>
              <div class="changelog-markdown">
                <div
                  v-for="s in changelogSections"
                  :key="s.key"
                  class="changelog-section"
                  :class="{ 'is-current': s.isCurrent }"
                  v-html="s.html"
                ></div>
              </div>
            </v-card-text>
          </v-card>
        </v-container>
      </v-window-item>
      </v-window>
      </div>

      <v-divider />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { cacheGetPath, cacheOpenFolder, svnCacheGetStats } from '../services/cache'
import { mattermostLogin } from '../services/mattermost'
import { createGitLabClient, normalizeGitLabApiBaseUrl } from '../services/gitlab'
import { useSettingsStore } from '../composables/useSettingsStore'
import localforage from 'localforage'
import pkg from '../../package.json'
import changelogRaw from '../../CHANGELOG.md?raw'
import { renderMarkdown } from '../chatTools/utils'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({})
  },
  updateStatus: {
    type: Object,
    default: () => ({ loading: false, source: '', message: '' })
  },
  error: {
    type: String,
    default: ''
  },
  initialTab: {
    type: String,
    default: 'gitlab'
  }
})

const emit = defineEmits(['close', 'save', 'clear-data', 'update-source', 'clear-source'])

// Use shared settings directly (saves on any change)
const { settings } = useSettingsStore()
const themeItems = [
  { title: 'System (browser)', value: 'system' },
  { title: 'Dark', value: 'dark' },
  { title: 'Light', value: 'light' }
]
const themeSetting = computed({
  get: () => settings.uiState.ui.theme || 'system',
  set: v => { settings.uiState.ui.theme = v || 'system' }
})

const isElectron = computed(() => !!window.electronAPI)
const isDev = import.meta.env.DEV
const buildMode = import.meta.env.MODE || (isDev ? 'development' : 'production')

const gitlabTestLoading = ref(false)
const gitlabTestResult = ref(null) // { ok: boolean, message: string }

const resolveGitLabApiBaseUrl = () => {
  const raw = String(settings.config.gitlabApiBaseUrl || '').trim()
  if (!raw) return ''

  const direct = normalizeGitLabApiBaseUrl(raw)
  if (!direct) return ''

  if (!isElectron.value && isDev) {
    const proxyTarget = String(import.meta.env.VITE_GITLAB_PROXY_TARGET || '').trim().replace(/\/+$/, '')
    const host = raw.replace(/\/+$/, '')
    if (proxyTarget && host.startsWith(proxyTarget)) return '/gitlab/api/v4'
  }

  return direct
}

async function runGitLabTest ({ requireToken = false, requireProject = false } = {}) {
  const baseURL = resolveGitLabApiBaseUrl()
  if (!baseURL) {
    return { ok: false, type: 'error', message: 'Please provide GitLab URL first.' }
  }

  const token = String(settings.config.token || '').trim()
  if (requireToken && !token) {
    return { ok: false, type: 'warning', message: 'Please provide a Personal Access Token first.' }
  }

  gitlabTestLoading.value = true
  try {
    const client = createGitLabClient(baseURL, token)

    if (token) {
      const resp = await client.get('/user')
      const u = resp && resp.data ? resp.data : null
      if (!u || (!u.username && !u.name)) throw new Error('Unexpected /user response')
    } else {
      const resp = await client.get('/version')
      const v = resp && resp.data ? resp.data : null
      if (!v || !v.version) throw new Error('Unexpected /version response')
    }

    if (requireProject) {
      const projectId = String(settings.config.projectId || '').trim()
      if (!projectId) return { ok: false, type: 'warning', message: 'Please provide Project ID / Path first.' }
      const encoded = encodeURIComponent(projectId)
      const pr = await client.get(`/projects/${encoded}`)
      const p = pr && pr.data ? pr.data : null
      if (!p || (!p.id && !p.path_with_namespace)) throw new Error('Unexpected /projects response')
    }

    if (token) return { ok: true, type: 'success', message: 'OK (GitLab API + token verified)' }
    return { ok: true, type: 'success', message: 'OK (GitLab API reachable)' }
  } catch (e) {
    const status = e?.response?.status
    if (status === 401 && !token) {
      return {
        ok: false,
        type: 'info',
        message: '401 (unauthenticated). This GitLab may require login/token for API access. You can ignore this until you set a Personal Access Token (or sign into GitLab in your browser) and retry.'
      }
    }
    if (status === 401 && token) {
      return {
        ok: false,
        type: 'warning',
        message: '401 (unauthorized). Token is missing/invalid or lacks required scopes (read_api, read_user).'
      }
    }
    if (status === 403) {
      return { ok: false, type: 'warning', message: '403 (forbidden). Token likely lacks required permissions (read_api).' }
    }
    if (status === 404 && requireProject) {
      return { ok: false, type: 'error', message: 'Project not found (404). Check Project ID / Path, or token permissions.' }
    }
    return { ok: false, type: 'error', message: e?.message || String(e) }
  } finally {
    gitlabTestLoading.value = false
  }
}

async function testGitLabConnection () {
  gitlabTestResult.value = null
  gitlabTestResult.value = await runGitLabTest()
}

async function saveAndReloadGitLab () {
  gitlabTestResult.value = null
  const res = await runGitLabTest({ requireToken: true, requireProject: true })
  gitlabTestResult.value = res
  if (!res?.ok) return
  refreshAndClose()
}

const gitlabTokenHelpUrl = computed(() => {
  const raw = String(settings.config.gitlabApiBaseUrl || '').trim()
  if (!raw) return ''
  const base = raw.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '')
  return `${base}/-/user_settings/personal_access_tokens`
})

const appVersion = computed(() => {
  const v = pkg && pkg.version ? String(pkg.version) : ''
  return v || '0.0.0'
})

const runtimeLabel = computed(() => (isElectron.value ? 'Electron' : 'Web'))
const platform = computed(() => {
  try {
    return navigator.platform || 'unknown'
  } catch {
    return 'unknown'
  }
})
const userAgent = computed(() => {
  try {
    return navigator.userAgent || 'unknown'
  } catch {
    return 'unknown'
  }
})
const settingsStorage = computed(() => (window.electronAPI?.settingsGet && window.electronAPI?.settingsSet) ? 'disk (Electron)' : 'localforage (browser)')

const diagnosticsText = computed(() => {
  const lines = []
  lines.push(`GitLab Viz v${appVersion.value}`)
  lines.push(`Runtime: ${runtimeLabel.value}`)
  lines.push(`Mode: ${buildMode}`)
  lines.push(`Platform: ${platform.value}`)
  lines.push(`User Agent: ${userAgent.value}`)
  lines.push(`Settings storage: ${settingsStorage.value}`)
  lines.push(`Project: ${settings.config.projectId || ''}`)
  const logs = Array.isArray(window.__glvConsole) ? window.__glvConsole : []
  const recent = logs
    .filter(e => e && (e.level === 'warn' || e.level === 'error'))
    .slice(-50)
  if (recent.length) {
    lines.push('')
    lines.push('Recent JS warnings/errors (last 50):')
    recent.forEach(e => {
      const ts = e.ts ? new Date(e.ts).toISOString() : ''
      lines.push(`[${ts}] ${e.level}: ${e.msg || ''}`.trim())
    })
  }
  lines.push(`Time: ${new Date().toISOString()}`)
  return lines.join('\n')
})

const openDevTools = async () => {
  try {
    if (!window.electronAPI?.openDevTools) return
    const res = await window.electronAPI.openDevTools()
    if (res && res.success === false) alert(res.error || 'Failed to open DevTools.')
  } catch {
    alert('Failed to open DevTools.')
  }
}

const copyDiagnostics = async () => {
  try {
    await navigator.clipboard.writeText(diagnosticsText.value)
    alert('Diagnostics copied to clipboard.')
  } catch (e) {
    alert('Failed to copy diagnostics to clipboard.')
  }
}

const changelogSections = computed(() => {
  const cur = appVersion.value
  let text = String(changelogRaw || '')
  // The tab already says "Changelog" — drop the top heading to avoid duplicate headers.
  text = text.replace(/^#\s+Changelog\s*\n+/i, '')

  const lines = text.split('\n')
  const starts = []
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\[/.test(lines[i])) starts.push(i)
  }

  const out = []
  const pushBlock = (key, block, isCurrent = false) => {
    const b = String(block || '').trim()
    if (!b) return
    out.push({ key, html: renderMarkdown(b), isCurrent })
  }

  if (!starts.length) {
    pushBlock('all', text, false)
    return out
  }

  // Preamble before first version section
  pushBlock('preamble', lines.slice(0, starts[0]).join('\n'), false)

  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]
    const e = (i + 1 < starts.length) ? starts[i + 1] : lines.length
    const block = lines.slice(s, e).join('\n')
    const m = block.match(/^##\s+\[([^\]]+)\]/m)
    const ver = m ? String(m[1]) : ''
    pushBlock(`release-${ver || i}`, block, ver === cur)
  }

  return out
})
const hasGitlabCache = computed(() => {
  const c = props.stats && props.stats.gitlabCache ? props.stats.gitlabCache : {}
  return !!((c.nodes || 0) || (c.edges || 0) || c.updatedAt)
})
const hasMattermostInfo = computed(() => {
  const m = props.stats && props.stats.mattermost ? props.stats.mattermost : {}
  return !!(m.loggedIn || m.updatedAt || (m.teams || 0) > 0)
})

const tab = ref(props.initialTab || 'gitlab')

// In SPA/web, default to GitLab tab if no specific tab requested, but allow overrides (like changelog)
if (!window.electronAPI && !props.initialTab) tab.value = 'gitlab'
const cachePath = ref('')
const mmEmail = ref('')
const mmPassword = ref('')
const mmMfaToken = ref('')
const mmLoggingIn = ref(false)
const mmError = ref('')
const gitlabCacheDetails = ref({ bytes: 0 })

const customPresets = computed(() => {
  const p = settings.uiState && settings.uiState.presets ? settings.uiState.presets : null
  return p && Array.isArray(p.custom) ? p.custom : []
})

const deletePreset = (name) => {
  const n = String(name || '').trim()
  if (!n) return
  settings.uiState.presets.custom = customPresets.value.filter(p => p && p.name !== n)
}

const copyPreset = async (p) => {
  if (!p || !p.name) return
  let cfg
  try {
    const raw = p.config || p.settings?.config || p.settings
    cfg = JSON.parse(JSON.stringify(toRaw(raw)))
  } catch {
    alert('Preset is not serializable.')
    return
  }
  const payload = { name: String(p.name), config: cfg }
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    alert('Preset copied to clipboard.')
  } catch (e) {
    alert('Failed to copy preset to clipboard.')
  }
}

const importPresetFromClipboard = async () => {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch (e) {
    alert('Failed to read clipboard.')
    return
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    alert('Clipboard does not contain valid JSON.')
    return
  }

  const cur = Array.isArray(settings.uiState.presets.custom) ? settings.uiState.presets.custom : []
  const list = cur
    .map(p => {
      if (!p || !p.name) return null
      try {
        const raw = p.config || p.settings?.config || p.settings
        return { name: String(p.name), config: JSON.parse(JSON.stringify(toRaw(raw))) }
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const existingNames = new Set(list.map(p => (p && p.name) ? String(p.name) : ''))

  const addOne = (obj) => {
    if (!obj || typeof obj !== 'object') return false

    const config = obj.config || obj.settings?.config || obj.settings
    if (!config || typeof config !== 'object') return false
    let safeConfig
    try {
      safeConfig = JSON.parse(JSON.stringify(config))
    } catch {
      return false
    }

    let name = String(obj.name || '').trim()
    if (!name) name = `Imported ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`
    if (existingNames.has(name)) {
      let i = 2
      while (existingNames.has(`${name} (${i})`)) i++
      name = `${name} (${i})`
    }

    list.push({ name, config: safeConfig })
    existingNames.add(name)
    return true
  }

  let ok = false
  if (Array.isArray(parsed)) ok = parsed.map(addOne).some(Boolean)
  else ok = addOne(parsed)

  if (!ok) {
    alert('Clipboard JSON is not a preset. Expected { name, config }.')
    return
  }

  settings.uiState.presets.custom = list
  alert('Preset imported.')
}

const refreshSvnStats = async () => {
  if (!isElectron.value) return
  const list = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
  for (const r of list) {
    if (!r || !r.id) continue
    if (!r.url) { svnStatsById.value[r.id] = { exists: false, bytes: 0 }; continue }
    svnStatsById.value[r.id] = await svnCacheGetStats(r.url)
  }
}

const openCacheFolder = async () => {
  if (!isElectron.value) return
  await cacheOpenFolder()
}

const copyCachePath = async () => {
  if (!cachePath.value) return
  try {
    await navigator.clipboard.writeText(cachePath.value)
    alert('Cache path copied to clipboard.')
  } catch (e) {
    alert('Failed to copy cache path.')
  }
}

const estimateJsonBytes = (v) => {
  try {
    const s = JSON.stringify(v)
    return s ? s.length : 0
  } catch {
    return 0
  }
}

const refreshGitlabCacheDetails = async () => {
  const meta = await localforage.getItem('gitlab_meta')
  const nodes = await localforage.getItem('gitlab_nodes')
  const edges = await localforage.getItem('gitlab_edges')
  gitlabCacheDetails.value = {
    bytes: estimateJsonBytes(meta) + estimateJsonBytes(nodes) + estimateJsonBytes(edges)
  }
}

const downloadTextFile = (filename, content, mime = 'application/json') => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const downloadSpa = async () => {
  try {
    const res = await fetch(window.location.href, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    downloadTextFile('gitlab-viz.html', text, 'text/html')
  } catch (e) {
    alert(`Failed to download SPA: ${e.message}`)
  }
}

const restoreInput = ref(null)

const exportGitlabCache = async () => {
  const payload = {
    type: 'gitlab-viz-cache',
    version: 2,
    exportedAt: Date.now(),
    gitlab: {
      meta: await localforage.getItem('gitlab_meta'),
      nodes: await localforage.getItem('gitlab_nodes'),
      edges: await localforage.getItem('gitlab_edges')
    },
    settings: {
      presets: settings.uiState && settings.uiState.presets ? { custom: settings.uiState.presets.custom || [] } : { custom: [] }
    }
  }
  const ts = new Date(payload.exportedAt).toISOString().replace(/[:.]/g, '-')
  downloadTextFile(`gitlab-viz-cache-${ts}.json`, JSON.stringify(payload, null, 2))
}

const updateAllCache = () => {
  if (settings.config.enableGitLab) emit('update-source', 'gitlab')
  if (isElectron.value && settings.config.enableSvn) {
    const urls = (settings.config.svnRepos || []).map(r => r && r.url).filter(Boolean)
    if (urls.length) {
      emit('update-source', { source: 'svn', mode: 'all', urls, username: settings.config.svnUsername || '', password: settings.config.svnPassword || '' })
    }
  }
  if (isElectron.value && settings.config.mattermostUrl && settings.config.mattermostToken) emit('update-source', 'mattermost')
}

const deleteAllCache = () => {
  if (!confirm('Delete cached data for all sources?')) return
  if (hasGitlabCache.value) emit('clear-source', 'gitlab')
  if (isElectron.value) {
    const urls = (settings.config.svnRepos || []).map(r => r && r.url).filter(Boolean)
    if (urls.length) emit('clear-source', { source: 'svn', mode: 'all', urls })
  }
}

const backupAllCache = async () => {
  if (isElectron.value && cachePath.value) {
    alert(`SVN/settings cache is stored on disk.\n\nBackup: copy this folder:\n${cachePath.value}\n\nA GitLab cache backup (.json) will download next.`)
  }
  await exportGitlabCache()
}

const restoreAllCache = () => {
  if (isElectron.value && cachePath.value) {
    alert(`This restores the GitLab cache from a .json backup.\n\nSVN/settings cache restore is done by copying the cache folder back:\n${cachePath.value}`)
  }
  openRestoreDialog()
}

const openRestoreDialog = () => {
  if (restoreInput.value) restoreInput.value.click()
}

const onRestoreFile = async (e) => {
  const file = e && e.target && e.target.files ? e.target.files[0] : null
  if (!file) return
  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const gitlab = payload && payload.gitlab ? payload.gitlab : null
    if (!gitlab || typeof gitlab !== 'object') throw new Error('Invalid backup file (missing gitlab)')
    await localforage.setItem('gitlab_meta', gitlab.meta || null)
    await localforage.setItem('gitlab_nodes', gitlab.nodes || null)
    await localforage.setItem('gitlab_edges', gitlab.edges || null)

    // Restore custom presets (optional; backward compatible with older backups)
    const presets = payload && payload.settings && payload.settings.presets ? payload.settings.presets : null
    if (presets && Array.isArray(presets.custom)) {
      settings.uiState.presets.custom = presets.custom.filter(p => p && typeof p === 'object' && p.name && p.settings.config)
    }

    await refreshGitlabCacheDetails()
    alert('GitLab cache restored. Close settings.configuration and refresh data if needed.')
  } catch (err) {
    alert(`Failed to restore cache: ${err && err.message ? err.message : String(err)}`)
  } finally {
    // allow re-selecting the same file
    if (e && e.target) e.target.value = ''
  }
}

onMounted(async () => {
  if (isElectron.value) {
    cachePath.value = await cacheGetPath()
    await refreshSvnStats()
  }
  await refreshGitlabCacheDetails()
})

watch(() => (settings.config.svnRepos || []).map(r => r.url).join('|'), () => {
  refreshSvnStats()
})

const svnStatsById = ref({})
const hasSvnCache = computed(() => {
  if (!isElectron.value) return false
  const list = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
  for (const r of list) {
    if (!r || !r.id) continue
    if (svnStatsById.value[r.id] && svnStatsById.value[r.id].exists) return true
  }
  return false
})

watch(tab, (v) => {
  if (v === 'cache') refreshGitlabCacheDetails()
})

const addSvnRepo = () => {
  const id = `repo-${Date.now()}`
  if (!Array.isArray(settings.config.svnRepos)) settings.config.svnRepos = []
  settings.config.svnRepos.push({ id, url: '', enabled: true })
}

const removeSvnRepo = (id) => {
  if (!confirm('Remove this SVN repo from the settings.config? (Does not delete its cache on disk)')) return
  const list = Array.isArray(settings.config.svnRepos) ? settings.config.svnRepos : []
  const idx = list.findIndex(r => r.id === id)
  if (idx >= 0) list.splice(idx, 1)
  delete svnStatsById.value[id]
}

const formatBytes = (bytes) => {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

const refreshAndClose = () => {
  emit('save')
  emit('close')
}

const loginMattermost = async () => {
  mmError.value = ''
  mmLoggingIn.value = true
  try {
    const res = await mattermostLogin({
      baseUrl: settings.config.mattermostUrl || '',
      email: mmEmail.value,
      password: mmPassword.value,
      mfaToken: mmMfaToken.value
    })
    settings.config.mattermostToken = res.token
    settings.config.mattermostUser = res.user || null
  } catch (e) {
    mmError.value = e?.message || String(e)
  } finally {
    mmLoggingIn.value = false
  }
}

const logoutMattermost = () => {
  if (!confirm('Log out from Mattermost (clears stored token)?')) return
  settings.config.mattermostToken = ''
  settings.config.mattermostUser = null
}
</script>

<style scoped>
.config-root {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.config-scroll {
  flex: 1 1 auto;
  height: 0; /* Crucial for nested flex scrolling */
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* styling the scrollbar for dark mode consistency */
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.3) transparent;
}

.config-scroll::-webkit-scrollbar {
  width: 8px;
}
.config-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.config-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(var(--v-theme-on-surface), 0.3);
  border-radius: 4px;
}

.config-max {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.gap-4 {
    gap: 16px;
}

.changelog-markdown {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
}

.changelog-section {
  margin: 0;
}

.changelog-section + .changelog-section {
  margin-top: 14px;
}

.changelog-section.is-current {
  border: 1px solid rgba(33, 150, 243, 0.35);
  background: rgba(33, 150, 243, 0.08);
  border-radius: 10px;
  padding: 12px 12px 8px;
}

.changelog-section :deep(h1),
.changelog-section :deep(h2),
.changelog-section :deep(h3),
.changelog-section :deep(p),
.changelog-section :deep(ul),
.changelog-section :deep(ol) {
  margin-top: 10px;
  margin-bottom: 10px;
}

.changelog-section :deep(h1:first-child),
.changelog-section :deep(h2:first-child),
.changelog-section :deep(h3:first-child),
.changelog-section :deep(p:first-child) {
  margin-top: 0;
}

.changelog-section :deep(ul),
.changelog-section :deep(ol) {
  padding-left: 22px;
}

.changelog-section :deep(li) {
  margin: 4px 0;
}

.changelog-markdown :deep(pre) {
  padding: 10px;
  border-radius: 8px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.08);
}

.changelog-markdown :deep(h1),
.changelog-markdown :deep(h2),
.changelog-markdown :deep(h3) {
  margin-top: 14px;
}
</style>