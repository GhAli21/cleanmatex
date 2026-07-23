/**
 * Tests: order-settlement-planner.service.ts (pure buildSettlementPlan only)
 *
 * Why these tests exist:
 * The planner classifies settlement legs into real-payment vs credit-application
 * buckets and decides whether the order requires a receipt voucher and/or AR
 * invoice. Its outputs gate downstream BVM wiring + AR allocation, so any
 * regression here corrupts the entire submit-order flow.
 *
 * Focused on the pure buildSettlementPlan() function — validateSettlementPlan
 * requires a Prisma transaction and is exercised via integration tests.
 */

// The planner module exports both buildSettlementPlan (pure) AND
// validateSettlementPlan (uses prisma). Mock prisma + tenant-context so the
// pure function under test loads in the jest env.
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    org_cash_drawer_sessions_mst: { findFirst: jest.fn() },
    org_payment_gateway_cf: { findFirst: jest.fn() },
    sys_payment_gateway_cd: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn(_id)
  ),
}));

import { PAYMENT_NATURE, CREDIT_APPLICATION_TYPES } from '@/lib/constants/order-financial';
import type { ResolvedSettlementLeg, SettlementOption } from '@/lib/types/order-financial';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import {
  buildSettlementPlan,
  validateSettlementPlan,
} from '@/lib/services/order-settlement-planner.service';
import { prisma } from '@/lib/db/prisma';

// --- fixtures ----------------------------------------------------------------

const ORDER_ID = '00000000-0000-0000-0000-000000000001';
const CURRENCY = 'OMR';

function makeRealOption(overrides: Partial<SettlementOption> = {}): SettlementOption {
  return {
    id: 'opt-real',
    paymentMethodCode: 'CASH',
    paymentNature: PAYMENT_NATURE.REAL_PAYMENT,
    gatewayCode: null,
    settlementTypeCode: null,
    creditApplicationType: null,
    requiresCashDrawer: true,
    requiresTerminal: false,
    supportsOverpayment: false,
    supportsChangeReturn: true,
    defaultCreationStatus: 'COMPLETED',
    allowStatusOverride: false,
    requiresReference: false,
    isUserIdRequired: false,
    allowedInPos: true,
    displayName: 'Cash',
    displayName2: null,
    minAmount: null,
    maxAmount: null,
    minOrderAmount: null,
    maxOrderAmount: null,
    isPlatformDisabled: false,
    isGloballyDisabled: false,
    ...overrides,
  };
}

function makeCreditOption(creditType: SettlementOption['creditApplicationType'] = CREDIT_APPLICATION_TYPES.WALLET): SettlementOption {
  return makeRealOption({
    id: 'opt-credit',
    paymentMethodCode: 'WALLET',
    paymentNature: PAYMENT_NATURE.CREDIT_APPLICATION,
    creditApplicationType: creditType,
    requiresCashDrawer: false,
  });
}

function makeLeg(option: SettlementOption, amount: number, extras: Partial<ResolvedSettlementLeg> = {}): ResolvedSettlementLeg {
  return {
    settlementOption: option,
    amount,
    cashTendered: undefined,
    terminalId: undefined,
    creditReferenceId: undefined,
    reference: undefined,
    ...extras,
  };
}

function makeOriginalLeg(method: string, amount: number, extras: Partial<PaymentLeg> = {}): PaymentLeg {
  return {
    method: method as PaymentLeg['method'],
    amount,
    ...extras,
  } as PaymentLeg;
}

// --- tests ------------------------------------------------------------------

