import { mm } from '../services/mattermost'

export class MattermostClient {
  constructor ({ baseUrl, token }) {
    this.baseUrl = baseUrl
    this.token = token
    this._users = new Map()
    this._channels = new Map()
    this._teams = null
    this._me = null
  }

  setAuth ({ baseUrl, token }) {
    this.baseUrl = baseUrl
    this.token = token
  }

  _ctx () {
    if (!this.baseUrl) throw new Error('Missing Mattermost baseUrl')
    if (!this.token) throw new Error('Not logged in (missing token)')
    return { baseUrl: this.baseUrl, token: this.token }
  }

  async me () {
    if (this._me) return this._me
    const res = await mm.me(this._ctx())
    this._me = res
    return res
  }

  async teams () {
    if (this._teams) return this._teams
    const res = await mm.teams(this._ctx())
    this._teams = Array.isArray(res) ? res : []
    return this._teams
  }

  async teamChannels (teamId) {
    const res = await mm.teamChannels({ ...this._ctx(), teamId })
    const list = Array.isArray(res) ? res : []
    for (const c of list) {
      if (c && c.id) this._channels.set(c.id, c)
    }
    return list
  }

  async channelById (channelId) {
    if (this._channels.has(channelId)) return this._channels.get(channelId)
    const c = await mm.channelById({ ...this._ctx(), channelId })
    if (c && c.id) this._channels.set(c.id, c)
    return c
  }

  async usersByIds (ids) {
    const out = {}
    const missing = []
    for (const id of (ids || [])) {
      if (!id) continue
      if (this._users.has(id)) out[id] = this._users.get(id)
      else missing.push(id)
    }
    if (missing.length) {
      const fetched = await mm.usersByIds({ ...this._ctx(), ids: missing })
      if (Array.isArray(fetched)) {
        for (const u of fetched) {
          if (u && u.id) {
            this._users.set(u.id, u)
            out[u.id] = u
          }
        }
      }
    }
    return out
  }

  async userById (id) {
    if (!id) return null
    const m = await this.usersByIds([id])
    return m[id] || null
  }

  async userByUsername (username) {
    const u = String(username || '').trim()
    if (!u) return null
    const key = `__username__:${u.toLowerCase()}`
    if (this._users.has(key)) return this._users.get(key)
    const res = await mm.userByUsername({ ...this._ctx(), username: u })
    if (res && res.id) {
      this._users.set(res.id, res)
      this._users.set(key, res)
    }
    return res || null
  }

  async posts (channelId, { perPage = 60, page = 0 } = {}) {
    return await mm.posts({ ...this._ctx(), channelId, perPage, page })
  }

  async thread (postId) {
    return await mm.thread({ ...this._ctx(), postId })
  }

  async flaggedPosts () {
    const me = await this.me()
    const userId = me?.id
    if (!userId) throw new Error('Could not resolve current user id')
    return await mm.flaggedPosts({ ...this._ctx(), userId })
  }

  async notificationKeywords () {
    const me = await this.me()
    const keys = String(me?.notify_props?.mention_keys || '').trim()
    if (!keys) return []
    return keys.split(',').map(s => s.trim()).filter(Boolean)
  }

  async searchPosts (teamId, terms) {
    return await mm.searchPosts({ ...this._ctx(), teamId, terms, isOrSearch: true })
  }

  async channelMembershipsForUser (userId, teamId) {
    return await mm.channelMembersForUser({ ...this._ctx(), userId, teamId })
  }

  async getAllChannels (teams) {
    const all = []
    for (const t of (teams || [])) {
      if (!t || !t.id) continue
      const channels = await this.teamChannels(t.id)
      all.push(...channels)
    }
    return all
  }

  async getMutedChannelIdsForUser (userId, teams) {
    const muted = new Set()
    for (const t of (teams || [])) {
      if (!t || !t.id) continue
      const memberships = await this.channelMembershipsForUser(userId, t.id)
      if (!Array.isArray(memberships)) continue
      for (const m of memberships) {
        if (m?.notify_props?.mark_unread === 'mention' && m.channel_id) muted.add(m.channel_id)
      }
    }
    return muted
  }

  async fixChannelDisplayName (channel, currentUserId) {
    if (!channel) return channel
    if (channel.type === 'D') {
      const parts = String(channel.name || '').split('__')
      if (parts.length === 2) {
        const other = parts[0] === currentUserId ? parts[1] : parts[0]
        const u = await this.userById(other)
        channel.display_name = u?.username || 'Direct Message'
      } else {
        channel.display_name = 'Direct Message'
      }
    } else if (channel.type === 'G' && !channel.display_name) {
      channel.display_name = 'Group Message'
    }
    return channel
  }
}


