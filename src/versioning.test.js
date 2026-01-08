import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('versioning', () => {
  it('package.json version matches latest CHANGELOG entry', () => {
    const repoRoot = process.cwd()
    const pkgPath = path.resolve(repoRoot, 'package.json')
    const changelogPath = path.resolve(repoRoot, 'CHANGELOG.md')

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const changelog = readFileSync(changelogPath, 'utf8')

    const m = changelog.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m)
    expect(m && m[1]).toBeTruthy()

    const latestChangelogVersion = m[1]
    expect(pkg.version).toBe(latestChangelogVersion)
  })
})

