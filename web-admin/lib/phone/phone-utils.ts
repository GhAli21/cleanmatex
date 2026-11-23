/**
 * Phone normalization, country catalog, validation, and display utilities.
 * Backed by libphonenumber-js (Google libphonenumber metadata).
 *
 * Canonical DB representation is always E.164 (e.g. "+96896662624", "+966501234567").
 * @module lib/phone/phone-utils
 */

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

export type { CountryCode }

export interface PhoneCountryOption {
  /** ISO 3166-1 alpha-2 country code (e.g. "OM", "SA") */
  iso: CountryCode
  /** Dial code with leading "+" (e.g. "+968") */
  dialCode: string
  /** Localized country name for the active UI locale */
  name: string
  /** Regional-indicator flag emoji */
  flag: string
  /** Lowercased search haystack covering localized name, English name, ISO, and dial code */
  searchText: string
}

export interface NormalizedPhoneResult {
  /** Canonical E.164 string for the DB column (e.g. "+96896662624"), or "" when empty */
  e164: string
  /** Resolved ISO 3166-1 alpha-2 country code */
  country: CountryCode
  /** Calling code with leading "+" (e.g. "+968") */
  dialCode: string
  /** National/local digits without country calling code */
  nationalNumber: string
  /** Human-readable international format (e.g. "+968 9666 2624") */
  formattedInternational: string
  /** True when libphonenumber validates the number for the country */
  isValid: boolean
  /** True when the digit length is possible for the country */
  isPossible: boolean
}

const SHARED_DIAL_CODE_DEFAULTS: Record<string, CountryCode> = {
  '1': 'US',
  '7': 'RU',
  '44': 'GB',
  '61': 'AU',
  '212': 'MA',
  '262': 'RE',
  '358': 'FI',
  '590': 'GP',
  '599': 'CW',
}

/**
 * Convert Arabic-Indic (٠-٩), Extended Arabic-Indic/Persian (۰-۹), and fullwidth digits (０-９)
 * into Western ASCII digits (0-9) so parsing works regardless of keyboard layout.
 */
export function toAsciiDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\uFF10-\uFF19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10))
}

/** Convert an ISO 3166-1 alpha-2 code (e.g. "OM") into a regional indicator flag emoji. */
export function countryIsoToFlag(iso: string): string {
  const upper = iso.toUpperCase()
  if (upper.length !== 2) return ''
  return String.fromCodePoint(
    0x1f1e6 + (upper.charCodeAt(0) - 65),
    0x1f1e6 + (upper.charCodeAt(1) - 65),
  )
}

/** Resolve a tenant setting like "+968", "968", or "OM" into a libphonenumber CountryCode. */
export function dialCodeToDefaultCountry(
  codeOrIso: string | null | undefined,
): CountryCode | undefined {
  if (!codeOrIso) return undefined
  const trimmed = toAsciiDigits(codeOrIso).trim()
  if (!trimmed) return undefined

  const countries = getCountries()
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && countries.includes(upper as CountryCode)) {
    return upper as CountryCode
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return undefined

  if (SHARED_DIAL_CODE_DEFAULTS[digits]) {
    return SHARED_DIAL_CODE_DEFAULTS[digits]
  }

  return countries.find((iso) => getCountryCallingCode(iso) === digits)
}

const countryListCache = new Map<string, PhoneCountryOption[]>()

/**
 * Build and cache the full searchable list of countries with localized names
 * via Intl.DisplayNames (zero static country-name translation bloat).
 */
export function getPhoneCountryOptions(locale: string): PhoneCountryOption[] {
  const normalizedLocale = locale === 'ar' ? 'ar' : 'en'
  const cached = countryListCache.get(normalizedLocale)
  if (cached) return cached

  let localDisplay: Intl.DisplayNames | null = null
  let enDisplay: Intl.DisplayNames | null = null
  try {
    localDisplay = new Intl.DisplayNames([normalizedLocale], { type: 'region' })
    enDisplay = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    // Fallback to ISO code if Intl.DisplayNames is unavailable in an older runtime
  }

  const options: PhoneCountryOption[] = getCountries().map((iso) => {
    const callingCode = getCountryCallingCode(iso)
    const dialCode = `+${callingCode}`
    const localName = localDisplay?.of(iso) ?? iso
    const enName = enDisplay?.of(iso) ?? iso
    return {
      iso,
      dialCode,
      name: localName,
      flag: countryIsoToFlag(iso),
      searchText: `${localName} ${enName} ${iso} ${dialCode} ${callingCode}`.toLowerCase(),
    }
  })

  options.sort((a, b) => a.name.localeCompare(b.name, normalizedLocale))
  countryListCache.set(normalizedLocale, options)
  return options
}

/**
 * Normalize user input (local digits, formatted string, Arabic digits, or pasted E.164)
 * into a canonical E.164 DB value alongside validation and display metadata.
 */
