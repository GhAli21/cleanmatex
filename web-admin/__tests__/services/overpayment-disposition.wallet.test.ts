/**
 * Tests: SAVE_TO_CUSTOMER_WALLET overpayment disposition.
 *
 * Regression coverage for validation-report Blocker-1 (2026-06-18): the wallet
 * checkout-excess path used to roll back the whole submit transaction because
 * the audit table's hardcoded CHECK omitted SAVE_TO_CUSTOMER_WALLET. Migration
 * 0378 replaced that CHECK with an FK to sys_fin_overpay_res_cd, and the catalog
 * already carries the code (asserted in settlement-catalog.test.ts).
 *
 * These are service-level tests with a mocked Prisma tx client — the repo's
 * unit-test convention (no live-DB harness in jest). Full HTTP/DB end-to-end is
 * covered by manual QA per the test guide.
 */

import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';

const topUpWalletTx = jest.fn();
const issueAdvanceTx = jest.fn();
const issueCreditNoteTx = jest.fn();

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...args: unknown[]) => topUpWalletTx(...args),
  issueAdvanceTx: (...args: unknown[]) => issueAdvanceTx(...args),
  issueCreditNoteTx: (...args: unknown[]) => issueCreditNoteTx(...args),
}));

const resolveTaxPricingMode = jest.fn();
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: (...args: unknown[]) => resolveTaxPricingMode(...args),
}));

import { executeOverpaymentDispositionTx } from '@/lib/services/overpayment-disposition.service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const CUSTOMER_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = 'user-001';

const walletResolution = {
  excessAmount: 20,
  lines: [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET, amount: 20 }],
};

function makeDispositionTx(existing: Array<{ id: string; target_ref: string | null }> = []) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(existing),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
}

