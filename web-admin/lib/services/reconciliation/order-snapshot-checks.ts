/**
 * BVM Phase 4 — Order snapshot / charge integrity checks.
 *
 * Covers PRD §22.1:
 *   - ORDER_CHARGES_MATCH_SNAPSHOT          (Σ active charges = total_charges_amount)
 *   - ORDER_PIECES_MATCH_CHARGES            (Σ piece service_pref_charge accounted for in PREFERENCE charges)
 *   - ORDER_PREFERENCES_MATCH_CHARGES       (Σ preference extra_price accounted for in PREFERENCE charges)
 *   - PIECE_EXTRA_PRICE_INCLUDED_ONCE       (no piece extra counted twice in PREFERENCE charges)
 *   - PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE  (no preference extra counted twice in PREFERENCE charges)
 *
 * Why these live together:
 * Every check folds piece/preference-level pricing into the order header
 * snapshot (`total_charges_amount`) or its supporting PREFERENCE charge rows.
 * The orchestrator can reuse the same fetched order set for all five checks
 * and avoid re-fetching pieces/preferences per check.
 *
 * Window semantics:
 * Operates on the order header set the orchestrator already scopes via
 * `getScopedOrders(periodFrom..periodTo)`. No additional window predicate
 * here — snapshot integrity is per-order regardless of when the order was
 * created within the window.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  CHARGE_TYPES,
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
} from '@/lib/constants/order-financial';

import {
  RECONCILIATION_TOLERANCE,
  toNumber,
  type CheckResult,
} from './types';
import type { ReconciliationOrderRow } from './order-checks';

/**
 * Run all five snapshot/charge integrity checks for the given order set.
 *
 * Why a single entry point:
 * Each check requires the same per-order children (pieces, preferences,
 * charges). Bundling the five into one pass lets us hit each child table
 * once per order instead of five times.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param orders header rows produced by the orchestrator's `getScopedOrders`.
 */
