import { execFileSync } from 'node:child_process'
import path from 'node:path'

describe('S0 privilege lockdown source', () => {
  it('keeps the drafted migrations aligned with the authenticated allowlist', () => {
    const script = path.resolve(__dirname, '../../../scripts/db/check-s0-privilege-sources.mjs')
    const output = execFileSync(process.execPath, [script], { encoding: 'utf8' })
    expect(output).toContain('s0 source check passed')
  })
})
