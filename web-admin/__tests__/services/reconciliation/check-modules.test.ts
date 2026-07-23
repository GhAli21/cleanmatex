/**
 * Unit tests for BVM Phase 4 reconciliation check modules.
 *
 * Covers (PRD §22.1):
 *   - lib/services/reconciliation/ar-checks.ts
 *   - lib/services/reconciliation/stored-value-checks.ts
 *   - lib/services/reconciliation/order-checks.ts
 *   - lib/services/reconciliation/order-snapshot-checks.ts
 *   - lib/services/reconciliation/voucher-checks.ts
 *   - lib/services/voucher-reconciliation.service.ts
 *
 * Per-module tests assert:
 *   - happy path emits the right CheckResult shape
 *   - violation path produces a BLOCKER with the correct checkName + delta
 *   - empty-input short-circuit returns []
 *
 * Plus one tenant-isolation test that confirms tenantOrgId is forwarded into
 * the Prisma `where` clause so a check for tenant A cannot see tenant B's
 * drift (defense-in-depth on top of RLS).
 */

const mockOrderPaymentsFindMany = jest.fn();
const mockCreditAppsFindMany = jest.fn();
const mockCreditAppsAggregate = jest.fn();
const mockRefundsFindMany = jest.fn();
const mockRefundsAggregate = jest.fn();
const mockChargesAggregate = jest.fn();
const mockChargesFindMany = jest.fn();
const mockItemsFindMany = jest.fn();
const mockPiecesFindMany = jest.fn();
const mockPreferencesFindMany = jest.fn();
const mockDiscountsFindMany = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockOrderFindMany = jest.fn();
const mockWalletsFindMany = jest.fn();
const mockWalletTxnFindMany = jest.fn();
const mockWalletTxnAggregate = jest.fn();
const mockAdvanceTxnFindMany = jest.fn();
const mockGiftCardTxnFindMany = jest.fn();
const mockCreditNoteTxnFindMany = jest.fn();
const mockLoyaltyTxnFindMany = jest.fn();
const mockInvoicePaymentsFindMany = jest.fn();
const mockVouchersFindMany = jest.fn();
const mockVoucherFindFirstOrThrow = jest.fn();
const mockTrxLinesFindMany = jest.fn();
const mockCashMovementsFindMany = jest.fn();
const mockOutboxCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_payments_dtl: { findMany: (...a: unknown[]) => mockOrderPaymentsFindMany(...a) },
    org_order_credit_apps_dtl: {
      findMany: (...a: unknown[]) => mockCreditAppsFindMany(...a),
      aggregate: (...a: unknown[]) => mockCreditAppsAggregate(...a),
    },
    org_order_refunds_dtl: {
      findMany: (...a: unknown[]) => mockRefundsFindMany(...a),
      aggregate: (...a: unknown[]) => mockRefundsAggregate(...a),
    },
    org_order_charges_dtl: {
      aggregate: (...a: unknown[]) => mockChargesAggregate(...a),
      findMany: (...a: unknown[]) => mockChargesFindMany(...a),
    },
    org_order_items_dtl: { findMany: (...a: unknown[]) => mockItemsFindMany(...a) },
    org_order_item_pieces_dtl: { findMany: (...a: unknown[]) => mockPiecesFindMany(...a) },
    org_order_preferences_dtl: { findMany: (...a: unknown[]) => mockPreferencesFindMany(...a) },
    org_order_discounts_dtl: { findMany: (...a: unknown[]) => mockDiscountsFindMany(...a) },
    org_orders_mst: {
      findUnique: (...a: unknown[]) => mockOrderFindUnique(...a),
      findMany: (...a: unknown[]) => mockOrderFindMany(...a),
    },
    org_customer_wallets_mst: { findMany: (...a: unknown[]) => mockWalletsFindMany(...a) },
    org_wallet_txn_dtl: {
      findMany: (...a: unknown[]) => mockWalletTxnFindMany(...a),
      aggregate: (...a: unknown[]) => mockWalletTxnAggregate(...a),
    },
    org_advance_txn_dtl: { findMany: (...a: unknown[]) => mockAdvanceTxnFindMany(...a) },
    org_gift_card_txn_dtl: { findMany: (...a: unknown[]) => mockGiftCardTxnFindMany(...a) },
    org_credit_note_txn_dtl: { findMany: (...a: unknown[]) => mockCreditNoteTxnFindMany(...a) },
    org_loyalty_txn_dtl: { findMany: (...a: unknown[]) => mockLoyaltyTxnFindMany(...a) },
    org_invoice_payments_dtl: { findMany: (...a: unknown[]) => mockInvoicePaymentsFindMany(...a) },
    org_fin_vouchers_mst: {
      findMany: (...a: unknown[]) => mockVouchersFindMany(...a),
      findFirstOrThrow: (...a: unknown[]) => mockVoucherFindFirstOrThrow(...a),
    },
    org_fin_voucher_trx_lines_dtl: { findMany: (...a: unknown[]) => mockTrxLinesFindMany(...a) },
    org_cash_drawer_movements_dtl: { findMany: (...a: unknown[]) => mockCashMovementsFindMany(...a) },
    org_domain_events_outbox: { count: (...a: unknown[]) => mockOutboxCount(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { Decimal } from '@prisma/client/runtime/library';

import {
  checkInvoicePaymentLink,
  checkRefundLink,
} from '@/lib/services/reconciliation/ar-checks';
import {
  checkAdvanceLedgerLink,
  checkCreditNoteLedgerLink,
  checkGiftCardLedgerLink,
  checkLoyaltyLedgerLink,
  checkWalletBalanceMatchesLedger,
  checkWalletLedgerLink,
} from '@/lib/services/reconciliation/stored-value-checks';
import {
  checkBaseCurrencyRatePresent,
  checkBaseVsOrderAmountConsistency,
  checkCreditAppLifecycleConsistency,
  checkOrderCreditApplicationAmountMatchesLine,
  checkOrderCreditApplicationLink,
  checkOrderCreditApplicationNotInDiscounts,
  checkOrderCreditApplicationNotInPayments,
  checkPaymentTargetVsOrderTotals,
  checkOrderPaymentAmountMatchesLine,
  checkOrderPaymentLink,
  checkOutboxStuck,
  runOrderBalanceChecks,
} from '@/lib/services/reconciliation/order-checks';
import { runOrderSnapshotChecks } from '@/lib/services/reconciliation/order-snapshot-checks';
import {
  checkCancelledPaymentNoOrphanMovement,
  checkCashMovementAmountEqualsRetained,
  checkCashMovementLink,
  runVoucherIntegrityChecks,
} from '@/lib/services/reconciliation/voucher-checks';
import { reconcileVoucher } from '@/lib/services/voucher-reconciliation.service';

const TENANT = 'tenant-aaa';
const WINDOW = { periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31') };

beforeEach(() => jest.clearAllMocks());

// ── ar-checks ─────────────────────────────────────────────────────────────
describe('ar-checks', () => {
  it('INVOICE_PAYMENT_LINK_EXISTS — flags allocation with no voucher_id', async () => {
    mockInvoicePaymentsFindMany.mockResolvedValue([
      { id: 'a1', invoice_id: 'inv-1', allocation_no: 1, allocated_amount: new Decimal('100') },
    ]);
    const result = await checkInvoicePaymentLink(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      checkName: 'INVOICE_PAYMENT_LINK_EXISTS',
      severity: 'BLOCKER',
      affectedEntityType: 'invoice_payment_allocation',
      affectedEntityId: 'a1',
    });
  });

  it('INVOICE_PAYMENT_LINK_EXISTS — empty set returns []', async () => {
    mockInvoicePaymentsFindMany.mockResolvedValue([]);
    expect(await checkInvoicePaymentLink(TENANT, WINDOW)).toEqual([]);
  });

  it('REFUND_LINK_EXISTS — flags PROCESSED refund without REFUND_VOUCHER', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001' },
    ]);
    mockVouchersFindMany.mockResolvedValue([]);
    const result = await checkRefundLink(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0].checkName).toBe('REFUND_LINK_EXISTS');
  });

  it('REFUND_LINK_EXISTS — clean when matching POSTED voucher exists', async () => {
    mockRefundsFindMany.mockResolvedValue([
      { id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001' },
    ]);
    mockVouchersFindMany.mockResolvedValue([{ order_id: 'o1' }]);
    expect(await checkRefundLink(TENANT, WINDOW)).toEqual([]);
  });

  // B9 — unambiguous mode (fin_voucher_id backlink present, migration 0418).
  it('REFUND_LINK_EXISTS (B9) — clean when fin_voucher_id resolves to a POSTED voucher and CASH has a linked movement', async () => {
    mockRefundsFindMany.mockResolvedValue([
      {
        id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001',
        refund_method_code: 'CASH', fin_voucher_id: 'vch-1', cash_drawer_movement_id: 'mvt-1',
      },
    ]);
    mockVouchersFindMany.mockResolvedValue([{ id: 'vch-1' }]);
    expect(await checkRefundLink(TENANT, WINDOW)).toEqual([]);
  });

  it('REFUND_LINK_EXISTS (B9) — flags a CASH refund with a posted voucher but no linked cash-drawer movement', async () => {
    mockRefundsFindMany.mockResolvedValue([
      {
        id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001',
        refund_method_code: 'CASH', fin_voucher_id: 'vch-1', cash_drawer_movement_id: null,
      },
    ]);
    mockVouchersFindMany.mockResolvedValue([{ id: 'vch-1' }]);
    const result = await checkRefundLink(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('no linked cash-drawer movement');
  });

  it('REFUND_LINK_EXISTS (B9) — flags fin_voucher_id pointing at a voucher that is not POSTED', async () => {
    mockRefundsFindMany.mockResolvedValue([
      {
        id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001',
        refund_method_code: 'ORIGINAL_METHOD', fin_voucher_id: 'vch-missing', cash_drawer_movement_id: null,
      },
    ]);
    mockVouchersFindMany.mockResolvedValue([]); // vch-missing not found/not POSTED
    const result = await checkRefundLink(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('not a POSTED REFUND_VOUCHER');
  });

  it('REFUND_LINK_EXISTS (B9) — ORIGINAL_METHOD with a posted voucher never requires a cash-drawer movement', async () => {
    mockRefundsFindMany.mockResolvedValue([
      {
        id: 'r1', order_id: 'o1', refund_amount: new Decimal('50'), refund_no: 'REF-001',
        refund_method_code: 'ORIGINAL_METHOD', fin_voucher_id: 'vch-1', cash_drawer_movement_id: null,
      },
    ]);
    mockVouchersFindMany.mockResolvedValue([{ id: 'vch-1' }]);
    expect(await checkRefundLink(TENANT, WINDOW)).toEqual([]);
  });
});

// ── stored-value-checks ───────────────────────────────────────────────────
describe('stored-value-checks', () => {
  it('STORED_VALUE_LEDGER — flags wallet balance drift', async () => {
    mockWalletsFindMany.mockResolvedValue([{ id: 'w1', balance: new Decimal('100') }]);
    mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('90') } });
    const result = await checkWalletBalanceMatchesLedger(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ checkName: 'STORED_VALUE_LEDGER', severity: 'BLOCKER' });
  });

  it('STORED_VALUE_LEDGER — clean when ledger sum equals balance', async () => {
    mockWalletsFindMany.mockResolvedValue([{ id: 'w1', balance: new Decimal('100') }]);
    mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('100') } });
    expect(await checkWalletBalanceMatchesLedger(TENANT)).toEqual([]);
  });

  it('WALLET_LEDGER_LINK_EXISTS — filters by REDEMPTION txn_type', async () => {
    mockWalletTxnFindMany.mockResolvedValue([
      { id: 't1', amount: new Decimal('25') },
    ]);
    await checkWalletLedgerLink(TENANT, WINDOW);
    const where = mockWalletTxnFindMany.mock.calls[0][0].where;
    expect(where.txn_type).toBe('REDEMPTION');
    expect(where.fin_voucher_id).toBeNull();
  });

  it('GIFT_CARD_LEDGER_LINK_EXISTS — uses transaction_type column', async () => {
    mockGiftCardTxnFindMany.mockResolvedValue([]);
    await checkGiftCardLedgerLink(TENANT, WINDOW);
    const where = mockGiftCardTxnFindMany.mock.calls[0][0].where;
    expect(where.transaction_type).toBe('REDEEM');
  });

  it('LOYALTY_LEDGER_LINK_EXISTS — uses points field, REDEEM txn_type', async () => {
    mockLoyaltyTxnFindMany.mockResolvedValue([
      { id: 'lt1', points: new Decimal('200') },
    ]);
    const result = await checkLoyaltyLedgerLink(TENANT, WINDOW);
    expect(result[0]).toMatchObject({
      checkName: 'LOYALTY_LEDGER_LINK_EXISTS',
      actualValue: 200,
    });
    const where = mockLoyaltyTxnFindMany.mock.calls[0][0].where;
    expect(where.txn_type).toBe('REDEEM');
  });

  it('ADVANCE_LEDGER_LINK_EXISTS — empty result returns []', async () => {
    mockAdvanceTxnFindMany.mockResolvedValue([]);
    expect(await checkAdvanceLedgerLink(TENANT, WINDOW)).toEqual([]);
  });

  it('CREDIT_NOTE_LEDGER_LINK_EXISTS — empty result returns []', async () => {
    mockCreditNoteTxnFindMany.mockResolvedValue([]);
    expect(await checkCreditNoteLedgerLink(TENANT, WINDOW)).toEqual([]);
  });
});

