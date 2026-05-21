/* eslint-disable jsdoc/require-param, jsdoc/require-returns */
/**
 * BVM Business Voucher Service
 * Core CRUD for org_fin_vouchers_mst (BVM flow).
 * Separate from existing voucher-service.ts to avoid breaking the receipt-only billing flow.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { VOUCHER_STATUS } from '../constants/voucher';
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
    party_type:         (row.party_type as never) ?? null,
    party_name:         (row.party_name as string) ?? null,
    customer_id:        (row.customer_id as string) ?? null,
    total_amount:       Number(row.total_amount ?? 0),
    subtotal_amount:    row.subtotal_amount != null ? Number(row.subtotal_amount) : null,
    discount_amount:    row.discount_amount != null ? Number(row.discount_amount) : null,
    tax_amount:         row.tax_amount != null ? Number(row.tax_amount) : null,
    fee_amount:         row.fee_amount != null ? Number(row.fee_amount) : null,
    paid_amount:        row.paid_amount != null ? Number(row.paid_amount) : null,
    refunded_amount:    row.refunded_amount != null ? Number(row.refunded_amount) : null,
    outstanding_amount: row.outstanding_amount != null ? Number(row.outstanding_amount) : null,
    currency_code:      (row.currency_code as string) ?? null,
    description:        (row.description as string) ?? null,
    notes:              (row.notes as string) ?? null,
    posted_at:          (row.posted_at as Date) ?? null,
    posted_by:          (row.posted_by as string) ?? null,
    reversed_at:        (row.reversed_at as Date) ?? null,
    reversal_reason:    (row.reversal_reason as string) ?? null,
    created_at:         row.created_at as Date,
    created_by:         (row.created_by as string) ?? null,
    updated_at:         (row.updated_at as Date) ?? null,
    lines:              [],
  };
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Create a new BVM voucher in DRAFT status.
 */
export async function createBizVoucher(
  tenantOrgId: string,
  input: CreateBizVoucherInput,
  userId: string
): Promise<{ id: string; voucher_no: string }> {
  return withTenantContext(tenantOrgId, async () => {
    return prisma.$transaction(async (tx) => {
      const voucher_no = await generateBizVoucherNo(tenantOrgId, input.voucher_type, tx);

      const direction = input.direction ?? 'NEUTRAL';
      const voucher_category =
        direction === 'IN'  ? 'CASH_IN' :
        direction === 'OUT' ? 'CASH_OUT' : 'NON_CASH';

      const created = await (tx as typeof prisma).org_fin_vouchers_mst.create({
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
          total_amount:     0,
          status:           'draft',
          created_by:       userId,
        },
        select: { id: true, voucher_no: true },
      });

      return { id: created.id, voucher_no: created.voucher_no };
    });
  });
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
      payment_method_code:    l.payment_method_code,
      amount:                 Number(l.amount),
      currency_code:          l.currency_code,
      direction:              l.direction,
      tendered_amount:        l.tendered_amount != null ? Number(l.tendered_amount) : null,
      change_returned_amount: l.change_returned_amount != null ? Number(l.change_returned_amount) : null,
      expense_category_code:  l.expense_category_code,
      party_name:             l.party_name,
      description:            l.description,
      line_status:            l.line_status,
      wiring_status:          l.wiring_status,
      reversed_line_id:       l.reversed_line_id,
      created_at:             l.created_at,
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

    await prisma.org_fin_vouchers_mst.updateMany({
      where: { id: voucherId, tenant_org_id: tenantOrgId },
      data: {
        voucher_status:  VOUCHER_STATUS.CANCELLED,
        reversal_reason: reason,
        updated_at:      new Date(),
        updated_by:      userId,
      },
    });
  });
}