describe('buildSettlementPlan', () => {
  it('happy path: single CASH leg → real payment, no AR invoice, voucher required', () => {
    const option = makeRealOption();
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(option, 100)],
      [makeOriginalLeg('CASH', 100)],
      'PAY_IN_ADVANCE',
      'session-1'
    );

    expect(plan.realPaymentLegs).toHaveLength(1);
    expect(plan.creditApplicationLegs).toHaveLength(0);
    expect(plan.realPaymentAmount).toBe(100);
    expect(plan.outstandingAmount).toBe(0);
    expect(plan.outstandingPolicy).toBe('NONE');
    expect(plan.shouldCreateReceiptVoucher).toBe(true);
    expect(plan.shouldCreateArInvoice).toBe(false);
    expect(plan.realPaymentLegs[0].cashDrawerSessionId).toBe('session-1');
    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('COMPLETED');
  });

  it('credit-application leg with valid type → no AR invoice, voucher required', () => {
    const option = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const plan = buildSettlementPlan(
      ORDER_ID,
      50,
      CURRENCY,
      [makeLeg(option, 50)],
      [makeOriginalLeg('WALLET', 50)],
      'PAY_IN_ADVANCE'
    );

    expect(plan.creditApplicationLegs).toHaveLength(1);
    expect(plan.creditApplicationLegs[0].creditType).toBe(CREDIT_APPLICATION_TYPES.WALLET);
    expect(plan.shouldCreateReceiptVoucher).toBe(true);
    expect(plan.outstandingPolicy).toBe('NONE');
  });

  it('throws CREDIT_APPLICATION_TYPE_REQUIRED when credit_application_type is null', () => {
    const option = makeCreditOption(null);
    expect(() =>
      buildSettlementPlan(
        ORDER_ID,
        50,
        CURRENCY,
        [makeLeg(option, 50)],
        [makeOriginalLeg('WALLET', 50)],
        'PAY_IN_ADVANCE'
      )
    ).toThrow('CREDIT_APPLICATION_TYPE_REQUIRED');
  });

  // B32 (M8) investigation: allow_status_override is captured on the leg but
  // deliberately NOT enforced against this explicit per-leg override — BVM
  // Phase 6 Sub-item 6 (B7 closer, see the "Phase 6 B7" tests below) already
  // shipped and tested "explicit PENDING always overrides the fallback,
  // regardless of config." Confirms that stays true even when
  // allow_status_override=false, so a future change cannot silently
  // reintroduce the M8 enforcement and regress checkout.
  it('explicit PENDING override is honored regardless of allow_status_override (B32 investigation)', () => {
    const option = makeRealOption({ defaultCreationStatus: 'COMPLETED', allowStatusOverride: false });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(option, 100)],
      [makeOriginalLeg('CASH', 100, { paymentStatus: 'PENDING' } as Partial<PaymentLeg>)],
      'PAY_IN_ADVANCE',
    );
    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('PENDING');
  });

  it('PAY_ON_COLLECTION (paymentTypeCode≠INVOICE): no payment legs → outstanding flows to PAY_ON_COLLECTION', () => {
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [], // no legs
      [],
      'PAY_ON_COLLECTION'
    );

    expect(plan.realPaymentLegs).toHaveLength(0);
    expect(plan.outstandingAmount).toBe(100);
    expect(plan.outstandingPolicy).toBe('PAY_ON_COLLECTION');
    expect(plan.shouldCreateReceiptVoucher).toBe(false);
    expect(plan.shouldCreateArInvoice).toBe(false);
  });

  it('INVOICE payment type with outstanding → outstandingPolicy=CREDIT_INVOICE and shouldCreateArInvoice=true', () => {
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [],
      [],
      'INVOICE'
    );

    expect(plan.outstandingAmount).toBe(100);
    expect(plan.outstandingPolicy).toBe('CREDIT_INVOICE');
    expect(plan.shouldCreateArInvoice).toBe(true);
    expect(plan.shouldCreateReceiptVoucher).toBe(false);
  });

  it('split CASH + WALLET fully covering total → no outstanding', () => {
    const cash = makeRealOption();
    const wallet = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(cash, 60), makeLeg(wallet, 40)],
      [makeOriginalLeg('CASH', 60), makeOriginalLeg('WALLET', 40)],
      'PAY_IN_ADVANCE',
      'session-1'
    );

    expect(plan.realPaymentAmount).toBe(60);
    expect(plan.creditAppliedAmount).toBe(40);
    expect(plan.immediateSettlementAmount).toBe(100);
    expect(plan.outstandingAmount).toBe(0);
    expect(plan.outstandingPolicy).toBe('NONE');
    expect(plan.shouldCreateReceiptVoucher).toBe(true);
  });

  it('legIndex is preserved from original ordering (idempotency key derivation depends on this)', () => {
    const cash = makeRealOption();
    const wallet = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(cash, 60), makeLeg(wallet, 40)],
      [makeOriginalLeg('CASH', 60), makeOriginalLeg('WALLET', 40)],
      'PAY_IN_ADVANCE',
      'session-1'
    );

    expect(plan.realPaymentLegs[0].legIndex).toBe(0);
    expect(plan.creditApplicationLegs[0].legIndex).toBe(1);
  });

  it('cashDrawerSessionId only attached when requiresCashDrawer=true', () => {
    const cardOption = makeRealOption({ paymentMethodCode: 'CARD', requiresCashDrawer: false });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(cardOption, 100)],
      [makeOriginalLeg('CARD', 100)],
      'PAY_IN_ADVANCE',
      'session-1'
    );

    expect(plan.realPaymentLegs[0].cashDrawerSessionId).toBeUndefined();
  });

  it('allows cash tendered above applied amount when change return is enabled', async () => {
    const option = makeRealOption({ supportsChangeReturn: true });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(option, 100, { cashTendered: 101 })],
      [makeOriginalLeg('CASH', 100, { cashTendered: 101 })],
      'PAY_IN_ADVANCE',
      'session-1'
    );
    (prisma.org_cash_drawer_sessions_mst.findFirst as jest.Mock).mockResolvedValue({ status: 'OPEN' });

    await expect(validateSettlementPlan(plan, 'tenant-1')).resolves.toBeUndefined();
  });

  it('blocks cash change when method policy disables change return', async () => {
    const option = makeRealOption({ supportsChangeReturn: false });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(option, 100, { cashTendered: 101 })],
      [makeOriginalLeg('CASH', 100, { cashTendered: 101 })],
      'PAY_IN_ADVANCE',
      'session-1'
    );

    await expect(validateSettlementPlan(plan, 'tenant-1')).rejects.toThrow('CASH_CHANGE_NOT_ALLOWED');
  });

  it('blocks non-cash over-application unless the method supports retained overpayment', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      supportsOverpayment: false,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(card, 101)],
      [makeOriginalLeg('CARD', 101)],
      'PAY_IN_ADVANCE'
    );

    await expect(validateSettlementPlan(plan, 'tenant-1')).rejects.toThrow('METHOD_OVERPAYMENT_NOT_ALLOWED');
  });

  it('check fields (checkNumber/checkBank/checkDate) are zipped from originalLegs', () => {
    const checkOption = makeRealOption({ paymentMethodCode: 'CHECK', requiresCashDrawer: false });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(checkOption, 100)],
      [makeOriginalLeg('CHECK', 100, {
        checkNumber: 'CHK001',
        checkBank:   'SomBank',
        checkDate:   '2026-05-28',
      })],
      'PAY_IN_ADVANCE'
    );

    expect(plan.realPaymentLegs[0].checkNumber).toBe('CHK001');
    expect(plan.realPaymentLegs[0].checkBank).toBe('SomBank');
    expect(plan.realPaymentLegs[0].checkDate).toBe('2026-05-28');
  });

  it('Phase 2: credit-application legs are sorted into STORED_VALUE_LOCK_ORDER regardless of caller ordering', () => {
    // Caller submits legs in REVERSE canonical order (loyalty → wallet → gift card).
    // Planner MUST emit them as gift card → wallet → loyalty so every concurrent
    // submit acquires balance-row locks in the same sequence (deadlock-free).
    const loyalty  = makeCreditOption(CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT);
    const wallet   = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const giftCard = makeCreditOption(CREDIT_APPLICATION_TYPES.GIFT_CARD);

    const plan = buildSettlementPlan(
      ORDER_ID,
      30,
      CURRENCY,
      [makeLeg(loyalty, 5), makeLeg(wallet, 15), makeLeg(giftCard, 10)],
      [
        makeOriginalLeg('LOYALTY_CREDIT', 5),
        makeOriginalLeg('WALLET', 15),
        makeOriginalLeg('GIFT_CARD', 10),
      ],
      'PAY_IN_ADVANCE'
    );

    expect(plan.creditApplicationLegs.map(l => l.creditType)).toEqual([
      CREDIT_APPLICATION_TYPES.GIFT_CARD,
      CREDIT_APPLICATION_TYPES.WALLET,
      CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT,
    ]);
    // Original legIndex values must survive the sort so downstream idempotency
    // keys (e.g. `${orderId}_sv_gc_${legIndex}`) remain stable per leg.
    expect(plan.creditApplicationLegs.map(l => l.legIndex)).toEqual([2, 1, 0]);
  });

  it('Phase 2: stable sort within the same credit type preserves caller legIndex', () => {
    // Two wallet legs (e.g. promo wallet + standard wallet) at indices 0 and 2.
    // Sort is stable → both end up before the gift-card leg at index 1, in
    // their original order.
    const wallet   = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const giftCard = makeCreditOption(CREDIT_APPLICATION_TYPES.GIFT_CARD);

    const plan = buildSettlementPlan(
      ORDER_ID,
      30,
      CURRENCY,
      [makeLeg(wallet, 5), makeLeg(giftCard, 10), makeLeg(wallet, 15)],
      [
        makeOriginalLeg('WALLET', 5),
        makeOriginalLeg('GIFT_CARD', 10),
        makeOriginalLeg('WALLET', 15),
      ],
      'PAY_IN_ADVANCE'
    );

    expect(plan.creditApplicationLegs.map(l => ({ type: l.creditType, idx: l.legIndex }))).toEqual([
      { type: CREDIT_APPLICATION_TYPES.GIFT_CARD,      idx: 1 },
      { type: CREDIT_APPLICATION_TYPES.WALLET,         idx: 0 },
      { type: CREDIT_APPLICATION_TYPES.WALLET,         idx: 2 },
    ]);
  });

  it('Phase 3: orchestrator-synthesized gift-card credit-application leg (no paymentLegs counterpart) classifies correctly with creditReferenceId preserved', () => {
    // Phase 3 (BVM Wiring): the orchestrator pushes a gift-card credit-app leg
    // onto settlementLegs WITHOUT a matching paymentLegs entry — the planner
    // zips `originalLegs[i]` defensively. For a CREDIT_APPLICATION leg the
    // planner only reads `leg.creditReferenceId`, so an undefined `orig` is
    // safe. This test pins that contract so a future planner refactor that
    // forces `orig` lookup for credit-apps doesn't silently break submit-order.
    const cash     = makeRealOption({ paymentMethodCode: 'CASH' });
    const giftCard = makeCreditOption(CREDIT_APPLICATION_TYPES.GIFT_CARD);
    const GIFT_CARD_ID = 'gc-99999999-9999-9999-9999-999999999999';

    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      // Two resolved legs (cash + synthesized gift-card)
      [
        makeLeg(cash, 80),
        makeLeg(giftCard, 20, { creditReferenceId: GIFT_CARD_ID }),
      ],
      // Only ONE original payment leg — gift-card has no counterpart
      [makeOriginalLeg('CASH', 80)],
      'PAY_IN_ADVANCE',
      'session-1',
    );

    expect(plan.realPaymentLegs).toHaveLength(1);
    expect(plan.realPaymentLegs[0].amount).toBe(80);
    expect(plan.creditApplicationLegs).toHaveLength(1);
    expect(plan.creditApplicationLegs[0].creditType).toBe(CREDIT_APPLICATION_TYPES.GIFT_CARD);
    expect(plan.creditApplicationLegs[0].amount).toBe(20);
    expect(plan.creditApplicationLegs[0].creditReferenceId).toBe(GIFT_CARD_ID);

    // The plan covers the full 100 → no outstanding, voucher required, no AR invoice.
    expect(plan.realPaymentAmount).toBe(80);
    expect(plan.creditAppliedAmount).toBe(20);
    expect(plan.immediateSettlementAmount).toBe(100);
    expect(plan.outstandingAmount).toBe(0);
    expect(plan.outstandingPolicy).toBe('NONE');
    expect(plan.shouldCreateReceiptVoucher).toBe(true);
    expect(plan.shouldCreateArInvoice).toBe(false);
  });

  it('Phase 3: mixed cash + wallet + gift-card → creditAppliedAmount sums ALL credit-apps (breakdown math correctness)', () => {
    // Phase 3 Step 6 changed `breakdown.creditsTotal` to `plan.creditAppliedAmount`
    // (was `serverTotals.giftCardApplied` only). This test pins the math the
    // orchestrator now relies on: gift-card + wallet sum into creditAppliedAmount.
    const cash     = makeRealOption({ paymentMethodCode: 'CASH' });
    const wallet   = makeCreditOption(CREDIT_APPLICATION_TYPES.WALLET);
    const giftCard = makeCreditOption(CREDIT_APPLICATION_TYPES.GIFT_CARD);

    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [
        makeLeg(cash, 40),
        makeLeg(wallet, 30),
        makeLeg(giftCard, 30, { creditReferenceId: 'gc-1' }),
      ],
      [
        makeOriginalLeg('CASH', 40),
        makeOriginalLeg('WALLET', 30),
        // gift-card synthesized — no counterpart
      ],
      'PAY_IN_ADVANCE',
      'session-1',
    );

    expect(plan.realPaymentAmount).toBe(40);
    expect(plan.creditAppliedAmount).toBe(60); // wallet 30 + gift-card 30
    expect(plan.immediateSettlementAmount).toBe(100);
    expect(plan.outstandingAmount).toBe(0);

    // Lock-order sort: GIFT_CARD (rank 0) precedes WALLET (rank 1) regardless
    // of caller order (here: wallet first in input, gift-card second).
    expect(plan.creditApplicationLegs.map(l => l.creditType)).toEqual([
      CREDIT_APPLICATION_TYPES.GIFT_CARD,
      CREDIT_APPLICATION_TYPES.WALLET,
    ]);
  });

  it('gateway leg resolves to PROCESSING by default-status fallback when D9 not set', () => {
    // defaultCreationStatus is empty string here → fallback kicks in
    const gateway = makeRealOption({
      paymentMethodCode: 'HYPERPAY',
      gatewayCode: 'HYPERPAY',
      defaultCreationStatus: '',
      requiresCashDrawer: false,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(gateway, 100)],
      [makeOriginalLeg('HYPERPAY', 100)],
      'PAY_IN_ADVANCE'
    );

    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('PROCESSING');
  });

  // ── BVM Phase 6 Sub-item 6 — explicit per-leg paymentStatus (B7 closer) ──
  it('Phase 6 B7: explicit PENDING on the original leg overrides the COMPLETED fallback', () => {
    // Cash leg WITHOUT a gateway code and WITH defaultCreationStatus=COMPLETED.
    // The pre-Phase-6 planner would resolve to COMPLETED for both the fallback
    // and the planner path. With the explicit field set to PENDING, the planner
    // must bypass both and persist PENDING.
    const cash = makeRealOption({ defaultCreationStatus: 'COMPLETED' });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(cash, 100)],
      [makeOriginalLeg('CASH', 100, { paymentStatus: 'PENDING' })],
      'PAY_IN_ADVANCE',
      'session-1',
    );

    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('PENDING');
  });

  it('Phase 6 B7: omitted paymentStatus on the original leg keeps the default COMPLETED', () => {
    // When the caller omits `paymentStatus`, Zod defaults it to 'COMPLETED'.
    // The planner must NOT treat 'COMPLETED' as an explicit override that
    // suppresses the gateway fallback — it stays the resolved-default path.
    const cash = makeRealOption({ defaultCreationStatus: 'COMPLETED' });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(cash, 100)],
      [makeOriginalLeg('CASH', 100, { paymentStatus: 'COMPLETED' })],
      'PAY_IN_ADVANCE',
      'session-1',
    );

    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('COMPLETED');
  });

  it('Phase 6 B7: explicit COMPLETED does NOT suppress the gateway-driven PROCESSING fallback for a gateway leg', () => {
    // Defense: a caller that sends paymentStatus=COMPLETED on a HYPERPAY leg
    // must NOT downgrade an inherently asynchronous gateway leg. Only an
    // explicit 'PENDING' bypasses the gateway fallback; 'COMPLETED' (the Zod
    // default) hands control back to the D9 / gateway resolution chain.
    const gateway = makeRealOption({
      paymentMethodCode: 'HYPERPAY',
      gatewayCode: 'HYPERPAY',
      defaultCreationStatus: '',
      requiresCashDrawer: false,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(gateway, 100)],
      [makeOriginalLeg('HYPERPAY', 100, { paymentStatus: 'COMPLETED' })],
      'PAY_IN_ADVANCE',
    );

    expect(plan.realPaymentLegs[0].resolvedPaymentStatus).toBe('PROCESSING');
  });

  it('validateSettlementPlan accepts CARD auth_code as required reference', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      requiresReference: true,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(card, 100, { authCode: 'AUTH-123' })],
      [makeOriginalLeg('CARD', 100, { auth_code: 'AUTH-123' })],
      'PAY_IN_ADVANCE'
    );

    await expect(validateSettlementPlan(plan, 'tenant-1')).resolves.toBeUndefined();
  });

  it('validateSettlementPlan blocks legs that require a terminal when terminalId is missing', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      requiresTerminal: true,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      100,
      CURRENCY,
      [makeLeg(card, 100)],
      [makeOriginalLeg('CARD', 100)],
      'PAY_IN_ADVANCE'
    );

    await expect(validateSettlementPlan(plan, 'tenant-1')).rejects.toThrow('PAYMENT_TERMINAL_REQUIRED');
  });
});
