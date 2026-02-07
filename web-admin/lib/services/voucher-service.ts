/**
 * Voucher Service for CleanMateX
 *
 * Handles finance vouchers (receipt voucher, refund, credit note, etc.):
 * - Create voucher (draft/issued)
 * - Issue / void voucher
 * - Get voucher data for print
 * - Generate tenant-scoped voucher_no (e.g. RCP-2025-00001)
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext, getTenantIdFromSession } from '../db/tenant-context';
import {
  VOUCHER_CATEGORY,
  VOUCHER_TYPE,
  VOUCHER_SUBTYPE,
  VOUCHER_STATUS,
} from '../constants/voucher';
import type {
  CreateVoucherInput,
  CreateReceiptVoucherForPaymentInput,
  VoucherData,
} from '../types/voucher';

const RECEIPT_PREFIX = 'RCP';
const YEAR_LEN = 4;
const SEQ_LEN = 5;

/**
 * Generate next voucher_no for a tenant (RCP-YYYY-NNNNN).
 * Uses max existing number for tenant + year and increments.
 */
export async function generateVoucherNo(
  tenantId: string,
  prefix: string = RECEIPT_PREFIX
): Promise<string> {
  return withTenantContext(tenantId, async () => {
    const year = new Date().getFullYear().toString();
    const pattern = `${prefix}-${year}-%`;
    const existing = await prisma.org_fin_vouchers_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        voucher_no: { startsWith: `${prefix}-${year}-` },
      },
      select: { voucher_no: true },
      orderBy: { voucher_no: 'desc' },
      take: 1,
    });
    const lastNo = existing[0]?.voucher_no;
    let seq = 1;
    if (lastNo) {
      const match = lastNo.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }
    const seqStr = seq.toString().padStart(SEQ_LEN, '0');
    return `${prefix}-${year}-${seqStr}`;
  });
}

/**
 * Create a voucher (draft by default). Returns voucher id and voucher_no.
 */
export async function createVoucher(
  input: CreateVoucherInput
): Promise<{ id: string; voucher_no: string }> {
  const voucher_no = await generateVoucherNo(input.tenant_org_id);
  const row = await prisma.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id: input.tenant_org_id,
      branch_id: input.branch_id ?? null,
      voucher_no,
      voucher_category: input.voucher_category,
      voucher_subtype: input.voucher_subtype ?? null,
      voucher_type: input.voucher_type ?? null,
      invoice_id: input.invoice_id ?? null,
      order_id: input.order_id ?? null,
      customer_id: input.customer_id ?? null,
      total_amount: input.total_amount,
      currency_code: input.currency_code ?? null,
      status: VOUCHER_STATUS.DRAFT,
      reason_code: input.reason_code ?? null,
      content_html: input.content_html ?? null,
      content_text: input.content_text ?? null,
      metadata: input.metadata ?? undefined,
      created_by: input.created_by ?? null,
    },
    select: { id: true, voucher_no: true },
  });
  return { id: row.id, voucher_no: row.voucher_no };
}

/**
 * Issue a voucher: set status=issued, issued_at=now, and write audit log.
 */
export async function issueVoucher(
  voucherId: string,
  options?: { changed_by?: string }
): Promise<void> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  await withTenantContext(tenantId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantId },
    });
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === VOUCHER_STATUS.VOIDED) {
      throw new Error('Cannot issue a voided voucher');
    }

    await prisma.$transaction([
      prisma.org_fin_vouchers_mst.update({
        where: { id: voucherId },
        data: {
          status: VOUCHER_STATUS.ISSUED,
          issued_at: new Date(),
          updated_at: new Date(),
          updated_by: options?.changed_by ?? null,
        },
      }),
      prisma.org_fin_voucher_audit_log.create({
        data: {
          voucher_id: voucherId,
          tenant_org_id: tenantId,
          action: 'issued',
          snapshot_or_reason: null,
          changed_by: options?.changed_by ?? null,
        },
      }),
    ]);
  });
}

/**
 * Void a voucher: set status=voided, voided_at, void_reason, and write audit log.
 */
