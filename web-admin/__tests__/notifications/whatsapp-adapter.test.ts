/** @jest-environment node */
import twilio from 'twilio'
import { deliverWhatsAppOutbox, type OutboxWhatsAppRow } from '@lib/notifications/adapters/whatsapp'
import { notificationSettingsService } from '@lib/notifications/settings-service'
import { resolveWhatsAppCustomerEligibility } from '@lib/notifications/whatsapp-customer-eligibility'
import { createAdminSupabaseClient } from '@lib/supabase/server'
import { __clearEffectiveNotificationRouteCacheForTests } from '@lib/notifications/route-resolver'
import {
  getTwilioWhatsappFrom,
  getTwilioWhatsappSandboxContentSid,
  getTwilioWhatsappSandboxToPhone,
  isNtfDispatchViaHq,
  isTwilioWhatsappSandboxTemplateEnabled,
} from '@lib/notifications/config'

jest.mock('twilio', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/notifications/settings-service', () => ({ notificationSettingsService: { getActiveProvider: jest.fn(), isChannelEnabled: jest.fn() } }))
jest.mock('@lib/notifications/whatsapp-customer-eligibility', () => ({ resolveWhatsAppCustomerEligibility: jest.fn() }))
jest.mock('@lib/notifications/log-missing-env', () => ({ collectMissingEnv: jest.fn(() => []), logMissingNotificationEnv: jest.fn() }))
// SHADOW-ONLY pilot (plan 17.2/22): deliverWhatsAppOutbox now also calls
// ResolveEffectiveNotificationRoute via shadow-route-comparison.ts, which
// reads org_ntf_route_assign_cf through this same admin client. It is
// mocked here (default: no ACTIVE route) so every pre-existing legacy-path
// assertion below runs with the real shadow code in the loop and keeps
// passing unchanged -- proving the shadow addition is a no-op for real sends.
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))
jest.mock('@lib/notifications/config', () => ({
  getTwilioWhatsappFrom: jest.fn(),
  getTwilioWhatsappSandboxContentSid: jest.fn(),
  getTwilioWhatsappSandboxToPhone: jest.fn(),
  isNtfDispatchViaHq: jest.fn(),
  isTwilioWhatsappSandboxTemplateEnabled: jest.fn(),
  getNtfHqDispatchUrl: jest.fn(),
}))

/**
 * Configures the shared admin-client mock used by the shadow route-comparison
 * path. `languages` simulates which languages (if any) currently have an
 * ACTIVE org_ntf_route_assign_cf row for (tenant, order.created, WHATSAPP);
 * `routeRow` simulates that row's content for resolveEffectiveNotificationRoute.
 */
function configureShadowSupabase(options: { languages?: string[]; routeRow?: Record<string, unknown> | null } = {}) {
  const languages = options.languages ?? []
  const routeRow = options.routeRow ?? null
  const from = jest.fn((table: string) => {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      order: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data: routeRow, error: null })),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          resolve(
            table === 'org_ntf_route_assign_cf'
              ? { data: languages.map((languageCode) => ({ language_code: languageCode })), error: null }
              : { data: [], error: null },
          ),
        ),
    }
    return query
  })
  jest.mocked(createAdminSupabaseClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminSupabaseClient>)
  return { from }
}

const createdSid = `HX${'1'.repeat(32)}`
const readySid = `HX${'2'.repeat(32)}`
const sandboxSid = `HX${'3'.repeat(32)}`
const config = {
  content_templates: {
    'order.created': {
      content_sid: createdSid,
      content_variable_map: { order_number: '$order_number', estimated_ready_at: '$estimated_ready_at' },
    },
    'order.ready': { content_sid: readySid, content_variable_map: { order_number: '$order_number' } },
  },
}
const row: OutboxWhatsAppRow = {
  id: 'outbox-1', tenant_org_id: 'tenant-1', recipient_address: '+96891234567',
  rendered_body: 'Legacy body', rendered_subject: null, event_code: 'order.created', retry_count: 0,
  source_entity_type: 'order', source_entity_id: 'order-1',
  metadata: { variables: { order_number: 'ORD-001', estimated_ready_at: '3 October 2026' } },
}

