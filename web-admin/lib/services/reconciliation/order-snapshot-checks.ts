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
        prisma.org_order_preferences_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, order_id: order.id },
          select: { id: true, extra_price: true },
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
        where: { id: order.id },
        select: { total_charges_amount: true },
      }),
    );
    const expectedCharges = toNumber(header?.total_charges_amount);
    const actualCharges = toNumber(chargesAgg._sum.amount);
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
    const itemsSum = items.reduce((s, i) => s + toNumber(i.service_pref_charge), 0);
    const preferencesSum = preferences.reduce((s, p) => s + toNumber(p.extra_price), 0);
    const preferenceChargesSum = preferenceChargeRows.reduce((s, c) => s + toNumber(c.amount), 0);

    // The PREFERENCE charge bucket on the order should fully account for
    // every piece + preference + item extra. If it is short, piece/preference
    // extras have not been rolled into the snapshot.
    const expectedPreferenceCharges = piecesSum + preferencesSum + itemsSum;
    const preferenceChargesDelta = preferenceChargesSum - expectedPreferenceCharges;

    // ── ORDER_PIECES_MATCH_CHARGES ───────────────────────────────────────
    // Pieces under-represented in the preference charge bucket. Threshold uses
    // direction: a shortfall < piecesSum signals missing roll-up.
    if (piecesSum > 0 && preferenceChargesSum + RECONCILIATION_TOLERANCE < piecesSum) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PIECES_MATCH_CHARGES,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: piecesSum,
        actualValue: preferenceChargesSum,
        delta: preferenceChargesSum - piecesSum,
        message: `Order ${order.order_no}: PREFERENCE charges sum (${preferenceChargesSum}) is less than piece-level service_pref_charge sum (${piecesSum}) — piece extras not fully rolled into the snapshot`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── ORDER_PREFERENCES_MATCH_CHARGES ──────────────────────────────────
    if (preferencesSum > 0 && preferenceChargesSum + RECONCILIATION_TOLERANCE < preferencesSum) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PREFERENCES_MATCH_CHARGES,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: preferencesSum,
        actualValue: preferenceChargesSum,
        delta: preferenceChargesSum - preferencesSum,
        message: `Order ${order.order_no}: PREFERENCE charges sum (${preferenceChargesSum}) is less than preference extra_price sum (${preferencesSum}) — preference extras not fully rolled into the snapshot`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    // ── PIECE_EXTRA_PRICE_INCLUDED_ONCE ──────────────────────────────────
    // Inverse direction: if the PREFERENCE bucket exceeds the expected sum by
    // ≥ smallest piece extra, the same source was likely counted twice.
    if (
      piecesSum > 0
      && preferenceChargesDelta >= RECONCILIATION_TOLERANCE
      && preferenceChargesSum > expectedPreferenceCharges
    ) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.PIECE_EXTRA_PRICE_INCLUDED_ONCE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedPreferenceCharges,
        actualValue: preferenceChargesSum,
        delta: preferenceChargesDelta,
        message: `Order ${order.order_no}: PREFERENCE charges sum (${preferenceChargesSum}) exceeds piece + preference + item extras (${expectedPreferenceCharges}) — a piece extra was likely included twice`,
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
