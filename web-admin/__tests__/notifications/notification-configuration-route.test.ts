/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST, PUT } from '@/app/api/v1/notifications/settings/providers/route'
import { GET as getCustomer, PATCH as patchCustomer } from '@/app/api/v1/customers/[id]/route'

const mockAuth = jest.fn()
const mockClient = jest.fn()
const mockFindCustomer = jest.fn()
const mockUpdateCustomer = jest.fn()
const mockCsrf = jest.fn()
const mockRateLimit = jest.fn()

jest.mock('server-only', () => ({}))
jest.mock('@/lib/middleware/require-permission', () => ({ requirePermission: (permission: string) => (request: unknown) => mockAuth(permission, request) }))
jest.mock('@/lib/supabase/server', () => ({ createAdminSupabaseClient: () => mockClient() }))
jest.mock('@/lib/notifications/settings-service', () => ({ notificationSettingsService: { invalidateChannel: jest.fn() } }))
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/lib/services/customers.service', () => ({
  findCustomerById: (...args: unknown[]) => mockFindCustomer(...args),
  updateCustomer: (...args: unknown[]) => mockUpdateCustomer(...args),
  deactivateCustomer: jest.fn(),
}))
jest.mock('@/lib/services/customer-addresses.service', () => ({ getCustomerAddresses: jest.fn() }))
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: (...args: unknown[]) => mockCsrf(...args) }))
jest.mock('@/lib/middleware/rate-limit', () => ({ checkAPIRateLimitTenant: (...args: unknown[]) => mockRateLimit(...args) }))

/** Real requests verify a stale UI cannot cross the middleware-owned tenant boundary. */
function request(method: string, body?: unknown, expectedTenant = 'tenant-a') {
  return new NextRequest('http://localhost/api/v1/notifications/settings/providers', {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': expectedTenant },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('notification configuration tenant and validation boundaries', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockAuth.mockResolvedValue({ tenantId: 'tenant-a', userId: 'staff-a' })
    mockCsrf.mockResolvedValue(null)
    mockRateLimit.mockResolvedValue(null)
  })

  it.each([['GET', GET], ['POST', POST], ['PUT', PUT]] as const)('rejects stale provider %s before database access', async (method, handler) => {
    expect((await handler(request(method, method === 'GET' ? undefined : {}, 'tenant-b'))).status).toBe(409)
    expect(mockClient).not.toHaveBeenCalled()
  })

  it.each([['POST', POST], ['PUT', PUT]] as const)('rejects invalid %s templates before changing the active provider', async (method, handler) => {
    const response = await handler(request(method, {
      channel_code: 'WHATSAPP', provider_code: 'TWILIO_WHATSAPP',
      config: { content_templates: { 'order.created': { content_sid: 'bad', content_variable_map: {} } } },
    }))
    expect(response.status).toBe(400)
    expect(mockClient).not.toHaveBeenCalled()
  })

  it('preserves the existing provider permission denial', async () => {
    mockAuth.mockResolvedValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    expect((await PUT(request('PUT', {}))).status).toBe(403)
    expect(mockAuth).toHaveBeenCalledWith('notifications:configure', expect.any(NextRequest))
    expect(mockClient).not.toHaveBeenCalled()
  })

  it.each([['POST', POST], ['PUT', PUT]] as const)('protects live provider %s routing changes from CSRF', async (method, handler) => {
    mockCsrf.mockResolvedValueOnce(NextResponse.json({ error: 'csrf' }, { status: 403 }))
    expect((await handler(request(method, {}))).status).toBe(403)
    expect(mockAuth).not.toHaveBeenCalled()
    expect(mockClient).not.toHaveBeenCalled()
  })

  it('rejects stale customer reads before exposing consent', async () => {
    const response = await getCustomer(request('GET', undefined, 'tenant-b'), { params: Promise.resolve({ id: 'customer-a' }) })
    expect(response.status).toBe(409)
    expect(mockFindCustomer).not.toHaveBeenCalled()
  })

  it('rejects stale consent writes before invoking the service', async () => {
    const response = await patchCustomer(request('PATCH', { preferences: { notifications: { whatsapp: true } } }, 'tenant-b'), { params: Promise.resolve({ id: 'customer-a' }) })
    expect(response.status).toBe(409)
    expect(mockUpdateCustomer).not.toHaveBeenCalled()
  })

  it('retains CSRF enforcement for customer consent', async () => {
    mockCsrf.mockResolvedValueOnce(NextResponse.json({ error: 'csrf' }, { status: 403 }))
    expect((await patchCustomer(request('PATCH', {}), { params: Promise.resolve({ id: 'customer-a' }) })).status).toBe(403)
    expect(mockAuth).not.toHaveBeenCalled()
    expect(mockUpdateCustomer).not.toHaveBeenCalled()
  })
})
