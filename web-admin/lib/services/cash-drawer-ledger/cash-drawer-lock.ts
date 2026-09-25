import 'server-only';

import { Prisma } from '@prisma/client';

/**
 * Drawer row locks and the per-drawer ledger sequence (CLF P1, ADR-057).
 *
 * Why a row lock + counter instead of an advisory lock: a session close must
 * record an exact cut. Every drawer ledger entry (cash voucher line or custody
 * transaction line) takes the next `org_cash_drawers_mst.ledger_seq` while the
 * drawer row is locked, so "entries with seq ≤ cut" is exact. A time cut is not:
 * `now()` is transaction-start time, so a payment waiting on the lock would be
 * stamped before a cut it actually follows.
 *
 * Lock order inside any transaction (deadlock rule):
 *   voucher-number lock → voucher header FOR UPDATE → drawer rows (sorted by id)
 *   → custody trx-number lock → session-number lock.
 * Custody services never take the voucher-number lock, and the session close
 * never takes it either (over/short is posted later, from an outbox event).
 */

/** Row returned by {@link lockDrawersTx}; enough to build a drawer profile. */
export interface LockedDrawerRow {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  drawer_type: string;
  currency_code: string;
  is_active: boolean;
  ledger_seq: bigint;
}

/**
 * Locks drawer rows FOR UPDATE in ascending id order (the order is what makes
 * concurrent multi-drawer transactions deadlock-free).
 * @param tx open Prisma transaction — the lock is released at its end
 * @param tenantOrgId tenant; rows of other tenants are never locked or returned
 * @param drawerIds drawers to lock (duplicates ignored)
 * @returns the locked rows (missing ids are simply absent)
 * @example const [drawer] = await lockDrawersTx(tx, tenantId, [drawerId]);
 */
export async function lockDrawersTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerIds: readonly string[],
): Promise<LockedDrawerRow[]> {
  const ids = [...new Set(drawerIds)].sort();
  if (ids.length === 0) return [];
  // ORDER BY is applied before the row locks are taken, so locks follow id order.
  return tx.$queryRaw<LockedDrawerRow[]>(Prisma.sql`
    SELECT id, tenant_org_id, branch_id, drawer_type, currency_code, is_active, ledger_seq
      FROM org_cash_drawers_mst
     WHERE tenant_org_id = ${tenantOrgId}::uuid
       AND id = ANY(${ids}::uuid[])
     ORDER BY id
       FOR UPDATE
  `);
}

/**
 * Reserves the next `count` ledger sequence values for a drawer.
 * Call only while the drawer row is locked by {@link lockDrawersTx}.
 * @param tx open Prisma transaction
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose counter advances
 * @param count how many consecutive values to reserve (default 1)
 * @returns the first reserved value; the rest follow consecutively
 * @throws when the drawer does not exist for the tenant
 * @example const seq = await allocateLedgerSeqTx(tx, tenantId, drawerId);
 */
export async function allocateLedgerSeqTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
  count = 1,
): Promise<bigint> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`allocateLedgerSeqTx: count must be a positive integer, got ${count}`);
  }
  const rows = await tx.$queryRaw<Array<{ ledger_seq: bigint }>>(Prisma.sql`
    UPDATE org_cash_drawers_mst
       SET ledger_seq = ledger_seq + ${count}
     WHERE id = ${drawerId}::uuid
       AND tenant_org_id = ${tenantOrgId}::uuid
    RETURNING ledger_seq
  `);
  if (rows.length === 0) {
    throw new Error(`allocateLedgerSeqTx: drawer ${drawerId} not found for tenant ${tenantOrgId}`);
  }
  return rows[0].ledger_seq - BigInt(count) + BigInt(1);
}

/**
 * Current ledger sequence of a drawer (the cut value for a close or count).
 * Call only while the drawer row is locked.
 * @param tx open Prisma transaction
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer to read
 * @returns the last issued sequence (0 when the drawer has no entries yet)
 */
export async function readLedgerSeqTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
): Promise<bigint> {
  const rows = await tx.$queryRaw<Array<{ ledger_seq: bigint }>>(Prisma.sql`
    SELECT ledger_seq FROM org_cash_drawers_mst
     WHERE id = ${drawerId}::uuid AND tenant_org_id = ${tenantOrgId}::uuid
  `);
  if (rows.length === 0) {
    throw new Error(`readLedgerSeqTx: drawer ${drawerId} not found for tenant ${tenantOrgId}`);
  }
  return rows[0].ledger_seq;
}
