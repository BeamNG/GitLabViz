import localforage from 'localforage'

describe('localforageConfig', () => {
  it('configures localforage db name', async () => {
    // import runs module side effects
    await import('./localforageConfig')
    expect(localforage.config).toHaveBeenCalled()
    expect(localforage.config).toHaveBeenCalledWith({ name: 'gitlab-viz' })
  })
})

