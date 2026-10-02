/**
 * BVM Phase 4 — Voucher integrity & cash-movement checks.
 *
 * Covers PRD §22.1:
 *   - VOUCHER_TOTAL_EQUALS_LINES
 *   - NO_DUPLICATE_OPERATIONAL_EFFECT
 *   - GATEWAY_STATE_VALID
 *   - CASH_MOVEMENT_LINK_EXISTS
 *   - CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT
 *
 * Why one module:
 * Voucher-level invariants and cash-movement invariants both validate the
 * `org_fin_voucher_trx_lines_dtl` shape, just from different directions:
 *   - VOUCHER_* checks operate on a voucher (or set of vouchers) and walk
 *     its lines.
 *   - CASH_MOVEMENT_* checks operate on `org_cash_drawer_movements_dtl` rows
 *     and verify the line they reference.
 *
 * Re-use:
 * The voucher-level helpers (`runVoucherIntegrityChecks`) are reused by the
 * voucher-scoped reconciliation service (PRD §23.1 / §24.3) to validate one
 * voucher in isolation. The cash-movement helpers are tenant-window-scoped
 * and used only by the orchestrator.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
} from '@/lib/constants/order-financial';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { CASH_PAYMENT_METHOD_CODES } from '@/lib/utils/cash-method';

import {
  RECONCILIATION_TOLERANCE,
  toNumber,
  type CheckResult,
} from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

/**
 * Header shape consumed by `runVoucherIntegrityChecks`.
 *
 * Voucher-scoped service (Step 2i) fetches one row; orchestrator fetches the
 * tenant-window set. Both pass through this same projection.
 */
export interface VoucherHeader {
  id: string;
  voucher_no: string;
  total_amount: import('@prisma/client/runtime/library').Decimal;
  voucher_status: string;
}

/**
 * Run the three voucher-level integrity checks (VOUCHER_TOTAL_EQUALS_LINES,
 * NO_DUPLICATE_OPERATIONAL_EFFECT, GATEWAY_STATE_VALID) against the given
 * voucher set.
 *
 * @param tenantOrgId active tenant — every query scoped via `withTenantContext`.
 * @param vouchers voucher headers to validate. Pre-filtered to POSTED status
 *   by the caller (orchestrator or voucher-scoped service) because only
 *   posted vouchers carry the GL invariants the checks enforce.
 */
export async function runVoucherIntegrityChecks(
  tenantOrgId: string,
  vouchers: VoucherHeader[],
): Promise<CheckResult[]> {
  if (vouchers.length === 0) return [];

  const voucherIds = vouchers.map((v) => v.id);

  // Single batched fetch of every line for every voucher we are about to
  // validate. Three checks consume this list so we avoid 3× N+1.
  const lines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        voucher_id: { in: voucherIds },
        is_active: true,
      },
      select: {
        id: true,
        voucher_id: true,
        line_role: true,
        target_type: true,
        target_id: true,
        amount: true,
        gateway_code: true,
        gateway_transaction_id: true,
        reversed_line_id: true,
        line_status: true,
      },
    }),
  );

  const linesByVoucher = new Map<string, typeof lines>();
  for (const line of lines) {
    const arr = linesByVoucher.get(line.voucher_id) ?? [];
    arr.push(line);
    linesByVoucher.set(line.voucher_id, arr);
  }

  const results: CheckResult[] = [];

  for (const voucher of vouchers) {
    const vlines = linesByVoucher.get(voucher.id) ?? [];

    // ── VOUCHER_TOTAL_EQUALS_LINES ───────────────────────────────────────
    const linesSum = vlines.reduce((s, l) => s + toNumber(l.amount), 0);
    const headerTotal = toNumber(voucher.total_amount);
    const totalDelta = linesSum - headerTotal;
    if (Math.abs(totalDelta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.VOUCHER_TOTAL_EQUALS_LINES,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: headerTotal,
        actualValue: linesSum,
        delta: totalDelta,
        message: `Voucher ${voucher.voucher_no}: trx line amounts sum (${linesSum}) does not match header total_amount (${headerTotal})`,
        affectedEntityType: 'voucher',
        affectedEntityId: voucher.id,
      });
    }

    // ── NO_DUPLICATE_OPERATIONAL_EFFECT ──────────────────────────────────
    // Two non-reversal lines with the same (line_role, target_type, target_id)
    // triple represent the same operational effect being recorded twice.
    // Reversal lines (`reversed_line_id IS NOT NULL`) are exempt because they
    // intentionally mirror an earlier line to cancel it.
    const effectKeyCounts = new Map<string, string[]>();
    for (const line of vlines) {
      if (line.reversed_line_id) continue;
      if (!line.line_role || !line.target_type || !line.target_id) continue;
      const key = `${line.line_role}|${line.target_type}|${line.target_id}`;
      const arr = effectKeyCounts.get(key) ?? [];
      arr.push(line.id);
      effectKeyCounts.set(key, arr);
    }
    for (const [key, ids] of effectKeyCounts) {
      if (ids.length <= 1) continue;
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.NO_DUPLICATE_OPERATIONAL_EFFECT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: ids.length,
        message: `Voucher ${voucher.voucher_no}: ${ids.length} non-reversal lines share effect ${key} (line ids: ${ids.join(', ')})`,
        affectedEntityType: 'voucher',
        affectedEntityId: voucher.id,
      });
    }

    // ── GATEWAY_STATE_VALID ──────────────────────────────────────────────
    // Any line that declares a gateway_code must also carry the
    // gateway_transaction_id; the inverse (txn id but no code) is also a
    // broken state. Both shapes block GL posting because the gateway leg
    // cannot be reconciled to the gateway-side report without both fields.
    for (const line of vlines) {
      const hasCode = !!line.gateway_code;
      const hasTxn = !!line.gateway_transaction_id;
      if (hasCode === hasTxn) continue;
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.GATEWAY_STATE_VALID,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        message: hasCode
          ? `Voucher ${voucher.voucher_no} line ${line.id}: gateway_code ${line.gateway_code} but no gateway_transaction_id`
          : `Voucher ${voucher.voucher_no} line ${line.id}: gateway_transaction_id ${line.gateway_transaction_id} but no gateway_code`,
        affectedEntityType: 'voucher_trx_line',
        affectedEntityId: line.id,
      });
    }
  }

  return results;
}

