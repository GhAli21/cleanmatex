/* eslint-disable jsdoc/require-param */
/**
 * BVM Business Voucher Service
 * Core CRUD for org_fin_vouchers_mst (BVM flow).
 * Separate from existing voucher-service.ts to avoid breaking the receipt-only billing flow.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { VOUCHER_STATUS } from '../constants/voucher';

/**
 * Prisma transaction client type, derived from the runtime signature of
 * `prisma.$transaction(cb)`. Used as the optional `tx` parameter on service
 * functions that can either run on their own transaction or join a caller's.
 */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import { assertVoucherIsMutable } from './voucher-validation.service';
import { generateBizVoucherNo } from './voucher-number.service';
import type {
  CreateBizVoucherInput,
  UpdateBizVoucherInput,
  BizVoucherDetailData,
  VoucherListItem,
  VoucherListFilters,
  VoucherType,
} from '../types/voucher';

// ── Internal mapper ───────────────────────────────────────────────────────────

function mapVoucherRow(row: Record<string, unknown>): BizVoucherDetailData {
  return {
    id:                 row.id as string,
    tenant_org_id:      row.tenant_org_id as string,
    branch_id:          (row.branch_id as string) ?? null,
    voucher_no:         row.voucher_no as string,
    voucher_type:       row.voucher_type as VoucherType,
    voucher_status:     row.voucher_status as never,
    posting_status:     row.posting_status as never,
    direction:          (row.direction as never) ?? null,
    voucher_date:       row.voucher_date ? (row.voucher_date as Date).toISOString().split('T')[0] ?? null : null,
    voucher_datetime:   row.voucher_datetime ? (row.voucher_datetime as Date).toISOString() : null,
    party_type:         (row.party_type as never) ?? null,
    supplier_id:        (row.supplier_id as string) ?? null,
    employee_id:        (row.employee_id as string) ?? null,
    party_name:         (row.party_name as string) ?? null,
    customer_id:        (row.customer_id as string) ?? null,
    order_id:           (row.order_id as string) ?? null,
    invoice_id:         (row.invoice_id as string) ?? null,
    total_amount:       Number(row.total_amount ?? 0),
    subtotal_amount:    row.subtotal_amount != null ? Number(row.subtotal_amount) : null,
    discount_amount:    row.discount_amount != null ? Number(row.discount_amount) : null,
    tax_amount:         row.tax_amount != null ? Number(row.tax_amount) : null,
    fee_amount:         row.fee_amount != null ? Number(row.fee_amount) : null,
    paid_amount:        row.paid_amount != null ? Number(row.paid_amount) : null,
    refunded_amount:    row.refunded_amount != null ? Number(row.refunded_amount) : null,
    outstanding_amount: row.outstanding_amount != null ? Number(row.outstanding_amount) : null,
    currency_code:      (row.currency_code as string) ?? null,
    currency_ex_rate:   row.currency_ex_rate != null ? Number(row.currency_ex_rate) : null,
    description:        (row.description as string) ?? null,
    notes:              (row.notes as string) ?? null,
    source_module:      (row.source_module as string) ?? null,
    source_ref_type:    (row.source_ref_type as string) ?? null,
    source_ref_id:      (row.source_ref_id as string) ?? null,
    posted_at:          (row.posted_at as Date) ?? null,
    posted_by:          (row.posted_by as string) ?? null,
    reversed_at:        (row.reversed_at as Date) ?? null,
    reversal_reason:    (row.reversal_reason as string) ?? null,
    created_at:         row.created_at as Date,
    created_by:         (row.created_by as string) ?? null,
    updated_at:         (row.updated_at as Date) ?? null,
    updated_by:         (row.updated_by as string) ?? null,
    lines:              [],
  };
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Internal core. Runs against the supplied Prisma transaction client and
 * assumes the caller already established tenant context (RLS).
 *
 * Why split:
 * Phase 2 BVM Wiring lets the orchestrator run header + lines + post + wire
 * inside one transaction. createBizVoucher accepts an optional `tx`; when
 * supplied we run on it directly — no nested $transaction, no nested
 * withTenantContext (the outer caller owns both).
 */
async function createBizVoucherInTx(
  tx: PrismaTransactionClient,
  tenantOrgId: string,
  input: CreateBizVoucherInput,
  userId: string,
): Promise<{ id: string; voucher_no: string }> {
  // Idempotency: if a voucher with this key already exists (prior failed attempt), return it.
  if (input.idempotency_key) {
    const existing = await tx.org_fin_vouchers_mst.findFirst({
      where:  { tenant_org_id: tenantOrgId, idempotency_key: input.idempotency_key },
      select: { id: true, voucher_no: true, source_ref_id: true, order_id: true },
    });
    if (existing) {
      // P3 Fix B (B6 RESUME doc): defense-in-depth. If the cached voucher's
      // source_ref_id (or order_id) does NOT match the new request, the caller
      // is reusing an idempotency key across different resources — refuse
      // rather than silently returning a voucher tied to a different order.
      const requestedRefId   = input.source_ref_id ?? null;
      const requestedOrderId = input.order_id ?? null;
      const refIdMismatch    =
        requestedRefId   !== null && existing.source_ref_id !== null && existing.source_ref_id !== requestedRefId;
      const orderIdMismatch  =
        requestedOrderId !== null && existing.order_id      !== null && existing.order_id      !== requestedOrderId;
      if (refIdMismatch || orderIdMismatch) {
        throw new Error('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_RESOURCE');
      }
      return { id: existing.id, voucher_no: existing.voucher_no };
    }
  }

  const voucher_no = await generateBizVoucherNo(tenantOrgId, input.voucher_type, tx);

  const direction = input.direction ?? 'NEUTRAL';
  const voucher_category =
    direction === 'IN'  ? 'CASH_IN' :
    direction === 'OUT' ? 'CASH_OUT' : 'NON_CASH';

  const created = await tx.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id:    tenantOrgId,
      branch_id:        input.branch_id ?? null,
      voucher_no,
      voucher_category,
      voucher_type:     input.voucher_type,
      voucher_status:   VOUCHER_STATUS.DRAFT,
      posting_status:   'NOT_POSTED',
      direction:        input.direction ?? null,
      voucher_date:     input.voucher_date ? new Date(input.voucher_date) : null,
      voucher_datetime: input.voucher_datetime ? new Date(input.voucher_datetime) : null,
      party_type:       input.party_type ?? null,
      supplier_id:      input.supplier_id ?? null,
      employee_id:      input.employee_id ?? null,
      party_name:       input.party_name ?? null,
      customer_id:      input.customer_id ?? null,
      order_id:         input.order_id ?? null,
      invoice_id:       input.invoice_id ?? null,
      currency_code:    input.currency_code ?? null,
      currency_ex_rate: input.currency_ex_rate ?? null,
      description:      input.description ?? null,
      notes:            input.notes ?? null,
      source_module:    input.source_module ?? null,
      source_ref_type:  input.source_ref_type ?? null,
      source_ref_id:    input.source_ref_id ?? null,
      idempotency_key:  input.idempotency_key ?? null,
      total_amount:     input.total_amount ?? 0,
      created_by:       userId,
    },
    select: { id: true, voucher_no: true },
  });

  return { id: created.id, voucher_no: created.voucher_no };
}