// ── order-checks ──────────────────────────────────────────────────────────
describe('order-checks', () => {
  const orderRow = {
    id: 'o1',
    order_no: 'ORD-001',
    total: new Decimal('100'),
    total_paid_amount: new Decimal('100'),
    total_credit_applied_amount: new Decimal('0'),
    outstanding_amount: new Decimal('0'),
    payment_status: 'PAID',
    payment_type_code: null,
    pay_on_collection_amount: null,
  };

  it('PAYMENT_TOTAL_MATCH — flags payment sum mismatch', async () => {
    // B02: balance checks now fetch raw fact rows and derive components via
    // the shared D005 aggregation module (nature-filtered payments, APPLIED
    // credits, PROCESSED refund reopens).
    mockOrderPaymentsFindMany.mockResolvedValue([
      {
        amount: new Decimal('80'),
        payment_status: 'COMPLETED',
        payment_nature_snapshot: 'REAL_PAYMENT',
        payment_method_code: 'CASH',
        gateway_code: null,
      },
    ]);
    mockCreditAppsFindMany.mockResolvedValue([]);
    mockRefundsFindMany.mockResolvedValue([]);

    const result = await runOrderBalanceChecks(TENANT, [orderRow]);
    expect(result.find((r) => r.checkName === 'PAYMENT_TOTAL_MATCH')).toBeDefined();
  });

  it('OUTSTANDING_TOTAL_MATCH — a commercial refund no longer reopens due (D005/D003 v2)', async () => {
    // Fully-paid 100 order with a processed commercial refund (reopen 0):
    // header outstanding 0 must reconcile clean — pre-B02 the "+ processed
    // refunds" term made this a permanent false blocker (audit C2).
    mockOrderPaymentsFindMany.mockResolvedValue([
      {
        amount: new Decimal('100'),
        payment_status: 'COMPLETED',
        payment_nature_snapshot: 'REAL_PAYMENT',
        payment_method_code: 'CASH',
        gateway_code: null,
      },
    ]);
    mockCreditAppsFindMany.mockResolvedValue([]);
    mockRefundsFindMany.mockResolvedValue([
      { refund_amount: new Decimal('40'), refund_status: 'PROCESSED', reopens_due_amount: new Decimal('0') },
    ]);

    const result = await runOrderBalanceChecks(TENANT, [
      {
        ...orderRow,
        total_amount: new Decimal('100'),
        total_paid_amount: new Decimal('100'),
        outstanding_amount: new Decimal('0'),
      },
    ]);
    expect(result.find((r) => r.checkName === 'OUTSTANDING_TOTAL_MATCH')).toBeUndefined();
  });

  it('OUTSTANDING_TOTAL_MATCH — an explicit reopen row must be reflected in the header', async () => {
    // REFUND_AND_REBILL row (reopen 40) while the header still claims 0
    // outstanding → the module-derived expectation (40) flags the drift.
    mockOrderPaymentsFindMany.mockResolvedValue([
      {
        amount: new Decimal('100'),
        payment_status: 'COMPLETED',
        payment_nature_snapshot: 'REAL_PAYMENT',
        payment_method_code: 'CASH',
        gateway_code: null,
      },
    ]);
    mockCreditAppsFindMany.mockResolvedValue([]);
    mockRefundsFindMany.mockResolvedValue([
      { refund_amount: new Decimal('40'), refund_status: 'PROCESSED', reopens_due_amount: new Decimal('40') },
    ]);

    const result = await runOrderBalanceChecks(TENANT, [
      {
        ...orderRow,
        total_amount: new Decimal('100'),
        total_paid_amount: new Decimal('100'),
        outstanding_amount: new Decimal('0'),
      },
    ]);
    expect(result.find((r) => r.checkName === 'OUTSTANDING_TOTAL_MATCH')).toMatchObject({
      expectedValue: 40,
      actualValue: 0,
    });
  });

  it('OUTBOX_PROCESSED — fires WARNING when stuck > 1h', async () => {
    mockOutboxCount.mockResolvedValue(5);
    const result = await checkOutboxStuck(TENANT);
    expect(result[0]).toMatchObject({ checkName: 'OUTBOX_PROCESSED', severity: 'WARNING' });
  });

  it('ORDER_PAYMENT_LINK_EXISTS — flags null backlink', async () => {
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', amount: new Decimal('50'), payment_method_code: 'CASH' },
    ]);
    const result = await checkOrderPaymentLink(TENANT, WINDOW);
    expect(result[0].checkName).toBe('ORDER_PAYMENT_LINK_EXISTS');
  });

  it('ORDER_PAYMENT_AMOUNT_MATCHES_LINE — flags amount mismatch with trx line', async () => {
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', amount: new Decimal('50'), fin_voucher_trx_line_id: 'L1' },
    ]);
    mockTrxLinesFindMany.mockResolvedValue([{ id: 'L1', amount: new Decimal('45') }]);
    const result = await checkOrderPaymentAmountMatchesLine(TENANT, WINDOW);
    expect(result[0]).toMatchObject({
      checkName: 'ORDER_PAYMENT_AMOUNT_MATCHES_LINE',
      expectedValue: 45,
      actualValue: 50,
    });
  });

  it('ORDER_PAYMENT_AMOUNT_MATCHES_LINE — flags missing trx line as dangling FK', async () => {
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', amount: new Decimal('50'), fin_voucher_trx_line_id: 'L-missing' },
    ]);
    mockTrxLinesFindMany.mockResolvedValue([]);
    const result = await checkOrderPaymentAmountMatchesLine(TENANT, WINDOW);
    expect(result[0].message).toContain('does not exist');
  });

  it('PAYMENT_TARGET_VS_ORDER_TOTALS — flags ORDER_PAYMENT voucher line without an order payment row', async () => {
    mockTrxLinesFindMany.mockResolvedValueOnce([
      { id: 'L1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1' },
    ]);
    mockOrderPaymentsFindMany.mockResolvedValueOnce([]);
    mockOrderPaymentsFindMany.mockResolvedValueOnce([]);
    mockOrderFindMany.mockResolvedValueOnce([
      { id: 'o1', order_no: 'ORD-001', total_paid_amount: new Decimal('0') },
    ]);

    const result = await checkPaymentTargetVsOrderTotals(TENANT, WINDOW);
    expect(result[0]).toMatchObject({
      checkName: 'PAYMENT_TARGET_VS_ORDER_TOTALS',
      affectedEntityType: 'voucher_trx_line',
      affectedEntityId: 'L1',
    });
  });

  it('ORDER_CREDIT_APPLICATION_LINK_EXISTS — empty returns []', async () => {
    mockCreditAppsFindMany.mockResolvedValue([]);
    expect(await checkOrderCreditApplicationLink(TENANT, WINDOW)).toEqual([]);
  });

  it('ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE — clean within tolerance', async () => {
    mockCreditAppsFindMany.mockResolvedValue([
      { id: 'a1', order_id: 'o1', credit_type: 'WALLET', applied_amount: new Decimal('20'), fin_voucher_trx_line_id: 'L1' },
    ]);
    mockTrxLinesFindMany.mockResolvedValue([{ id: 'L1', amount: new Decimal('20') }]);
    expect(await checkOrderCreditApplicationAmountMatchesLine(TENANT, WINDOW)).toEqual([]);
  });

  it('ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS — flags trx line collision', async () => {
    mockCreditAppsFindMany.mockResolvedValue([
      { id: 'a1', order_id: 'o1', credit_type: 'WALLET', applied_amount: new Decimal('10'), fin_voucher_trx_line_id: 'L1' },
    ]);
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p-bad', order_id: 'o1', fin_voucher_trx_line_id: 'L1' },
    ]);
    const result = await checkOrderCreditApplicationNotInPayments(TENANT, WINDOW);
    expect(result[0].checkName).toBe('ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS');
  });

  it('ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS — flags WALLET discount source', async () => {
    mockCreditAppsFindMany.mockResolvedValue([{ order_id: 'o1' }]);
    mockDiscountsFindMany.mockResolvedValue([
      { id: 'd1', order_id: 'o1', source_type: 'WALLET', discount_amount: new Decimal('15') },
    ]);
    const result = await checkOrderCreditApplicationNotInDiscounts(TENANT, WINDOW);
    expect(result[0].checkName).toBe('ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS');
  });

  it('CREDIT_APP_LIFECYCLE_CONSISTENCY — flags failed bucket drift against the order header', async () => {
    mockTrxLinesFindMany.mockResolvedValueOnce([]);
    mockCreditAppsFindMany.mockResolvedValueOnce([
      {
        id: 'a-window',
        order_id: 'o1',
        applied_amount: new Decimal('10'),
        application_status: 'APPLIED',
        fin_voucher_trx_line_id: 'L1',
      },
    ]);
    mockTrxLinesFindMany.mockResolvedValueOnce([
      { id: 'L1', line_role: 'ORDER_CREDIT_APPLICATION', target_type: 'ORDER', target_id: 'o1' },
    ]);
    mockCreditAppsFindMany.mockResolvedValueOnce([
      { id: 'a1', order_id: 'o1', applied_amount: new Decimal('10'), application_status: 'APPLIED', fin_voucher_trx_line_id: 'L1' },
      { id: 'a2', order_id: 'o1', applied_amount: new Decimal('4'), application_status: 'PENDING', fin_voucher_trx_line_id: 'L2' },
      { id: 'a3', order_id: 'o1', applied_amount: new Decimal('3'), application_status: 'FAILED', fin_voucher_trx_line_id: 'L3' },
    ]);
    mockOrderFindMany.mockResolvedValueOnce([
      {
        id: 'o1',
        order_no: 'ORD-001',
        total_credit_applied_amount: new Decimal('10'),
        pending_credit_application_amount: new Decimal('4'),
        failed_credit_application_amount: new Decimal('1'),
      },
    ]);
    mockTrxLinesFindMany.mockResolvedValueOnce([
      { id: 'L1', line_role: 'ORDER_CREDIT_APPLICATION', target_type: 'ORDER', target_id: 'o1' },
      { id: 'L2', line_role: 'ORDER_CREDIT_APPLICATION', target_type: 'ORDER', target_id: 'o1' },
      { id: 'L3', line_role: 'ORDER_CREDIT_APPLICATION', target_type: 'ORDER', target_id: 'o1' },
    ]);

    const result = await checkCreditAppLifecycleConsistency(TENANT, WINDOW);
    expect(result.find((row) => row.checkName === 'CREDIT_APP_LIFECYCLE_CONSISTENCY')).toMatchObject({
      expectedValue: 1,
      actualValue: 3,
      affectedEntityType: 'order',
      affectedEntityId: 'o1',
    });
  });

  it('BASE_CURRENCY_RATE_PRESENT — flags zero exchange rate', async () => {
    mockOrderFindMany.mockResolvedValueOnce([
      { id: 'o1', order_no: 'ORD-001', currency_ex_rate: new Decimal('0') },
    ]);

    const result = await checkBaseCurrencyRatePresent(TENANT, WINDOW);
    expect(result[0]).toMatchObject({
      checkName: 'BASE_CURRENCY_RATE_PRESENT',
      severity: 'BLOCKER',
      affectedEntityId: 'o1',
    });
  });

  it('BASE_VS_ORDER_AMOUNT_CONSISTENCY — flags base amount drift', async () => {
    mockOrderFindMany.mockResolvedValueOnce([
      {
        id: 'o1',
        order_no: 'ORD-001',
        currency_ex_rate: new Decimal('3.6725'),
        total_amount: new Decimal('100'),
        total_tax_amount: new Decimal('5'),
        total_paid_amount: new Decimal('25'),
        total_credit_applied_amount: new Decimal('10'),
        outstanding_amount: new Decimal('65'),
        ar_receivable_amount: new Decimal('65'),
        base_cur_total_amount: new Decimal('360'),
        base_cur_tax_amount: new Decimal('18.3625'),
        base_cur_paid_amount: new Decimal('91.8125'),
        base_cur_credit_applied_amount: new Decimal('36.725'),
        base_cur_outstanding_amount: new Decimal('238.7125'),
        base_cur_ar_receivable_amount: new Decimal('238.7125'),
      },
    ]);

    const result = await checkBaseVsOrderAmountConsistency(TENANT, WINDOW);
    expect(result[0]).toMatchObject({
      checkName: 'BASE_VS_ORDER_AMOUNT_CONSISTENCY',
      expectedValue: 367.25,
      actualValue: 360,
      affectedEntityId: 'o1',
    });
  });
});

