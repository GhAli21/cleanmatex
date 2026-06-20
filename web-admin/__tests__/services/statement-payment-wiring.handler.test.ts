/**
 * Tests: statement-payment-wiring.handler (D-12 / F-T2, rule 8).
 *
 * Locks the B2B STATEMENT_PAYMENT wiring handler, including the D-12 fix to
 * `getLinkedEffect`: `org_b2b_statements_mst` has NO Prisma model (raw-SQL only),
 * so the previous `tx.org_b2b_statements_mst.findFirst` was a tsc error AND a
 * runtime crash. It now uses `tx.$queryRaw`. This test pins the raw-SQL shape so
 * it can't silently regress to a model accessor.
 */

import { statementPaymentWiringHandler } from '@/lib/services/wiring/statement-payment-wiring.handler';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

jest.mock('@/lib/services/b2b-statement-payment.service', () => ({
  allocateB2bStatementPaymentTx: jest.fn().mockResolvedValue({ id: 'stmt-001', appliedAmount: 40 }),
}));
import { allocateB2bStatementPaymentTx } from '@/lib/services/b2b-statement-payment.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const STATEMENT_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-001';

function makeStatementPaymentLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: LINE_ROLE.STATEMENT_PAYMENT,
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CARD',
    payment_status: 'POSTED',
    amount: 40 as never,
    currency_code: 'OMR',
    target_type: TARGET_TYPE.B2B_STATEMENT,
    target_id: STATEMENT_ID,
    order_id: null,
    customer_id: null,
    cash_drawer_session_id: null,
    tendered_amount: null,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: null,
    cash_drawer_mvt_id: null,
    card_brand_code: null,
    card_last4: null,
    gateway_code: null,
    gateway_reference: null,
    bank_reference: null,
    check_number: null,
    org_payment_method_id: null,
    payment_terminal_id: null,
    branch_id: 'branch-1',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('statementPaymentWiringHandler.canHandle', () => {
  it('matches only STATEMENT_PAYMENT / IN / B2B_STATEMENT lines', () => {
    expect(statementPaymentWiringHandler.canHandle(makeStatementPaymentLine())).toBe(true);
    expect(statementPaymentWiringHandler.canHandle(makeStatementPaymentLine({ direction: 'OUT' }))).toBe(false);
    expect(statementPaymentWiringHandler.canHandle(makeStatementPaymentLine({ target_type: TARGET_TYPE.ORDER }))).toBe(false);
    expect(statementPaymentWiringHandler.canHandle(makeStatementPaymentLine({ line_role: LINE_ROLE.ORDER_PAYMENT }))).toBe(false);
  });
});

describe('statementPaymentWiringHandler.validate', () => {
  it('throws when target_id is missing', async () => {
    await expect(statementPaymentWiringHandler.validate(makeStatementPaymentLine({ target_id: null }))).rejects.toThrow(/target_id/);
  });
  it('passes when target_id is present', async () => {
    await expect(statementPaymentWiringHandler.validate(makeStatementPaymentLine())).resolves.toBeUndefined();
  });
});

describe('statementPaymentWiringHandler.wire', () => {
  it('allocates with a per-line idempotency key and returns the statement id', async () => {
    const id = await statementPaymentWiringHandler.wire(
      makeStatementPaymentLine(),
      VOUCHER_ID,
      TENANT,
      USER_ID,
      {} as never,
    );

    expect(id).toBe('stmt-001');
    expect(allocateB2bStatementPaymentTx).toHaveBeenCalledWith(
      expect.anything(),
      STATEMENT_ID,
      expect.objectContaining({
        tenantId: TENANT,
        userId: USER_ID,
        amount: 40,
        idempotencyKey: `${VOUCHER_ID}_stmt_line-001`,
        voucherId: VOUCHER_ID,
        voucherTrxLineId: 'line-001',
        branchId: 'branch-1',
      }),
    );
  });
});

describe('statementPaymentWiringHandler.getLinkedEffect', () => {
  it('builds a LinkedEffect from a raw-SQL statement row (regression lock for the model-accessor fix)', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: STATEMENT_ID, currency_cd: 'OMR' }]);
    const tx = { $queryRaw: queryRaw };

    const effect = await statementPaymentWiringHandler.getLinkedEffect(makeStatementPaymentLine(), TENANT, tx as never);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(effect).toEqual({
      effectType: 'STATEMENT_PAYMENT',
      effectId: STATEMENT_ID,
      tableRef: 'org_b2b_statements_mst',
      amount: 40,
      currency_code: 'OMR',
    });
  });

  it('returns null when the statement row is not found', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    expect(await statementPaymentWiringHandler.getLinkedEffect(makeStatementPaymentLine(), TENANT, tx as never)).toBeNull();
  });

  it('returns null (no query) when target_id is missing', async () => {
    const queryRaw = jest.fn();
    const tx = { $queryRaw: queryRaw };
    expect(await statementPaymentWiringHandler.getLinkedEffect(makeStatementPaymentLine({ target_id: null }), TENANT, tx as never)).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