export async function voidVoucher(
  voucherId: string,
  reason: string,
  options?: { changed_by?: string }
): Promise<void> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  await withTenantContext(tenantId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantId },
    });
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === VOUCHER_STATUS.VOIDED) {
      throw new Error('Voucher is already voided');
    }

    await prisma.$transaction([
      prisma.org_fin_vouchers_mst.update({
        where: { id: voucherId },
        data: {
          status: VOUCHER_STATUS.VOIDED,
          voided_at: new Date(),
          void_reason: reason,
          updated_at: new Date(),
          updated_by: options?.changed_by ?? null,
        },
      }),
      prisma.org_fin_voucher_audit_log.create({
        data: {
          voucher_id: voucherId,
          tenant_org_id: tenantId,
          action: 'voided',
          snapshot_or_reason: reason,
          changed_by: options?.changed_by ?? null,
        },
      }),
    ]);
  });
}

/**
 * Get voucher data for display/print (with optional relations).
 */
export async function getVoucherData(
  voucherId: string,
  options?: { includePayments?: boolean; includeInvoice?: boolean }
): Promise<VoucherData | null> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) return null;

  return withTenantContext(tenantId, async () => {
    const row = await prisma.org_fin_vouchers_mst.findFirst({
      where: { id: voucherId, tenant_org_id: tenantId },
      include: {
        org_invoice_mst: options?.includeInvoice ?? false,
        org_orders_mst: true,
        org_customers_mst: true,
        org_payments_dtl_tr: options?.includePayments ?? false,
      },
    });
    if (!row) return null;
    return mapRowToVoucherData(row);
  });
}

/**
 * Get voucher data by payment ID (looks up voucher via payment's voucher_id).
 */
export async function getVoucherDataByPaymentId(
  paymentId: string,
  options?: { includePayments?: boolean; includeInvoice?: boolean }
): Promise<VoucherData | null> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) return null;

  return withTenantContext(tenantId, async () => {
    const payment = await prisma.org_payments_dtl_tr.findFirst({
      where: { id: paymentId, tenant_org_id: tenantId },
      select: { voucher_id: true },
    });
    if (!payment?.voucher_id) return null;

    return getVoucherData(payment.voucher_id, options);
  });
}

