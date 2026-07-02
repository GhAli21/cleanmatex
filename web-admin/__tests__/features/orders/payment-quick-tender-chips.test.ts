// Pure chip-row deriver for the Phase 3 quick-tender fast lane (UX finding 1.2).
// Chips are input assistance only — the applied amount always routes through the
// same capped `updateLeg` path as the keypad, so these tests only cover the
// chip VALUES (denominations, round-ups, dedupe, ordering), not gating.
import {
  deriveQuickTenderChips,
  deriveQuickTenderDenominations,
} from '@features/orders/ui/payment-modal-v4.utils';

describe('deriveQuickTenderDenominations', () => {
  it('uses the small-note ladder for high-unit 3-dp GCC currencies', () => {
    expect(deriveQuickTenderDenominations('OMR')).toEqual([1, 5, 10, 20, 50]);
    expect(deriveQuickTenderDenominations('BHD')).toEqual([1, 5, 10, 20, 50]);
    expect(deriveQuickTenderDenominations('KWD')).toEqual([1, 5, 10, 20, 50]);
  });

  it('uses the large-note ladder for SAR/AED/QAR', () => {
    expect(deriveQuickTenderDenominations('SAR')).toEqual([10, 50, 100, 200, 500]);
    expect(deriveQuickTenderDenominations('AED')).toEqual([10, 50, 100, 200, 500]);
  });

  it('falls back to the generic ladder for unknown currencies', () => {
    expect(deriveQuickTenderDenominations('USD')).toEqual([5, 10, 20, 50, 100]);
    expect(deriveQuickTenderDenominations('')).toEqual([5, 10, 20, 50, 100]);
  });
});

describe('deriveQuickTenderChips', () => {
  it('returns nothing when nothing remains to settle', () => {
    expect(
      deriveQuickTenderChips({
        remaining: 0,
        currencyCode: 'OMR',
        decimalPlaces: 3,
        isCash: true,
      })
    ).toEqual([]);
  });

  it('non-cash legs only get the Exact chip', () => {
    const chips = deriveQuickTenderChips({
      remaining: 37.5,
      currencyCode: 'USD',
      decimalPlaces: 2,
      isCash: false,
    });
    expect(chips).toEqual([{ id: 'exact', kind: 'exact' }]);
  });

  it('cash: exact first, then ascending round-ups and flat notes (USD 37.50)', () => {
    const chips = deriveQuickTenderChips({
      remaining: 37.5,
      currencyCode: 'USD',
      decimalPlaces: 2,
      isCash: true,
    });
    expect(chips[0]).toEqual({ id: 'exact', kind: 'exact' });
    // next-5 = 40, next-10 = 40 (dedupe), notes 50 + 100
    expect(chips.slice(1).map((chip) => chip.tenderAmount)).toEqual([40, 50, 100]);
  });

  it('cash: 3-dp OMR round-ups use the 1/5 ladder and stay 3-dp safe', () => {
    const chips = deriveQuickTenderChips({
      remaining: 3.275,
      currencyCode: 'OMR',
      decimalPlaces: 3,
      isCash: true,
    });
    // next-1 = 4, next-5 = 5, notes 20 + 50
    expect(chips.slice(1).map((chip) => chip.tenderAmount)).toEqual([4, 5, 20, 50]);
    for (const chip of chips.slice(1)) {
      expect(chip.tenderAmount).toBeCloseTo(Number((chip.tenderAmount ?? 0).toFixed(3)), 10);
    }
  });

  it('drops chips that equal the exact amount (remaining already on a note)', () => {
    const chips = deriveQuickTenderChips({
      remaining: 50,
      currencyCode: 'USD',
      decimalPlaces: 2,
      isCash: true,
    });
    // next-5/next-10 == 50 == exact → dropped; note 50 == exact → dropped; only 100 stays.
    expect(chips.map((chip) => chip.id)).toEqual(['exact', 'tender-100']);
  });

  it('caps the row at Exact + 4 tender chips', () => {
    const chips = deriveQuickTenderChips({
      remaining: 3.2,
      currencyCode: 'USD',
      decimalPlaces: 2,
      isCash: true,
    });
    expect(chips.length).toBeLessThanOrEqual(5);
    expect(chips[0].kind).toBe('exact');
  });

  it('floating-point remainders do not produce phantom round-ups (epsilon guard)', () => {
    const chips = deriveQuickTenderChips({
      remaining: 40.0000000001,
      currencyCode: 'USD',
      decimalPlaces: 2,
      isCash: true,
    });
    // 40.0000000001 is "40" for money purposes → next-5 stays 40 → dropped as exact-equal.
    expect(chips.map((chip) => chip.tenderAmount ?? null)).toEqual([null, 50, 100]);
  });
});