export function normalizePhoneInput(
  rawInput: string,
  selectedCountry: CountryCode,
): NormalizedPhoneResult {
  const ascii = toAsciiDigits(rawInput).trim()
  const callingCode = getCountryCallingCode(selectedCountry)
  const fallbackDialCode = `+${callingCode}`

  if (!ascii) {
    return {
      e164: '',
      country: selectedCountry,
      dialCode: fallbackDialCode,
      nationalNumber: '',
      formattedInternational: '',
      isValid: false,
      isPossible: false,
    }
  }

  // Handle pasted international format ("+966..." or "00966...")
  const internationalCandidate = ascii.startsWith('00')
    ? `+${ascii.slice(2)}`
    : ascii

  if (internationalCandidate.startsWith('+')) {
    const cleanedIntl = `+${internationalCandidate.slice(1).replace(/\D/g, '')}`
    const parsed = parsePhoneNumberFromString(cleanedIntl)
    if (parsed && parsed.country) {
      return {
        e164: parsed.number,
        country: parsed.country,
        dialCode: `+${parsed.countryCallingCode}`,
        nationalNumber: parsed.nationalNumber,
        formattedInternational: parsed.formatInternational(),
        isValid: parsed.isValid(),
        isPossible: parsed.isPossible(),
      }
    }
    const digitsOnly = cleanedIntl.slice(1)
    return {
      e164: digitsOnly ? cleanedIntl : '',
      country: selectedCountry,
      dialCode: fallbackDialCode,
      nationalNumber: digitsOnly,
      formattedInternational: cleanedIntl,
      isValid: false,
      isPossible: false,
    }
  }

  // Local / national input for the selected country
  const digits = ascii.replace(/\D/g, '')
  if (!digits) {
    return {
      e164: '',
      country: selectedCountry,
      dialCode: fallbackDialCode,
      nationalNumber: '',
      formattedInternational: '',
      isValid: false,
      isPossible: false,
    }
  }

  const parsed = parsePhoneNumberFromString(digits, selectedCountry)
  if (parsed) {
    return {
      e164: parsed.number,
      country: parsed.country ?? selectedCountry,
      dialCode: `+${parsed.countryCallingCode}`,
      nationalNumber: parsed.nationalNumber,
      formattedInternational: parsed.formatInternational(),
      isValid: parsed.isValid(),
      isPossible: parsed.isPossible(),
    }
  }

  // Fallback E.164 while the user is still typing a short prefix
  const strippedLeadingZero = digits.replace(/^0+/, '')
  const e164 = strippedLeadingZero ? `${fallbackDialCode}${strippedLeadingZero}` : ''
  return {
    e164,
    country: selectedCountry,
    dialCode: fallbackDialCode,
    nationalNumber: digits,
    formattedInternational: e164,
    isValid: false,
    isPossible: false,
  }
}

/**
 * Split a stored DB phone string (E.164 or legacy national digits) into
 * Part 1 (country), Part 2 (nationalNumber), and Part 3 (canonical e164).
 */
export function splitPhoneValue(
  value: string | null | undefined,
  fallbackCountry: CountryCode,
): { country: CountryCode; nationalNumber: string; e164: string } {
  const ascii = toAsciiDigits(value ?? '').trim()
  if (!ascii) {
    return { country: fallbackCountry, nationalNumber: '', e164: '' }
  }

  const parsed = parsePhoneNumberFromString(ascii, fallbackCountry)
  if (parsed) {
    return {
      country: parsed.country ?? fallbackCountry,
      nationalNumber: parsed.nationalNumber,
      e164: parsed.number,
    }
  }

  // If the value starts with "+<dial>" for an incomplete number, extract matching country
  if (ascii.startsWith('+')) {
    const digits = ascii.slice(1).replace(/\D/g, '')
    for (let len = 3; len >= 1; len -= 1) {
      const prefix = digits.slice(0, len)
      const matched = dialCodeToDefaultCountry(prefix)
      if (matched) {
        return {
          country: matched,
          nationalNumber: digits.slice(len),
          e164: `+${digits}`,
        }
      }
    }
  }

  const normalized = normalizePhoneInput(ascii, fallbackCountry)
  return {
    country: normalized.country,
    nationalNumber: normalized.nationalNumber,
    e164: normalized.e164,
  }
}

/** Format an E.164 or national phone number for clean international UI display. */
export function formatPhoneForDisplay(
  value: string | null | undefined,
  defaultCountry?: CountryCode,
): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  const parsed = parsePhoneNumberFromString(toAsciiDigits(raw), defaultCountry)
  if (parsed) {
    return parsed.formatInternational()
  }
  return raw
}

/** Extract the ISO 3166-1 alpha-2 country code from an E.164 or national phone string. */
export function getPhoneCountry(
  value: string | null | undefined,
  defaultCountry?: CountryCode,
): CountryCode | undefined {
  const raw = (value ?? '').trim()
  if (!raw) return undefined
  const parsed = parsePhoneNumberFromString(toAsciiDigits(raw), defaultCountry)
  return parsed?.country ?? defaultCountry
}

/** Strip "+" and non-digits for WhatsApp deep links (https://wa.me/<digits>). */
export function toWhatsAppDigits(value: string | null | undefined): string {
  return toAsciiDigits(value ?? '').replace(/\D/g, '')
}
