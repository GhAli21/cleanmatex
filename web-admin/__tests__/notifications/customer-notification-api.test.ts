import { fetchCustomerNotificationConsent, saveCustomerWhatsAppConsent } from '@features/customers/api/customer-notification-api'

jest.mock('@lib/utils/csrf-token', () => ({ getCSRFToken: jest.fn().mockResolvedValue('csrf-test') }))

const customer = { id: 'customer-a', tenantData: { tenantOrgId: 'organization-a' }, preferences: { notifications: { whatsapp: true, sms: true } }, phone: '+96890123456', updatedAt: '2026-10-02' }
const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) })

describe('customer WhatsApp consent API', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('requires exact boolean consent rather than a truthy string', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ ...customer, preferences: { notifications: { whatsapp: 'true' } } }))
    expect((await fetchCustomerNotificationConsent('organization-a', 'customer-a')).optedIn).toBe(false)
  })

  it('rejects another organization and never submits the stale draft', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ ...customer, tenantData: { tenantOrgId: 'organization-b' } }))
    global.fetch = fetchMock
    await expect(saveCustomerWhatsAppConsent('organization-a', 'customer-a', true)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('writes only the consent flag, preserves the expected organization, and verifies the saved result', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(ok(customer)).mockResolvedValueOnce(ok({})).mockResolvedValueOnce(ok({ ...customer, preferences: { notifications: { whatsapp: false, sms: true } } }))
    global.fetch = fetchMock
    const result = await saveCustomerWhatsAppConsent('organization-a', 'customer-a', false)
    const write = fetchMock.mock.calls[1][1]
    expect(write.headers).toMatchObject({ 'X-Tenant-Id': 'organization-a', 'X-CSRF-Token': 'csrf-test' })
    expect(JSON.parse(write.body)).toEqual({ preferences: { notifications: { whatsapp: false } } })
    expect(result.optedIn).toBe(false)
    expect(fetchMock.mock.calls[2][1].headers['X-Tenant-Id']).toBe('organization-a')
  })
})