// ── order-snapshot-checks ─────────────────────────────────────────────────
describe('order-snapshot-checks', () => {
  const orderRow = {
    id: 'o1',
    order_no: 'ORD-001',
    total: new Decimal('100'),
    total_paid_amount: new Decimal('0'),
    total_credit_applied_amount: new Decimal('0'),
    outstanding_amount: new Decimal('0'),
    payment_status: null,
    payment_type_code: null,
    pay_on_collection_amount: null,
  };

  it('ORDER_CHARGES_MATCH_SNAPSHOT — flags drift vs total_charges_amount', async () => {
    mockChargesAggregate.mockResolvedValue({ _sum: { amount: new Decimal('30') } });
    mockChargesFindMany.mockResolvedValue([]);
    mockItemsFindMany.mockResolvedValue([]);
    mockPiecesFindMany.mockResolvedValue([]);
    mockPreferencesFindMany.mockResolvedValue([]);
    mockOrderFindUnique.mockResolvedValue({ total_charges_amount: new Decimal('25') });

    const result = await runOrderSnapshotChecks(TENANT, [orderRow]);
    const issue = result.find((r) => r.checkName === 'ORDER_CHARGES_MATCH_SNAPSHOT');
    expect(issue).toMatchObject({ expectedValue: 25, actualValue: 30 });
  });

  it('PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE — detects duplicate charge_source_id', async () => {
    mockChargesAggregate.mockResolvedValue({ _sum: { amount: new Decimal('0') } });
    mockChargesFindMany.mockResolvedValue([
      { id: 'c1', amount: new Decimal('5'), charge_source_id: 'pref-1' },
      { id: 'c2', amount: new Decimal('5'), charge_source_id: 'pref-1' },
    ]);
    mockItemsFindMany.mockResolvedValue([]);
    mockPiecesFindMany.mockResolvedValue([]);
    mockPreferencesFindMany.mockResolvedValue([]);
    mockOrderFindUnique.mockResolvedValue({ total_charges_amount: new Decimal('0') });

    const result = await runOrderSnapshotChecks(TENANT, [orderRow]);
    expect(result.find((r) => r.checkName === 'PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE')).toBeDefined();
  });
});

