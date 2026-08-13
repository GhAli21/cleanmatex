/**
 * B28 follow-up #4 — preview-route vs. submit-orchestrator request-schema
 * parity, kept as a permanent regression guard.
 *
 * Background (2026-08-13): `previewPaymentRequestSchema` (used by both
 * `/api/v1/orders/preview-payment` and `/api/v1/orders/preview-financials`)
 * accepted a materially narrower input than `createWithPaymentRequestSchema`
 * (the real submit path). Because Zod's default `.object()` mode silently
 * STRIPS unrecognized keys rather than erroring, any field present on one and
 * absent on the other is a silent, non-throwing drop — the preview total can
 * diverge from the total actually charged with nothing failing loudly.
 *
 * The specific divergence found was `additionalTaxRate`/`additionalTaxAmount`:
 * an ad-hoc, client-supplied, order-level tax override that
 * `calculateOrderTotals` applied only when a tenant had no tax profile
 * configured. It was accepted on submit but impossible to send to preview.
 *
 * Resolution — the override was REMOVED rather than mirrored onto preview.
 * It was verified dead in practice before removal (`use-payment-totals.ts`
 * hardcodes the client's `totals.taxRate` to 0 in both branches of its totals
 * memo, so `use-order-submission.ts`'s `taxRate > 0` send condition could
 * never fire; no other caller in the repo sent either field). Removing it —
 * rather than adding the fields to the preview schema — eliminates the parity
 * gap permanently instead of requiring two schemas to be kept in sync forever,
 * and leaves tax with exactly two authoritative sources: configured tax
 * profiles, and the server-resolved `TENANT_VAT_RATE` fallback (already
 * zero-by-default per B15's "no invented tax" policy).
 *
 * These tests lock that in: they fail if anyone re-introduces a client-supplied
 * tax override on the submit path without also wiring it into preview.
 */
import {
  previewPaymentRequestSchema,
  createWithPaymentRequestSchema,
} from '@/lib/validations/new-order-payment-schemas';

const ITEM = {
  productId: '11111111-1111-4111-8111-111111111111',
  quantity: 1,
  pricePerUnit: 20,
  totalPrice: 20,
};

const SUBMIT_BASE = {
  customerId: 'cust-1',
  paymentMethod: 'CASH',
  items: [ITEM],
  clientTotals: { subtotal: 20, vatValue: 0, saleTotal: 20 },
};

describe('preview vs. submit request-schema parity (B28 follow-up #4)', () => {
  it('neither schema accepts a client-supplied ad-hoc tax override — tax comes from profiles or the server-resolved tenant rate only', () => {
    const override = { additionalTaxRate: 5, additionalTaxAmount: 1 };

    const preview = previewPaymentRequestSchema.safeParse({ items: [ITEM], ...override });
    expect(preview.success).toBe(true);
    if (preview.success) {
      expect('additionalTaxRate' in preview.data).toBe(false);
      expect('additionalTaxAmount' in preview.data).toBe(false);
    }

    const submit = createWithPaymentRequestSchema.safeParse({ ...SUBMIT_BASE, ...override });
    expect(submit.success).toBe(true);
    if (submit.success) {
      // The parity guarantee: what preview drops, submit must drop too.
      expect('additionalTaxRate' in submit.data).toBe(false);
      expect('additionalTaxAmount' in submit.data).toBe(false);
    }
  });

  it('taxProfileIds — the surviving canonical tax input — is accepted identically by both schemas', () => {
    const taxProfileIds = ['33333333-3333-4333-8333-333333333333'];

    const preview = previewPaymentRequestSchema.safeParse({ items: [ITEM], taxProfileIds });
    expect(preview.success).toBe(true);
    if (preview.success) expect(preview.data.taxProfileIds).toEqual(taxProfileIds);

    const submit = createWithPaymentRequestSchema.safeParse({ ...SUBMIT_BASE, taxProfileIds });
    expect(submit.success).toBe(true);
    if (submit.success) expect(submit.data.taxProfileIds).toEqual(taxProfileIds);
  });

  it('promoCodeId is still submit-only (accepted on submit, stripped by preview) — documented, not a money divergence', () => {
    // Unlike the tax override, this one does NOT cause a preview/submit total
    // mismatch: preview resolves promo discounts from `promoCode` (which it
    // does accept), and `promoCodeId` only pins which already-validated promo
    // row the submit path persists against. Asserted so the asymmetry stays
    // deliberate and visible rather than drifting unnoticed.
    const promoCodeId = '22222222-2222-4222-8222-222222222222';

    const preview = previewPaymentRequestSchema.safeParse({ items: [ITEM], promoCodeId });
    expect(preview.success).toBe(true);
    if (preview.success) expect('promoCodeId' in preview.data).toBe(false);

    const submit = createWithPaymentRequestSchema.safeParse({ ...SUBMIT_BASE, promoCodeId });
    expect(submit.success).toBe(true);
    if (submit.success) expect(submit.data.promoCodeId).toBe(promoCodeId);
  });

  it('serviceCategories is client-supplied on preview but server-derived on submit (from items[].serviceCategoryCode)', () => {
    // order-submit-orchestrator.service.ts derives this from the items array
    // rather than trusting a client-supplied list, so the submit schema has no
    // such field. Recorded as a deliberate, documented difference in
    // derivation source — not a divergence in the resulting tax base.
    const preview = previewPaymentRequestSchema.safeParse({
      items: [ITEM],
      serviceCategories: ['DRY_CLEAN'],
    });
    expect(preview.success).toBe(true);
    if (preview.success) expect(preview.data.serviceCategories).toEqual(['DRY_CLEAN']);

    const submit = createWithPaymentRequestSchema.safeParse({
      ...SUBMIT_BASE,
      serviceCategories: ['DRY_CLEAN'],
    });
    expect(submit.success).toBe(true);
    if (submit.success) expect('serviceCategories' in submit.data).toBe(false);
  });
});