/**
 * CASH_MOVEMENT_LINK_EXISTS — every active cash-drawer movement created in
 * the window must carry both `fin_voucher_id` and `fin_voucher_trx_line_id`
 * (mig 0303 backlinks).
 *
 * Why BLOCKER: a cash movement without a voucher backlink means cash entered
 * or left the drawer outside the BVM accounting trail.
 *
 * @param tenantOrgId active tenant — query scoped via `withTenantContext`.
 * @param window applied against `performed_at` on the movement row.
 */
export async function checkCashMovementLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  // CLF-6-3: replaces the retired `org_cash_drawer_movements_dtl` orphan
  // check (no table in the new model can write cash outside a voucher line
  // by construction — CLF-5/W1-W15 removed every writer capable of it, same
  // reasoning as `getCashDrawerReconReport`'s now-permanent-0
  // `unlinkedMovementCount`). The live equivalent hazard is a POSTED
  // cash-family voucher line the CLF gate never stamped at all (`cash_
  // effect_code IS NULL` is not a valid terminal gate state — every posted
  // cash-family line is PENDING/DRAWER/UNTRACKED/NONE by the gate's own
  // contract, see `lib/constants/cash-drawer.ts`'s `CASH_EFFECTS`) — a gate
  // bypass or a code path that posts cash without running through it.
  const unstamped = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        updated_at: { gte: window.periodFrom, lte: window.periodTo },
        line_status: 'POSTED',
        payment_method_code: { in: [...CASH_PAYMENT_METHOD_CODES] },
        cash_effect_code: null,
      },
      select: {
        id: true,
        voucher_id: true,
        line_role: true,
        direction: true,
        amount: true,
      },
    }),
  );

  return unstamped.map((row) => {
    const amount = toNumber(row.amount);
    return {
      checkName: RECONCILIATION_CHECK_NAMES.CASH_MOVEMENT_LINK_EXISTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: amount,
      message: `Voucher trx line ${row.id} (voucher ${row.voucher_id}, ${row.line_role} ${row.direction} ${amount}) is a POSTED cash-family line the CLF gate never stamped — cash_effect_code is NULL`,
      affectedEntityType: 'org_fin_voucher_trx_lines_dtl',
      affectedEntityId: row.id,
    };
  });
}

/**
 * CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT (B30/B32) — a payment leg that ends
 * up CANCELLED or FAILED must never carry a live CASH_SALE movement, because
 * `cashDrawerWiringHandler.canHandle` (B32) only creates one for an
 * effective-COMPLETED leg, and `payment-transition.service.ts`'s CANCEL/
 * FAIL_BOUNCE path never sources from COMPLETED (that needs a B10 reversal
 * instead). This should be structurally unreachable — the check exists as
 * a trip-wire for a regression in either invariant, not routine drift.
 */
