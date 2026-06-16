/**
 * BVM Voucher Line Service
 * CRUD operations for org_fin_voucher_trx_lines_dtl.
 * All functions require tenant context and a DRAFT parent voucher.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { assertVoucherIsMutable, validateVoucherLine } from './voucher-validation.service';
import type { CreateVoucherLineInput, UpdateVoucherLineInput, VoucherLineData } from '../types/voucher';
import { TARGET_TYPE } from '../constants/voucher';

/** Prisma transaction client type — accepted by addVoucherLine when the caller
 *  composes header + lines + redemptions in a single submit-order tx. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Internal helpers ──────────────────────────────────────────────────────────

function mapLineRow(row: Record<string, unknown>): VoucherLineData {
  return {
    id:                     row.id as string,
    tenant_org_id:          row.tenant_org_id as string,
    voucher_id:             row.voucher_id as string,
    line_no:                row.line_no as number,
    line_type:              row.line_type as string,
    line_role:              row.line_role as string,
    target_type:            (row.target_type as string) ?? null,
    target_id:              (row.target_id as string) ?? null,
    order_id:               (row.order_id as string) ?? null,
    customer_id:            (row.customer_id as string) ?? null,
    supplier_id:            (row.supplier_id as string) ?? null,
    employee_id:            (row.employee_id as string) ?? null,
    payment_method_code:    (row.payment_method_code as string) ?? null,
    payment_status:         (row.payment_status as string) ?? null,
    amount:                 Number(row.amount),
    currency_code:          (row.currency_code as string) ?? null,
    direction:              (row.direction as string) ?? null,
    tendered_amount:        row.tendered_amount != null ? Number(row.tendered_amount) : null,
    change_returned_amount: row.change_returned_amount != null ? Number(row.change_returned_amount) : null,
    expense_category_code:  (row.expense_category_code as string) ?? null,
    party_name:             (row.party_name as string) ?? null,
    description:            (row.description as string) ?? null,
    notes:                  (row.notes as string) ?? null,
    line_status:            row.line_status as string,
    wiring_status:          row.wiring_status as string,
    reversed_line_id:       (row.reversed_line_id as string) ?? null,
    created_at:             row.created_at as Date,
    credit_application_type:(row.credit_application_type as string) ?? null,
    order_payment_id:       (row.order_payment_id as string) ?? null,
    cash_drawer_mvt_id:     (row.cash_drawer_mvt_id as string) ?? null,
    org_payment_method_id:  (row.org_payment_method_id as string) ?? null,
    payment_terminal_id:    (row.payment_terminal_id as string) ?? null,
    cash_drawer_session_id: (row.cash_drawer_session_id as string) ?? null,
    card_brand_code:        (row.card_brand_code as string) ?? null,
    card_last4:             (row.card_last4 as string) ?? null,
    auth_code:              (row.auth_code as string) ?? null,
    gateway_code:           (row.gateway_code as string) ?? null,
    gateway_transaction_id: (row.gateway_transaction_id as string) ?? null,
    gateway_reference:      (row.gateway_reference as string) ?? null,
    bank_reference:         (row.bank_reference as string) ?? null,
    check_number:           (row.check_number as string) ?? null,
    check_bank:             (row.check_bank as string) ?? null,
    check_date:             (row.check_date as Date) ?? null,
    branch_id:              (row.branch_id as string) ?? null,
  };
}

function resolveTargetId(input: CreateVoucherLineInput): string | null {
  if (input.target_id !== undefined) return input.target_id;
  if (input.target_type === TARGET_TYPE.ORDER) return input.order_id ?? null;
  return null;
}

async function getNextLineNoTx(
  tx: PrismaTransactionClient | typeof prisma,
  tenantOrgId: string,
  voucherId: string,
): Promise<number> {
  const last = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
    where: { tenant_org_id: tenantOrgId, voucher_id: voucherId },
    orderBy: { line_no: 'desc' },
    select: { line_no: true },
  });
  return (last?.line_no ?? 0) + 1;
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Internal core. Runs against the supplied tx client and assumes the caller
 * already established tenant context.
 */
