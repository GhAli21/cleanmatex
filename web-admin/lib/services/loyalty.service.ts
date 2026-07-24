import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  LOYALTY_ERROR_CODES,
  LOYALTY_ROUNDING_RULES,
  LOYALTY_TXN_TYPES,
  OUTBOX_EVENT_TYPES,
  type LoyaltyRoundingRule,
} from '@/lib/constants/order-financial';
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
 * B21 — round a fractional points computation to a whole point count per
 * the tenant's configured rounding rule. Points must be an integer;
 * `redeemPointsTx` compares against an integer `points_balance`.
 *
 * @param raw points/currency-unit ratio before rounding (always >= 0 here — the caller only calls this for a positive redemption amount)
 * @param rule the tenant's org_loyalty_programs_cf.rounding_rule value
 */
export function roundLoyaltyPoints(raw: number, rule: LoyaltyRoundingRule): number {
  switch (rule) {
    case LOYALTY_ROUNDING_RULES.FLOOR:
      return Math.floor(raw);
    case LOYALTY_ROUNDING_RULES.HALF_UP:
      return Math.round(raw);
    case LOYALTY_ROUNDING_RULES.HALF_DOWN: {
      const fractional = raw - Math.floor(raw);
      return fractional > 0.5 ? Math.ceil(raw) : Math.floor(raw);
    }
    case LOYALTY_ROUNDING_RULES.CEIL:
    default:
      return Math.ceil(raw);
  }
}

/**
 * B21 — resolve how many whole points a `monetaryAmount` redemption costs,
 * per the tenant's configured rate/rounding rule, and enforce the
 * min-redemption floor. The ONE place this math happens — both
 * `applyStoredValueDebitTx` (order-credit-application.service.ts, the live
 * BVM-wiring path) and the legacy `settleOrderTx` branch
 * (order-settlement.service.ts) call this instead of resolving the rate
 * inline, closing the drift risk between the two (B21's §44 finding).
 *
 * Fails loudly — never falls back to another field's value (the exact
 * `option.minAmount` misuse this package replaces) and never silently
 * accepts a below-threshold redemption.
 *
 * @param tenantId tenant whose loyalty program config applies
 * @param monetaryAmount the currency amount the customer wants to cover with points
 * @throws Error(LOYALTY_NOT_CONFIGURED) no active program, or redeem_rate_per_point <= 0
 * @throws Error(LOYALTY_BELOW_MIN_REDEEM) computed points fall below min_redeem_points
 */
export async function resolveLoyaltyRedemptionPoints(
  tenantId: string,
  monetaryAmount: number,
): Promise<number> {
  const config = await getLoyaltyConfig(tenantId);
  const redeemRate = config ? Number(config.redeem_rate_per_point) : 0;
  if (!config || !(redeemRate > 0)) {
    throw new Error(LOYALTY_ERROR_CODES.LOYALTY_NOT_CONFIGURED);
  }

  const rule = (config.rounding_rule as LoyaltyRoundingRule) ?? LOYALTY_ROUNDING_RULES.CEIL;
  const pointsToRedeem = roundLoyaltyPoints(monetaryAmount / redeemRate, rule);

  if (pointsToRedeem < config.min_redeem_points) {
    throw new Error(LOYALTY_ERROR_CODES.LOYALTY_BELOW_MIN_REDEEM);
  }

  return pointsToRedeem;
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

  // Idempotency-skip (mirrors redeemPointsTx). The outbox delivers LOYALTY_EARN
  // at-least-once, so a re-delivery must not double-credit. The DB unique
  // `uq_loyalty_txn_idempotency (tenant_org_id, idempotency_key)` already
  // prevents a duplicate row, but without this graceful skip the second
  // delivery throws a raw unique-violation that rolls back the worker tx and
  // wedges the event in a retry loop. Returning the existing row lets the
  // worker mark the event processed.
  const existing = await tx.org_loyalty_txn_dtl.findFirst({
    where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
  });
  if (existing) return existing;

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
 *
 * Pass `idempotencyKey` (e.g. a request id) to make a retried adjustment a
 * safe no-op replay. When omitted, a per-call random key is generated so two
 * distinct adjustments never collide — `crypto.randomUUID()` replaces the old
 * `Date.now()` key, which could collide for two adjustments in the same
 * millisecond and trip `uq_loyalty_txn_idempotency`.
 */
export async function adjustPointsTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId:        string;
    customerId:      string;
    delta:           number;
    notes?:          string;
    adjustedBy:      string;
    idempotencyKey?: string;
  }
) {
  const { tenantId, customerId, delta, notes, adjustedBy, idempotencyKey } = params;

  // Idempotency-skip when the caller supplies a key (mirrors redeem/earn).
  if (idempotencyKey) {
    const existing = await tx.org_loyalty_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

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
      idempotency_key: idempotencyKey ?? `adj-${rows[0].id}-${randomUUID()}`,
      performed_by:    adjustedBy,
    },
  });
}