/**
 * Create a new BVM voucher in DRAFT status.
 *
 * When `tx` is supplied the function runs on the caller's transaction (no
 * nested $transaction, no nested withTenantContext) — used by the submit-order
 * orchestrator to compose voucher creation with stored-value debits atomically.
 * Existing callers can omit `tx`; the function then opens its own
 * withTenantContext + prisma.$transaction.
 */
export async function createBizVoucher(
  tenantOrgId: string,
  input: CreateBizVoucherInput,
  userId: string,
  tx?: PrismaTransactionClient,
): Promise<{ id: string; voucher_no: string }> {
  if (tx) {
    return createBizVoucherInTx(tx, tenantOrgId, input, userId);
  }
  return withTenantContext(tenantOrgId, () =>
    prisma.$transaction((innerTx) => createBizVoucherInTx(innerTx, tenantOrgId, input, userId)),
  );
}

/**
 * Update mutable fields on a DRAFT BVM voucher.
 */
export async function updateBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  input: UpdateBizVoucherInput,
  userId: string
): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
      select: { voucher_status: true },
    });

    if (!voucher) throw new Error(`Voucher ${voucherId} not found`);
    assertVoucherIsMutable(voucher.voucher_status as never);

    await prisma.org_fin_vouchers_mst.updateMany({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
      data: {
        ...(input.branch_id    !== undefined && { branch_id: input.branch_id }),
        ...(input.voucher_date !== undefined && { voucher_date: new Date(input.voucher_date) }),
        ...(input.party_type   !== undefined && { party_type: input.party_type }),
        ...(input.supplier_id  !== undefined && { supplier_id: input.supplier_id }),
        ...(input.employee_id  !== undefined && { employee_id: input.employee_id }),
        ...(input.party_name   !== undefined && { party_name: input.party_name }),
        ...(input.customer_id  !== undefined && { customer_id: input.customer_id }),
        ...(input.total_amount !== undefined && { total_amount: input.total_amount }),
        ...(input.description  !== undefined && { description: input.description }),
        ...(input.notes        !== undefined && { notes: input.notes }),
        updated_at: new Date(),
        updated_by: userId,
      },
    });
  });
}

/**
 * Get a BVM voucher with its lines.
 */