async function addVoucherLineInTx(
  tx: PrismaTransactionClient,
  tenantOrgId: string,
  voucherId: string,
  input: CreateVoucherLineInput,
  userId: string,
): Promise<{ id: string; line_no: number }> {
  // Idempotency: return existing line if a prior attempt already created it.
  if (input.idempotency_key) {
    const existing = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
      where:  { tenant_org_id: tenantOrgId, idempotency_key: input.idempotency_key },
      select: { id: true, line_no: true },
    });
    if (existing) return { id: existing.id, line_no: existing.line_no };
  }

  const voucher = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: voucherId, tenant_org_id: tenantOrgId },
    select: { voucher_status: true },
  });

  if (!voucher) throw new Error(`Voucher ${voucherId} not found`);
  assertVoucherIsMutable(voucher.voucher_status as never, 'add a line to');

  const line_no = await getNextLineNoTx(tx, tenantOrgId, voucherId);

  // Auto-derive change for cash payments unless explicitly provided
  let changeReturned: number | null = null;
  if (input.payment_method_code === 'CASH' && input.tendered_amount !== undefined) {
    if (input.change_returned_amount !== undefined) {
      changeReturned = input.change_returned_amount > 0 ? input.change_returned_amount : null;
    } else {
      changeReturned = Math.max(0, input.tendered_amount - input.amount);
    }
  }

  const created = await tx.org_fin_voucher_trx_lines_dtl.create({
    data: {
      tenant_org_id:          tenantOrgId,
      voucher_id:             voucherId,
      line_no,
      line_type:              input.line_type,
      line_role:              input.line_role,
      target_type:            input.target_type ?? null,
      target_id:              resolveTargetId(input),
      order_id:               input.order_id ?? null,
      customer_id:            input.customer_id ?? null,
      supplier_id:            input.supplier_id ?? null,
      employee_id:            input.employee_id ?? null,
      branch_id:              input.branch_id ?? null,
      cash_drawer_session_id: input.cash_drawer_session_id ?? null,
      payment_method_code:    input.payment_method_code ?? null,
      payment_status:         input.payment_status ?? null,
      // B5 fix: these three were dropped by the original create payload, leaving
      // org_payment_method_id NULL on every voucher line and breaking the wiring
      // handler's link from voucher line -> org_order_payments_dtl.org_payment_method_id.
      org_payment_method_id:  input.org_payment_method_id ?? null,
      payment_terminal_id:    input.payment_terminal_id ?? null,
      credit_application_type: input.credit_application_type ?? null,
      amount:                 input.amount,
      currency_code:          input.currency_code ?? null,
      currency_ex_rate:       input.currency_ex_rate ?? null,
      direction:              input.direction ?? 'NEUTRAL',
      tendered_amount:        input.tendered_amount ?? null,
      change_returned_amount: changeReturned,
      card_brand_code:        input.card_brand_code ?? null,
      card_last4:             input.card_last4 ?? null,
      auth_code:              input.auth_code ?? null,
      gateway_code:           input.gateway_code ?? null,
      gateway_transaction_id: input.gateway_transaction_id ?? null,
      gateway_reference:      input.gateway_reference ?? null,
      bank_reference:         input.bank_reference ?? null,
      check_number:           input.check_number ?? null,
      check_bank:             input.check_bank ?? null,
      check_date:             input.check_date ? new Date(input.check_date) : null,
      expense_category_code:  input.expense_category_code ?? null,
      party_name:             input.party_name ?? null,
      description:            input.description ?? null,
      notes:                  input.notes ?? null,
      reversed_line_id:       input.reversed_line_id ?? null,
      idempotency_key:        input.idempotency_key ?? null,
      line_status:            'DRAFT',
      wiring_status:          'NOT_WIRED',
      created_by:             userId,
    },
    select: { id: true, line_no: true },
  });

  return { id: created.id, line_no: created.line_no };
}

/**
 * Add a transaction line to a DRAFT voucher.
 *
 * When `tx` is supplied, runs on the caller's transaction without nesting —
 * used by the submit-order orchestrator so a single tx covers header + lines
 * + stored-value redemptions + post-and-wire. Existing callers can omit `tx`.
 */