// CLF-6-3 note: dormant since R1 (2026-09-26) — nothing writes to
// `org_cash_drawer_movements_dtl` anymore, so this can no longer find a
// violation (harmless, not a false negative: the hazard it guards — a
// CANCELLED/FAILED leg carrying a live CASH_SALE movement — is structurally
// unreachable once no writer can create that movement at all). Kept for
// pre-CLF historical data; retire alongside the table in R3.
export async function checkCancelledPaymentNoOrphanMovement(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const rows = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        payment_status: { in: ['CANCELLED', 'FAILED'] },
        updated_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: {
        id: true,
        order_id: true,
        payment_status: true,
        org_cash_drawer_movements_dtl: {
          where: { movement_type: 'CASH_SALE', is_active: true },
          select: { id: true, amount: true },
        },
      },
    }),
  );

  const violations: CheckResult[] = [];
  for (const row of rows) {
    for (const movement of row.org_cash_drawer_movements_dtl ?? []) {
      violations.push({
        checkName: RECONCILIATION_CHECK_NAMES.CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(movement.amount),
        message: `Payment ${row.id} (order ${row.order_id}) is ${row.payment_status} but still has a live CASH_SALE movement ${movement.id} — B32 status-gate invariant violated`,
        affectedEntityType: 'org_order_payments_dtl',
        affectedEntityId: row.id,
      });
    }
  }
  return violations;
}

/**
 * VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT (B10) — same trip-wire as
 * CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT, extended to the new VOIDED status: a
 * never-effective leg (PENDING/PROCESSING/AUTHORIZED source) must never carry
 * a live CASH_SALE movement.
 */
// CLF-6-3 note: dormant since R1, same reasoning as
// `checkCancelledPaymentNoOrphanMovement` above — retire alongside the table in R3.
export async function checkVoidedPaymentNoOrphanMovement(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const rows = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        payment_status: 'VOIDED',
        updated_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: {
        id: true,
        order_id: true,
        payment_status: true,
        org_cash_drawer_movements_dtl: {
          where: { movement_type: 'CASH_SALE', is_active: true },
          select: { id: true, amount: true },
        },
      },
    }),
  );

  const violations: CheckResult[] = [];
  for (const row of rows) {
    for (const movement of row.org_cash_drawer_movements_dtl ?? []) {
      violations.push({
        checkName: RECONCILIATION_CHECK_NAMES.VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(movement.amount),
        message: `Payment ${row.id} (order ${row.order_id}) is VOIDED but still has a live CASH_SALE movement ${movement.id} — B10 void invariant violated (never-effective legs move no money)`,
        affectedEntityType: 'org_order_payments_dtl',
        affectedEntityId: row.id,
      });
    }
  }
  return violations;
}

/**
 * REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT (B10) — the inverse
 * invariant: a REVERSED cash-family leg MUST carry exactly one live
 * PAYMENT_REVERSAL compensating movement (`reversed_payment_id` back-link),
 * otherwise the drawer's expected cash silently lost the correction. A
 * non-cash REVERSED leg is skipped (no compensating movement expected —
 * gateway-side reversal is B8, out of scope).
 */
export async function checkReversedCashPaymentHasCompensatingMovement(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const rows = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        payment_status: 'REVERSED',
        payment_method_code: { equals: 'CASH', mode: 'insensitive' },
        updated_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: {
        id: true,
        order_id: true,
        amount: true,
      },
    }),
  );
  if (rows.length === 0) return [];

  // CLF-6-3: the compensating effect for a reversed cash-family leg is now a
  // mirror voucher line (`reversed_line_id` back-link, stamped `cash_effect_
  // code='DRAWER'` by `reverseVoucherLinesInTx` — W9), not a `PAYMENT_REVERSAL`
  // row in the retired movements table. Checking the old table here would
  // false-positive-BLOCKER every real reversal post-CLF (R1, 2026-09-26),
  // since nothing writes there anymore.
  const originalLines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        order_payment_id: { in: rows.map((r) => r.id) },
        cash_effect_code: 'DRAWER',
      },
      select: { id: true, order_payment_id: true },
    }),
  );
  if (originalLines.length === 0) return [];
  const originalLineByPaymentId = new Map(originalLines.map((l) => [l.order_payment_id, l.id]));

  const mirrorLines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        reversed_line_id: { in: originalLines.map((l) => l.id) },
        cash_effect_code: 'DRAWER',
      },
      select: { reversed_line_id: true },
    }),
  );
  const reversedLineIdsWithMirror = new Set(mirrorLines.map((l) => l.reversed_line_id));

  const violations: CheckResult[] = [];
  for (const row of rows) {
    const originalLineId = originalLineByPaymentId.get(row.id);
    // No DRAWER-recognized original line at all = this payment's cash was
    // never in the CLF ledger to begin with (pre-CLF era) — nothing to check.
    if (!originalLineId) continue;
    if (!reversedLineIdsWithMirror.has(originalLineId)) {
      violations.push({
        checkName: RECONCILIATION_CHECK_NAMES.REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(row.amount),
        message: `Cash payment ${row.id} (order ${row.order_id}) is REVERSED but its recognised voucher line ${originalLineId} has no DRAWER-stamped reversal mirror line — the drawer's expected cash never reflected the correction`,
        affectedEntityType: 'org_order_payments_dtl',
        affectedEntityId: row.id,
      });
    }
  }
  return violations;
}

