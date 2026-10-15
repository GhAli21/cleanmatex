/** @jest-environment node */
/**
 * Shared render contract (R12): the exact same cases run against the HQ preview renderer
 * (platform-api templates/preview/__tests__/template-render.spec.ts), so a preview shows what a tenant send renders.
 */
import contract from './fixtures/render-contract.json'
import { interpolate } from '@lib/notifications/template-renderer'

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))

describe('interpolate: shared render contract', () => {
  it.each(contract.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(interpolate(c.template, c.vars)).toBe(c.expected)
  })
})
