import { isValidTimeZone } from '@/lib/utils/business-date';

/**
 * Suggested organization locale for the public registration form.
 * The visitor confirms or changes these values before they are stored.
 * They are not an operations clock for an existing tenant.
 */
export interface RegistrationLocaleDefaults {
  country: string;
  currency: string;
  timezone: string;
  language: 'en' | 'ar';
}

/** Used on the server render and when the browser locale cannot be read. */
export const REGISTRATION_SERVER_DEFAULTS: RegistrationLocaleDefaults = {
  country: 'US',
  currency: 'USD',
  timezone: 'UTC',
  language: 'en',
};

const REGION_CURRENCY: Record<string, string> = {
  US: 'USD',
  OM: 'OMR',
  SA: 'SAR',
  AE: 'AED',
  KW: 'KWD',
  BH: 'BHD',
  QA: 'QAR',
  GB: 'GBP',
  EU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  IN: 'INR',
  PK: 'PKR',
  EG: 'EGP',
  JO: 'JOD',
  LB: 'LBP',
  TR: 'TRY',
  JP: 'JPY',
  CN: 'CNY',
  SG: 'SGD',
  MY: 'MYR',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
};

/** Used only when the browser language tag has no region. */
const ZONE_COUNTRY: Record<string, string> = {
  'Asia/Muscat': 'OM',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Qatar': 'QA',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
};

/** ISO currency for a registration country. Unknown countries stay on USD. */
export function currencyForCountry(country: string): string {
  return REGION_CURRENCY[country] ?? REGISTRATION_SERVER_DEFAULTS.currency;
}

/**
 * Map a browser language tag and IANA zone to the registration selects.
 * A missing region or an unknown currency stays on the server defaults.
 */
export function registrationDefaultsFromLocale(input: {
  timeZone?: string | null;
  language?: string | null;
}): RegistrationLocaleDefaults {
  const languageTag = (input.language ?? '').trim();
  const primary = languageTag.split('-')[0]?.toLowerCase();
  const region = languageTag.split('-')[1]?.toUpperCase();
  const timeZone = input.timeZone?.trim();
  const zoneCountry = timeZone ? ZONE_COUNTRY[timeZone] : undefined;
  const country = region && /^[A-Z]{2}$/.test(region)
    ? region
    : zoneCountry ?? REGISTRATION_SERVER_DEFAULTS.country;
  const currency = currencyForCountry(country);
  return {
    country,
    currency,
    timezone: isValidTimeZone(timeZone) ? timeZone : REGISTRATION_SERVER_DEFAULTS.timezone,
    language: primary === 'ar' ? 'ar' : 'en',
  };
}

let cachedBrowserKey = '';
let cachedBrowserDefaults: RegistrationLocaleDefaults = REGISTRATION_SERVER_DEFAULTS;

/** Stable snapshot for useSyncExternalStore. A new object each call would loop. */
export function readBrowserRegistrationDefaults(): RegistrationLocaleDefaults {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = typeof navigator === 'undefined' ? '' : navigator.language;
  const key = `${timeZone}|${language}`;
  if (key !== cachedBrowserKey) {
    cachedBrowserKey = key;
    cachedBrowserDefaults = registrationDefaultsFromLocale({ timeZone, language });
  }
  return cachedBrowserDefaults;
}

export function subscribeRegistrationDefaults(): () => void {
  return () => undefined;
}
