import { describe, it, expect, beforeEach, jest } from '@jest/globals'

/**
 * Route-level guarantees of the session/password endpoints:
 *  - revoke: permission gate, strict body, tenant + actor always taken from the session (never from the body)
 *  - password reset: refuses without the recovery cookie (a normal session cannot skip the current-password check)
 */

const requirePermissionMock = jest.fn()
const revokeTenantSessionsMock = jest.fn()
const validateJWTMock = jest.fn()

class MockNextResponse {
  status: number
  private payload: unknown
  constructor(payload: unknown, init?: { status?: number }) {
    this.payload = payload
    this.status = init?.status ?? 200
  }
  static json(payload: unknown, init?: { status?: number }) {
    return new MockNextResponse(payload, init)
  }
  async json() {
    return this.payload
  }
}

jest.mock('next/server', () => ({ NextRequest: class {}, NextResponse: MockNextResponse }))
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}))
jest.mock('@/lib/middleware/jwt-tenant-validator', () => ({
  validateJWTWithTenant: (...args: unknown[]) => validateJWTMock(...args),
}))
jest.mock('@/lib/auth/current-session', () => ({ getCurrentAuthSessionId: async () => 'current-auth-session' }))
jest.mock('@/lib/supabase/server', () => ({ createAdminSupabaseClient: () => ({}), createClient: async () => ({}) }))
jest.mock('@/lib/services/auth/session/use-cases/session-management', () => ({
  revokeTenantSessions: (...args: unknown[]) => revokeTenantSessionsMock(...args),
}))
// password-deps pulls in the Notification Hub (and with it the Supabase browser client).
jest.mock('@lib/notifications/event-emitter', () => ({ emitNotificationEvent: jest.fn() }))
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))

const { POST: revoke } = require('@/app/api/users/sessions/revoke/route') as {
  POST: (req: unknown) => Promise<MockNextResponse>
}
const { POST: reset } = require('@/app/api/auth/password/reset/route') as {
  POST: (req: unknown) => Promise<MockNextResponse>
}

const UUID = '3f1b5c2e-8a4d-4c6e-9f10-2b7d5e8a1c33'
const request = (body: unknown, cookies: Record<string, string> = {}) => ({
  json: async () => body,
  headers: { get: () => null },
  cookies: { get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined) },
})

describe('POST /api/users/sessions/revoke', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requirePermissionMock.mockReturnValue(async () => ({ tenantId: 'tenant-A', userId: 'admin-1' }))
    revokeTenantSessionsMock.mockResolvedValue({ revoked: 1, notFound: 0, skippedCurrent: false })
  })

  it('is gated by user_sessions:revoke and returns the guard response untouched when denied', async () => {
    const denied = MockNextResponse.json({ error: 'Forbidden' }, { status: 403 })
    requirePermissionMock.mockReturnValue(async () => denied)
    const res = await revoke(request({ all: true }))
    expect(requirePermissionMock).toHaveBeenCalledWith('user_sessions:revoke')
    expect(res.status).toBe(403)
    expect(revokeTenantSessionsMock).not.toHaveBeenCalled()
  })

  it('takes tenant and actor from the session, never from the body', async () => {
    const res = await revoke(request({ sessionIds: [UUID] }))
    expect(res.status).toBe(200)
    expect(revokeTenantSessionsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-A', actorId: 'admin-1', currentAuthSessionId: 'current-auth-session', sessionIds: [UUID] })
    )
  })

  it('supports the emergency all:true form', async () => {
    await revoke(request({ all: true }))
    expect(revokeTenantSessionsMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ all: true, tenantId: 'tenant-A' }))
  })

  it.each([
    ['empty id list', { sessionIds: [] }],
    ['non-uuid id', { sessionIds: ['not-a-uuid'] }],
    ['all:false', { all: false }],
    ['extra tenant field (strict)', { sessionIds: [UUID], tenantId: 'tenant-B' }],
    ['both forms', { sessionIds: [UUID], all: true }],
    ['too many ids', { sessionIds: Array.from({ length: 101 }, () => UUID) }],
  ])('rejects %s', async (_name, body) => {
    const res = await revoke(request(body))
    expect(res.status).toBe(400)
    expect(revokeTenantSessionsMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/password/reset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    validateJWTMock.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-A', user: { email: 'a@b.c' } })
  })

  it('refuses without the recovery cookie, before touching the session', async () => {
    const res = await reset(request({ newPassword: 'Str0ngPassw' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'RECOVERY_REQUIRED' })
    expect(validateJWTMock).not.toHaveBeenCalled()
  })

  it('refuses a recovery cookie with a wrong value', async () => {
    const res = await reset(request({ newPassword: 'Str0ngPassw' }, { 'cmx-recovery': '0' }))
    expect(res.status).toBe(403)
  })
})
