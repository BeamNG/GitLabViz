import { getScopedLabelValue } from './scopedLabels'

describe('scopedLabels', () => {
  it('extracts scoped label value for both "::" and ":" (prefers last match)', () => {
    const labels = [
      'Component:build&tools',
      'Priority::High',
      'Component:world-editor-tools',
      'Component::engine'
    ]

    expect(getScopedLabelValue(labels, 'Component')).toBe('engine')
    expect(getScopedLabelValue(labels, 'Priority')).toBe('High')
  })

  it('returns null for missing/invalid inputs', () => {
    expect(getScopedLabelValue(null, 'Component')).toBe(null)
    expect(getScopedLabelValue([], 'Component')).toBe(null)
    expect(getScopedLabelValue(['Component:foo'], '')).toBe(null)
  })
})