export async function runOrderSnapshotChecks(
  tenantOrgId: string,
  orders: ReconciliationOrderRow[],
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const order of orders) {
    const [chargesAgg, preferenceChargeRows, items, pieces, preferences] = await Promise.all([
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_charges_dtl.aggregate({
          where: {
            tenant_org_id: tenantOrgId,
            order_id: order.id,
            is_voided: false,
          },
          _sum: { amount: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_charges_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            order_id: order.id,
            is_voided: false,
            charge_type: CHARGE_TYPES.PREFERENCE,
          },
          select: { id: true, amount: true, charge_source_id: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_items_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, order_id: order.id },
          select: { id: true, service_pref_charge: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_item_pieces_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, order_id: order.id },
          select: { id: true, service_pref_charge: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        // rec_status: 1 excludes preference rows soft-deleted by a charge
        // void (order-charge.service.ts) — mirrors recalculateOrderFinancialSnapshotTx's
        // own preference/piece aggregates so both consumers agree.
        prisma.org_order_preferences_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, order_id: order.id, rec_status: 1 },
          select: { id: true, extra_price: true, prefs_level: true },
        }),
      ),
    ]);

    // ── ORDER_CHARGES_MATCH_SNAPSHOT ─────────────────────────────────────
    // The header field is `total_charges_amount` — fetched inline because the
    // shared `ReconciliationOrderRow` projection does not include it. The
    // orchestrator (Step 2h) could widen the projection later, but fetching
    // here keeps the snapshot module self-contained without forcing callers
    // that only run balance checks to pay for the wider header read.
    const header = await withTenantContext(tenantOrgId, () =>
      prisma.org_orders_mst.findUnique({
        where: { id: order.id, tenant_org_id: tenantOrgId },
        select: { total_charges_amount: true },
      }),
    );
    const expectedCharges = toNumber(header?.total_charges_amount);
    const orderLevelPrefIds = new Set(
      preferences
        .filter((pref) => String(pref.prefs_level ?? '').toUpperCase() === 'ORDER')
        .map((pref) => pref.id),
    );
    const moneyPreferenceChargeSum = preferenceChargeRows
      .filter((row) => row.charge_source_id && orderLevelPrefIds.has(row.charge_source_id))
      .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const nonPreferenceChargeSum = Math.max(
      0,
      toNumber(chargesAgg._sum.amount) - preferenceChargeRows.reduce((sum, row) => sum + toNumber(row.amount), 0),
    );
    const actualCharges = moneyPreferenceChargeSum + nonPreferenceChargeSum;
    const chargesDelta = actualCharges - expectedCharges;
    if (Math.abs(chargesDelta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_CHARGES_MATCH_SNAPSHOT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedCharges,
        actualValue: actualCharges,
        delta: chargesDelta,
        message: `Order ${order.order_no}: active charges sum (${actualCharges}) does not match header total_charges_amount (${expectedCharges})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── Roll-ups for the next four checks ─────────────────────────────────
    const piecesSum = pieces.reduce((s, p) => s + toNumber(p.service_pref_charge), 0);
    const orderLevelPreferences = preferences.filter(
      (pref) => String(pref.prefs_level ?? '').toUpperCase() === 'ORDER',
    );
    const orderLevelPreferencesSum = orderLevelPreferences.reduce((s, p) => s + toNumber(p.extra_price), 0);
    const itemPiecePreferenceChargeSum = preferenceChargeRows
      .filter((row) => !row.charge_source_id || !orderLevelPrefIds.has(row.charge_source_id))
      .reduce((s, c) => s + toNumber(c.amount), 0);
    const preferenceChargesSum = moneyPreferenceChargeSum;

    // ── ORDER_PIECES_MATCH_CHARGES ───────────────────────────────────────
    // Piece extras belong in line totals. Active ITEM/PIECE PREFERENCE charges
    // mean those extras are still being added as money.
    if (itemPiecePreferenceChargeSum > RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PIECES_MATCH_CHARGES,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: 0,
        actualValue: itemPiecePreferenceChargeSum,
        delta: itemPiecePreferenceChargeSum,
        message: `Order ${order.order_no}: ITEM/PIECE PREFERENCE charges (${itemPiecePreferenceChargeSum}) are still active — piece extras must live in items_base_amount only`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── ORDER_PREFERENCES_MATCH_CHARGES ──────────────────────────────────
    if (Math.abs(preferenceChargesSum - orderLevelPreferencesSum) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PREFERENCES_MATCH_CHARGES,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: orderLevelPreferencesSum,
        actualValue: preferenceChargesSum,
        delta: preferenceChargesSum - orderLevelPreferencesSum,
        message: `Order ${order.order_no}: ORDER-level PREFERENCE charges (${preferenceChargesSum}) do not match ORDER-level extra_price sum (${orderLevelPreferencesSum})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── PIECE_EXTRA_PRICE_INCLUDED_ONCE ──────────────────────────────────
    // Piece extras already in items_base must not also appear as money charges.
    if (piecesSum > 0 && itemPiecePreferenceChargeSum >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.PIECE_EXTRA_PRICE_INCLUDED_ONCE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: 0,
        actualValue: itemPiecePreferenceChargeSum,
        delta: itemPiecePreferenceChargeSum,
        message: `Order ${order.order_no}: piece extras (${piecesSum}) are also present as PREFERENCE charges (${itemPiecePreferenceChargeSum})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE ─────────────────────────────
    // Distinct from PIECE check by `charge_source_id` collision: when more
    // than one PREFERENCE charge row points at the same preference source,
    // that preference's extra has been counted twice.
    const sourceCounts = new Map<string, number>();
    for (const row of preferenceChargeRows) {
      if (!row.charge_source_id) continue;
      sourceCounts.set(row.charge_source_id, (sourceCounts.get(row.charge_source_id) ?? 0) + 1);
    }
    for (const [sourceId, count] of sourceCounts) {
      if (count > 1) {
        results.push({
          checkName: RECONCILIATION_CHECK_NAMES.PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE,
          severity: RECONCILIATION_SEVERITIES.BLOCKER,
          passed: false,
          actualValue: count,
          message: `Order ${order.order_no}: preference source ${sourceId} appears in ${count} PREFERENCE charge rows — preference extra counted more than once`,
          affectedEntityType: 'order',
          affectedEntityId: order.id,
        });
      }
    }
  }

  return results;
}
