/**
 * B20 — Missing reconciliation checks.
 *
 * Wires the two check-name constants that existed but were never implemented
 * (`TAX_CALCULATION`, `DISCOUNT_VALIDATION` — reconciliation.service.ts:66–71,
 * §13/§50-B20) plus a new D003 v2 policy check (`REFUND_REOPEN_CONSISTENCY`)
 * that D005 calls for in place of the recon-side `+ processedRefunds`
 * conservatism B02 already removed from the shared formula.
 *
 * Why these live together:
 * All three are per-order "detail facts vs header/policy" checks in the same
 * shape as `order-snapshot-checks.ts` (charges/pieces/preferences vs header) —
 * co-locating them keeps that established pattern in one place instead of
 * scattering three more small modules.
 *
 * Window semantics:
 * Each check scopes its own detail rows by `created_at` within the recon
 * window (matching the PRD §22.1 link/amount checks), then batches the
 * order-header projection it needs for the comparison — no N+1 queries.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
  REFUND_CONTEXTS,
} from '@/lib/constants/order-financial';
import {
  ORDER_FINANCIAL_COMPARISON_TOLERANCE,
  round4,
  toAmount,
} from '@/lib/services/order-financial-aggregation';

import { toNumber, type CheckResult } from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

/** refund_context values a positive `reopens_due_amount` may legally carry (D003 v2). */
const REOPEN_ALLOWED_CONTEXTS: ReadonlySet<string> = new Set([
  REFUND_CONTEXTS.REFUND_AND_REBILL,
  REFUND_CONTEXTS.MANUAL_EXCEPTION,
]);

/**
 * TAX_CALCULATION — recompute each recorded tax line's amount from its own
 * `taxable_amount * rate` (the tax engine's own inputs) and compare to the
 * persisted `tax_amount`; then compare the order's active tax-line total to
 * the header `total_tax_amount` stamp.
 *
 * Why a BLOCKER: a line-level mismatch means the persisted tax fact disagrees
 * with the rate that produced it (silent drift in the tax engine or a manual
 * edit); a header mismatch means the header total was not recomputed after
 * the detail lines last changed — either way downstream tax reporting is
 * wrong.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `created_at` on the tax line.
 */
export async function checkTaxCalculation(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const lines = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_taxes_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        rec_status: 1,
      },
      select: { id: true, order_id: true, rate: true, taxable_amount: true, tax_amount: true },
    }),
  );

  if (lines.length === 0) return [];

  const results: CheckResult[] = [];

  // ── Line-level recompute: expected tax_amount from taxable_amount * rate ──
  for (const line of lines) {
    const taxable = toAmount(line.taxable_amount);
    const rate = toAmount(line.rate);
    const expectedTax = round4(taxable * rate);
    const actualTax = toNumber(line.tax_amount);
    const delta = actualTax - expectedTax;

    if (Math.abs(delta) >= ORDER_FINANCIAL_COMPARISON_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.TAX_CALCULATION,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedTax,
        actualValue: actualTax,
        delta,
        message: `Tax line ${line.id} (order ${line.order_id}): recomputed tax (taxable ${taxable} × rate ${rate} = ${expectedTax}) does not match persisted tax_amount (${actualTax})`,
        affectedEntityType: 'org_order_taxes_dtl',
        affectedEntityId: line.id,
      });
    }
  }

  // ── Header-level roll-up: Σ active tax lines (all time) vs header stamp ──
  const orderIds = [...new Set(lines.map((line) => line.order_id))];

  const [allLinesForOrders, headers] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_taxes_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, order_id: { in: orderIds }, rec_status: 1 },
        select: { order_id: true, tax_amount: true },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_orders_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: orderIds } },
        select: { id: true, order_no: true, total_tax_amount: true },
      }),
    ),
  ]);

  const taxByOrder = new Map<string, number>();
  for (const line of allLinesForOrders) {
    taxByOrder.set(line.order_id, (taxByOrder.get(line.order_id) ?? 0) + toAmount(line.tax_amount));
  }

  for (const header of headers) {
    const actualTaxSum = round4(taxByOrder.get(header.id) ?? 0);
    const expectedTaxHeader = toNumber(header.total_tax_amount);
    const delta = actualTaxSum - expectedTaxHeader;

    if (Math.abs(delta) >= ORDER_FINANCIAL_COMPARISON_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.TAX_CALCULATION,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedTaxHeader,
        actualValue: actualTaxSum,
        delta,
        message: `Order ${header.order_no}: active tax-line sum (${actualTaxSum}) does not match header total_tax_amount (${expectedTaxHeader})`,
        affectedEntityType: 'order',
        affectedEntityId: header.id,
      });
    }
  }

  return results;
}

/**
 * DISCOUNT_VALIDATION — discount facts vs rules/caps:
 *   1. A `PERCENTAGE` discount's `discount_rate` must be within (0, 100] —
 *      outside that range is a data-entry/engine bug, not a real discount.
 *   2. Σ active discounts for an order must not exceed the base it discounts
 *      from (`items_base_amount + total_charges_amount`, mirroring the
 *      canonical total formula's itemsBase + charges − discounts term) — a
 *      discount larger than its base is structurally impossible.
 *   3. Σ active discounts must match the header `total_discount_amount` stamp
 *      (facts vs header, same shape as `ORDER_CHARGES_MATCH_SNAPSHOT`).
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `created_at` on the discount row.
 */
