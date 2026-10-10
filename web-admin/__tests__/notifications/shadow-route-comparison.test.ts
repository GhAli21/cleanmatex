/** @jest-environment node */
import { runShadowOrderCreatedWhatsAppComparison } from '@lib/notifications/shadow-route-comparison'
import { __clearEffectiveNotificationRouteCacheForTests } from '@lib/notifications/route-resolver'
import { createAdminSupabaseClient } from '@lib/supabase/server'
import { logger } from '@lib/utils/logger'

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const createdSid = `HX${'1'.repeat(32)}`
const config = {
  content_templates: {
    'order.created': {
      content_sid: createdSid,
      content_variable_map: { order_number: '$order_number' },
    },
  },
}

const baseRow = {
  id: 'outbox-1',
  tenant_org_id: 'tenant-1',
  event_code: 'order.created',
  metadata: { variables: { order_number: 'ORD-001' } },
}

function configureSupabase(options: { languages?: string[]; routeRow?: Record<string, unknown> | null } = {}) {
  const languages = options.languages ?? []
  const routeRow = options.routeRow ?? null
  const calls: string[] = []
  const from = jest.fn((table: string) => {
    calls.push(table)
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
  return { from, calls }
}

describe('runShadowOrderCreatedWhatsAppComparison', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    __clearEffectiveNotificationRouteCacheForTests()
  })

  it('is scoped to order.created only -- any other event code never queries the database', async () => {
    const { from } = configureSupabase({ languages: ['en'] })
    await runShadowOrderCreatedWhatsAppComparison(
      { ...baseRow, event_code: 'order.ready' },
      { providerCode: 'TWILIO_WHATSAPP', config },
    )
    expect(from).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('logs a no-route comparison and never calls the resolver when no ACTIVE route is configured', async () => {
    configureSupabase({ languages: [] })
    await runShadowOrderCreatedWhatsAppComparison(baseRow, { providerCode: 'TWILIO_WHATSAPP', config })
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('no ACTIVE route configured'),
      expect.objectContaining({ shadow: true, tenantOrgId: 'tenant-1', outboxId: 'outbox-1' }),
    )
  })

  it('resolves and logs the effective route alongside the legacy summary, per configured language, without sending anything', async () => {
    configureSupabase({
      languages: ['en'],
      routeRow: {
        id: 'route-x', route_owner: 'PLATFORM', assignment_version: 1, language_code: 'en', fallback_language: null,
        platform_account_id: 'acct-x', platform_sender_id: 'sender-x', provider_revision_id: 'rev-x',
        private_account_id: null, private_sender_id: null, private_revision_id: null,
      },
    })
    await runShadowOrderCreatedWhatsAppComparison(baseRow, { providerCode: 'TWILIO_WHATSAPP', config })

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('comparison (shadow only'),
      expect.objectContaining({
        shadow: true, tenantOrgId: 'tenant-1', outboxId: 'outbox-1', languageCode: 'en',
        legacy: { providerCode: 'TWILIO_WHATSAPP', usesProductionTemplate: true, contentSid: createdSid },
        effectiveRoute: expect.objectContaining({ matched: true, routeId: 'route-x', accountId: 'acct-x', revisionId: 'rev-x' }),
      }),
    )
  })

  it('records a non-production-template legacy summary accurately', async () => {
    configureSupabase({ languages: [] })
    await runShadowOrderCreatedWhatsAppComparison(baseRow, { providerCode: 'TWILIO_WHATSAPP', config: {} })
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ legacy: { providerCode: 'TWILIO_WHATSAPP', usesProductionTemplate: false, contentSid: null } }),
    )
  })

  it('records a null legacy summary when there is no active provider at all', async () => {
    configureSupabase({ languages: [] })
    await runShadowOrderCreatedWhatsAppComparison(baseRow, null)
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ legacy: { providerCode: null, usesProductionTemplate: false, contentSid: null } }),
    )
  })

  it('never throws when the underlying lookup fails -- it degrades to the no-route comparison', async () => {
    jest.mocked(createAdminSupabaseClient).mockImplementation(() => { throw new Error('boom') })
    await expect(runShadowOrderCreatedWhatsAppComparison(baseRow, { providerCode: 'TWILIO_WHATSAPP', config })).resolves.toBeUndefined()
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('no ACTIVE route configured'), expect.any(Object))
  })
})