// ── voucher-checks ────────────────────────────────────────────────────────
describe('voucher-checks', () => {
  const voucher = {
    id: 'v1',
    voucher_no: 'VCH-001',
    total_amount: new Decimal('100'),
    voucher_status: 'POSTED',
  };

  it('VOUCHER_TOTAL_EQUALS_LINES — flags sum mismatch', async () => {
    mockTrxLinesFindMany.mockResolvedValue([
      { id: 'L1', voucher_id: 'v1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1', amount: new Decimal('80'), gateway_code: null, gateway_transaction_id: null, reversed_line_id: null, line_status: 'POSTED' },
    ]);
    const result = await runVoucherIntegrityChecks(TENANT, [voucher]);
    const issue = result.find((r) => r.checkName === 'VOUCHER_TOTAL_EQUALS_LINES');
    expect(issue).toMatchObject({ expectedValue: 100, actualValue: 80 });
  });

  it('NO_DUPLICATE_OPERATIONAL_EFFECT — detects duplicate (role, target_type, target_id)', async () => {
    mockTrxLinesFindMany.mockResolvedValue([
      { id: 'L1', voucher_id: 'v1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1', amount: new Decimal('50'), gateway_code: null, gateway_transaction_id: null, reversed_line_id: null, line_status: 'POSTED' },
      { id: 'L2', voucher_id: 'v1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1', amount: new Decimal('50'), gateway_code: null, gateway_transaction_id: null, reversed_line_id: null, line_status: 'POSTED' },
    ]);
    const result = await runVoucherIntegrityChecks(TENANT, [voucher]);
    expect(result.find((r) => r.checkName === 'NO_DUPLICATE_OPERATIONAL_EFFECT')).toBeDefined();
  });

  it('GATEWAY_STATE_VALID — flags gateway_code without gateway_transaction_id', async () => {
    mockTrxLinesFindMany.mockResolvedValue([
      { id: 'L1', voucher_id: 'v1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1', amount: new Decimal('100'), gateway_code: 'STRIPE', gateway_transaction_id: null, reversed_line_id: null, line_status: 'POSTED' },
    ]);
    const result = await runVoucherIntegrityChecks(TENANT, [voucher]);
    expect(result.find((r) => r.checkName === 'GATEWAY_STATE_VALID')).toBeDefined();
  });

  it('CASH_MOVEMENT_LINK_EXISTS — flags null backlink', async () => {
    mockCashMovementsFindMany.mockResolvedValue([
      { id: 'm1', cash_drawer_session_id: 's1', movement_type: 'SALE', amount: new Decimal('40'), direction: 'IN' },
    ]);
    const result = await checkCashMovementLink(TENANT, WINDOW);
    expect(result[0].checkName).toBe('CASH_MOVEMENT_LINK_EXISTS');
  });

  it('CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT — flags retained-amount drift', async () => {
    mockCashMovementsFindMany.mockResolvedValue([
      { id: 'm1', cash_drawer_session_id: 's1', amount: new Decimal('47'), fin_voucher_trx_line_id: 'L1' },
    ]);
    mockTrxLinesFindMany.mockResolvedValue([
      { id: 'L1', amount: new Decimal('47'), change_returned_amount: new Decimal('3') },
    ]);
    // amount (47) vs retained (47 - 3 = 44) = drift of 3
    const result = await checkCashMovementAmountEqualsRetained(TENANT, WINDOW);
    expect(result[0]).toMatchObject({ expectedValue: 44, actualValue: 47 });
  });

  // B30/B32 — trip-wire: a CANCELLED/FAILED payment must never carry a live
  // CASH_SALE movement (structurally unreachable post-B32; this is defense-in-depth).
  it('CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT — flags a CANCELLED payment with a live CASH_SALE movement', async () => {
    mockOrderPaymentsFindMany.mockResolvedValue([
      {
        id: 'p1',
        order_id: 'o1',
        payment_status: 'CANCELLED',
        org_cash_drawer_movements_dtl: [{ id: 'm1', amount: new Decimal('50') }],
      },
    ]);
    const result = await checkCancelledPaymentNoOrphanMovement(TENANT, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      checkName: 'CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT',
      severity: 'BLOCKER',
      actualValue: 50,
      affectedEntityId: 'p1',
    });
  });

  it('CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT — clean when no movement is attached', async () => {
    mockOrderPaymentsFindMany.mockResolvedValue([
      { id: 'p1', order_id: 'o1', payment_status: 'FAILED', org_cash_drawer_movements_dtl: [] },
    ]);
    expect(await checkCancelledPaymentNoOrphanMovement(TENANT, WINDOW)).toEqual([]);
  });
});

