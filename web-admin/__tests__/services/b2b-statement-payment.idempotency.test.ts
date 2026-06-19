/**
 * Tests: allocateB2bStatementPaymentTx idempotency (F-02, migration 0380).
 *
 * The B2B statement allocation path previously ignored its idempotencyKey and
 * mutated org_b2b_statements_mst in place — the one non-idempotent allocation
 * path (AR uses org_idempotency_keys; order/wallet/advance/CN use effect-table
 * indexes). It now consumes the key against org_b2b_statement_payments_dtl.
 *
 * Service-level test with a mocked Prisma tx (repo convention).
 */

import { allocateB2bStatementPaymentTx } from '@/lib/services/b2b-statement-payment.service';
import { STATEMENT_STATUSES } from '@/lib/constants/b2b';

const TENANT = '11111111-1111-1111-1111-111111111111';
const STMT = '22222222-2222-2222-2222-222222222222';

function collectibleStatementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STMT,
    balance_amount: 100,
    paid_amount: 0,
    total_amount: 100,
    status_cd: STATEMENT_STATUSES.ISSUED,
    currency_cd: 'OMR',
    customer_id: '44444444-4444-4444-4444-444444444444',
    ...overrides,
  };
}

const baseParams = {
  tenantId: TENANT,
  userId: 'user-1',
  amount: 40,
  idempotencyKey: 'voucher-1_stmt_line-1',
  voucherId: 'voucher-1',
  voucherTrxLineId: 'line-1',
  branchId: 'branch-1',
};

describe('allocateB2bStatementPaymentTx — idempotency (F-02)', () => {
  it('applies once and writes an audit/detail row on first call', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([]) // idempotency lookup → none
      .mockResolvedValueOnce([collectibleStatementRow()]); // FOR UPDATE statement
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };

    const result = await allocateB2bStatementPaymentTx(tx as never, STMT, baseParams);

    expect(result).toEqual({ id: STMT, appliedAmount: 40 });
    // UPDATE statement + INSERT detail row
    expect(executeRaw).toHaveBeenCalledTimes(2);
    // the detail INSERT carries the idempotency key + amount
    const insertCall = executeRaw.mock.calls[1];
    expect(insertCall).toEqual(expect.arrayContaining(['voucher-1_stmt_line-1', 40]));
  });

  it('replays as a no-op: same key returns the cached amount, no balance mutation', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'existing-detail-1', amount: 40 }]); // idempotency hit
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };

    const result = await allocateB2bStatementPaymentTx(tx as never, STMT, baseParams);

    expect(result).toEqual({ id: STMT, appliedAmount: 40 });
    // No FOR UPDATE, no UPDATE, no INSERT — balance is never touched twice.
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('caps the applied amount to the remaining statement balance', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([collectibleStatementRow({ balance_amount: 25 })]);
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };

    const result = await allocateB2bStatementPaymentTx(tx as never, STMT, {
      ...baseParams,
      amount: 40,
    });

    expect(result.appliedAmount).toBe(25);
  });
});
