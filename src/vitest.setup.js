// Keep unit tests deterministic: localforage depends on browser storage drivers that
// aren't reliably available in jsdom. Mock it with a simple in-memory store.
vi.mock('localforage', () => {
  const store = new Map()
  const api = {
    config: vi.fn(),
    getItem: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn(async (key, value) => {
      store.set(key, value)
      return value
    }),
    removeItem: vi.fn(async (key) => {
      store.delete(key)
      return null
    }),
    clear: vi.fn(async () => {
      store.clear()
      return null
    })
  }
  return { default: api }
})

