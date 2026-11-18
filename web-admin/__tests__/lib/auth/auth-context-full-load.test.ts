/**
 * UI Design System PR-07 review C1: the root layout holds the per-user theme and the
 * Organization brand, and a client-side router.push never re-renders it. Every
 * sign-in, Organization choice and sign-out must load the next page in full, so the
 * next person never sees the previous person's density, text size, colours or logo.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const source = readFileSync(join(__dirname, '../../../lib/auth/auth-context.tsx'), 'utf8')

describe('auth context navigation after an identity change', () => {
  it('never moves with router.push', () => {
    expect(source).not.toMatch(/router\.push\(/)
  })

  it('loads the page in full after sign-in, choose-tenant, sign-out and session expiry', () => {
    expect(source.match(/window\.location\.assign\(/g)?.length).toBe(4)
  })
})
