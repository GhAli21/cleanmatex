import { describe, it, expect, beforeEach, jest } from '@jest/globals'

/**
 * Setup Health routes:
 *  - list: setup_health:view gate (401/403 pass through), query validation, tenant from the session only
 *  - summary: sign-in only (401 passes through), tenant from the session only
 */

const requirePermissionMock = jest.fn()
const validateJWTMock = jest.fn()
const listMock = jest.fn()
const domainsMock = jest.fn()
const summaryMock = jest.fn()

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
jest.mock('@/lib/services/setup-health/setup-health.service', () => ({
  listSetupHealth: (...args: unknown[]) => listMock(...args),
  listSetupHealthDomains: (...args: unknown[]) => domainsMock(...args),
  getSetupHealthSummary: (...args: unknown[]) => summaryMock(...args),
}))
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))

const { GET: list } = require('@/app/api/v1/setup-health/route') as { GET: (req: unknown) => Promise<MockNextResponse> }
const { GET: summary } = require('@/app/api/v1/setup-health/summary/route') as { GET: (req: unknown) => Promise<MockNextResponse> }

const TENANT = 'tenant-session'
const request = (query: Record<string, string> = {}) => ({
  nextUrl: { searchParams: new URLSearchParams(query) },
  headers: { get: () => null },
})
const gate = (result: unknown) => requirePermissionMock.mockReturnValue(async () => result)

describe('GET /api/v1/setup-health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    listMock.mockResolvedValue([] as never)
    domainsMock.mockResolvedValue([] as never)
  })

  it('requires setup_health:view', async () => {
    gate({ tenantId: TENANT })
    await list(request())
    expect(requirePermissionMock).toHaveBeenCalledWith('setup_health:view')
  })

  it.each([401, 403])('returns the gate response (%i) without running checks', async (status) => {
    gate(MockNextResponse.json({ error: 'x' }, { status }))
    const res = await list(request())
    expect(res.status).toBe(status)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('rejects a bad branchId / domain with 400', async () => {
    gate({ tenantId: TENANT })
    expect((await list(request({ branchId: 'nope' }))).status).toBe(400)
    expect((await list(request({ domain: 'drop table' }))).status).toBe(400)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('uses the session tenant and passes filters', async () => {
    gate({ tenantId: TENANT })
    const branchId = '3f1b5c2e-8a4d-4c6e-9f10-2b7d5e8a1c33'
    const res = await list(request({ domain: 'CALENDAR', branchId }))
    expect(res.status).toBe(200)
    expect(listMock).toHaveBeenCalledWith(TENANT, { domain: 'CALENDAR', branchId })
  })
})

describe('GET /api/v1/setup-health/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    summaryMock.mockResolvedValue({} as never)
  })

  it('returns 401 from the session check without running checks', async () => {
    validateJWTMock.mockResolvedValue(MockNextResponse.json({ error: 'x' }, { status: 401 }) as never)
    const res = await summary(request())
    expect(res.status).toBe(401)
    expect(summaryMock).not.toHaveBeenCalled()
  })

  it('needs no permission and uses the session tenant', async () => {
    validateJWTMock.mockResolvedValue({ tenantId: TENANT } as never)
    const res = await summary(request())
    expect(res.status).toBe(200)
    expect(requirePermissionMock).not.toHaveBeenCalled()
    expect(summaryMock).toHaveBeenCalledWith(TENANT)
  })
})