/**
 * CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT — for each linked cash
 * movement in the window, the movement's `amount` must equal the trx line's
 * retained amount, where retained = `amount - (change_returned_amount ?? 0)`.
 *
 * Why "retained": when a cashier accepts a cash tender of 50 for a 47 sale
 * the trx line records amount=47, tendered_amount=50, change_returned=3.
 * The amount that actually stays in the drawer (retained) is 47 — the
 * cash-movement row mirrors this. A drift = drawer count and voucher leg
 * diverge.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `performed_at` on the movement row.
 */
// CLF-6-3 note: dormant since R1, same reasoning as the other
// `org_cash_drawer_movements_dtl`-sourced checks above — retire alongside the
// table in R3. The amount-integrity concept this guarded (movement amount
// must equal the voucher line's retained amount) has no live equivalent
// check yet, since CLF no longer writes a second "movement" row to compare
// the voucher line against — tracked as remaining CLF-6-3 scope in STATUS.
export async function checkCashMovementAmountEqualsRetained(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const movements = await withTenantContext(tenantOrgId, () =>
    prisma.org_cash_drawer_movements_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        performed_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        fin_voucher_trx_line_id: { not: null },
      },
      select: {
        id: true,
        cash_drawer_session_id: true,
        amount: true,
        fin_voucher_trx_line_id: true,
      },
    }),
  );

  if (movements.length === 0) return [];

  const lineIds = movements
    .map((m) => m.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);

  const lines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        id: { in: lineIds },
      },
      select: { id: true, amount: true, change_returned_amount: true },
    }),
  );

  const lineById = new Map(lines.map((l) => [l.id, l]));
  const results: CheckResult[] = [];

  for (const mvt of movements) {
    const lineId = mvt.fin_voucher_trx_line_id;
    if (!lineId) continue;
    const line = lineById.get(lineId);
    if (!line) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(mvt.amount),
        message: `Cash movement ${mvt.id} references voucher trx line ${lineId} that does not exist`,
        affectedEntityType: 'cash_drawer_movement',
        affectedEntityId: mvt.id,
      });
      continue;
    }
    const retained = toNumber(line.amount) - toNumber(line.change_returned_amount);
    const movementAmount = toNumber(mvt.amount);
    const delta = movementAmount - retained;
    if (Math.abs(delta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: retained,
        actualValue: movementAmount,
        delta,
        message: `Cash movement ${mvt.id} (session ${mvt.cash_drawer_session_id}) amount ${movementAmount} does not match voucher trx line ${lineId} retained amount ${retained}`,
        affectedEntityType: 'cash_drawer_movement',
        affectedEntityId: mvt.id,
      });
    }
  }

  return results;
}

/**
 * Fetch posted vouchers in the recon window. Helper used by the orchestrator
 * to feed `runVoucherIntegrityChecks`.
 *
 * Why a helper: the orchestrator needs the same projection the voucher-scoped
 * service uses. Centralising the fetch keeps both consumers aligned on the
 * `VoucherHeader` shape.
 * @param tenantOrgId
 * @param window
 */
export async function getPostedVouchersInWindow(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<VoucherHeader[]> {
  return withTenantContext(tenantOrgId, () =>
    prisma.org_fin_vouchers_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        voucher_status: VOUCHER_STATUS.POSTED,
      },
      select: {
        id: true,
        voucher_no: true,
        total_amount: true,
        voucher_status: true,
      },
    }),
  );
}
