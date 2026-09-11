import { parseRuntimeBool, resolveRuntimeString } from '@lib/notifications/runtime-config-helpers'

describe('notification runtime config helpers', () => {
  it('parses boolean flags and treats blank as unset', () => {
    expect(parseRuntimeBool('true')).toBe(true)
    expect(parseRuntimeBool('false')).toBe(false)
    expect(parseRuntimeBool('  YES ')).toBe(true)
    expect(parseRuntimeBool('')).toBeUndefined()
    expect(parseRuntimeBool(undefined)).toBeUndefined()
  })

  it('lets env override DB, then falls back', () => {
    expect(
      resolveRuntimeString({
        envValue: 'whatsapp:+14155238886',
        dbValue: 'whatsapp:+17017796841',
        fallback: '+10000000000',
      }),
    ).toBe('whatsapp:+14155238886')

    expect(
      resolveRuntimeString({
        envValue: '  ',
        dbValue: '+17017796841',
      }),
    ).toBe('+17017796841')

    expect(
      resolveRuntimeString({
        envValue: undefined,
        dbValue: '',
        fallback: 'noreply@service.cleanmatex.com',
      }),
    ).toBe('noreply@service.cleanmatex.com')
  })
})
