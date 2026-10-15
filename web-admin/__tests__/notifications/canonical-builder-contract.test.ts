/** @jest-environment node */
/**
 * Contract fixtures for the canonical builder (plan NTF-06): the SAME fixture is pushed through the
 * EVENT, CAMPAIGN and TEST entry points and must produce identical rendered content and the same
 * delivery decision. A divergence between the three paths fails here.
 */
import { buildNotification } from '@lib/notifications/canonical-builder'
import { renderChannelTemplate, renderTemplateByCode } from '@lib/notifications/template-renderer'
import type { ChannelConfig } from '@lib/notifications/settings-service'
import { createAdminSupabaseClient } from '@lib/supabase/server'

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedClient = createAdminSupabaseClient as jest.Mock

/** Template store keyed by channel; both the event and the code lookup resolve against it. */
function configureTemplates(rowsByChannel: Record<string, Record<string, unknown> | undefined>) {
  let channel: string | undefined
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: unknown) => {
      if (column === 'channel_code') channel = value as string
      return query
    }),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: channel ? rowsByChannel[channel] ?? null : null, error: null })),
  }
  mockedClient.mockReturnValue({ from: jest.fn(() => query) })
}

const OPEN: ChannelConfig = {
  channelCode: 'EMAIL', isEnabled: true, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00',
  quietHoursTz: 'UTC', dailyLimit: null, activeProvider: null, metadata: null,
}

interface Fixture {
  name: string
  channel: string
  templates: Record<string, Record<string, unknown> | undefined>
  variables: Record<string, string>
  transactional: boolean
  consent: boolean | null
  now: string
  expected: {
    title: string
    body: string
    title2: string | null
    action: 'SEND' | 'SKIP'
    skipReason?: string
    scheduledAt: string
  }
}

const READY = {
  rendered_body: 'Order {{order_number}} is ready',
  rendered_body2: 'الطلب {{order_number}} جاهز',
  metadata: {},
  sys_ntf_template_ver_dtl: { subject: 'Ready {{order_number}}', subject2: 'جاهز {{order_number}}' },
}

const FIXTURES: Fixture[] = [
  {
    name: 'transactional email at noon: sends now with EN + AR content',
    channel: 'EMAIL', templates: { EMAIL: READY }, variables: { order_number: 'ORD-1' },
    transactional: true, consent: null, now: '2026-10-15T12:00:00Z',
    expected: { title: 'Ready ORD-1', body: 'Order ORD-1 is ready', title2: 'جاهز ORD-1', action: 'SEND', scheduledAt: '2026-10-15T12:00:00.000Z' },
  },
  {
    name: 'marketing with consent at night: deferred to the end of quiet hours',
    channel: 'EMAIL', templates: { EMAIL: READY }, variables: { order_number: 'ORD-2' },
    transactional: false, consent: true, now: '2026-10-15T23:30:00Z',
    expected: { title: 'Ready ORD-2', body: 'Order ORD-2 is ready', title2: 'جاهز ORD-2', action: 'SEND', scheduledAt: '2026-10-16T07:00:00.000Z' },
  },
  {
    name: 'marketing without consent: skipped, content still rendered',
    channel: 'EMAIL', templates: { EMAIL: READY }, variables: { order_number: 'ORD-3' },
    transactional: false, consent: false, now: '2026-10-15T12:00:00Z',
    expected: { title: 'Ready ORD-3', body: 'Order ORD-3 is ready', title2: 'جاهز ORD-3', action: 'SKIP', skipReason: 'NO_MARKETING_CONSENT', scheduledAt: '2026-10-15T12:00:00.000Z' },
  },
  {
    name: 'channel without its own template: falls back to the IN_APP rendering',
    channel: 'SMS', templates: { IN_APP: READY }, variables: { order_number: 'ORD-4' },
    transactional: true, consent: null, now: '2026-10-15T12:00:00Z',
    expected: { title: 'Ready ORD-4', body: 'Order ORD-4 is ready', title2: 'جاهز ORD-4', action: 'SEND', scheduledAt: '2026-10-15T12:00:00.000Z' },
  },
]

