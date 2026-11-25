import { registrationDefaultsFromLocale } from '@/lib/utils/registration-browser-defaults';

describe('registrationDefaultsFromLocale', () => {
  it('uses the browser region, its currency, and the browser zone', () => {
    expect(registrationDefaultsFromLocale({
      language: 'ar-OM',
      timeZone: 'Asia/Muscat',
    })).toEqual({
      country: 'OM',
      currency: 'OMR',
      timezone: 'Asia/Muscat',
      language: 'ar',
    });
  });

  it('keeps English for a non-Arabic browser and maps a US locale', () => {
    expect(registrationDefaultsFromLocale({
      language: 'en-US',
      timeZone: 'America/Chicago',
    })).toEqual({
      country: 'US',
      currency: 'USD',
      timezone: 'America/Chicago',
      language: 'en',
    });
  });

  it('uses the browser zone when the language tag has no country', () => {
    expect(registrationDefaultsFromLocale({
      language: 'en',
      timeZone: 'Asia/Muscat',
    })).toEqual({
      country: 'OM',
      currency: 'OMR',
      timezone: 'Asia/Muscat',
      language: 'en',
    });
  });

  it('falls back when the region or zone is missing', () => {
    expect(registrationDefaultsFromLocale({
      language: 'en',
      timeZone: 'Not/AZone',
    })).toEqual({
      country: 'US',
      currency: 'USD',
      timezone: 'UTC',
      language: 'en',
    });
  });
});
