import 'server-only';

import type { Prisma } from '@prisma/client';
import { STATEMENT_STATUSES } from '@/lib/constants/b2b';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { RECEIPT_ALLOCATION_WARNING_CODES } from '@/lib/types/customer-receipt-allocation';

type PrismaTransactionClient = Prisma.TransactionClient;

const COLLECTIBLE_STATUSES = [
  STATEMENT_STATUSES.ISSUED,
  STATEMENT_STATUSES.PARTIAL,
  STATEMENT_STATUSES.OVERDUE,
] as const;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

function resolveStatementStatusAfterPayment(balance: number, total: number): string {
  if (balance <= SETTLEMENT_MONEY_EPSILON) return STATEMENT_STATUSES.PAID;
  if (balance + SETTLEMENT_MONEY_EPSILON < total) return STATEMENT_STATUSES.PARTIAL;
  return STATEMENT_STATUSES.ISSUED;
}

/**
 *
 */
export interface AllocateB2bStatementPaymentParams {
  tenantId: string;
  userId: string;
  amount: number;
  idempotencyKey: string;
  voucherId?: string | null;
  voucherTrxLineId?: string | null;
  branchId?: string | null;
  notes?: string;
}

/**
 * Applies a customer receipt allocation payment to a B2B statement balance.
 * Updates paid_amount / balance_amount / status_cd atomically inside caller TX.
 * @param tx
 * @param statementId
 * @param params
 */
export async function allocateB2bStatementPaymentTx(
  tx: PrismaTransactionClient,
  statementId: string,
  params: AllocateB2bStatementPaymentParams
): Promise<{ id: string; appliedAmount: number }> {
  // Idempotency (F-02): if this key already applied a statement payment,
  // return the cached result WITHOUT re-reducing the balance. Backed by the
  // partial unique uq_b2b_stmt_pay_idem on org_b2b_statement_payments_dtl
  // (migration 0380). This is the B2B equivalent of the AR org_idempotency_keys
  // guard and the order/wallet/advance/CN effect-table indexes.
  if (params.idempotencyKey) {
    const priorApplied = await tx.$queryRaw<Array<{ id: string; amount: number }>>`
      SELECT id, amount::float8 AS amount
      FROM org_b2b_statement_payments_dtl
      WHERE tenant_org_id = ${params.tenantId}::uuid
        AND idempotency_key = ${params.idempotencyKey}
        AND COALESCE(is_active, true) = true
      LIMIT 1
    `;
    if (priorApplied[0]) {
      return { id: statementId, appliedAmount: toNumber(priorApplied[0].amount) };
    }
  }

  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      balance_amount: number;
      paid_amount: number;
      total_amount: number;
      status_cd: string;
      currency_cd: string | null;
      customer_id: string;
    }>
  >`
    SELECT id, balance_amount::float8, paid_amount::float8, total_amount::float8,
           status_cd, currency_cd, customer_id
    FROM org_b2b_statements_mst
    WHERE id = ${statementId}::uuid
      AND tenant_org_id = ${params.tenantId}::uuid
      AND COALESCE(is_active, true) = true
      AND COALESCE(rec_status, 1) = 1
    FOR UPDATE
  `;

  const statement = rows[0];
  if (!statement) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  if (!COLLECTIBLE_STATUSES.includes(statement.status_cd as (typeof COLLECTIBLE_STATUSES)[number])) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  const balance = toNumber(statement.balance_amount);
  if (balance <= SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  const appliedAmount = Math.min(params.amount, balance);
  if (appliedAmount <= SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  const newPaid = toNumber(statement.paid_amount) + appliedAmount;
  const newBalance = Math.max(0, balance - appliedAmount);
  const total = toNumber(statement.total_amount);
  const newStatus = resolveStatementStatusAfterPayment(newBalance, total);

  await tx.$executeRaw`
    UPDATE org_b2b_statements_mst
    SET paid_amount = ${newPaid},
        balance_amount = ${newBalance},
        status_cd = ${newStatus},
        updated_at = NOW(),
        updated_by = ${params.userId}
    WHERE id = ${statementId}::uuid
      AND tenant_org_id = ${params.tenantId}::uuid
  `;

  // Audit + idempotency detail row (F-04). ON CONFLICT DO NOTHING is a
  // concurrency backstop alongside the top-of-function key check.
  await tx.$executeRaw`
    INSERT INTO org_b2b_statement_payments_dtl (
      id, tenant_org_id, branch_id, statement_id, customer_id,
      voucher_id, voucher_trx_line_id, amount, currency_code,
      idempotency_key, notes, created_by
    ) VALUES (
      gen_random_uuid(),
      ${params.tenantId}::uuid,
      ${params.branchId ?? null}::uuid,
      ${statementId}::uuid,
      ${statement.customer_id ?? null}::uuid,
      ${params.voucherId ?? null}::uuid,
      ${params.voucherTrxLineId ?? null}::uuid,
      ${appliedAmount},
      ${statement.currency_cd ?? null},
      ${params.idempotencyKey ?? null},
      ${params.notes ?? null},
      ${params.userId}
    )
    ON CONFLICT (tenant_org_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
      DO NOTHING
  `;

  return { id: statementId, appliedAmount };
}