describe.each(FIXTURES)('contract: $name', (fixture) => {
  beforeEach(() => configureTemplates(fixture.templates))
  afterEach(() => jest.clearAllMocks())

  const policy = () => ({
    channelConfig: { ...OPEN, channelCode: fixture.channel },
    isTransactional: fixture.transactional,
    hasMarketingConsent: fixture.consent,
    priority: 'NORMAL' as const,
    now: new Date(fixture.now),
  })

  it.each(['EVENT', 'CAMPAIGN', 'TEST'] as const)('%s source produces the expected content and decision', async (source) => {
    const template = source === 'CAMPAIGN'
      ? ({ kind: 'code', templateCode: 'promo.tpl' } as const)
      : ({ kind: 'event', eventCode: 'order.ready' } as const)
    const built = await buildNotification({ source, channel: fixture.channel, template, variables: fixture.variables, policy: policy() })

    expect(built.rendered.title).toBe(fixture.expected.title)
    expect(built.rendered.body).toBe(fixture.expected.body)
    expect(built.rendered.title2).toBe(fixture.expected.title2)
    expect(built.decision.action).toBe(fixture.expected.action)
    if (built.decision.action === 'SKIP') expect(built.decision.skipReason).toBe(fixture.expected.skipReason)
    expect(built.decision.scheduledAt.toISOString()).toBe(fixture.expected.scheduledAt)
    expect(built.isTest).toBe(source === 'TEST')
  })

  it('the legacy entry points render exactly what the canonical builder renders', async () => {
    const built = await buildNotification({
      source: 'EVENT', channel: fixture.channel, template: { kind: 'event', eventCode: 'order.ready' }, variables: fixture.variables, policy: policy(),
    })
    expect(await renderChannelTemplate('order.ready', fixture.channel, fixture.variables)).toEqual(built.rendered)
    expect(await renderTemplateByCode('promo.tpl', fixture.channel, fixture.variables)).toEqual(built.rendered)
  })
})

describe('builder inputs', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders inline content when there is no template (campaign saved before a template was attached)', async () => {
    const built = await buildNotification({
      source: 'CAMPAIGN', channel: 'EMAIL', template: null,
      inline: { title: 'Sale', title2: 'تخفيض', body: 'Everything 20% off', body2: null },
      variables: {}, policy: { channelConfig: OPEN, isTransactional: false, hasMarketingConsent: true, now: new Date('2026-10-15T12:00:00Z') },
    })
    expect(built.rendered).toEqual({ title: 'Sale', title2: 'تخفيض', body: 'Everything 20% off', body2: null, metadata: {} })
    expect(built.decision.action).toBe('SEND')
  })

  it('refuses to build without a template or inline content', async () => {
    await expect(buildNotification({
      source: 'EVENT', channel: 'EMAIL', template: null, variables: {},
      policy: { channelConfig: OPEN, isTransactional: true, hasMarketingConsent: null },
    })).rejects.toThrow('template reference or inline content')
  })

  it('test mode bypasses consent only for the TEST source', async () => {
    configureTemplates({ EMAIL: READY })
    const base = {
      channel: 'EMAIL', template: { kind: 'event', eventCode: 'order.ready' } as const, variables: {},
      policy: { channelConfig: OPEN, isTransactional: false, hasMarketingConsent: false, now: new Date('2026-10-15T12:00:00Z') },
      testMode: true,
    }
    expect((await buildNotification({ ...base, source: 'TEST' })).decision.action).toBe('SEND')
    expect((await buildNotification({ ...base, source: 'CAMPAIGN' })).decision.action).toBe('SKIP')
    expect((await buildNotification({ ...base, source: 'EVENT' })).decision.action).toBe('SKIP')
  })
})
