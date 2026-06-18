import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { LOYALTY_TXN_TYPES, OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { emitEventTx } from './outbox.service';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 *
 * @param tenantId
 */
export async function getLoyaltyConfig(tenantId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_loyalty_programs_cf.findFirst({
      where:   { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      include: { org_loyalty_tiers_cf: { orderBy: { min_points: 'asc' } } },
    })
  );
}

/**
 *
 * @param tenantId
 * @param customerId
 */
export async function getLoyaltyAccount(tenantId: string, customerId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_loyalty_accounts_mst.findFirst({
      where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
    })
  );
}

/**
 *
 * @param tenantId
 * @param pointsBalance
 */
export async function getCustomerTier(
  tenantId: string,
  pointsBalance: number
) {
  return withTenantContext(tenantId, () =>
    prisma.org_loyalty_tiers_cf.findFirst({
      where: {
        tenant_org_id: tenantId,
        min_points:    { lte: pointsBalance },
        is_active:     true,
      },
      orderBy: { min_points: 'desc' },
    })
  );
}

/* eslint-disable jsdoc/require-param */
/**
 * Redeem loyalty points within a transaction (SELECT FOR UPDATE).
 *
 * Phase 2 BVM Wiring contract:
 *  - `idempotencyKey` (required) enables skip-on-existing.
 *  - `voucherId` / `voucherLineId` persist the voucher → ledger backlink
 *    (columns added by migration 0329).
 */
export async function redeemPointsTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId:       string;
    customerId:     string;
    pointsToRedeem: number;
    monetaryAmount: number;
    orderId:        string;
    idempotencyKey: string;
    voucherId?:     string;
    voucherLineId?: string;
  }
) {
  const { tenantId, customerId, pointsToRedeem, orderId, idempotencyKey, voucherId, voucherLineId } = params;

  // Phase 2: idempotency-skip. If this key already produced a ledger row,
  // return it instead of re-debiting points.
  const existing = await tx.org_loyalty_txn_dtl.findFirst({
    where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
  });
  if (existing) return existing;

  const rows = await tx.$queryRaw<{ id: string; points_balance: number }[]>`
    SELECT id, points_balance FROM org_loyalty_accounts_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND is_active     = true
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Loyalty account not found');
  if (rows[0].points_balance < pointsToRedeem) throw new Error('Insufficient loyalty points');

  const pointsBefore = rows[0].points_balance;
  const pointsAfter  = pointsBefore - pointsToRedeem;

  await tx.org_loyalty_accounts_mst.update({
    where: { id: rows[0].id },
    data:  { points_balance: pointsAfter, lifetime_earned: { increment: 0 } },
  });

  return tx.org_loyalty_txn_dtl.create({
    data: {
      tenant_org_id:           tenantId,
      account_id:              rows[0].id,
      customer_id:              customerId,
      txn_type:                LOYALTY_TXN_TYPES.REDEEM,
      points:                  -pointsToRedeem,
      points_before:           pointsBefore,
      points_after:            pointsAfter,
      order_id:                orderId,
      idempotency_key:         idempotencyKey,
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
    },
  });
}

/**
 * Queue a loyalty earn event via the outbox (async — avoids blocking the checkout transaction).
 */
export async function queueEarnPoints(
  tx: PrismaTransactionClient,
  params: {
    tenantId:    string;
    customerId:  string;
    orderId:     string;
    orderAmount: number;
  }
) {
  await emitEventTx(tx, params.tenantId, OUTBOX_EVENT_TYPES.LOYALTY_EARN, 'order', params.orderId, {
    customerId:  params.customerId,
    orderAmount: params.orderAmount,
  });
}

/**
 * Process loyalty earn — called by the outbox worker after ORDER_COMPLETED event.
 */
export async function processEarnPoints(
  tx: PrismaTransactionClient,
  params: {
    tenantId:       string;
    customerId:     string;
    orderId:        string;
    earnPoints:     number;
    monetaryValue:  number;
    idempotencyKey: string;
  }
) {
  const { tenantId, customerId, orderId, earnPoints, idempotencyKey } = params;

  // Fetch loyalty program (need program_id for account creation)
  const program = await tx.org_loyalty_programs_cf.findFirst({
    where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
  });
  if (!program) throw new Error('No active loyalty program found');

  let account = await tx.org_loyalty_accounts_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
  });

  if (!account) {
    account = await tx.org_loyalty_accounts_mst.create({
      data: {
        tenant_org_id: tenantId,
        customer_id:   customerId,
        program_id:    program.id,
        points_balance:0,
        lifetime_earned:0,
        is_active:     true,
        rec_status:    1,
      },
    });
  }

  const pointsBefore = account.points_balance;
  const pointsAfter  = pointsBefore + earnPoints;

  await tx.org_loyalty_accounts_mst.update({
    where: { id: account.id },
    data:  { points_balance: pointsAfter, lifetime_earned: { increment: earnPoints } },
  });

  return tx.org_loyalty_txn_dtl.create({
    data: {
      tenant_org_id:   tenantId,
      account_id:      account.id,
      customer_id:     customerId,
      txn_type:        LOYALTY_TXN_TYPES.EARN,
      points:          earnPoints,
      points_before:   pointsBefore,
      points_after:    pointsAfter,
      order_id:        orderId,
      idempotency_key: idempotencyKey,
    },
  });
}

/**
 * Manually adjust a customer's loyalty point balance (admin action).
 */
export async function adjustPointsTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId:   string;
    customerId: string;
    delta:      number;
    notes?:     string;
    adjustedBy: string;
  }
) {
  const { tenantId, customerId, delta, notes, adjustedBy } = params;

  const rows = await tx.$queryRaw<{ id: string; points_balance: number }[]>`
    SELECT id, points_balance FROM org_loyalty_accounts_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND is_active     = true
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Loyalty account not found');
  const newBalance = rows[0].points_balance + delta;
  if (newBalance < 0) throw new Error('Adjustment would result in negative balance');

  await tx.org_loyalty_accounts_mst.update({
    where: { id: rows[0].id },
    data:  { points_balance: newBalance },
  });

  return tx.org_loyalty_txn_dtl.create({
    data: {
      tenant_org_id:   tenantId,
      account_id:      rows[0].id,
      customer_id:     customerId,
      txn_type:        LOYALTY_TXN_TYPES.ADJUST,
      points:          delta,
      points_before:   rows[0].points_balance,
      points_after:    newBalance,
      notes:           notes ?? null,
      idempotency_key: `adj-${rows[0].id}-${Date.now()}`,
      performed_by:    adjustedBy,
    },
  });
}