describe('WhatsApp adapter template dispatch', () => {
  const createMessage = jest.fn()
  const savedEnv = { account: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TWILIO_ACCOUNT_SID = 'AC-test'
    process.env.TWILIO_AUTH_TOKEN = 'test-token'
    jest.mocked(twilio).mockReturnValue({ messages: { create: createMessage } } as unknown as ReturnType<typeof twilio>)
    createMessage.mockResolvedValue({ sid: 'SM-test', status: 'queued' })
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config })
    jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(true)
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({
      allowed: true, recipientAddress: '+96891234567', customerId: 'customer-1',
    })
    jest.mocked(getTwilioWhatsappFrom).mockResolvedValue('+96890000000')
    jest.mocked(getTwilioWhatsappSandboxToPhone).mockResolvedValue('+96899999999')
    jest.mocked(getTwilioWhatsappSandboxContentSid).mockResolvedValue(sandboxSid)
    jest.mocked(isTwilioWhatsappSandboxTemplateEnabled).mockResolvedValue(true)
    jest.mocked(isNtfDispatchViaHq).mockResolvedValue(false)
    __clearEffectiveNotificationRouteCacheForTests()
    configureShadowSupabase({ languages: [] })
  })

  afterAll(() => {
    if (savedEnv.account === undefined) delete process.env.TWILIO_ACCOUNT_SID
    else process.env.TWILIO_ACCOUNT_SID = savedEnv.account
    if (savedEnv.token === undefined) delete process.env.TWILIO_AUTH_TOKEN
    else process.env.TWILIO_AUTH_TOKEN = savedEnv.token
  })

  it('sends the exact event ContentSid and variables without Body, ignoring sandbox flags and recipient', async () => {
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
    expect(createMessage).toHaveBeenCalledWith({
      from: 'whatsapp:+96890000000', to: 'whatsapp:+96891234567', contentSid: createdSid,
      contentVariables: JSON.stringify({ order_number: 'ORD-001', estimated_ready_at: '3 October 2026' }),
    })
    expect(getTwilioWhatsappSandboxToPhone).not.toHaveBeenCalled()
    expect(getTwilioWhatsappSandboxContentSid).not.toHaveBeenCalled()
    expect(isTwilioWhatsappSandboxTemplateEnabled).not.toHaveBeenCalled()
    await deliverWhatsAppOutbox({ ...row, event_code: 'order.ready' })
    expect(createMessage).toHaveBeenLastCalledWith({
      from: 'whatsapp:+96890000000', to: 'whatsapp:+96891234567', contentSid: readySid,
      contentVariables: JSON.stringify({ order_number: 'ORD-001' }),
    })
  })

  it('never falls back to free text or a global SID for an unmapped event', async () => {
    expect(await deliverWhatsAppOutbox({ ...row, event_code: 'payment.received' })).toEqual({
      success: false, permanent: true, errorMessage: expect.stringContaining('No Twilio content_templates entry'),
    })
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('fails permanently before sending malformed config or missing template values', async () => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({
      providerCode: 'TWILIO_WHATSAPP', config: { content_templates: null },
    })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, permanent: true, errorMessage: expect.any(String) })
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config })
    expect(await deliverWhatsAppOutbox({ ...row, metadata: { variables: {} } })).toEqual({
      success: false, permanent: true, errorMessage: expect.stringContaining('metadata.variables.order_number'),
    })
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('keeps legacy sandbox behavior for a provider without an event catalog', async () => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: {} })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ to: 'whatsapp:+96899999999', contentSid: sandboxSid }))
  })

  it('honors provider sandbox false over a stale runtime true', async () => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({
      providerCode: 'TWILIO_WHATSAPP', config: { use_sandbox_template: false },
    })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
    expect(createMessage).toHaveBeenCalledWith({ from: 'whatsapp:+96890000000', to: 'whatsapp:+96899999999', body: 'Legacy body' })
    expect(isTwilioWhatsappSandboxTemplateEnabled).not.toHaveBeenCalled()
  })

  it('refuses HQ body-only dispatch when production templates are configured', async () => {
    jest.mocked(isNtfDispatchViaHq).mockResolvedValue(true)
    const fetchSpy = jest.spyOn(global, 'fetch')
    expect(await deliverWhatsAppOutbox(row)).toEqual({
      success: false, permanent: true, errorMessage: expect.stringContaining('disable NTF_DISPATCH_VIA_HQ'),
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(createMessage).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it.each([21656, 92007, 50529, 50541, 63055, 21211, 21614])('marks provider rejection %p permanent', async (code) => {
    createMessage.mockRejectedValue({ code, message: 'Provider rejected request' })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, permanent: true, errorMessage: 'Provider rejected request' })
  })

  it('keeps transient provider errors retryable', async () => {
    createMessage.mockRejectedValue({ code: 20429, message: 'Rate limit' })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, permanent: false, errorMessage: 'Rate limit' })
  })

  it.each(['Customer consent was revoked', 'Customer has no valid WhatsApp phone'])('skips permanently disallowed customer: %s', async (reason) => {
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({ allowed: false, retryable: false, reason })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, skipped: true, permanent: false, errorMessage: reason })
    expect(createMessage).not.toHaveBeenCalled()
    expect(resolveWhatsAppCustomerEligibility).toHaveBeenCalledWith('tenant-1', 'order', 'order-1')
  })

  it('retries temporary eligibility lookup errors without contacting Twilio', async () => {
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({ allowed: false, retryable: true, reason: 'Customer lookup unavailable' })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, skipped: false, permanent: false, errorMessage: 'Customer lookup unavailable' })
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('skips queued live messages when the channel is disabled', async () => {
    jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false)
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: false, skipped: true, errorMessage: expect.stringContaining('channel was disabled') })
    expect(resolveWhatsAppCustomerEligibility).not.toHaveBeenCalled()
    expect(createMessage).not.toHaveBeenCalled()
  })

  it.each(['+96891111111', null])('skips mismatched or missing queued recipient %p', async (recipient_address) => {
    expect(await deliverWhatsAppOutbox({ ...row, recipient_address })).toEqual({
      success: false, skipped: true, errorMessage: expect.stringContaining('queued recipient no longer matches'),
    })
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('authorizes a fresh recipient only when the queued lookup was explicitly pending', async () => {
    expect(await deliverWhatsAppOutbox({
      ...row, recipient_address: null,
      metadata: { ...row.metadata, whatsapp_eligibility_pending: true },
    })).toEqual({ success: true, providerMessageId: 'SM-test' })
    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ to: 'whatsapp:+96891234567', contentSid: createdSid }))
  })

  it('cannot use a pending marker to replace an existing mismatched recipient', async () => {
    expect(await deliverWhatsAppOutbox({
      ...row, recipient_address: '+96891111111', metadata: { ...row.metadata, whatsapp_eligibility_pending: true },
    })).toEqual({ success: false, skipped: true, errorMessage: expect.stringContaining('queued recipient no longer matches') })
    expect(createMessage).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { providerCode: 'TWILIO_WHATSAPP', config: {} },
    { providerCode: 'META_WHATSAPP', config: {} },
  ])('skips queued live messages after provider changes to %p', async (provider) => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(provider)
    expect(await deliverWhatsAppOutbox({ ...row, metadata: { ...row.metadata, whatsapp_production_template: true } })).toEqual({
      success: false, skipped: true, errorMessage: expect.stringContaining('provider changed or was disabled'),
    })
    expect(createMessage).not.toHaveBeenCalled()
    expect(resolveWhatsAppCustomerEligibility).not.toHaveBeenCalled()
  })

  it('preserves legacy providers without imposing the production customer gate', async () => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: {} })
    expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
    expect(notificationSettingsService.isChannelEnabled).not.toHaveBeenCalled()
    expect(resolveWhatsAppCustomerEligibility).not.toHaveBeenCalled()
  })

  describe('shadow-only route-resolver pilot (never a live cutover)', () => {
    const expectedSend = {
      from: 'whatsapp:+96890000000', to: 'whatsapp:+96891234567', contentSid: createdSid,
      contentVariables: JSON.stringify({ order_number: 'ORD-001', estimated_ready_at: '3 October 2026' }),
    }

    it('is a no-op for the legacy send when no ACTIVE route is configured', async () => {
      configureShadowSupabase({ languages: [] })
      expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
      expect(createMessage).toHaveBeenCalledTimes(1)
      expect(createMessage).toHaveBeenCalledWith(expectedSend)
    })

    it('leaves the legacy send byte-for-byte unchanged when an ACTIVE route exists for this tenant/event/channel', async () => {
      configureShadowSupabase({
        languages: ['en'],
        routeRow: {
          id: 'route-x', route_owner: 'PLATFORM', assignment_version: 1, language_code: 'en', fallback_language: null,
          platform_account_id: 'acct-x', platform_sender_id: null, provider_revision_id: 'rev-x',
          private_account_id: null, private_sender_id: null, private_revision_id: null,
        },
      })
      expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
      // Exactly the one legacy provider call -- the resolved route is never dispatched through.
      expect(createMessage).toHaveBeenCalledTimes(1)
      expect(createMessage).toHaveBeenCalledWith(expectedSend)
    })

    it('never fails or alters the legacy send when the shadow lookup itself throws', async () => {
      jest.mocked(createAdminSupabaseClient).mockImplementation(() => {
        throw new Error('shadow lookup unavailable')
      })
      expect(await deliverWhatsAppOutbox(row)).toEqual({ success: true, providerMessageId: 'SM-test' })
      expect(createMessage).toHaveBeenCalledTimes(1)
      expect(createMessage).toHaveBeenCalledWith(expectedSend)
    })

    it('never runs the shadow comparison for an event outside this pilot scope', async () => {
      const { from } = configureShadowSupabase({ languages: ['en'] })
      await deliverWhatsAppOutbox({ ...row, event_code: 'order.ready' })
      expect(from).not.toHaveBeenCalled()
    })
  })
})