export async function checkDiscountValidation(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const windowedRows = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_discounts_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        is_voided: false,
      },
      select: { id: true, order_id: true, discount_type: true, discount_rate: true, discount_amount: true },
    }),
  );

  if (windowedRows.length === 0) return [];

  const results: CheckResult[] = [];

  // ── Rule: PERCENTAGE discount_rate must be within (0, 100] ──────────────
  for (const row of windowedRows) {
    if (row.discount_type !== 'PERCENTAGE') continue;
    const rate = row.discount_rate == null ? null : toAmount(row.discount_rate);

    if (rate == null || rate <= 0 || rate > 100) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.DISCOUNT_VALIDATION,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: rate ?? undefined,
        message: `Discount ${row.id} (order ${row.order_id}): PERCENTAGE discount_rate (${rate ?? 'null'}) is outside the valid (0, 100] range`,
        affectedEntityType: 'org_order_discounts_dtl',
        affectedEntityId: row.id,
      });
    }
  }

  // ── Cap + header roll-up: Σ active discounts (all time) per order ───────
  const orderIds = [...new Set(windowedRows.map((row) => row.order_id))];

  const [allActiveForOrders, headers] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_discounts_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, order_id: { in: orderIds }, is_voided: false },
        select: { order_id: true, discount_amount: true },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_orders_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: orderIds } },
        select: {
          id: true,
          order_no: true,
          total_discount_amount: true,
          items_base_amount: true,
          total_charges_amount: true,
        },
      }),
    ),
  ]);

  const discountByOrder = new Map<string, number>();
  for (const row of allActiveForOrders) {
    discountByOrder.set(
      row.order_id,
      (discountByOrder.get(row.order_id) ?? 0) + toAmount(row.discount_amount),
    );
  }

  for (const header of headers) {
    const actualDiscountSum = round4(discountByOrder.get(header.id) ?? 0);
    const discountBase = toNumber(header.items_base_amount) + toNumber(header.total_charges_amount);

    // Cap: cannot discount more than the base it discounts from.
    if (actualDiscountSum - discountBase >= ORDER_FINANCIAL_COMPARISON_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.DISCOUNT_VALIDATION,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: discountBase,
        actualValue: actualDiscountSum,
        delta: actualDiscountSum - discountBase,
        message: `Order ${header.order_no}: active discount sum (${actualDiscountSum}) exceeds the discountable base (items ${toNumber(header.items_base_amount)} + charges ${toNumber(header.total_charges_amount)} = ${discountBase})`,
        affectedEntityType: 'order',
        affectedEntityId: header.id,
      });
    }

    // Facts vs header stamp.
    const expectedHeaderDiscount = toNumber(header.total_discount_amount);
    const headerDelta = actualDiscountSum - expectedHeaderDiscount;
    if (Math.abs(headerDelta) >= ORDER_FINANCIAL_COMPARISON_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.DISCOUNT_VALIDATION,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedHeaderDiscount,
        actualValue: actualDiscountSum,
        delta: headerDelta,
        message: `Order ${header.order_no}: active discount sum (${actualDiscountSum}) does not match header total_discount_amount (${expectedHeaderDiscount})`,
        affectedEntityType: 'order',
        affectedEntityId: header.id,
      });
    }
  }

  return results;
}

/**
 * REFUND_REOPEN_CONSISTENCY — D003 v2 invariant 7: a positive
 * `reopens_due_amount` may exist only on `REFUND_AND_REBILL` or
 * `MANUAL_EXCEPTION` refund rows. Migration 0404's `chk_refund_reopen_context_v2`
 * enforces this at write time; this check is the monitoring layer that also
 * catches any row the DB constraint cannot see (pre-0404 legacy data, or a row
 * inserted outside the app layer).
 *
 * Why a BLOCKER: a violating row means a commercial refund silently reopened
 * a customer's due — exactly the D003 v2 defect the decision was written to
 * prevent (§ Approved decision, D003).
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `created_at` on the refund row.
 */
export async function checkRefundReopenConsistency(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const rows = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        reopens_due_amount: { gt: 0 },
      },
      select: { id: true, order_id: true, refund_context: true, reopens_due_amount: true },
    }),
  );

  return rows
    .filter((row) => !REOPEN_ALLOWED_CONTEXTS.has(String(row.refund_context ?? '').trim().toUpperCase()))
    .map((row) => ({
      checkName: RECONCILIATION_CHECK_NAMES.REFUND_REOPEN_CONSISTENCY,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: toAmount(row.reopens_due_amount),
      message: `Refund ${row.id} (order ${row.order_id}): reopens_due_amount (${toAmount(row.reopens_due_amount)}) is positive but refund_context "${row.refund_context}" is not REFUND_AND_REBILL or MANUAL_EXCEPTION — D003 v2 violation`,
      affectedEntityType: 'org_order_refunds_dtl',
      affectedEntityId: row.id,
    }));
}
