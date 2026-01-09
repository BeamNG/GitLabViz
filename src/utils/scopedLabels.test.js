import { getScopedLabelValue, getScopedLabelValues } from './scopedLabels'

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

  it('extracts all scoped label values (in order, de-duped)', () => {
    const labels = [
      'Status::Todo',
      'Status::In Progress',
      'Status::Todo',
      'Status:Blocked',
      'Other::X'
    ]
    expect(getScopedLabelValues(labels, 'Status')).toEqual(['Todo', 'In Progress', 'Blocked'])
  })

  it('returns null for missing/invalid inputs', () => {
    expect(getScopedLabelValue(null, 'Component')).toBe(null)
    expect(getScopedLabelValue([], 'Component')).toBe(null)
    expect(getScopedLabelValue(['Component:foo'], '')).toBe(null)
  })

})