// ── voucher-reconciliation.service ────────────────────────────────────────
describe('voucher-reconciliation.service', () => {
  it('reconcileVoucher — returns full summary for clean voucher', async () => {
    mockVoucherFindFirstOrThrow.mockResolvedValue({
      id: 'v1',
      voucher_no: 'VCH-001',
      total_amount: new Decimal('100'),
      voucher_status: 'POSTED',
    });
    mockTrxLinesFindMany.mockResolvedValue([
      { id: 'L1', voucher_id: 'v1', line_role: 'ORDER_PAYMENT', target_type: 'ORDER', target_id: 'o1', amount: new Decimal('100'), gateway_code: null, gateway_transaction_id: null, reversed_line_id: null, line_status: 'POSTED' },
    ]);

    const result = await reconcileVoucher(TENANT, 'v1');
    expect(result.voucherId).toBe('v1');
    expect(result.issues).toEqual([]);
    expect(result.summary.finalStatus).toBe('PASSED');
  });
});

// ── Multi-tenant isolation ────────────────────────────────────────────────
describe('multi-tenant isolation', () => {
  it('tenant A query forwards tenant_org_id filter — cannot see tenant B drift', async () => {
    const TENANT_A = 'tenant-aaa';
    const TENANT_B = 'tenant-bbb';

    // Simulate the Prisma layer: only return rows whose tenant_org_id matches
    // the `where.tenant_org_id` the check passed.
    mockInvoicePaymentsFindMany.mockImplementation(async (args: { where: { tenant_org_id: string } }) => {
      const all = [
        { id: 'a-A', tenant_org_id: TENANT_A, invoice_id: 'inv-A', allocation_no: 1, allocated_amount: new Decimal('10') },
        { id: 'a-B', tenant_org_id: TENANT_B, invoice_id: 'inv-B', allocation_no: 1, allocated_amount: new Decimal('20') },
      ];
      return all.filter((r) => r.tenant_org_id === args.where.tenant_org_id);
    });

    const aResult = await checkInvoicePaymentLink(TENANT_A, WINDOW);
    const bResult = await checkInvoicePaymentLink(TENANT_B, WINDOW);

    expect(aResult.map((r) => r.affectedEntityId)).toEqual(['a-A']);
    expect(bResult.map((r) => r.affectedEntityId)).toEqual(['a-B']);
    // Confirm each call forwarded its own tenant_org_id (defense-in-depth on
    // top of RLS).
    const calls = mockInvoicePaymentsFindMany.mock.calls;
    expect(calls[0][0].where.tenant_org_id).toBe(TENANT_A);
    expect(calls[1][0].where.tenant_org_id).toBe(TENANT_B);
  });
});
