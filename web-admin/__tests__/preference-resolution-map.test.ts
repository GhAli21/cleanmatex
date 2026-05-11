/**
 * PreferenceResolutionService RPC row mapping (Repeat Last Order payloads)
 */

import { PreferenceResolutionService } from '@/lib/services/preference-resolution.service';

describe('PreferenceResolutionService.mapLastOrderRpcRow', () => {
  it('maps packing CF id and service_prefs_catalog from RPC shape', () => {
    const pid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const sid = '11111111-2222-4222-8222-333333333333';
    const mapped = PreferenceResolutionService.mapLastOrderRpcRow({
      product_id: pid,
      service_category_code: 'DRY',
      packing_pref_code: 'HANGER',
      service_pref_codes: ['STARCH'],
      packing_pref_cf_id: '22222222-3333-4333-8444-555555555555',
      service_prefs_catalog: [
        { preference_code: 'STARCH', preference_id: sid },
      ],
    });
    expect(mapped.product_id).toBe(pid);
    expect(mapped.packing_pref_cf_id).toBe('22222222-3333-4333-8444-555555555555');
    expect(mapped.service_prefs_catalog).toEqual([
      { preference_code: 'STARCH', preference_id: sid },
    ]);
  });

  it('tolerates legacy rows without catalog columns', () => {
    const mapped = PreferenceResolutionService.mapLastOrderRpcRow({
      product_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      service_category_code: null,
      packing_pref_code: null,
      service_pref_codes: [],
    });
    expect(mapped.service_prefs_catalog).toEqual([]);
    expect(mapped.packing_pref_cf_id).toBeNull();
  });
});
