import {
  comparePreferenceSnapshots,
  describePreferenceChange,
  preferenceChangeCodes,
  preferenceChangeCount,
} from '@/lib/utils/order-preference-snapshot';

const antiBacterial = {
  preferenceCode: 'ANTI_BACTERIAL',
  preferenceSysKind: 'service_prefs',
  preferenceContent: null as string | null,
  preferenceId: 'cf-1',
  extraPrice: 0.4,
  prefsLevel: 'PIECE',
  productId: 'p1',
  productName: 'Cotton Pants',
  pieceSeq: 1,
};

describe('comparePreferenceSnapshots', () => {
  it('records an added preference with kind, content, and code', () => {
    const result = comparePreferenceSnapshots([], [
      { ...antiBacterial, preferenceContent: 'Apply on collar' },
    ]);
    expect(result.added).toEqual([
      expect.objectContaining({
        newPreferenceCode: 'ANTI_BACTERIAL',
        newPreferenceSysKind: 'service_prefs',
        newPreferenceContent: 'Apply on collar',
      }),
    ]);
    expect(describePreferenceChange(result.added[0]!)).toBe(
      'service_prefs:ANTI_BACTERIAL (PIECE · Cotton Pants #1)'
    );
  });

  it('records a removed preference with old kind, content, and code', () => {
    const result = comparePreferenceSnapshots(
      [{ ...antiBacterial, preferenceCode: 'STARCH_HEAVY', extraPrice: 0.3 }],
      []
    );
    expect(result.removed[0]).toEqual(
      expect.objectContaining({
        oldPreferenceCode: 'STARCH_HEAVY',
        oldPreferenceSysKind: 'service_prefs',
        oldExtraPrice: 0.3,
      })
    );
  });

  it('records before/after when kind, content, or code change on the same row', () => {
    const result = comparePreferenceSnapshots(
      [antiBacterial],
      [
        {
          ...antiBacterial,
          preferenceCode: 'ANTI_BACTERIAL_PLUS',
          preferenceSysKind: 'note',
          preferenceContent: 'Customer asked for extra',
          extraPrice: 0.5,
        },
      ]
    );
    expect(result.modified).toEqual([
      expect.objectContaining({
        oldPreferenceCode: 'ANTI_BACTERIAL',
        newPreferenceCode: 'ANTI_BACTERIAL_PLUS',
        oldPreferenceSysKind: 'service_prefs',
        newPreferenceSysKind: 'note',
        oldPreferenceContent: null,
        newPreferenceContent: 'Customer asked for extra',
        oldExtraPrice: 0.4,
        newExtraPrice: 0.5,
      }),
    ]);
  });

  it('does not flag an unchanged preference', () => {
    expect(preferenceChangeCount(comparePreferenceSnapshots([antiBacterial], [antiBacterial]))).toBe(0);
  });

  it('reads a legacy single preferenceCode as before/after', () => {
    expect(
      preferenceChangeCodes({
        prefsLevel: 'PIECE',
        productName: 'Cotton Pants',
        pieceSeq: 1,
        changeType: 'added',
        preferenceCode: 'STARCH_HEAVY',
      })
    ).toEqual({ oldCode: null, newCode: 'STARCH_HEAVY' });
  });

  it('names the attachment level from prefs_level', () => {
    const orderPref = comparePreferenceSnapshots([], [{
      ...antiBacterial,
      prefsLevel: 'ORDER',
      productId: null,
      productName: null,
      pieceSeq: null,
    }]).added[0]!;
    expect(describePreferenceChange(orderPref)).toBe(
      'service_prefs:ANTI_BACTERIAL (ORDER)'
    );
  });
});
