import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { throwBusinessError } from '@/lib/utils/business-error';
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function loyaltyExpiryCutoff(pointsExpiryDays: number | null | undefined): Date | null {
  if (pointsExpiryDays == null || pointsExpiryDays <= 0) return null;
  return new Date(Date.now() - pointsExpiryDays * MS_PER_DAY);
}

/**
 * B19 FIFO ledger — draw `pointsToConsume` from this account's oldest open
 * lots first (rows with `remaining_points > 0`, ordered by `created_at`),
 * writing one `org_loyalty_txn_allocs_dtl` row per lot drawn on. Called by
 * every debit path (redeem, negative adjust, expiry) after the consuming
 * `org_loyalty_txn_dtl` row already exists, so allocations can reference it.
 *
 * Throws `LOYALTY_LOT_ALLOCATION_SHORTFALL` if the open lots don't cover the
 * requested amount — this should never happen when every credit path sets
 * `remaining_points` and every debit path routes through here (the
 * invariant `SUM(remaining_points) per account === points_balance` always
 * holds), so a shortfall means real ledger drift and must surface loudly,
 * never silently under-allocate.
 */
async function consumeLoyaltyLotsTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  accountId: string,
  consumingTxnId: string,
  pointsToConsume: number,
  minCreatedAt: Date = new Date(0),
): Promise<void> {
  if (pointsToConsume <= 0) return;

  const lots = await tx.$queryRaw<{ id: string; remaining_points: number }[]>`
    SELECT id, remaining_points FROM org_loyalty_txn_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND account_id   = ${accountId}::uuid
      AND remaining_points > 0
      AND created_at >= ${minCreatedAt}
    ORDER BY created_at ASC, id ASC
    FOR UPDATE`;

  let remaining = pointsToConsume;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const draw = Math.min(lot.remaining_points, remaining);

    await tx.org_loyalty_txn_dtl.update({
      where: { id: lot.id, tenant_org_id: tenantId },
      data: { remaining_points: { decrement: draw } },
    });
    await tx.org_loyalty_txn_allocs_dtl.create({
      data: {
        tenant_org_id: tenantId,
        account_id: accountId,
        consuming_txn_id: consumingTxnId,
        source_txn_id: lot.id,
        applied_points: draw,
      },
    });

    remaining -= draw;
  }

  if (remaining > 0) {
    throw new Error('LOYALTY_LOT_ALLOCATION_SHORTFALL');
  }
}

/**
 * Zero remaining points on lots older than `cutoff` and write one EXPIRE
 * ledger row. Caller must already hold the account row lock.
 */
