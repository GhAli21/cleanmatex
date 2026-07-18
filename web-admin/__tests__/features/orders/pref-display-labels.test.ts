/**
 * @jest-environment node
 */

import {
  buildPrefNameByCode,
  humanizePrefCode,
  labelForPrefCode,
  labelForPrefKind,
} from '@/src/features/orders/ui/piece-preferences/pref-display-labels';
import type { PreferenceKind } from '@/lib/types/service-preferences';

describe('pref-display-labels', () => {
  const getBilingualAr = (name?: string | null, name2?: string | null) =>
    (name2 && name2.trim() ? name2 : name) || '';
  const getBilingualEn = (name?: string | null, name2?: string | null) =>
    (name && name.trim() ? name : name2) || '';

  it('humanizes unknown codes', () => {
    expect(humanizePrefCode('ECO_WASH')).toBe('ECO WASH');
  });

  it('AR prefers name2', () => {
    const map = buildPrefNameByCode(
      {
        servicePrefs: [
          { code: 'ECO_WASH', name: 'Eco Wash', name2: 'غسيل بيئي' },
        ],
      },
      getBilingualAr
    );
    expect(labelForPrefCode('ECO_WASH', map)).toBe('غسيل بيئي');
    expect(labelForPrefCode('eco_wash', map)).toBe('غسيل بيئي');
  });

  it('EN prefers name', () => {
    const map = buildPrefNameByCode(
      {
        colors: [{ code: 'RED', name: 'Red', name2: 'أحمر' }],
      },
      getBilingualEn
    );
    expect(labelForPrefCode('RED', map)).toBe('Red');
  });

  it('falls back to humanized code when unknown', () => {
    expect(labelForPrefCode('CUSTOM_X', new Map())).toBe('CUSTOM X');
  });

  it('labels preference kinds bilingually', () => {
    const kinds = [
      {
        kind_code: 'service_prefs',
        name: 'Service Preferences',
        name2: 'تفضيلات الخدمة',
      },
    ] as PreferenceKind[];
    expect(labelForPrefKind('service_prefs', kinds, getBilingualAr)).toBe(
      'تفضيلات الخدمة'
    );
    expect(labelForPrefKind('unknown_kind', kinds, getBilingualAr)).toBe(
      'unknown kind'
    );
  });
});
