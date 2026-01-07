const TOKEN_PREFIX = 'glv-xor1:'
const TOKEN_KEY = 'gitlab-viz-token-xor-v1'

const toBytes = (s) => new TextEncoder().encode(String(s || ''))
const fromBytes = (b) => new TextDecoder().decode(b)

const bytesToBase64 = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const base64ToBytes = (b64) => {
  const bin = atob(String(b64 || ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
  return bytes
}

const xorBytes = (bytes, keyBytes) => {
  if (!keyBytes || !keyBytes.length) return bytes
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length]
  return out
}

export const encodeGitLabTokenForStorage = (token) => {
  const rawIn = String(token || '')
  if (!rawIn) return ''

  // Accept either a plain token or already-obfuscated token; always write v1.
  const plain = decodeGitLabTokenFromStorage(rawIn)
  const x = xorBytes(toBytes(plain), toBytes(TOKEN_KEY))
  return `${TOKEN_PREFIX}${bytesToBase64(x)}`
}

export const decodeGitLabTokenFromStorage = (maybeEncoded) => {
  const raw = String(maybeEncoded || '')
  if (!raw.startsWith(TOKEN_PREFIX)) return raw
  try {
    const b64 = raw.slice(TOKEN_PREFIX.length)
    const x = base64ToBytes(b64)
    const plainBytes = xorBytes(x, toBytes(TOKEN_KEY))
    return fromBytes(plainBytes)
  } catch {
    // Backward/forward compatible: if decode fails, keep as-is.
    return raw
  }
}