function mapRowToVoucherData(row: {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  voucher_no: string;
  voucher_category: string;
  voucher_subtype: string | null;
  voucher_type: string | null;
  invoice_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  total_amount: unknown;
  currency_code: string | null;
  status: string;
  issued_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  reason_code: string | null;
  reversed_by_voucher_id: string | null;
  content_html: string | null;
  content_text: string | null;
  metadata: unknown;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}): VoucherData {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    branch_id: row.branch_id,
    voucher_no: row.voucher_no,
    voucher_category: row.voucher_category,
    voucher_subtype: row.voucher_subtype,
    voucher_type: row.voucher_type,
    invoice_id: row.invoice_id,
    order_id: row.order_id,
    customer_id: row.customer_id,
    total_amount: Number(row.total_amount),
    currency_code: row.currency_code,
    status: row.status,
    issued_at: row.issued_at,
    voided_at: row.voided_at,
    void_reason: row.void_reason,
    reason_code: row.reason_code,
    reversed_by_voucher_id: row.reversed_by_voucher_id,
    content_html: row.content_html,
    content_text: row.content_text,
    metadata: row.metadata,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

/**
 * Create a receipt voucher for a payment (CASH_IN, RECEIPT, SALE_PAYMENT).
 * Optionally auto-issue. Returns voucher id for attaching to payment row.
 */
export async function createReceiptVoucherForPayment(
  input: CreateReceiptVoucherForPaymentInput
): Promise<{ voucher_id: string; voucher_no: string }> {
  const { id: voucher_id, voucher_no } = await createVoucher({
    tenant_org_id: input.tenant_org_id,
    branch_id: input.branch_id,
    voucher_category: VOUCHER_CATEGORY.CASH_IN,
    voucher_subtype: VOUCHER_SUBTYPE.SALE_PAYMENT,
    voucher_type: VOUCHER_TYPE.RECEIPT,
    invoice_id: input.invoice_id,
    order_id: input.order_id,
    customer_id: input.customer_id,
    total_amount: input.total_amount,
    currency_code: input.currency_code ?? undefined,
    created_by: input.created_by,
  });

  if (input.auto_issue !== false) {
    await prisma.org_fin_vouchers_mst.update({
      where: { id: voucher_id },
      data: {
        status: VOUCHER_STATUS.ISSUED,
        issued_at: input.issued_at ?? new Date(),
        updated_at: new Date(),
        updated_by: input.created_by ?? null,
      },
    });
    await prisma.org_fin_voucher_audit_log.create({
      data: {
        voucher_id,
        tenant_org_id: input.tenant_org_id,
        action: 'issued',
        snapshot_or_reason: null,
        changed_by: input.created_by ?? null,
      },
    });
  }

  return { voucher_id, voucher_no };
}

/**
 * List vouchers with filtering, search, sorting and pagination.
 */
export async function listVouchers(params: {
  tenantOrgId?: string;
  status?: string[];
  voucherCategory?: string[];
  voucherType?: string[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<{ vouchers: VoucherData[]; total: number; totalPages: number }> {
  const tenantId = params.tenantOrgId || (await getTenantIdFromSession());
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  const limit = params.limit || 20;
  const offset = params.offset || 0;

  return withTenantContext(tenantId, async () => {
    const where: any = {
      tenant_org_id: tenantId,
    };

    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    }

    if (params.voucherCategory && params.voucherCategory.length > 0) {
      where.voucher_category = { in: params.voucherCategory };
    }

    if (params.voucherType && params.voucherType.length > 0) {
      where.voucher_type = { in: params.voucherType };
    }

    if (params.dateFrom || params.dateTo) {
      where.created_at = {};
      if (params.dateFrom) {
        where.created_at.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        where.created_at.lte = new Date(params.dateTo);
      }
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const search = params.searchQuery.trim();
      where.OR = [
        { voucher_no: { contains: search, mode: 'insensitive' } },
        { invoice_id: { contains: search, mode: 'insensitive' } },
        { order_id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.org_fin_vouchers_mst.findMany({
        where,
        include: {
          org_invoice_mst: { select: { invoice_no: true } },
          org_orders_mst: { select: { order_no: true } },
          org_customers_mst: { select: { name: true, name2: true } },
          org_payments_dtl_tr: {
            select: { id: true },
            take: 1,
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: {
          [params.sortBy && ['voucher_no', 'created_at', 'issued_at', 'total_amount', 'status'].includes(params.sortBy)
            ? params.sortBy
            : 'created_at']: params.sortOrder || 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.org_fin_vouchers_mst.count({ where }),
    ]);

    return {
      vouchers: vouchers.map((row) => {
        const voucher = mapRowToVoucherData({
          id: row.id,
          tenant_org_id: row.tenant_org_id,
          branch_id: row.branch_id,
          voucher_no: row.voucher_no,
          voucher_category: row.voucher_category,
          voucher_subtype: row.voucher_subtype,
          voucher_type: row.voucher_type,
          invoice_id: row.invoice_id,
          order_id: row.order_id,
          customer_id: row.customer_id,
          total_amount: row.total_amount,
          currency_code: row.currency_code,
          status: row.status,
          issued_at: row.issued_at,
          voided_at: row.voided_at,
          void_reason: row.void_reason,
          reason_code: row.reason_code,
          reversed_by_voucher_id: row.reversed_by_voucher_id,
          content_html: row.content_html,
          content_text: row.content_text,
          metadata: row.metadata,
          created_at: row.created_at,
          created_by: row.created_by,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        });
        // Add first payment ID for linking
        return {
          ...voucher,
          payment_id: row.org_payments_dtl_tr?.[0]?.id || null,
        };
      }),
      total,
      totalPages: Math.ceil(total / limit),
    };
  });
}
