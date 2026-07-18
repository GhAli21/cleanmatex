/**
 * Unit tests for B20 — lib/services/reconciliation/financial-integrity-checks.ts
 *
 * Covers:
 *   - TAX_CALCULATION            (line-level recompute + header roll-up)
 *   - DISCOUNT_VALIDATION        (rate range, cap, header roll-up)
 *   - REFUND_REOPEN_CONSISTENCY  (D003 v2 invariant 7 monitoring layer)
 */

const mockTaxesFindMany = jest.fn();
const mockDiscountsFindMany = jest.fn();
const mockOrdersFindMany = jest.fn();
const mockRefundsFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_taxes_dtl: { findMany: (...a: unknown[]) => mockTaxesFindMany(...a) },
    org_order_discounts_dtl: { findMany: (...a: unknown[]) => mockDiscountsFindMany(...a) },
    org_orders_mst: { findMany: (...a: unknown[]) => mockOrdersFindMany(...a) },
    org_order_refunds_dtl: { findMany: (...a: unknown[]) => mockRefundsFindMany(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { Decimal } from '@prisma/client/runtime/library';
import {
  checkDiscountValidation,
  checkRefundReopenConsistency,
  checkTaxCalculation,
} from '@/lib/services/reconciliation/financial-integrity-checks';

const TENANT = 'tenant-aaa';
const WINDOW = { periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31') };

beforeEach(() => jest.clearAllMocks());

describe('checkTaxCalculation', () => {
  it('returns [] when there are no tax lines in the window', async () => {
    mockTaxesFindMany.mockResolvedValue([]);
    expect(await checkTaxCalculation(TENANT, WINDOW)).toEqual([]);
  });

  it('flags a line whose tax_amount does not match taxable_amount * rate', async () => {
    mockTaxesFindMany
      .mockResolvedValueOnce([
        { id: 'tax-1', order_id: 'order-1', rate: new Decimal('0.05'), taxable_amount: new Decimal('100'), tax_amount: new Decimal('10') },
      ])
      // second call: all active lines for the order set (header roll-up)
      .mockResolvedValueOnce([
        { order_id: 'order-1', tax_amount: new Decimal('10') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_tax_amount: new Decimal('10') },
    ]);

    const issues = await checkTaxCalculation(TENANT, WINDOW);
    const lineIssue = issues.find((i) => i.affectedEntityId === 'tax-1');
    expect(lineIssue).toMatchObject({ checkName: 'TAX_CALCULATION', expectedValue: 5, actualValue: 10 });
  });

  it('flags a header whose total_tax_amount does not match the active tax-line sum', async () => {
    mockTaxesFindMany
      .mockResolvedValueOnce([
        { id: 'tax-1', order_id: 'order-1', rate: new Decimal('0.05'), taxable_amount: new Decimal('100'), tax_amount: new Decimal('5') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', tax_amount: new Decimal('5') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_tax_amount: new Decimal('7') },
    ]);

    const issues = await checkTaxCalculation(TENANT, WINDOW);
    const headerIssue = issues.find((i) => i.affectedEntityType === 'order');
    expect(headerIssue).toMatchObject({ checkName: 'TAX_CALCULATION', expectedValue: 7, actualValue: 5 });
  });

  it('is clean when the line recompute and header both match', async () => {
    mockTaxesFindMany
      .mockResolvedValueOnce([
        { id: 'tax-1', order_id: 'order-1', rate: new Decimal('0.05'), taxable_amount: new Decimal('100'), tax_amount: new Decimal('5') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', tax_amount: new Decimal('5') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_tax_amount: new Decimal('5') },
    ]);

    expect(await checkTaxCalculation(TENANT, WINDOW)).toEqual([]);
  });
});

describe('checkDiscountValidation', () => {
  it('returns [] when there are no discount rows in the window', async () => {
    mockDiscountsFindMany.mockResolvedValue([]);
    expect(await checkDiscountValidation(TENANT, WINDOW)).toEqual([]);
  });

  it('flags a PERCENTAGE discount_rate outside (0, 100]', async () => {
    mockDiscountsFindMany
      .mockResolvedValueOnce([
        { id: 'disc-1', order_id: 'order-1', discount_type: 'PERCENTAGE', discount_rate: new Decimal('150'), discount_amount: new Decimal('10') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', discount_amount: new Decimal('10') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_discount_amount: new Decimal('10'), items_base_amount: new Decimal('100'), total_charges_amount: new Decimal('0') },
    ]);

    const issues = await checkDiscountValidation(TENANT, WINDOW);
    expect(issues.some((i) => i.affectedEntityId === 'disc-1')).toBe(true);
  });

  it('does not flag FIXED_AMOUNT discounts for the rate-range rule', async () => {
    mockDiscountsFindMany
      .mockResolvedValueOnce([
        { id: 'disc-1', order_id: 'order-1', discount_type: 'FIXED_AMOUNT', discount_rate: null, discount_amount: new Decimal('10') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', discount_amount: new Decimal('10') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_discount_amount: new Decimal('10'), items_base_amount: new Decimal('100'), total_charges_amount: new Decimal('0') },
    ]);

    const issues = await checkDiscountValidation(TENANT, WINDOW);
    expect(issues.find((i) => i.affectedEntityId === 'disc-1')).toBeUndefined();
  });

  it('flags Σ discounts exceeding the discountable base (items + charges)', async () => {
    mockDiscountsFindMany
      .mockResolvedValueOnce([
        { id: 'disc-1', order_id: 'order-1', discount_type: 'FIXED_AMOUNT', discount_rate: null, discount_amount: new Decimal('150') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', discount_amount: new Decimal('150') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_discount_amount: new Decimal('150'), items_base_amount: new Decimal('100'), total_charges_amount: new Decimal('0') },
    ]);

    const issues = await checkDiscountValidation(TENANT, WINDOW);
    expect(issues.some((i) => i.message.includes('exceeds the discountable base'))).toBe(true);
  });

  it('flags Σ discounts not matching header total_discount_amount', async () => {
    mockDiscountsFindMany
      .mockResolvedValueOnce([
        { id: 'disc-1', order_id: 'order-1', discount_type: 'FIXED_AMOUNT', discount_rate: null, discount_amount: new Decimal('10') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', discount_amount: new Decimal('10') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_discount_amount: new Decimal('20'), items_base_amount: new Decimal('100'), total_charges_amount: new Decimal('0') },
    ]);

    const issues = await checkDiscountValidation(TENANT, WINDOW);
    expect(issues.some((i) => i.message.includes('does not match header total_discount_amount'))).toBe(true);
  });

  it('is clean when rate, cap, and header all agree', async () => {
    mockDiscountsFindMany
      .mockResolvedValueOnce([
        { id: 'disc-1', order_id: 'order-1', discount_type: 'PERCENTAGE', discount_rate: new Decimal('10'), discount_amount: new Decimal('10') },
      ])
      .mockResolvedValueOnce([
        { order_id: 'order-1', discount_amount: new Decimal('10') },
      ]);
    mockOrdersFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-1', total_discount_amount: new Decimal('10'), items_base_amount: new Decimal('100'), total_charges_amount: new Decimal('0') },
    ]);

    expect(await checkDiscountValidation(TENANT, WINDOW)).toEqual([]);
  });
});

describe('checkRefundReopenConsistency', () => {
  it('returns [] when there are no positive-reopen refund rows', async () => {
    mockRefundsFindMany.mockResolvedValue([]);
    expect(await checkRefundReopenConsistency(TENANT, WINDOW)).toEqual([]);
  });

  it('does not flag a positive reopen on REFUND_AND_REBILL', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'refund-1', order_id: 'order-1', refund_context: 'REFUND_AND_REBILL', reopens_due_amount: new Decimal('25') },
    ]);
    expect(await checkRefundReopenConsistency(TENANT, WINDOW)).toEqual([]);
  });

  it('does not flag a positive reopen on MANUAL_EXCEPTION', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'refund-1', order_id: 'order-1', refund_context: 'MANUAL_EXCEPTION', reopens_due_amount: new Decimal('25') },
    ]);
    expect(await checkRefundReopenConsistency(TENANT, WINDOW)).toEqual([]);
  });

  it('flags a positive reopen on a commercial context (STANDARD) — D003 v2 violation', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'refund-1', order_id: 'order-1', refund_context: 'STANDARD', reopens_due_amount: new Decimal('25') },
    ]);

    const issues = await checkRefundReopenConsistency(TENANT, WINDOW);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      checkName: 'REFUND_REOPEN_CONSISTENCY',
      severity: 'BLOCKER',
      affectedEntityId: 'refund-1',
    });
  });

  it('flags a positive reopen on CANCELLATION_UNWIND (only REBILL/MANUAL are allowed)', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'refund-1', order_id: 'order-1', refund_context: 'CANCELLATION_UNWIND', reopens_due_amount: new Decimal('25') },
    ]);

    const issues = await checkRefundReopenConsistency(TENANT, WINDOW);
    expect(issues).toHaveLength(1);
  });
});
