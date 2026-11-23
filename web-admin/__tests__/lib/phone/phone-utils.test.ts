import {
  countryIsoToFlag,
  dialCodeToDefaultCountry,
  formatPhoneForDisplay,
  getPhoneCountry,
  getPhoneCountryOptions,
  normalizePhoneInput,
  splitPhoneValue,
  toAsciiDigits,
  toWhatsAppDigits,
} from '@/lib/phone/phone-utils'

describe('phone-utils', () => {
  it('converts Arabic-Indic and Persian digits to ASCII', () => {
    expect(toAsciiDigits('٠٥٠١٢٣٤٥٦٧')).toBe('0501234567')
    expect(toAsciiDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
  })

  it('maps ISO codes to flag emojis', () => {
    expect(countryIsoToFlag('OM')).toBe('🇴🇲')
    expect(countryIsoToFlag('SA')).toBe('🇸🇦')
  })

  it('resolves tenant dial codes and ISO codes to default countries', () => {
    expect(dialCodeToDefaultCountry('+968')).toBe('OM')
    expect(dialCodeToDefaultCountry('+966')).toBe('SA')
    expect(dialCodeToDefaultCountry('+971')).toBe('AE')
    expect(dialCodeToDefaultCountry('SA')).toBe('SA')
    expect(dialCodeToDefaultCountry('+1')).toBe('US')
    expect(dialCodeToDefaultCountry('')).toBeUndefined()
  })

  it('returns searchable country lists in EN and AR', () => {
    const en = getPhoneCountryOptions('en')
    const ar = getPhoneCountryOptions('ar')
    expect(en.length).toBeGreaterThan(200)
    expect(ar.length).toBeGreaterThan(200)
    const omanEn = en.find((c) => c.iso === 'OM')
    const omanAr = ar.find((c) => c.iso === 'OM')
    expect(omanEn?.dialCode).toBe('+968')
    expect(omanAr?.searchText).toContain('oman')
    expect(omanAr?.searchText).toContain('968')
  })

  it('normalizes GCC national numbers including leading trunk 0 and Arabic digits', () => {
    const om = normalizePhoneInput('9666 2624', 'OM')
    expect(om.e164).toBe('+96896662624')
    expect(om.country).toBe('OM')
    expect(om.isValid).toBe(true)

    const sa = normalizePhoneInput('٠٥٠ ١٢٣ ٤٥٦٧', 'SA')
    expect(sa.e164).toBe('+966501234567')
    expect(sa.country).toBe('SA')
    expect(sa.nationalNumber).toBe('501234567')
    expect(sa.isValid).toBe(true)
  })

  it('auto-detects country when pasting full E.164 or 00-prefixed international numbers', () => {
    const pastedPlus = normalizePhoneInput('+966501234567', 'OM')
    expect(pastedPlus.country).toBe('SA')
    expect(pastedPlus.e164).toBe('+966501234567')
    expect(pastedPlus.nationalNumber).toBe('501234567')
    expect(pastedPlus.isValid).toBe(true)

    const pastedZeroZero = normalizePhoneInput('00971501234567', 'OM')
    expect(pastedZeroZero.country).toBe('AE')
    expect(pastedZeroZero.e164).toBe('+971501234567')
    expect(pastedZeroZero.isValid).toBe(true)
  })

  it('splits stored E.164 values accurately for edit forms', () => {
    const splitSa = splitPhoneValue('+966501234567', 'OM')
    expect(splitSa).toEqual({
      country: 'SA',
      nationalNumber: '501234567',
      e164: '+966501234567',
    })

    const splitLegacy = splitPhoneValue('96662624', 'OM')
    expect(splitLegacy).toEqual({
      country: 'OM',
      nationalNumber: '96662624',
      e164: '+96896662624',
    })
  })

  it('formats phones for display, extracts country ISO, and builds WhatsApp digits', () => {
    expect(formatPhoneForDisplay('+96896662624')).toBe('+968 9666 2624')
    expect(formatPhoneForDisplay('+966501234567')).toBe('+966 50 123 4567')
    expect(getPhoneCountry('+96896662624')).toBe('OM')
    expect(getPhoneCountry('+966501234567')).toBe('SA')
    expect(toWhatsAppDigits('+968 9666 2624')).toBe('96896662624')
  })
})
