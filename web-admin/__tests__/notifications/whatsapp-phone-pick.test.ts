import { pickWhatsAppDestination, pickWhatsAppPhone } from '@lib/notifications/whatsapp-phone'

describe('pickWhatsAppPhone', () => {
  it('prefers a customer master phone', () => {
    expect(pickWhatsAppPhone('+96891234567', '+96890000000')).toBe('+96891234567')
  })

  it('falls back to the order contact number', () => {
    expect(pickWhatsAppPhone(null, '+96891234567')).toBe('+96891234567')
  })

  it('returns null when neither contact is present', () => {
    expect(pickWhatsAppPhone(null, '   ')).toBeNull()
  })
})

describe('pickWhatsAppDestination', () => {
  it('uses the sandbox To override when set', () => {
    expect(
      pickWhatsAppDestination('whatsapp:+14155552671', '+96891234567', '+96890000000'),
    ).toBe('+14155552671')
  })

  it('falls back to customer then order mobile when sandbox To is empty', () => {
    expect(pickWhatsAppDestination('', '+96891234567', '+96890000000')).toBe('+96891234567')
    expect(pickWhatsAppDestination(null, null, '+96890000000')).toBe('+96890000000')
  })

  it('returns null when sandbox To and both contacts are empty', () => {
    expect(pickWhatsAppDestination('  ', null, '')).toBeNull()
  })
})
