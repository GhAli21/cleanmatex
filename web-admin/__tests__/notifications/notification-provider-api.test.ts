import { saveWhatsAppTemplate } from '@features/notifications/api/notification-provider-api'

jest.mock('@lib/utils/csrf-token', () => ({ getCSRFToken: jest.fn().mockResolvedValue('csrf-test') }))

const values = { event: 'order.created', contentSid: 'HX0123456789abcdef0123456789abcdef', mappings: [] }

describe('notification provider tenant guard', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('stops without writing when expected organization differs from the session', async () => {
    const request = jest.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ success: false }) })
    global.fetch = request
    await expect(saveWhatsAppTemplate('organization-a', values)).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][1].headers['X-Tenant-Id']).toBe('organization-a')
  })

  it('re-reads provider config and submits the expected organization on the write', async () => {
    const request = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ provider_code: 'TWILIO_WHATSAPP', config: { sender: '+96812345678', content_templates: { 'order.ready': { content_sid: values.contentSid, content_variable_map: {} } } } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    global.fetch = request
    await saveWhatsAppTemplate('organization-a', values)
    const options = request.mock.calls[1][1]
    expect(options.headers['X-Tenant-Id']).toBe('organization-a')
    expect(options.headers['X-CSRF-Token']).toBe('csrf-test')
    expect(JSON.parse(options.body).config).toEqual({ sender: '+96812345678', content_templates: { 'order.ready': { content_sid: values.contentSid, content_variable_map: {} }, 'order.created': { content_sid: values.contentSid, content_variable_map: {} } } })
  })
})