export async function getBizVoucherById(
  tenantOrgId: string,
  voucherId: string
): Promise<BizVoucherDetailData> {
  return withTenantContext(tenantOrgId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
    });

    if (!voucher) throw new Error(`Voucher ${voucherId} not found`);

    const lines = await prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, voucher_id: voucherId, is_active: true },
      orderBy: { line_no: 'asc' },
    });

    const detail = mapVoucherRow(voucher as unknown as Record<string, unknown>);
    detail.lines = lines.map(l => ({
      id:                     l.id,
      tenant_org_id:          l.tenant_org_id,
      voucher_id:             l.voucher_id,
      line_no:                l.line_no,
      line_type:              l.line_type,
      line_role:              l.line_role,
      target_type:            l.target_type,
      target_id:              l.target_id,
      order_id:               l.order_id,
      customer_id:            l.customer_id,
      supplier_id:            l.supplier_id ?? null,
      employee_id:            l.employee_id ?? null,
      payment_method_code:    l.payment_method_code,
      payment_status:         l.payment_status ?? null,
      amount:                 Number(l.amount),
      currency_code:          l.currency_code,
      direction:              l.direction,
      tendered_amount:        l.tendered_amount != null ? Number(l.tendered_amount) : null,
      change_returned_amount: l.change_returned_amount != null ? Number(l.change_returned_amount) : null,
      expense_category_code:  l.expense_category_code,
      party_name:             l.party_name,
      description:            l.description,
      notes:                  l.notes ?? null,
      line_status:            l.line_status,
      wiring_status:          l.wiring_status,
      reversed_line_id:       l.reversed_line_id,
      created_at:             l.created_at,
      credit_application_type: null,
      order_payment_id:        l.order_payment_id ?? null,
      cash_drawer_mvt_id:      l.cash_drawer_mvt_id ?? null,
      org_payment_method_id:   null,
      payment_terminal_id:     l.payment_terminal_id ?? null,
      cash_drawer_session_id:  l.cash_drawer_session_id ?? null,
      card_brand_code:         l.card_brand_code ?? null,
      card_last4:              l.card_last4 ?? null,
      auth_code:               l.auth_code ?? null,
      gateway_code:            l.gateway_code ?? null,
      gateway_transaction_id:  l.gateway_transaction_id ?? null,
      gateway_reference:       l.gateway_reference ?? null,
      bank_reference:          l.bank_reference ?? null,
      check_number:            l.check_number ?? null,
      check_bank:              l.check_bank ?? null,
      check_date:              l.check_date ?? null,
      branch_id:               l.branch_id ?? null,
    }));

    return detail;
  });
}

/**
 * List BVM vouchers for a tenant with optional filters and pagination.
 */
export async function listBizVouchers(
  tenantOrgId: string,
  filters: VoucherListFilters,
  page = 1,
  pageSize = 20
): Promise<{ items: VoucherListItem[]; total: number }> {
  return withTenantContext(tenantOrgId, async () => {
    const where = {
      tenant_org_id: tenantOrgId,
      ...(filters.voucher_type   && { voucher_type: filters.voucher_type }),
      ...(filters.voucher_status && { voucher_status: filters.voucher_status }),
      ...(filters.direction      && { direction: filters.direction }),
      ...(filters.party_type     && { party_type: filters.party_type }),
      ...(filters.branch_id      && { branch_id: filters.branch_id }),
      ...(filters.date_from && {
        voucher_date: { gte: new Date(filters.date_from) },
      }),
      ...(filters.date_to && {
        voucher_date: { lte: new Date(filters.date_to) },
      }),
      ...(filters.search && {
        OR: [
          { voucher_no: { contains: filters.search, mode: 'insensitive' as const } },
          { party_name: { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.org_fin_vouchers_mst.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          voucher_no: true,
          voucher_type: true,
          voucher_status: true,
          direction: true,
          party_name: true,
          total_amount: true,
          currency_code: true,
          voucher_date: true,
          created_at: true,
        },
      }),
      prisma.org_fin_vouchers_mst.count({ where }),
    ]);

    const items: VoucherListItem[] = rows.map(r => ({
      id:             r.id,
      voucher_no:     r.voucher_no,
      voucher_type:   r.voucher_type ?? '',
      voucher_status: r.voucher_status,
      direction:      r.direction,
      party_name:     r.party_name,
      total_amount:   Number(r.total_amount),
      currency_code:  r.currency_code,
      voucher_date:   r.voucher_date ? r.voucher_date.toISOString().split('T')[0] ?? null : null,
      created_at:     r.created_at,
    }));

    return { items, total };
  });
}

/**
 * Cancel a DRAFT voucher.
 */
export async function cancelBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  reason: string,
  userId: string
): Promise<void> {
  await withTenantContext(tenantOrgId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
      select: { voucher_status: true },
    });

    if (!voucher) throw new Error(`Voucher ${voucherId} not found`);
    assertVoucherIsMutable(voucher.voucher_status as never, 'cancel');

    const now = new Date();
    // B8 fix (RESUME doc 2026-05-28): sync legacy `status` + wiring
    // `posting_status` alongside Phase-1A `voucher_status` so the three
    // columns can't drift. posting_status='NOT_POSTED' is correct for a
    // cancelled-while-DRAFT voucher (CHECK constraint allows only
    // NOT_POSTED | POSTED | POSTING_FAILED — no CANCELLED value).
    await prisma.org_fin_vouchers_mst.updateMany({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
      data: {
        voucher_status:  VOUCHER_STATUS.CANCELLED,
        posting_status:  'NOT_POSTED',
        reversal_reason: reason,
        voided_at:       now,
        updated_at:      now,
        updated_by:      userId,
      },
    });
  });
}
