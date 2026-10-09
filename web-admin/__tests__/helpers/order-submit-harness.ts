/**
 * WP01 isolates infrastructure while retaining the actual submission and plan builders.
 * Callback mocks verify transaction composition; they cannot prove database rollback.
 */
import type { SubmitOrderRequest } from '@/lib/validations/new-order-payment-schemas';
import type { OrderCalculationResult } from '@/lib/services/order-calculation.service';

/** Records the guarded initial-commit write at the end of the aggregate transaction. */
export const mockInitialCommit = jest.fn();
/** Identity sentinel used to detect writes that escape the shared callback transaction. */
export const mockTx = Object.freeze({
  boundary: 'submit-transaction',
  $executeRaw: (...args: unknown[]) => mockInitialCommit(...args),
});
/** Supplies server totals without duplicating the calculator's pricing tests. */
export const mockCalculate = jest.fn();
/** Observes canonical order creation while leaving orchestration decisions real. */
export const mockCreate = jest.fn();
/** Captures the financial snapshot input and its transaction identity. */
export const mockSettle = jest.fn();
/** Isolates fiscal issuance so callback error handling can be characterized. */
export const mockTaxDoc = jest.fn();
/** Captures remaining-receivable invoicing without persisting an AR document. */
export const mockInvoice = jest.fn();
/** Observes promo consumption in the submission transaction. */
export const mockPromo = jest.fn();
/** Injects stored-value outcomes while retaining orchestration eligibility checks. */
export const mockDebit = jest.fn();
/** Supplies the receipt voucher identity required by downstream lineage. */
export const mockVoucher = jest.fn();
/** Captures tender lines and their distinct idempotency keys. */
export const mockLine = jest.fn();
/** Supplies wiring results without executing ledger writes. */
export const mockWire = jest.fn();
/** Isolates the post-transaction linked-effects read. */
export const mockEffects = jest.fn();
/** Controls the final tenant-scoped read, including response-read failures. */
export const mockReadOrder = jest.fn();
/** Supplies credit-policy facts independently of settlement planning. */
export const mockCreditCheck = jest.fn();
/** Injects policy rejection to prove caller input cannot bypass enforcement. */
export const mockCreditAssert = jest.fn();
/** Executes callback composition only; it does not emulate PostgreSQL rollback. */
export const mockTransaction = jest.fn();
/** Records tenant-context use without installing a database RLS session. */
export const mockTenantContext = jest.fn();
/** Supplies method configuration while keeping the real plan classifier active. */
export const mockMethodConfigs = jest.fn();
/** Captures explicit tenant predicates used for branch resolution. */
export const mockBranchRead = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {
  $transaction: (...args: unknown[]) => mockTransaction(...args),
  org_orders_mst: { findFirstOrThrow: (...args: unknown[]) => mockReadOrder(...args) },
  org_branches_mst: { findFirst: (...args: unknown[]) => mockBranchRead(...args) },
} }));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (...args: unknown[]) => mockTenantContext(...args),
}));
jest.mock('@/lib/services/order-service', () => ({ OrderService: {
  createOrderInTransaction: (...args: unknown[]) => mockCreate(...args),
} }));
jest.mock('@/lib/services/order-calculation.service', () => ({ calculateOrderTotals: (...args: unknown[]) => mockCalculate(...args) }));
jest.mock('@/lib/services/ar-invoice.service', () => ({ createArInvoiceFromOrders: (...args: unknown[]) => mockInvoice(...args) }));
jest.mock('@/lib/services/discount-service', () => ({ applyPromoCodeTx: (...args: unknown[]) => mockPromo(...args) }));
jest.mock('@/lib/services/order-credit-application.service', () => ({ applyStoredValueDebitTx: (...args: unknown[]) => mockDebit(...args) }));
jest.mock('@/lib/services/order-settlement.service', () => ({ settleOrderTx: (...args: unknown[]) => mockSettle(...args) }));
jest.mock('@/lib/services/tax-document-issuance.service', () => ({ maybeIssueTaxDocumentTx: (...args: unknown[]) => mockTaxDoc(...args) }));
jest.mock('@/lib/services/credit-limit.service', () => ({
  checkCreditLimit: (...args: unknown[]) => mockCreditCheck(...args),
  assertCreditWithinPolicy: (...args: unknown[]) => mockCreditAssert(...args),
}));
jest.mock('@/lib/services/voucher-biz.service', () => ({ createBizVoucher: (...args: unknown[]) => mockVoucher(...args) }));
jest.mock('@/lib/services/voucher-line.service', () => ({ addVoucherLine: (...args: unknown[]) => mockLine(...args) }));
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...args: unknown[]) => mockWire(...args),
  getVoucherLinkedEffects: (...args: unknown[]) => mockEffects(...args),
}));
jest.mock('@/lib/services/order-settlement-planner.service', () => ({
  ...jest.requireActual('@/lib/services/order-settlement-planner.service'),
  // Configuration validation is a data boundary; plan classification remains real.
  validateSettlementPlan: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/overpayment-resolution-validator.service', () => ({ validateOverpaymentResolution: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/services/overpayment-disposition.service', () => ({ executeOverpaymentDispositionTx: jest.fn() }));
jest.mock('@/lib/services/customer-receipt-excess-executor.service', () => ({
  executeAllocationPreviewTx: jest.fn(), extractAllocationPreviewId: jest.fn(),
  getDispositionLinesExcludingAllocation: jest.fn(), resolutionIncludesAllocation: jest.fn(),
}));
jest.mock('@/lib/services/payment-config.service', () => ({ listEffectivePaymentMethodConfigs: (...args: unknown[]) => mockMethodConfigs(...args) }));
jest.mock('@/lib/services/cash-drawer.service', () => ({ resolveCashDrawerSessionId: jest.fn().mockResolvedValue('drawer-1') }));
jest.mock('@/lib/services/order-created-pos-session', () => ({
  stampCreatedPosSession: jest.fn().mockResolvedValue(undefined),
  findOpenPosSessionIdForOrder: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/services/pos-session.service', () => ({
  assertOpenPosSessionForFinanceTx: jest.fn().mockResolvedValue(undefined),
  resolvePosSessionForFinanceTx: jest.fn().mockResolvedValue({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'OPEN',
    branch_id: '44444444-4444-4444-8444-444444444444',
  }),
  autoLinkDrawerTx: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

/** Real service entry points exposed alongside the isolated infrastructure harness. */
export { submitOrder, resolveOrderBranch } from '@/lib/services/order-submit-orchestrator.service';

/** Synthetic tenant UUID shared across fixture requests and isolation assertions. */
export const tenantId = '11111111-1111-4111-8111-111111111111';
/** Synthetic customer UUID for stored-value and remaining-credit cases. */
export const customerId = '22222222-2222-4222-8222-222222222222';
/** Synthetic persisted order UUID used to verify lineage across mocked writers. */
export const orderId = '33333333-3333-4333-8333-333333333333';
/** Synthetic branch UUID used to verify tenant-scoped resolution. */
export const branchId = '44444444-4444-4444-8444-444444444444';

/**
 * Builds a valid single-payment request so individual tests override only their intent.
 *
 * @param overrides - Case-specific submission fields; fixture amounts use a 20 OMR sale.
 * @returns A canonical request without client-controlled tenant or actor context.
 */
export function makeSubmitInput(overrides: Partial<SubmitOrderRequest> = {}): SubmitOrderRequest {
  return {
    customerId, orderTypeId: 'POS', orderSourceCode: 'pos',
    items: [{ productId: '55555555-5555-4555-8555-555555555555', quantity: 1,
      pricePerUnit: 20, totalPrice: 20, serviceCategoryCode: 'LAUNDRY' }],
    paymentMethod: 'CASH', amountToCharge: 20, outstandingPolicy: 'NONE',
    idempotencyKey: 'wp01-submit',
    clientTotals: { subtotal: 20, manualDiscount: 0, promoDiscount: 0, vatValue: 0, saleTotal: 20 },
    ...overrides,
  };
}

/**
 * Supplies explicit server facts; pricing itself is protected in its existing service suite.
 *
 * @param overrides - Calculated values needed by the case, including credits or discounts.
 * @returns Server totals for a 20 OMR sale with three currency decimal places by default.
 */
export function makeServerTotals(overrides: Partial<OrderCalculationResult> = {}): OrderCalculationResult {
  return {
    subtotal: 20, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0,
    afterDiscounts: 20, taxRate: 0, taxAmount: 0, additionalTaxAmount: 0,
    vatTaxPercent: 0, vatValue: 0, taxBreakdown: [], giftCardApplied: 0,
    saleTotal: 20, currencyCode: 'OMR', decimalPlaces: 3, discountLines: [],
    taxPricingMode: 'TAX_EXCLUSIVE', roundingAdjustmentAmount: 0, chargesTotal: 0,
    ...overrides,
  };
}

/**
 * Restores all dependency defaults to prevent payment cases leaking into failure tests.
 * Tenant and transaction callbacks are simulated; no RLS or database rollback is exercised.
 *
 * @returns Nothing; resets mocks and installs deterministic infrastructure responses.
 */
export function resetSubmitHarness(): void {
  jest.resetAllMocks();
  mockTenantContext.mockImplementation((_tenant: string, callback: () => unknown) => callback());
  mockTransaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) => callback(mockTx));
  mockCalculate.mockResolvedValue(makeServerTotals());
  mockCreate.mockResolvedValue({ success: true, order: { id: orderId, orderNo: 'ORD-WP01', currentStatus: 'intake' } });
  mockVoucher.mockResolvedValue({ id: 'voucher-1' });
  mockLine.mockResolvedValue({ id: 'line-1' });
  mockWire.mockResolvedValue({ voucherId: 'voucher-1', voucher_no: 'RV-WP01', voucher_status: 'POSTED', wiring: { linesWired: 1, linesSkipped: 0 } });
  mockEffects.mockResolvedValue({ orderPayments: [], creditApplications: [], cashDrawerMovements: [] });
  mockCreditCheck.mockResolvedValue({ allowed: true });
  mockInvoice.mockResolvedValue({ invoice: { id: 'invoice-1' } });
  mockReadOrder.mockResolvedValue({ id: orderId, order_no: 'ORD-WP01', current_status: 'intake',
    total_amount: '20.000', total_paid_amount: '20.000', total_credit_applied_amount: '0.000',
    outstanding_amount: '0.000', payment_status: 'paid', payment_type_code: 'PAY_IN_ADVANCE' });
  mockInitialCommit.mockResolvedValue(1);
  const posSessionMocks = jest.requireMock('@/lib/services/pos-session.service') as {
    resolvePosSessionForFinanceTx: jest.Mock;
    assertOpenPosSessionForFinanceTx: jest.Mock;
    autoLinkDrawerTx: jest.Mock;
  };
  posSessionMocks.resolvePosSessionForFinanceTx.mockResolvedValue({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'OPEN',
    branch_id: branchId,
  });
  posSessionMocks.assertOpenPosSessionForFinanceTx.mockResolvedValue(undefined);
  posSessionMocks.autoLinkDrawerTx.mockResolvedValue(undefined);
  const createdSessionMocks = jest.requireMock('@/lib/services/order-created-pos-session') as {
    stampCreatedPosSession: jest.Mock;
    findOpenPosSessionIdForOrder: jest.Mock;
  };
  createdSessionMocks.stampCreatedPosSession.mockResolvedValue(undefined);
  createdSessionMocks.findOpenPosSessionIdForOrder.mockResolvedValue(null);
  mockMethodConfigs.mockImplementation(async ({ methodCodes }: { methodCodes: string[] }) => methodCodes.map((code) => ({
    id: `method-${code}`, payment_method_code: code,
    payment_nature: code === 'GIFT_CARD' ? 'CREDIT_APPLICATION' : 'REAL_PAYMENT',
    credit_application_type: code === 'GIFT_CARD' ? 'GIFT_CARD' : null,
    display_name: code, display_name2: code, gateway_code: null,
    settlement_type_code: null,
    requires_cash_drawer: false, requires_terminal: false, supports_overpayment: false,
    supports_change_return: false, default_creation_status: 'COMPLETED',
    min_amount: null, max_amount: null, min_order_amount: null, max_order_amount: null,
    is_platform_disabled: false, is_globally_disabled: false,
  })));
}

/**
 * Supplies simulated server-derived context consistently to every actual service invocation.
 * The fixture tenant is passed explicitly rather than accepted from the request payload.
 *
 * @param input - Canonical request whose orchestration behavior is under test.
 * @returns Submission parameters with the shared tenant, actor, branch, and audit fixtures.
 */
export function submitParams(input: SubmitOrderRequest = makeSubmitInput()) {
  return { tenantId, userId: 'staff-1', userName: 'Staff', branchId, input,
    requestAudit: { userAgent: 'WP01 Jest', userIp: '127.0.0.1' } };
}
