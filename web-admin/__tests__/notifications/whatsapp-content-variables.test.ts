import { buildTwilioContentVariables } from '@lib/notifications/adapters/whatsapp-content-variables'

describe('buildTwilioContentVariables', () => {
  const orderRow = {
    event_code: 'order.created',
    metadata: {
      variables: {
        order_number: 'ORD-20260912-0001',
        estimated_ready_at: '12 September 2026',
        date: '12 September 2026',
      },
    },
  }

  it('uses provider content_variable_map named slots', () => {
    expect(
      buildTwilioContentVariables(orderRow, {
        content_variable_map: {
          order_number: '$order_number',
          estimated_ready_at: '$estimated_ready_at',
        },
      }),
    ).toEqual({
      order_number: 'ORD-20260912-0001',
      estimated_ready_at: '12 September 2026',
    })
  })

  it('passes named order keys through when no map is configured', () => {
    expect(buildTwilioContentVariables(orderRow)).toEqual({
      order_number: 'ORD-20260912-0001',
      estimated_ready_at: '12 September 2026',
      date: '12 September 2026',
    })
  })

  it('falls back to OTP-style slots when only a code is present', () => {
    expect(
      buildTwilioContentVariables({
        event_code: 'auth.otp',
        metadata: { variables: { otp: '4821' } },
      }),
    ).toEqual({ '1': 'auth otp', '2': '4821' })
  })

  it('sends no variables when content_variable_map is an empty object', () => {
    expect(
      buildTwilioContentVariables(orderRow, { content_variable_map: {} }),
    ).toEqual({})
  })
})
