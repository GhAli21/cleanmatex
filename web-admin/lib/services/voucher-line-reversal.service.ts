import 'server-only';

import type { Prisma } from '@prisma/client';

import { CASH_EFFECTS, CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
import { VOUCHER_STATUS, WIRING_STATUS } from '@/lib/constants/voucher';
import { stampCashLinesTx, abandonPendingCashLineTx, type CashGateLine } from './cash-drawer-ledger/cash-drawer-ledger-gate';
import { validateStatusTransition } from './voucher-validation.service';
import { generateBizVoucherNo } from './voucher-number.service';
import type { VoucherType } from '../types/voucher';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';

/**
 * Voucher reversal core — all lines or selected lines (CLF W9, ADR-057).
 *
 * Principle: a posted line is never edited. A reversal is a NEW voucher with
 * mirror lines, recorded now. Cash mirror lines go through the cash-drawer
 * ledger gate in DEFERRED mode, so they land in the window that is current at
 * reversal time (never back into a closed session). Pending cash originals
 * (never received) and their mirrors are marked NONE — nothing physical moved.
 *
 * This module deliberately imports nothing from payment-transition, so both
 * voucher-reversal (full / selected lines, with operational unwind) and the
 * payment REVERSE transition (one line) can call it without a circular import.
 */

type Tx = Prisma.TransactionClient;

export interface ReverseVoucherLinesInput {
  tenantOrgId: string;
  voucherId: string;
  reason: string;
  userId: string;
  /** Lines to reverse; omitted = every POSTED line (full reversal). */
  lineIds?: readonly string[];
  /** Pay the cash side from this drawer instead of the original (e.g. original deactivated). */
  cashDrawerId?: string | null;
}

/** One reversed line and its mirror. */
export interface ReversedLinePair {
  originalLineId: string;
  originalLineRole: string;
  originalOrderId: string | null;
  originalCustomerId: string | null;
  reversalLineId: string;
  /** Session the mirror landed in (null = no session / next window / not cash). */
  reversalSessionId: string | null;
}

export interface ReverseVoucherLinesResult {
  reversalVoucherId: string;
  reversalVoucherNo: string;
  /** REVERSED when no POSTED line remains, else PARTIALLY_REVERSED. */
  originalStatus: string;
  pairs: ReversedLinePair[];
}

/**
 * Creates the reversal voucher for all or selected POSTED lines of a voucher,
 * inside the caller's transaction.
 * @param tx open Prisma transaction
 * @param input tenant, voucher, reason, actor, optional line selection / drawer
 * @returns reversal voucher id/no, the original's new status, and the line pairs
 * @throws Error('VOUCHER_NOT_FOUND' | 'VOUCHER_LINE_NOT_REVERSIBLE' | 'NO_POSTED_LINES_TO_REVERSE')
 * @throws CashDrawerLedgerError when a cash mirror cannot be placed in a drawer
 * @example const r = await reverseVoucherLinesInTx(tx, { tenantOrgId, voucherId, reason, userId, lineIds: [lineId] });
 */
export async function reverseVoucherLinesInTx(
  tx: Tx,
  input: ReverseVoucherLinesInput,
): Promise<ReverseVoucherLinesResult> {
  const { tenantOrgId, voucherId, reason, userId } = input;
  if (!reason || !reason.trim()) {
    throw new Error('REVERSAL_REASON_REQUIRED');
  }

  // Lock the original header (serialises concurrent reversals of the same voucher).
  const originals = await tx.$queryRaw<Array<{
    id: string;
    voucher_no: string;
    voucher_type: string;
    voucher_category: string;
    voucher_subtype: string | null;
    voucher_status: string;
    currency_code: string | null;
    currency_ex_rate: string | null;
    branch_id: string | null;
    direction: string | null;
    party_type: string | null;
    party_name: string | null;
    supplier_id: string | null;
    employee_id: string | null;
    customer_id: string | null;
    order_id: string | null;
    invoice_id: string | null;
    source_module: string | null;
    source_ref_type: string | null;
    source_ref_id: string | null;
    reason_code: string | null;
    notes: string | null;
  }>>`
    SELECT id, voucher_no, voucher_type, voucher_category, voucher_subtype, voucher_status,
           currency_code, currency_ex_rate::text AS currency_ex_rate, branch_id, direction,
           party_type, party_name, supplier_id, employee_id, customer_id, order_id, invoice_id,
           source_module, source_ref_type, source_ref_id, reason_code, notes
      FROM org_fin_vouchers_mst
     WHERE id = ${voucherId}::uuid
       AND tenant_org_id = ${tenantOrgId}::uuid
     FOR UPDATE
  `;
  const original = originals[0];
  if (!original) throw new Error('VOUCHER_NOT_FOUND');
  if (
    original.voucher_status !== VOUCHER_STATUS.POSTED
    && original.voucher_status !== VOUCHER_STATUS.PARTIALLY_REVERSED
  ) {
    // Surfaces the standard illegal-transition error.
    validateStatusTransition(original.voucher_status as never, VOUCHER_STATUS.REVERSED);
  }

  const postedLines = await tx.org_fin_voucher_trx_lines_dtl.findMany({
    where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, line_status: 'POSTED', is_active: true },
    orderBy: { line_no: 'asc' },
  });
  const selected = input.lineIds
    ? postedLines.filter((l) => input.lineIds?.includes(l.id))
    : postedLines;
  if (input.lineIds && selected.length !== new Set(input.lineIds).size) {
    throw new Error('VOUCHER_LINE_NOT_REVERSIBLE');
  }
  if (selected.length === 0) throw new Error('NO_POSTED_LINES_TO_REVERSE');

  const remainingAfter = postedLines.length - selected.length;
  const targetStatus = remainingAfter === 0 ? VOUCHER_STATUS.REVERSED : VOUCHER_STATUS.PARTIALLY_REVERSED;
  if (targetStatus !== original.voucher_status) {
    validateStatusTransition(original.voucher_status as never, targetStatus);
  }

  const now = new Date();
  const total = selected.reduce((sum, l) => sum + Number(l.amount), 0);
  const reversalVoucherNo = await generateBizVoucherNo(tenantOrgId, original.voucher_type as VoucherType, tx);

  const reversalVoucher = await tx.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id:    tenantOrgId,
      branch_id:        original.branch_id,
      voucher_no:       reversalVoucherNo,
      voucher_category: original.voucher_category ?? 'NON_CASH',
      voucher_subtype:  original.voucher_subtype,
      voucher_type:     original.voucher_type,
      voucher_status:   VOUCHER_STATUS.POSTED,
      posting_status:   'POSTED',
      direction:        original.direction,
      party_type:       original.party_type,
      party_name:       original.party_name,
      supplier_id:      original.supplier_id,
      employee_id:      original.employee_id,
      customer_id:      original.customer_id,
      order_id:         original.order_id,
      invoice_id:       original.invoice_id,
      source_module:    original.source_module,
      source_ref_type:  original.source_ref_type,
      source_ref_id:    original.source_ref_id,
      reason_code:      original.reason_code,
      total_amount:     total,
      paid_amount:      total,
      outstanding_amount: 0,
      currency_code:    original.currency_code,
      currency_ex_rate: original.currency_ex_rate != null ? Number(original.currency_ex_rate) : null,
      voucher_date:     now,
      voucher_datetime: now,
      issued_at:        now,
      ref_voucher_id:   original.id,
      reversal_reason:  reason,
      posted_at:        now,
      posted_by:        userId,
      description:      `Reversal of ${original.voucher_no}: ${reason}`,
      notes:            original.notes,
      created_by:       userId,
    },
    select: { id: true },
  });

  // Mirror lines start DRAFT so the gate can stamp them (posted lines are immutable).
  const pairs: ReversedLinePair[] = [];
  const gateLines: CashGateLine[] = [];
  const pendingOriginalIds: string[] = [];
  let lineNo = 1;
  for (const line of selected) {
    const opposite = line.direction === 'IN' ? 'OUT' : line.direction === 'OUT' ? 'IN' : 'NEUTRAL';
    const description = line.description?.trim();
    const mirror = await tx.org_fin_voucher_trx_lines_dtl.create({
      data: {
        tenant_org_id:   tenantOrgId,
        voucher_id:      reversalVoucher.id,
        line_no:         lineNo++,
        line_type:       line.line_type,
        line_role:       line.line_role,
        target_type:     line.target_type,
        target_id:       line.target_id,
        order_id:        line.order_id,
        customer_id:     line.customer_id,
        supplier_id:     line.supplier_id,
        employee_id:     line.employee_id,
        branch_id:       line.branch_id,
        payment_method_code: line.payment_method_code,
        amount:          line.amount,
        currency_code:   line.currency_code,
        currency_ex_rate: line.currency_ex_rate,
        direction:       opposite,
        tendered_amount: line.tendered_amount,
        change_returned_amount: line.change_returned_amount,
        card_brand_code: line.card_brand_code,
        card_last4:      line.card_last4,
        auth_code:       line.auth_code,
        gateway_code:    line.gateway_code,
        gateway_transaction_id: line.gateway_transaction_id,
        gateway_reference: line.gateway_reference,
        bank_reference:  line.bank_reference,
        check_number:    line.check_number,
        check_bank:      line.check_bank,
        check_date:      line.check_date,
        expense_category_code: line.expense_category_code,
        party_name:      line.party_name ?? original.party_name,
        description:     description ? `Reversal of line ${line.line_no}: ${description}` : `Reversal of line ${line.line_no}`,
        notes:           line.notes,
        line_status:     'DRAFT',
        payment_status:  line.payment_status,
        wiring_status:   WIRING_STATUS.NOT_WIRED,
        reversed_line_id: line.id,
        // Hint only — the gate decides the real session (current window).
        cash_drawer_session_id: line.cash_drawer_session_id,
        pos_session_id:  line.pos_session_id,
        credit_application_type: line.credit_application_type,
        org_payment_method_id: line.org_payment_method_id,
        payment_terminal_id: line.payment_terminal_id,
        created_by:      userId,
      },
      select: { id: true },
    });

    pairs.push({
      originalLineId: line.id,
      originalLineRole: String(line.line_role ?? ''),
      originalOrderId: line.order_id,
      originalCustomerId: line.customer_id,
      reversalLineId: mirror.id,
      reversalSessionId: null,
    });

    const cashFamily = isCashFamilyMethod(line.payment_method_code);
    if (!cashFamily) continue; // only cash-family lines ever reach the gate

    if (line.cash_effect_code === CASH_EFFECTS.PENDING || line.cash_effect_code === CASH_EFFECTS.NONE) {
      // Never received → nothing physical to reverse.
      pendingOriginalIds.push(line.id);
      continue;
    }
    // Pre-CLF originals carry no drawer stamp; their mirror must not create a
    // one-sided OUT either (the M9 backfill stamps history before R2 readers switch).
    if (line.cash_effect_code == null) continue;

    gateLines.push({
      id: mirror.id,
      tenant_org_id: tenantOrgId,
      voucher_id: reversalVoucher.id,
      line_no: lineNo - 1,
      line_role: line.line_role,
      line_status: 'DRAFT',
      wiring_status: WIRING_STATUS.NOT_WIRED,
      direction: opposite,
      payment_method_code: line.payment_method_code,
      payment_status: line.payment_status,
      amount: line.amount,
      currency_code: line.currency_code,
      target_type: line.target_type,
      target_id: line.target_id,
      order_id: line.order_id,
      customer_id: line.customer_id,
      cash_drawer_session_id: line.cash_drawer_session_id,
      pos_session_id: line.pos_session_id,
      tendered_amount: line.tendered_amount,
      change_returned_amount: line.change_returned_amount,
      credit_application_type: line.credit_application_type,
      order_payment_id: null,
      cash_drawer_mvt_id: null,
      sv_funding_tender_id: null,
      card_brand_code: line.card_brand_code,
      card_last4: line.card_last4,
      gateway_code: line.gateway_code,
      gateway_reference: line.gateway_reference,
      bank_reference: line.bank_reference,
      check_number: line.check_number,
      check_bank: line.check_bank,
      check_date: line.check_date,
      org_payment_method_id: line.org_payment_method_id,
      payment_terminal_id: line.payment_terminal_id,
      branch_id: line.branch_id,
      cash_drawer_id: input.cashDrawerId ?? line.cash_drawer_id,
    });
  }

  // Reversal is a back-office correction: DEFERRED — never refused on session state.
  await stampCashLinesTx(
    tx,
    { tenantOrgId, userId, mode: CASH_GATE_MODES.DEFERRED },
    { id: reversalVoucher.id, branchId: original.branch_id, currencyCode: original.currency_code },
    gateLines,
  );
  const sessionByMirror = new Map(gateLines.map((l) => [l.id, l.cash_drawer_session_id]));
  for (const pair of pairs) {
    pair.reversalSessionId = sessionByMirror.get(pair.reversalLineId) ?? null;
  }

  await tx.org_fin_voucher_trx_lines_dtl.updateMany({
    where: { tenant_org_id: tenantOrgId, voucher_id: reversalVoucher.id, line_status: 'DRAFT' },
    data: { line_status: 'POSTED', updated_at: now, updated_by: userId },
  });

  // Pending originals and their mirrors: nothing was ever received.
  for (const pair of pairs) {
    if (pendingOriginalIds.includes(pair.originalLineId)) {
      await abandonPendingCashLineTx(tx, { tenantOrgId, userId, mode: CASH_GATE_MODES.DEFERRED }, pair.originalLineId);
    }
  }

  await tx.org_fin_voucher_trx_lines_dtl.updateMany({
    where: { tenant_org_id: tenantOrgId, id: { in: selected.map((l) => l.id) } },
    data: { line_status: 'REVERSED', updated_at: now, updated_by: userId },
  });

  await tx.org_fin_vouchers_mst.updateMany({
    where: { id: voucherId, tenant_org_id: tenantOrgId },
    data: {
      voucher_status: targetStatus,
      ...(targetStatus === VOUCHER_STATUS.REVERSED ? { reversed_at: now, reversed_by: userId } : {}),
      reversed_by_voucher_id: reversalVoucher.id,
      reversal_reason: reason,
      updated_at: now,
      updated_by: userId,
    },
  });

  await tx.org_fin_voucher_audit_log.create({
    data: {
      voucher_id: voucherId,
      tenant_org_id: tenantOrgId,
      action: targetStatus,
      changed_by: userId,
      changed_at: now,
      snapshot_or_reason: JSON.stringify({
        voucher_status: targetStatus,
        reversal_voucher_id: reversalVoucher.id,
        reversal_voucher_no: reversalVoucherNo,
        reversed_line_ids: selected.map((l) => l.id),
        reason,
      }),
    },
  });

  await tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id: tenantOrgId,
      event_type: 'VOUCHER_REVERSED',
      aggregate_type: 'fin_voucher',
      aggregate_id: voucherId,
      payload: {
        original_voucher_id: voucherId,
        reversal_voucher_id: reversalVoucher.id,
        reversal_voucher_no: reversalVoucherNo,
        reversed_line_ids: selected.map((l) => l.id),
        original_status: targetStatus,
        reason,
        reversed_by: userId,
        reversed_at: now.toISOString(),
      },
    },
  });

  return {
    reversalVoucherId: reversalVoucher.id,
    reversalVoucherNo,
    originalStatus: targetStatus,
    pairs,
  };
}
