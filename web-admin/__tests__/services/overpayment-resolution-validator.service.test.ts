/**
 * Tests: overpayment-resolution-validator.service.ts + settlement overpayment metrics
 */

import { buildSettlementPlan } from '@/lib/services/order-settlement-planner.service';
import { validateOverpaymentResolution } from '@/lib/services/overpayment-resolution-validator.service';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type { ResolvedSettlementLeg } from '@/lib/types/order-financial';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

const ORDER_ID = '00000000-0000-4000-8000-000000000001';
const CURRENCY = 'OMR';
const LEG_REF = '00000000-0000-4000-8000-000000000099';

function makeRealOption(overrides: Partial<ResolvedSettlementLeg['settlementOption']> = {}) {
  return {
    id: 'pm-1',
    paymentMethodCode: 'CASH',
    paymentNature: 'REAL_PAYMENT' as const,
    gatewayCode: null,
    creditApplicationType: null,
    requiresCashDrawer: true,
    supportsChangeReturn: true,
    supportsOverpayment: false,
    requiresReference: false,
    requiresTerminal: false,
    defaultCreationStatus: 'COMPLETED',
    allowStatusOverride: false,
    isUserIdRequired: false,
    allowedInPos: true,
    ...overrides,
  };
}

function makeLeg(
  option: ReturnType<typeof makeRealOption>,
  amount: number,
  extras: Partial<ResolvedSettlementLeg> = {}
): ResolvedSettlementLeg {
  return {
    settlementOption: option,
    amount,
    cashTendered: undefined,
    reference: undefined,
    terminalId: undefined,
    creditReferenceId: undefined,
    ...extras,
  };
}

function makeOriginalLeg(method: string, amount: number, extras: Partial<PaymentLeg> = {}): PaymentLeg {
  return {
    legRef: LEG_REF,
    method,
    amount,
    paymentStatus: 'COMPLETED',
    ...extras,
  } as PaymentLeg;
}

describe('validateOverpaymentResolution', () => {
  it('passes when excess is auto-resolved via cash change (unresolved = 0)', async () => {
    const cash = makeRealOption({
      paymentMethodCode: 'CASH',
      requiresCashDrawer: true,
      supportsChangeReturn: true,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      80,
      CURRENCY,
      [makeLeg(cash, 80, { cashTendered: 100 })],
      [makeOriginalLeg('CASH', 80)],
      'PAY_IN_ADVANCE'
    );

    expect(plan.unresolvedExcessAmount).toBe(0);
    expect(plan.cashChangeCapacity).toBe(20);
    await expect(validateOverpaymentResolution(plan, undefined)).resolves.toBeUndefined();
  });

  it('requires resolution when non-cash excess cannot be retained', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      supportsOverpayment: false,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      80,
      CURRENCY,
      [makeLeg(card, 100)],
      [makeOriginalLeg('CARD', 100)],
      'PAY_IN_ADVANCE'
    );

    expect(plan.excessAmount).toBe(20);
    expect(plan.unresolvedExcessAmount).toBe(20);
    await expect(validateOverpaymentResolution(plan, undefined)).rejects.toThrow(
      'OVERPAYMENT_RESOLUTION_REQUIRED'
    );
  });

  it('requires resolution when non-cash excess cannot be retained silently', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      supportsOverpayment: true,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      80,
      CURRENCY,
      [makeLeg(card, 100)],
      [makeOriginalLeg('CARD', 100)],
      'PAY_IN_ADVANCE'
    );

    expect(plan.excessAmount).toBe(20);
    expect(plan.unresolvedExcessAmount).toBe(20);
    await expect(validateOverpaymentResolution(plan, undefined)).rejects.toThrow(
      'OVERPAYMENT_RESOLUTION_REQUIRED'
    );
  });

  it('accepts SAVE_AS_CUSTOMER_ADVANCE when customer is linked', async () => {
    const card = makeRealOption({
      paymentMethodCode: 'CARD',
      requiresCashDrawer: false,
      supportsOverpayment: false,
    });
    const plan = buildSettlementPlan(
      ORDER_ID,
      80,
      CURRENCY,
      [makeLeg(card, 100)],
      [makeOriginalLeg('CARD', 100)],
      'PAY_IN_ADVANCE'
    );

    await expect(
      validateOverpaymentResolution(
        plan,
        {
          excessAmount: 20,
          lines: [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE, amount: 20 }],
        },
        { customerId: '00000000-0000-4000-8000-000000000010' }
      )
    ).resolves.toBeUndefined();
  });
});