async function expireOpenLotsInTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  account: { id: string; points_balance: number; customer_id: string },
  cutoff: Date,
  idempotencyKey?: string,
): Promise<{ expiredPoints: number; pointsBalanceAfter: number }> {
  const lots = await tx.$queryRaw<{ id: string; remaining_points: number }[]>`
    SELECT id, remaining_points FROM org_loyalty_txn_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND account_id   = ${account.id}::uuid
      AND remaining_points > 0
      AND created_at < ${cutoff}
    ORDER BY created_at ASC, id ASC
    FOR UPDATE`;

  const totalExpiring = lots.reduce((sum, lot) => sum + Number(lot.remaining_points), 0);
  if (totalExpiring <= 0) {
    return { expiredPoints: 0, pointsBalanceAfter: account.points_balance };
  }

  const pointsBefore = account.points_balance;
  const pointsAfter = Math.max(0, pointsBefore - totalExpiring);

  await tx.org_loyalty_accounts_mst.update({
    where: { id: account.id, tenant_org_id: tenantId },
    data: { points_balance: pointsAfter },
  });

  const expireTxn = await tx.org_loyalty_txn_dtl.create({
    data: {
      tenant_org_id:   tenantId,
      account_id:      account.id,
      customer_id:     account.customer_id,
      txn_type:        LOYALTY_TXN_TYPES.EXPIRE,
      points:          -totalExpiring,
      points_before:   pointsBefore,
      points_after:    pointsAfter,
      notes:           `Expired ${lots.length} lot(s) earned before ${cutoff.toISOString().slice(0, 10)}`,
      created_info:    'system/loyalty-points-expiry',
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
  });

  for (const lot of lots) {
    await tx.org_loyalty_txn_dtl.update({
      where: { id: lot.id, tenant_org_id: tenantId },
      data: { remaining_points: { decrement: lot.remaining_points } },
    });
    await tx.org_loyalty_txn_allocs_dtl.create({
      data: {
        tenant_org_id:    tenantId,
        account_id:       account.id,
        consuming_txn_id: expireTxn.id,
        source_txn_id:    lot.id,
        applied_points:   lot.remaining_points,
      },
    });
  }

  return { expiredPoints: totalExpiring, pointsBalanceAfter: pointsAfter };
}

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
    throwBusinessError(LOYALTY_ERROR_CODES.LOYALTY_NOT_CONFIGURED, {
      redeemRatePerPoint: redeemRate,
    });
  }

  const rule = (config.rounding_rule as LoyaltyRoundingRule) ?? LOYALTY_ROUNDING_RULES.CEIL;
  const pointsToRedeem = roundLoyaltyPoints(monetaryAmount / redeemRate, rule);

  if (pointsToRedeem < config.min_redeem_points) {
    throwBusinessError(LOYALTY_ERROR_CODES.LOYALTY_BELOW_MIN_REDEEM, {
      minRedeemPoints: config.min_redeem_points,
      pointsToRedeem,
      monetaryAmount,
      redeemRatePerPoint: redeemRate,
    });
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

  const rows = await tx.$queryRaw<{ id: string; points_balance: number; customer_id: string }[]>`
    SELECT id, points_balance, customer_id FROM org_loyalty_accounts_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND is_active     = true
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Loyalty account not found');

  const program = await tx.org_loyalty_programs_cf.findFirst({
    where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
    select: { points_expiry_days: true },
  });
  const cutoff = loyaltyExpiryCutoff(program?.points_expiry_days);
  let pointsBalance = rows[0].points_balance;
  if (cutoff) {
    const expired = await expireOpenLotsInTx(tx, tenantId, rows[0], cutoff);
    pointsBalance = expired.pointsBalanceAfter;
  }

  if (pointsBalance < pointsToRedeem) throw new Error('Insufficient loyalty points');

  const pointsBefore = pointsBalance;
  const pointsAfter  = pointsBefore - pointsToRedeem;

  await tx.org_loyalty_accounts_mst.update({
    where: { id: rows[0].id, tenant_org_id: tenantId },
    data:  { points_balance: pointsAfter, lifetime_earned: { increment: 0 } },
  });

  const redeemTxn = await tx.org_loyalty_txn_dtl.create({
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

  // B19 FIFO ledger — draw the redeemed points from the oldest open earn
  // lot(s) so a later expiry sweep only ever touches genuinely unconsumed points.
  await consumeLoyaltyLotsTx(
    tx,
    tenantId,
    rows[0].id,
    redeemTxn.id,
    pointsToRedeem,
    cutoff ?? new Date(0),
  );

  return redeemTxn;
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
    where: { id: account.id, tenant_org_id: tenantId },
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
      // B19 FIFO ledger — this EARN row is a new lot, fully unconsumed until
      // a later redemption or the expiry sweep draws it down.
      remaining_points: earnPoints,
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
    where: { id: rows[0].id, tenant_org_id: tenantId },
    data:  { points_balance: newBalance },
  });

  const adjustTxn = await tx.org_loyalty_txn_dtl.create({
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
      // B19 FIFO ledger — a positive adjustment is itself a new lot; a
      // negative one draws from existing open lots like any other debit.
      remaining_points: delta > 0 ? delta : null,
    },
  });

  if (delta < 0) {
    await consumeLoyaltyLotsTx(tx, tenantId, rows[0].id, adjustTxn.id, -delta);
  }

  return adjustTxn;
}

/**
 * B19 — expire every open lot (remaining_points > 0) older than `cutoff` for
 * one account, in a single atomic sweep. Aggregates all qualifying lots into
 * ONE EXPIRE ledger row (full per-lot traceability still lives in
 * `org_loyalty_txn_allocs_dtl`) rather than one row per lot, mirroring how a
 * multi-lot redemption already produces one REDEEM row with N allocations.
 *
 * Safe to call at any time: lots already zeroed are skipped. A same-day
 * retry after a failure continues remaining due lots instead of no-op'ing
 * on a daily idempotency key (lots can become due later the same day).
 * @param tenantId
 * @param accountId
 * @param cutoff lots with `created_at` before this instant are expired
 */
export async function expireLoyaltyPointsForAccount(
  tenantId: string,
  accountId: string,
  cutoff: Date,
): Promise<{ success: boolean; expiredPoints: number; error?: string }> {
  return withTenantContext(tenantId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const accountRows = await tx.$queryRaw<
          { id: string; points_balance: number; customer_id: string }[]
        >`
          SELECT id, points_balance, customer_id FROM org_loyalty_accounts_mst
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${accountId}::uuid
          FOR UPDATE`;
        const account = accountRows[0];
        if (!account) return { success: false, expiredPoints: 0, error: 'LOYALTY_ACCOUNT_NOT_FOUND' };

        const expired = await expireOpenLotsInTx(tx, tenantId, account, cutoff);
        return { success: true, expiredPoints: expired.expiredPoints };
      });
    } catch (error) {
      logger.error('Error expiring loyalty points', error as Error, { tenantId, accountId });
      return {
        success: false,
        expiredPoints: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}

/**
 * Catch-up sweep for accounts nobody opened today. Live available points
 * are applied by {@link syncAvailableLoyaltyPoints} on checkout / customer
 * read — this job only keeps unused accounts' ledgers honest.
 * @param tenantId
 */
export async function expireLoyaltyPoints(
  tenantId: string,
): Promise<{ expiredCount: number; failedCount: number }> {
  return withTenantContext(tenantId, async () => {
    const program = await prisma.org_loyalty_programs_cf.findFirst({
      where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: { points_expiry_days: true },
    });
    if (!program || program.points_expiry_days == null || program.points_expiry_days <= 0) {
      return { expiredCount: 0, failedCount: 0 };
    }

    const cutoff = new Date(Date.now() - program.points_expiry_days * 24 * 60 * 60 * 1000);

    const eligibleAccounts = await prisma.$queryRaw<{ account_id: string }[]>`
      SELECT DISTINCT account_id FROM org_loyalty_txn_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND remaining_points > 0
        AND created_at < ${cutoff}`;

    let expiredCount = 0;
    let failedCount = 0;
    for (const row of eligibleAccounts) {
      const result = await expireLoyaltyPointsForAccount(tenantId, row.account_id, cutoff);
      if (result.success) {
        expiredCount++;
      } else {
        failedCount++;
      }
    }
    return { expiredCount, failedCount };
  });
}

/** One row of a customer's loyalty ledger, shaped for the UI history list. */
export interface LoyaltyTransactionView {
  id: string;
  txnType: string;
  points: number;
  pointsBefore: number;
  pointsAfter: number;
  orderId: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Recent ledger rows for a customer's loyalty account, newest first —
 * powers the Loyalty tab's transaction history.
 * @param tenantId
 * @param accountId
 * @param limit
 */
export async function getLoyaltyTransactions(
  tenantId: string,
  accountId: string,
  limit = 50,
): Promise<LoyaltyTransactionView[]> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.org_loyalty_txn_dtl.findMany({
      where: { tenant_org_id: tenantId, account_id: accountId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        txn_type: true,
        points: true,
        points_before: true,
        points_after: true,
        order_id: true,
        notes: true,
        created_at: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      txnType: row.txn_type,
      points: row.points,
      pointsBefore: row.points_before,
      pointsAfter: row.points_after,
      orderId: row.order_id,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  });
}

/** Spendable vs already-due lot split for one account. */
export interface SpendableLoyaltyPoints {
  /** Points still inside the expiry window (what checkout may redeem). */
  spendablePoints: number;
  /** Open-lot points already past cutoff that have not been written as EXPIRE yet. */
  expiredUnappliedPoints: number;
}

/** Live available-points result after applying due expiry to the ledger. */
export interface SyncedLoyaltyPoints extends SpendableLoyaltyPoints {
  /** Points written as EXPIRE during this sync (0 when nothing was due). */
  expiredNow: number;
}

/**
 * Apply every currently due expiry to the ledger, then return live available
 * points. Checkout, customer loyalty, and redeem must use this — available
 * balance is not allowed to wait for the nightly sweep.
 */
export async function syncAvailableLoyaltyPoints(
  tenantId: string,
  accountId: string,
  fallbackLedgerPoints = 0,
): Promise<SyncedLoyaltyPoints> {
  const program = await withTenantContext(tenantId, () =>
    prisma.org_loyalty_programs_cf.findFirst({
      where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: { points_expiry_days: true },
    }),
  );
  const cutoff = loyaltyExpiryCutoff(program?.points_expiry_days);
  let expiredNow = 0;
  if (cutoff) {
    const expired = await expireLoyaltyPointsForAccount(tenantId, accountId, cutoff);
    if (expired.success) {
      expiredNow = expired.expiredPoints;
    } else {
      logger.warn('Live loyalty expiry sync failed; returning read-time spendable', {
        tenantId,
        accountId,
        error: expired.error,
      });
    }
  }

  const spendable = await getSpendableLoyaltyPoints(tenantId, accountId, fallbackLedgerPoints);
  return { ...spendable, expiredNow };
}

/**
 * Read-only available-points split. Prefer {@link syncAvailableLoyaltyPoints}
 * on cashier/customer surfaces so the ledger is updated in the same call.
 */
export async function getSpendableLoyaltyPoints(
  tenantId: string,
  accountId: string,
  fallbackLedgerPoints = 0,
): Promise<SpendableLoyaltyPoints> {
  return withTenantContext(tenantId, async () => {
    const program = await prisma.org_loyalty_programs_cf.findFirst({
      where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: { points_expiry_days: true },
    });
    const cutoff = loyaltyExpiryCutoff(program?.points_expiry_days);
    const lots = await prisma.org_loyalty_txn_dtl.findMany({
      where: { tenant_org_id: tenantId, account_id: accountId, remaining_points: { gt: 0 } },
      select: { remaining_points: true, created_at: true },
    });

    if (lots.length === 0) {
      // Pre-lot ledger rows have no remaining_points to split — keep the
      // cached balance rather than showing a false zero.
      return { spendablePoints: fallbackLedgerPoints, expiredUnappliedPoints: 0 };
    }

    if (!cutoff) {
      const spendablePoints = lots.reduce((sum, lot) => sum + Number(lot.remaining_points), 0);
      return { spendablePoints, expiredUnappliedPoints: 0 };
    }

    const cutoffMs = cutoff.getTime();
    let spendablePoints = 0;
    let expiredUnappliedPoints = 0;
    for (const lot of lots) {
      const remaining = Number(lot.remaining_points);
      if (lot.created_at.getTime() < cutoffMs) {
        expiredUnappliedPoints += remaining;
      } else {
        spendablePoints += remaining;
      }
    }
    return { spendablePoints, expiredUnappliedPoints };
  });
}

/** Points due to expire soon, for the Loyalty tab's expiry banner. */
export interface LoyaltyExpirySummary {
  pointsExpiryDays: number | null;
  /** Points from the single soonest-expiring *still-valid* open lot, and the date they expire. */
  nextExpiry: { points: number; expiresAt: Date } | null;
  /** Total still-valid points expiring within the next 30 days across open lots. */
  expiringWithin30Days: number;
  /** Open-lot points already past cutoff that have not been written as EXPIRE yet. */
  expiredUnappliedPoints: number;
}

/**
 * Resolves upcoming expiry exposure for one loyalty account from its open
 * lots (`remaining_points > 0`) and the tenant's `points_expiry_days`.
 * Returns an all-null/zero summary when the tenant has no expiry policy —
 * the UI renders nothing in that case rather than a misleading "0 expiring".
 * @param tenantId
 * @param accountId
 */
export async function getLoyaltyExpirySummary(
  tenantId: string,
  accountId: string,
): Promise<LoyaltyExpirySummary> {
  return withTenantContext(tenantId, async () => {
    const program = await prisma.org_loyalty_programs_cf.findFirst({
      where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: { points_expiry_days: true },
    });
    const pointsExpiryDays = program?.points_expiry_days ?? null;
    if (!pointsExpiryDays || pointsExpiryDays <= 0) {
      return {
        pointsExpiryDays: null,
        nextExpiry: null,
        expiringWithin30Days: 0,
        expiredUnappliedPoints: 0,
      };
    }

    const lots = await prisma.org_loyalty_txn_dtl.findMany({
      where: { tenant_org_id: tenantId, account_id: accountId, remaining_points: { gt: 0 } },
      orderBy: { created_at: 'asc' },
      select: { remaining_points: true, created_at: true },
    });

    if (lots.length === 0) {
      return { pointsExpiryDays, nextExpiry: null, expiringWithin30Days: 0, expiredUnappliedPoints: 0 };
    }

    const expiryMs = pointsExpiryDays * MS_PER_DAY;
    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * MS_PER_DAY;

    let expiredUnappliedPoints = 0;
    const stillValid: { remaining_points: number; created_at: Date; expiresAt: number }[] = [];
    for (const lot of lots) {
      const expiresAt = lot.created_at.getTime() + expiryMs;
      const remaining = lot.remaining_points ?? 0;
      if (expiresAt <= now) {
        expiredUnappliedPoints += remaining;
      } else {
        stillValid.push({ remaining_points: remaining, created_at: lot.created_at, expiresAt });
      }
    }

    const soonest = stillValid[0];
    const expiringWithin30Days = stillValid.reduce((sum, lot) => {
      return lot.expiresAt <= thirtyDaysFromNow ? sum + lot.remaining_points : sum;
    }, 0);

    return {
      pointsExpiryDays,
      nextExpiry: soonest
        ? { points: soonest.remaining_points, expiresAt: new Date(soonest.expiresAt) }
        : null,
      expiringWithin30Days,
      expiredUnappliedPoints,
    };
  });
}