describe('executeOverpaymentDispositionTx — SAVE_TO_CUSTOMER_WALLET', () => {
  beforeEach(() => {
    topUpWalletTx.mockReset();
    issueAdvanceTx.mockReset();
    issueCreditNoteTx.mockReset();
    topUpWalletTx.mockResolvedValue({ id: 'wallet-txn-1' });
  });

  it('credits the wallet and writes a SAVE_TO_CUSTOMER_WALLET audit row', async () => {
    const tx = makeDispositionTx();

    const result = await executeOverpaymentDispositionTx({
      tx: tx as never,
      tenantId: TENANT,
      userId: USER_ID,
      orderId: ORDER_ID,
      branchId: null,
      customerId: CUSTOMER_ID,
      currencyCode: 'OMR',
      voucherId: null,
      resolution: walletResolution as never,
      idempotencyKey: 'idem-1',
    });

    // Wallet credited exactly once with the excess amount.
    expect(topUpWalletTx).toHaveBeenCalledTimes(1);
    expect(topUpWalletTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: TENANT,
        customerId: CUSTOMER_ID,
        amount: 20,
        currencyCode: 'OMR',
        orderId: ORDER_ID,
      }),
    );

    // Audit row inserted carrying the wallet resolution code + wallet txn ref.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['SAVE_TO_CUSTOMER_WALLET', 'wallet-txn-1', 20]),
    );

    expect(result).toEqual([
      expect.objectContaining({
        resolutionCode: 'SAVE_TO_CUSTOMER_WALLET',
        amount: 20,
        targetRef: 'wallet-txn-1',
      }),
    ]);
  });

  it('is idempotent on replay: reuses the existing audit row, no double wallet credit', async () => {
    const tx = makeDispositionTx([{ id: 'existing-disp-1', target_ref: 'wallet-txn-existing' }]);

    const result = await executeOverpaymentDispositionTx({
      tx: tx as never,
      tenantId: TENANT,
      userId: USER_ID,
      orderId: ORDER_ID,
      branchId: null,
      customerId: CUSTOMER_ID,
      currencyCode: 'OMR',
      voucherId: null,
      resolution: walletResolution as never,
      idempotencyKey: 'idem-1',
    });

    expect(topUpWalletTx).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'existing-disp-1',
        resolutionCode: 'SAVE_TO_CUSTOMER_WALLET',
        targetRef: 'wallet-txn-existing',
      }),
    );
  });

  it('rejects wallet disposition when no customer is linked (walk-in)', async () => {
    const tx = makeDispositionTx();

    await expect(
      executeOverpaymentDispositionTx({
        tx: tx as never,
        tenantId: TENANT,
        userId: USER_ID,
        orderId: ORDER_ID,
        branchId: null,
        customerId: null,
        currencyCode: 'OMR',
        voucherId: null,
        resolution: walletResolution as never,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toThrow('OVERPAYMENT_RESOLUTION_NOT_ALLOWED');

    expect(topUpWalletTx).not.toHaveBeenCalled();
  });
});

/**
 * Recalc proof: a posted wallet-disposition audit row offsets the gross excess,
 * so org_orders_mst.overpaid_amount lands at 0 (rule 13 — overpaid = unresolved
 * excess only). Order total 80, one COMPLETED real payment of 100 ⇒ gross 20.
 */
function makeRecalcTx(disposedAmount: number) {
  return {
    org_orders_mst: {
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: ORDER_ID,
        branch_id: null,
        total_discount_amount: 0,
        total_tax_amount: 0,
        outstanding_amount: 0,
        payment_type_code: 'PAY_IN_ADVANCE',
        rounding_adjustment_amount: 0,
        total_amount: 80,
        currency_code: 'OMR',
        currency_ex_rate: null,
        base_cur_currency_code: null,
        tax_document_id: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    org_order_items_dtl: { aggregate: jest.fn().mockResolvedValue({ _sum: { total_price: 80 } }) },
    org_order_item_pieces_dtl: { aggregate: jest.fn().mockResolvedValue({ _sum: { service_pref_charge: 0 } }) },
    org_order_preferences_dtl: { aggregate: jest.fn().mockResolvedValue({ _sum: { extra_price: 0 } }) },
    org_order_charges_dtl: { findMany: jest.fn().mockResolvedValue([]) },
    org_order_discounts_dtl: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { discount_amount: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    org_order_taxes_dtl: { aggregate: jest.fn().mockResolvedValue({ _sum: { tax_amount: 0, taxable_amount: 0 } }) },
    org_order_payments_dtl: {
      findMany: jest.fn().mockResolvedValue([
        {
          amount: 100,
          payment_status: 'COMPLETED',
          payment_nature_snapshot: 'REAL_PAYMENT',
          payment_method_code: 'CASH',
          org_payment_method_id: null,
          gateway_code: null,
          gateway_reference: null,
          tendered_amount: null,
          check_no: null,
          bank_reference: null,
          change_returned_amount: 0,
        },
      ]),
    },
    org_order_credit_apps_dtl: { findMany: jest.fn().mockResolvedValue([]) },
    org_order_refunds_dtl: { findMany: jest.fn().mockResolvedValue([]) },
    org_invoice_orders_dtl: { findFirst: jest.fn().mockResolvedValue(null) },
    // Disposition sum read in recalculateOrderFinancialSnapshotTx.
    $queryRaw: jest.fn().mockResolvedValue([{ total: disposedAmount }]),
  };
}

describe('recalculateOrderFinancialSnapshotTx — wallet disposition zeroes overpaid_amount', () => {
  beforeEach(() => {
    resolveTaxPricingMode.mockReset();
    resolveTaxPricingMode.mockResolvedValue('TAX_EXCLUSIVE');
  });

  it('overpaid_amount = 0 when a SAVE_TO_CUSTOMER_WALLET disposition offsets the excess', async () => {
    const tx = makeRecalcTx(20);

    const result = await recalculateOrderFinancialSnapshotTx(tx as never, TENANT, ORDER_ID);

    expect(result.outstandingAmount).toBe(0);
    expect(tx.org_orders_mst.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ overpaid_amount: 0, outstanding_amount: 0 }),
      }),
    );
  });

  it('overpaid_amount = 20 without a disposition (proves the disposition is what zeroes it)', async () => {
    const tx = makeRecalcTx(0);

    await recalculateOrderFinancialSnapshotTx(tx as never, TENANT, ORDER_ID);

    expect(tx.org_orders_mst.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ overpaid_amount: 20 }),
      }),
    );
  });
});
