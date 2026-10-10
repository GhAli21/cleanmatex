/** @jest-environment node */
import { renderTemplateByCode } from '@lib/notifications/template-renderer'
import { createAdminSupabaseClient } from '@lib/supabase/server'

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedCreateAdminSupabaseClient = createAdminSupabaseClient as jest.Mock

/**
 * Builds a chainable `.from('sys_ntf_template_chan_dtl').select(...).eq(...).eq(...)...maybeSingle()`
 * mock. `rowsByChannel` maps a channel_code to the row that query should resolve to (or undefined
 * for "no row"), mirroring the real query's `.eq('channel_code', channelCode)` filter.
 */
function configureTemplateSupabase(rowsByChannel: Record<string, Record<string, unknown> | undefined>) {
  let currentChannel: string | undefined
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: string) => {
      if (column === 'channel_code') currentChannel = value
      return query
    }),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data: currentChannel ? rowsByChannel[currentChannel] ?? null : null,
      error: null,
    })),
  }
  const from = jest.fn(() => query)
  mockedCreateAdminSupabaseClient.mockReturnValue({ from })
  return from
}

describe('renderTemplateByCode', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the channel-specific APPROVED version and substitutes {{variables}} in subject/body (EN + AR)', async () => {
    configureTemplateSupabase({
      SMS: {
        rendered_body: 'Hi {{customer_name}}, enjoy {{discount}}% off!',
        rendered_body2: 'مرحبا {{customer_name}}، احصل على خصم {{discount}}%!',
        metadata: { foo: 'bar' },
        sys_ntf_template_ver_dtl: { subject: 'Offer for {{customer_name}}', subject2: 'عرض لـ {{customer_name}}' },
      },
    })

    const result = await renderTemplateByCode('promo.sms.default', 'SMS', {
      customer_name: 'Ali',
      discount: '20',
    })

    expect(result.title).toBe('Offer for Ali')
    expect(result.title2).toBe('عرض لـ Ali')
    expect(result.body).toBe('Hi Ali, enjoy 20% off!')
    expect(result.body2).toBe('مرحبا Ali، احصل على خصم 20%!')
    expect(result.metadata).toEqual({ foo: 'bar' })
  })

  it('falls back to the IN_APP rendering of the same template_code when no channel-specific row exists', async () => {
    configureTemplateSupabase({
      SMS: undefined,
      IN_APP: {
        rendered_body: 'In-app body {{x}}',
        rendered_body2: null,
        metadata: {},
        sys_ntf_template_ver_dtl: { subject: 'In-app subject', subject2: null },
      },
    })

    const result = await renderTemplateByCode('promo.generic', 'SMS', { x: '1' })

    expect(result.title).toBe('In-app subject')
    expect(result.body).toBe('In-app body 1')
  })

  it('falls back to plain text when the template_code has no APPROVED version at all (not even IN_APP)', async () => {
    configureTemplateSupabase({ SMS: undefined, IN_APP: undefined })

    const result = await renderTemplateByCode('missing.template', 'SMS', {})

    expect(result.title).toContain('missing.template')
    expect(result.body).toContain('missing.template')
    expect(result.title2).toBeNull()
    expect(result.body2).toBeNull()
  })

  it('does not recurse when channelCode is already IN_APP and no row exists', async () => {
    const from = configureTemplateSupabase({ IN_APP: undefined })

    const result = await renderTemplateByCode('missing.template', 'IN_APP', {})

    expect(result.title).toContain('missing.template')
    // Only one query attempt — no further fallback query possible past IN_APP.
    expect(from).toHaveBeenCalledTimes(1)
  })
})
