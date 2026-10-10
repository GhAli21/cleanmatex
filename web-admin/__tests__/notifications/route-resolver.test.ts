/** @jest-environment node */
import {
  resolveEffectiveNotificationRoute,
  invalidateEffectiveNotificationRouteCache,
  __clearEffectiveNotificationRouteCacheForTests,
} from '@lib/notifications/route-resolver'
import { createAdminSupabaseClient } from '@lib/supabase/server'

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

describe('resolveEffectiveNotificationRoute', () => {
  let filters: unknown[][]

  function configure(options: {
    routeResponse?: { data: unknown; error: unknown }
    bindingResponse?: { data: unknown; error: unknown }
  } = {}) {
    filters = []
    const routeResponse = options.routeResponse ?? { data: null, error: null }
    const bindingResponse = options.bindingResponse ?? { data: [], error: null }

    const from = jest.fn((table: string) => {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); return query }),
        order: jest.fn(() => query),
        maybeSingle: jest.fn(async () => routeResponse),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(bindingResponse)),
      }
      return query
    })
    jest.mocked(createAdminSupabaseClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminSupabaseClient>)
    return { from }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    __clearEffectiveNotificationRouteCacheForTests()
  })

  it('returns a matched PLATFORM route with its ordered binding structure, explicitly tenant-scoped', async () => {
    configure({
      routeResponse: {
        data: {
          id: 'route-1', route_owner: 'PLATFORM', assignment_version: 2, language_code: 'en', fallback_language: null,
          platform_account_id: 'acct-1', platform_sender_id: 'sender-1', provider_revision_id: 'rev-1',
          private_account_id: null, private_sender_id: null, private_revision_id: null,
        },
        error: null,
      },
      bindingResponse: {
        data: [
          { component_position: 1, parameter_position: 1, external_slot: '1', variable_id: 'var-1' },
          { component_position: 1, parameter_position: 2, external_slot: '2', variable_id: null },
        ],
        error: null,
      },
    })

    const result = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', 'en')
    expect(result).toMatchObject({
      matched: true, routeId: 'route-1', routeOwner: 'PLATFORM', assignmentVersion: 2, languageCode: 'en',
      accountId: 'acct-1', senderId: 'sender-1', revisionId: 'rev-1', bindingCount: 2,
    })
    if (result.matched) {
      expect(result.bindings).toEqual([
        { componentPosition: 1, parameterPosition: 1, externalSlot: '1', source: 'VARIABLE' },
        { componentPosition: 1, parameterPosition: 2, externalSlot: '2', source: 'STATIC' },
      ])
    }

    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'tenant_org_id', 'tenant-a'])
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'event_code', 'order.created'])
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'channel_code', 'WHATSAPP'])
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'language_code', 'en'])
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'route_state', 'ACTIVE'])
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'is_active', true])
    expect(filters.some((f) => f[0] === 'sys_ntf_prov_tmpl_bind_dtl' && f[1] === 'revision_id' && f[2] === 'rev-1')).toBe(true)
  })

  it('returns a matched PRIVATE route and reads tenant-scoped private bindings, never the platform catalog', async () => {
    configure({
      routeResponse: {
        data: {
          id: 'route-2', route_owner: 'PRIVATE', assignment_version: 1, language_code: 'ar', fallback_language: 'en',
          platform_account_id: null, platform_sender_id: null, provider_revision_id: null,
          private_account_id: 'pacct-1', private_sender_id: null, private_revision_id: 'prev-1',
        },
        error: null,
      },
      bindingResponse: { data: [], error: null },
    })

    const result = await resolveEffectiveNotificationRoute('tenant-b', 'order.created', 'WHATSAPP', 'ar')
    expect(result).toMatchObject({
      matched: true, routeOwner: 'PRIVATE', accountId: 'pacct-1', senderId: null, revisionId: 'prev-1',
      fallbackLanguage: 'en', bindingCount: 0,
    })
    expect(filters.some((f) => f[0] === 'org_ntf_ptbind_dtl' && f[1] === 'tenant_org_id' && f[2] === 'tenant-b')).toBe(true)
    expect(filters.some((f) => f[0] === 'org_ntf_ptbind_dtl' && f[1] === 'revision_id' && f[2] === 'prev-1')).toBe(true)
    expect(filters.some((f) => f[0] === 'sys_ntf_prov_tmpl_bind_dtl')).toBe(false)
  })

  it('returns an explicit NO_ACTIVE_ROUTE result -- never an error -- when nothing matches', async () => {
    configure({ routeResponse: { data: null, error: null } })
    const result = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', 'en')
    expect(result).toEqual({ matched: false, reason: 'NO_ACTIVE_ROUTE', resolvedAt: expect.any(String) })
  })

  it('distinguishes a lookup error from an absent route', async () => {
    configure({ routeResponse: { data: null, error: { message: 'db unavailable' } } })
    const result = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', 'en')
    expect(result).toEqual({ matched: false, reason: 'LOOKUP_ERROR', resolvedAt: expect.any(String) })
  })

  it('swallows an unexpected exception as a distinguishable LOOKUP_ERROR, never NO_ACTIVE_ROUTE', async () => {
    jest.mocked(createAdminSupabaseClient).mockImplementation(() => { throw new Error('boom') })
    const result = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', 'en')
    expect(result).toEqual({ matched: false, reason: 'LOOKUP_ERROR', resolvedAt: expect.any(String) })
  })

  it('always scopes the lookup by the requested tenant_org_id so another tenant route can never leak', async () => {
    const { from } = configure({ routeResponse: { data: null, error: null } })
    await resolveEffectiveNotificationRoute('tenant-b', 'order.created', 'WHATSAPP', 'en')
    expect(filters).toContainEqual(['org_ntf_route_assign_cf', 'tenant_org_id', 'tenant-b'])
    expect(filters.filter((f) => f[0] === 'org_ntf_route_assign_cf' && f[1] === 'tenant_org_id')).toEqual([
      ['org_ntf_route_assign_cf', 'tenant_org_id', 'tenant-b'],
    ])
    expect(from).toHaveBeenCalledWith('org_ntf_route_assign_cf')
  })

  it('caches a result for repeat lookups within the freshness window, and invalidation forces a fresh read', async () => {
    const { from } = configure({ routeResponse: { data: null, error: null } })
    await resolveEffectiveNotificationRoute('tenant-c', 'order.created', 'WHATSAPP', 'en')
    await resolveEffectiveNotificationRoute('tenant-c', 'order.created', 'WHATSAPP', 'en')
    expect(from).toHaveBeenCalledTimes(1)

    invalidateEffectiveNotificationRouteCache('tenant-c', 'order.created', 'WHATSAPP', 'en')
    await resolveEffectiveNotificationRoute('tenant-c', 'order.created', 'WHATSAPP', 'en')
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('does not cache across different tenants, events, channels or languages', async () => {
    const { from } = configure({ routeResponse: { data: null, error: null } })
    await resolveEffectiveNotificationRoute('tenant-d', 'order.created', 'WHATSAPP', 'en')
    await resolveEffectiveNotificationRoute('tenant-e', 'order.created', 'WHATSAPP', 'en')
    await resolveEffectiveNotificationRoute('tenant-d', 'order.ready', 'WHATSAPP', 'en')
    await resolveEffectiveNotificationRoute('tenant-d', 'order.created', 'SMS', 'en')
    await resolveEffectiveNotificationRoute('tenant-d', 'order.created', 'WHATSAPP', 'ar')
    expect(from).toHaveBeenCalledTimes(5)
  })

  it('rejects a blank language rather than defaulting or guessing one', async () => {
    const { from } = configure()
    const result = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', '   ')
    expect(result).toEqual({ matched: false, reason: 'NO_ACTIVE_ROUTE', resolvedAt: expect.any(String) })
    expect(from).not.toHaveBeenCalled()
  })
})