export async function addVoucherLine(
  tenantOrgId: string,
  voucherId: string,
  input: CreateVoucherLineInput,
  userId: string,
  userRole?: string,
  tx?: PrismaTransactionClient,
): Promise<{ id: string; line_no: number }> {
  validateVoucherLine(input, userRole);

  if (tx) {
    return addVoucherLineInTx(tx, tenantOrgId, voucherId, input, userId);
  }
  return withTenantContext(tenantOrgId, () =>
    addVoucherLineInTx(prisma as unknown as PrismaTransactionClient, tenantOrgId, voucherId, input, userId),
  );
}

/**
 * Update fields on a DRAFT voucher line.
 */
export async function updateVoucherLine(
  tenantOrgId: string,
  lineId: string,
  input: UpdateVoucherLineInput,
  userId: string
): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const line = await prisma.org_fin_voucher_trx_lines_dtl.findFirst({
      where: { id: lineId, tenant_org_id: tenantOrgId },
      select: { line_status: true, voucher_id: true },
    });

    if (!line) throw new Error(`Voucher line ${lineId} not found`);
    if (line.line_status !== 'DRAFT') {
      throw new Error(`Cannot update a line with status '${line.line_status}'`);
    }

    let changeReturned: number | null | undefined = undefined;
    if (input.payment_method_code === 'CASH' && input.tendered_amount !== undefined && input.amount !== undefined) {
      changeReturned = Math.max(0, input.tendered_amount - input.amount);
    }

    await prisma.org_fin_voucher_trx_lines_dtl.updateMany({
      where: { id: lineId, tenant_org_id: tenantOrgId },
      data: {
        ...(input.line_type              !== undefined && { line_type: input.line_type }),
        ...(input.line_role              !== undefined && { line_role: input.line_role }),
        ...(input.target_type            !== undefined && { target_type: input.target_type }),
        ...(input.target_id              !== undefined && { target_id: input.target_id }),
        ...(input.order_id               !== undefined && { order_id: input.order_id }),
        ...(input.customer_id            !== undefined && { customer_id: input.customer_id }),
        ...(input.payment_method_code    !== undefined && { payment_method_code: input.payment_method_code }),
        ...(input.payment_status         !== undefined && { payment_status: input.payment_status }),
        ...(input.amount                 !== undefined && { amount: input.amount }),
        ...(input.currency_code          !== undefined && { currency_code: input.currency_code }),
        ...(input.direction              !== undefined && { direction: input.direction }),
        ...(input.tendered_amount        !== undefined && { tendered_amount: input.tendered_amount }),
        ...(changeReturned               !== undefined && { change_returned_amount: changeReturned }),
        ...(input.expense_category_code  !== undefined && { expense_category_code: input.expense_category_code }),
        ...(input.bank_reference         !== undefined && { bank_reference: input.bank_reference }),
        ...(input.party_name             !== undefined && { party_name: input.party_name }),
        ...(input.description            !== undefined && { description: input.description }),
        ...(input.notes                  !== undefined && { notes: input.notes }),
        updated_at: new Date(),
        updated_by: userId,
      },
    });
  });
}

/**
 * Permanently delete a DRAFT line from a voucher.
 */
export async function deleteDraftVoucherLine(
  tenantOrgId: string,
  lineId: string
): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const line = await prisma.org_fin_voucher_trx_lines_dtl.findFirst({
      where: { id: lineId, tenant_org_id: tenantOrgId },
      select: { line_status: true },
    });

    if (!line) throw new Error(`Voucher line ${lineId} not found`);
    if (line.line_status !== 'DRAFT') {
      throw new Error(`Cannot delete a line with status '${line.line_status}'`);
    }

    await prisma.org_fin_voucher_trx_lines_dtl.deleteMany({
      where: { id: lineId, tenant_org_id: tenantOrgId },
    });
  });
}

/**
 * List all lines for a voucher, ordered by line_no.
 */
export async function listVoucherLines(
  tenantOrgId: string,
  voucherId: string
): Promise<VoucherLineData[]> {
  return withTenantContext(tenantOrgId, async () => {
    const rows = await prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, is_active: true },
      orderBy: { line_no: 'asc' },
    });
    return rows.map(r => mapLineRow(r as unknown as Record<string, unknown>));
  });
}
