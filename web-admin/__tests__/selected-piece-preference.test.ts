/**
 * Unit tests: PreSubmissionPiece <-> SelectedPreference mappers
 */

import {
  applySelectedPreferencesToPiece,
  pieceToSelectedPreferences,
  renumberPreferencesForPiece,
} from '@/src/features/orders/lib/selected-piece-preference';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';

const basePiece = (): PreSubmissionPiece => ({
  id: 'temp-p1-1',
  itemId: 'uuid-product',
  pieceSeq: 1,
  notes: 'keep me',
});

describe('pieceToSelectedPreferences / applySelectedPreferencesToPiece', () => {
  it('round-trips conditions, service prefs, packing, color', () => {
    const piece: PreSubmissionPiece = {
      ...basePiece(),
      conditions: ['coffee', 'hole'],
      servicePrefs: [{ preference_code: 'STARCH', source: 'manual', extra_price: 0.5 }],
      packingPrefCode: 'HANGER',
      color: 'WHITE',
    };
    const chips = pieceToSelectedPreferences(piece);
    expect(chips.length).toBe(5);
    expect(chips[0].preference_sys_kind).toMatch(/condition_/);
    expect(chips[2].preference_sys_kind).toBe('service_prefs');
    expect(chips[3].preference_sys_kind).toBe('packing_prefs');
    expect(chips[4].preference_sys_kind).toBe('color');

    const merged = applySelectedPreferencesToPiece(basePiece(), chips);
    expect(merged.notes).toBe('keep me');
    expect(merged.conditions?.sort()).toEqual(['coffee', 'hole'].sort());
    expect(merged.servicePrefs?.[0]?.preference_code).toBe('STARCH');
    expect(merged.packingPrefCode).toBe('HANGER');
    expect(merged.color).toBe('WHITE');
  });

  it('round-trips empty piece', () => {
    const p = basePiece();
    const chips = pieceToSelectedPreferences(p);
    expect(chips).toEqual([]);
    const merged = applySelectedPreferencesToPiece(p, []);
    expect(merged.conditions).toBeUndefined();
    expect(merged.servicePrefs).toBeUndefined();
  });

  it('round-trips condition mapped to damage/special kind (delicate)', () => {
    const piece: PreSubmissionPiece = {
      ...basePiece(),
      conditions: ['delicate'],
    };
    const chips = pieceToSelectedPreferences(piece);
    expect(chips).toHaveLength(1);
    expect(chips[0].preference_sys_kind).toBe('condition_special');
    expect(chips[0].preference_code).toBe('DELICATE_COND');
    const merged = applySelectedPreferencesToPiece(basePiece(), chips);
    expect(merged.conditions).toEqual(['delicate']);
  });

  it('renumberPreferencesForPiece assigns contiguous prefs_no', () => {
    const piece = basePiece();
    const a = pieceToSelectedPreferences({
      ...piece,
      conditions: ['coffee'],
      servicePrefs: [{ preference_code: 'X', source: 'manual', extra_price: 0 }],
    });
    const renumbered = renumberPreferencesForPiece(a, piece.id);
    expect(renumbered.map((x) => x.prefs_no)).toEqual([1, 2]);
  });
});
