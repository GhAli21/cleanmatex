/**
 * Payment Modal v4 — payload regression oracle (ACTIVATED IN PHASE 2F).
 *
 * Replays the 8 Phase-0 baseline fixtures through the extracted pure
 * `buildPaymentPayload` and asserts the rebuilt payload is deep-equal to the recorded
 * payload. This retro-certifies the payload contract across Phases 2A–2F: any
 * extraction that drops/renames a field, changes a conditional spread, alters leg-ref
 * stamping, or reorders `taxProfileIds`/`paymentLegs` breaks this gate.
 *
 * The fixtures record `{ paymentData, payload }`. `buildPaymentPayload`'s inputs are
 * reconstructed from the recorded `payload` (the upstream derivations that PRODUCE
 * those inputs live in the totals/legs/derivations/cash-drawer slices and are covered
 * by their own suites + manual QA). This suite freezes the **assembly** contract that
 * `buildPaymentPayload` owns.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildPaymentPayload } from '@features/orders/hooks/use-payment-submit';
import type { BuildPaymentPayloadInput } from '@features/orders/hooks/use-payment-submit';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

const FIXTURES_DIR = __dirname;

/** The recorded payload shape (a superset/optional view of the builder output). */
type RecordedPayload = {
  amountToCharge: number;
  totals: {
    subtotal: number;
    manualDiscount: number;
    promoDiscount: number;
    afterDiscounts: number;
    taxRate: number;
    taxAmount: number;
    vatTaxPercent: number;
    vatValue: number;
    giftCardApplied: number;
    saleTotal: number;
  };
  outstandingPolicy: string;
  currencyCode?: string;
  currencyExRate?: number;
  creditLimitOverride?: boolean;
  cashDrawerSessionId?: string;
  taxProfileIds?: string[];
  paymentLegs?: PaymentLeg[];
  overpaymentResolution?: unknown;
};

/**
 * Reconstructs `buildPaymentPayload`'s inputs from a recorded payload. Each mapping is
 * the inverse of the builder's assembly; passing `extraReceiptMode: 'adjust_legs'` +
 * `unresolvedOverpaymentAmount: 0` makes the overpayment-resolution fallback resolve
 * to `undefined`, so fixtures without an `overpaymentResolution` round-trip cleanly.
 */
function inputFromPayload(payload: RecordedPayload): BuildPaymentPayloadInput {
  const legs = (payload.paymentLegs ?? []) as PaymentLeg[];
  return {
    settledNowAmount: payload.amountToCharge,
    totals: {
      subtotal: payload.totals.subtotal,
      manualDiscount: payload.totals.manualDiscount,
      promoDiscount: payload.totals.promoDiscount,
      afterDiscounts: payload.totals.afterDiscounts,
      taxRate: payload.totals.taxRate,
      taxAmount: payload.totals.taxAmount,
      vatTaxPercent: payload.totals.vatTaxPercent,
      vatValue: payload.totals.vatValue,
      giftCardApplied: payload.totals.giftCardApplied,
    },
    saleTotal: payload.totals.saleTotal,
    currencyConfig:
      payload.currencyCode != null
        ? { currencyCode: payload.currencyCode, currencyExRate: payload.currencyExRate ?? 1 }
        : null,
    effectiveOutstandingPolicy:
      payload.outstandingPolicy as BuildPaymentPayloadInput['effectiveOutstandingPolicy'],
    creditLimitOverride: payload.creditLimitOverride ?? false,
    cashDrawerRequired: payload.cashDrawerSessionId != null,
    selectedCashDrawerSessionId: payload.cashDrawerSessionId ?? '',
    taxProfileEntries: (payload.taxProfileIds ?? []).map((id) => ({ id, enabled: true })),
    settlementLegEntries: legs.map((leg) => ({ leg })),
    paymentLegs: legs,
    overpaymentResolutionPayload:
      (payload.overpaymentResolution ??
        null) as BuildPaymentPayloadInput['overpaymentResolutionPayload'],
    extraReceiptMode: 'adjust_legs',
    unresolvedOverpaymentAmount: 0,
    allocationPreviewId: null,
  };
}

const fixtureFiles = fs
  .readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

describe('payment payload oracle (Phase 2F)', () => {
  it('has all 8 baseline scenario fixtures', () => {
    expect(fixtureFiles).toEqual([
      'b2b-credit.json',
      'card-gateway.json',
      'cash-exact.json',
      'cash-with-change.json',
      'deferred-policy.json',
      'gift-card-pin.json',
      'overpayment-allocation.json',
      'split.json',
    ]);
  });

  it.each(fixtureFiles)(
    'rebuilds %s deep-identically through buildPaymentPayload',
    (file) => {
      const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
      const { payload } = JSON.parse(raw) as { payload: RecordedPayload };
      const rebuilt = buildPaymentPayload(inputFromPayload(payload));
      expect(rebuilt).toEqual(payload);
    }
  );
});
