/** @jest-environment node */
/**
 * Characterization tests for the EVENT render paths (renderChannelTemplate / renderInAppTemplate).
 * Written BEFORE the R11 canonical-builder refactor: they pin today's behaviour (query filters, IN_APP
 * fallback, plain-text fallback, interpolation) so the refactor can prove it changed nothing.
 */
import { renderChannelTemplate, renderInAppTemplate } from '@lib/notifications/template-renderer'
import { createAdminSupabaseClient } from '@lib/supabase/server'

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedClient = createAdminSupabaseClient as jest.Mock

type Row = Record<string, unknown> | undefined

/** Chainable query mock: resolves the row configured for the channel the query filtered on. */
function configure(rowsByChannel: Record<string, Row>, error: { message: string } | null = null) {
  const eqCalls: Array<[string, unknown]> = []
  let channel: string | undefined
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: unknown) => {
      eqCalls.push([column, value])
      if (column === 'channel_code') channel = value as string
      return query
    }),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: channel ? rowsByChannel[channel] ?? null : null, error })),
  }
  const from = jest.fn(() => query)
  mockedClient.mockReturnValue({ from })
  return { from, query, eqCalls }
}

const ROW = {
  rendered_body: 'Order {{order_number}} is ready',
  rendered_body2: 'الطلب {{order_number}} جاهز',
  metadata: { k: 'v' },
  sys_ntf_template_ver_dtl: { subject: 'Ready: {{order_number}}', subject2: 'جاهز: {{order_number}}' },
}

describe('renderChannelTemplate (event path)', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the channel-specific APPROVED version with EN + AR interpolation and metadata', async () => {
    configure({ EMAIL: ROW })
    const result = await renderChannelTemplate('order.ready', 'EMAIL', { order_number: 'ORD-7' })
    expect(result).toEqual({
      title: 'Ready: ORD-7', title2: 'جاهز: ORD-7', body: 'Order ORD-7 is ready', body2: 'الطلب ORD-7 جاهز', metadata: { k: 'v' },
    })
  })

  it('filters by channel, APPROVED status, the event code and an active version, newest version first', async () => {
    const { eqCalls, query } = configure({ EMAIL: ROW })
    await renderChannelTemplate('order.ready', 'EMAIL', {})
    expect(eqCalls).toEqual([
      ['channel_code', 'EMAIL'],
      ['sys_ntf_template_ver_dtl.status', 'APPROVED'],
      ['sys_ntf_template_ver_dtl.sys_ntf_templates_mst.event_code', 'order.ready'],
      ['sys_ntf_template_ver_dtl.is_active', true],
    ])
    expect(query.order).toHaveBeenCalledWith('sys_ntf_template_ver_dtl(version_number)', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1)
  })

  it('falls back to the IN_APP rendering of the event when the channel has no template', async () => {
    const { eqCalls } = configure({ IN_APP: ROW })
    const result = await renderChannelTemplate('order.ready', 'SMS', { order_number: 'ORD-8' })
    expect(result.body).toBe('Order ORD-8 is ready')
    expect(eqCalls.filter(([column]) => column === 'channel_code').map(([, value]) => value)).toEqual(['SMS', 'IN_APP'])
  })

  it('falls back to plain text keyed by the event code when nothing exists at all', async () => {
    configure({})
    const result = await renderChannelTemplate('order.ready', 'IN_APP', {})
    expect(result).toEqual({
      title: 'New notification: order.ready', title2: null, body: 'You have a new notification for order.ready.', body2: null, metadata: {},
    })
  })

  it('leaves unknown placeholders untouched and uses the event code when the subject is empty', async () => {
    configure({ EMAIL: { ...ROW, rendered_body2: null, sys_ntf_template_ver_dtl: { subject: null, subject2: null } } })
    const result = await renderChannelTemplate('order.ready', 'EMAIL', {})
    expect(result.title).toBe('order.ready')
    expect(result.title2).toBeNull()
    expect(result.body).toBe('Order {{order_number}} is ready')
    expect(result.body2).toBeNull()
  })

  it('treats a database error like a missing template (never throws)', async () => {
    configure({}, { message: 'boom' })
    await expect(renderChannelTemplate('order.ready', 'EMAIL', {})).resolves.toMatchObject({ title: 'New notification: order.ready' })
  })
})

describe('renderInAppTemplate (event path)', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the IN_APP APPROVED version for the event', async () => {
    const { eqCalls } = configure({ IN_APP: ROW })
    const result = await renderInAppTemplate('order.ready', { order_number: 'ORD-9' })
    expect(result.title).toBe('Ready: ORD-9')
    expect(eqCalls[0]).toEqual(['channel_code', 'IN_APP'])
    expect(eqCalls).toContainEqual(['sys_ntf_template_ver_dtl.sys_ntf_templates_mst.event_code', 'order.ready'])
  })

  it('falls back to plain text when there is no IN_APP template', async () => {
    configure({})
    const result = await renderInAppTemplate('order.ready', {})
    expect(result.body).toBe('You have a new notification for order.ready.')
  })
})
