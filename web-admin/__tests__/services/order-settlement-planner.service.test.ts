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
import { buildSettlementPlan } from '@/lib/services/order-settlement-planner.service';

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
});
