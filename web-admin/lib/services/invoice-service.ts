/* eslint-disable jsdoc/require-param */
/**
 * Invoice Service for CleanMateX
 *
 * @deprecated New AR invoice screens, APIs, and reporting flows must use
 * `ar-invoice.service.ts`. This file remains only for read/list/update and
 * statistics compatibility helpers consumed by order screens that still
 * project the legacy `Invoice` shape.
 *
 * BVM Wiring Phase 6 Sub-item 2: the `createInvoice` adapter and its
 * private helpers (`generateInvoiceNumber`, the duplicated
 * `assertBlockingInvoiceAutoPostSucceeded` guard) were removed. The
 * canonical writer `createArInvoiceFromOrders` in `ar-invoice.service.ts`
 * is the sole AR-invoice producer; `createInvoiceAction` is now a thin
 * shim around it.
 */

import { prisma } from '@/lib/db/prisma';
import {
  AR_INVOICE_STATUSES,
  deriveArInvoiceStatus,
  normalizeArInvoiceStatus,
} from '@/lib/constants/ar-invoice';

/** Transaction client for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import { withTenantContext, getTenantIdFromSession } from '@/lib/db/tenant-context';
import type {
  Invoice,
  InvoiceStatus,
  UpdateInvoiceInput,
  InvoiceMetadata,
  PaymentSummary,
} from '../types/payment';

function tenantInvoiceWhere(tenant_org_id: string, id: string) {
  return { id_tenant_org_id: { tenant_org_id, id } };
}

// ============================================================================
// Invoice Retrieval
// ============================================================================

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
      include: {
        org_orders_mst: { select: { order_no: true } },
        org_customers_mst: { select: { name: true, name2: true } },
      },
    });

    if (!invoice) {
      return null;
    }

    return mapInvoiceToType(invoice);
  });
}

/**
 * Get invoice by invoice number
 */
export async function getInvoiceByNumber(
  tenantOrgId: string,
  invoiceNo: string
): Promise<Invoice | null> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const invoice = await prisma.org_invoice_mst.findFirst({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        invoice_no: invoiceNo,
      },
    });

    if (!invoice) {
      return null;
    }

    return mapInvoiceToType(invoice);
  });
}

/**
 * Get all invoices for an order
 */
export async function getInvoicesForOrder(
  orderId: string
): Promise<Invoice[]> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoices = await prisma.org_invoice_mst.findMany({
      where: {
        order_id: orderId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return invoices.map(mapInvoiceToType);
  });
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(
  tenantOrgId: string,
  status: InvoiceStatus
): Promise<Invoice[]> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const invoices = await prisma.org_invoice_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        status,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return invoices.map(mapInvoiceToType);
  });
}

/**
 * List all invoices with filtering, search, sorting and pagination
 */
export async function listInvoices(params: {
  tenantOrgId?: string;
  status?: InvoiceStatus;
  /** Filter by invoice type: RETAIL, B2B, or empty for all */
  invoiceTypeCd?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<{ invoices: Invoice[]; total: number; totalPages: number }> {
  // Get tenant ID from params or session
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

    if (params.status) {
      where.status = params.status;
    }

    if (params.invoiceTypeCd && params.invoiceTypeCd.trim()) {
      where.invoice_type_cd = params.invoiceTypeCd.trim();
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
      const q = params.searchQuery.trim();
      where.OR = [
        { invoice_no: { contains: q, mode: 'insensitive' } },
        { rec_notes: { contains: q, mode: 'insensitive' } },
        { paid_by: { contains: q, mode: 'insensitive' } },
        { paid_by_name: { contains: q, mode: 'insensitive' } },
        { trans_desc: { contains: q, mode: 'insensitive' } },
        { customer_reference: { contains: q, mode: 'insensitive' } },
        { handed_to_name: { contains: q, mode: 'insensitive' } },
        { handed_to_mobile_no: { contains: q, mode: 'insensitive' } },
        { org_orders_mst: { order_no: { contains: q, mode: 'insensitive' } } },
        {
          org_customers_mst: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { name2: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const allowedSortFields = ['invoice_no', 'created_at', 'due_date', 'total', 'paid_amount', 'status', 'invoice_date'];
    const sortBy = allowedSortFields.includes(params.sortBy || '') ? params.sortBy! : 'created_at';
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

    const [invoices, total] = await Promise.all([
      prisma.org_invoice_mst.findMany({
        where,
        include: {
          org_orders_mst: { select: { order_no: true } },
          org_customers_mst: { select: { name: true, name2: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.org_invoice_mst.count({ where }),
    ]);

    return {
      invoices: invoices.map(mapInvoiceToType),
      total,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ============================================================================
// Invoice Updates
// ============================================================================

/**
 * Update invoice
 */
export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceInput
): Promise<Invoice> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const currentInvoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!currentInvoice) {
      throw new Error('Invoice not found');
    }

    const updateData: any = {
      updated_at: new Date(),
      updated_by: input.paid_by,
    };

    if (input.status !== undefined) {
      updateData.status = normalizeArInvoiceStatus(input.status);
    }

    if (input.payment_method_code !== undefined) {
      updateData.payment_method_code = input.payment_method_code;
    }

    if (input.paid_amount !== undefined) {
      updateData.paid_amount = input.paid_amount;
    }

    if (input.paid_at !== undefined) {
      updateData.paid_at = new Date(input.paid_at);
    }

    if (input.paid_by !== undefined) {
      updateData.paid_by = input.paid_by;
    }

    if (input.metadata !== undefined) {
      updateData.metadata = JSON.stringify(input.metadata);
    }

    if (input.rec_notes !== undefined) {
      updateData.rec_notes = input.rec_notes;
    }

    const effectivePaidAmount = input.paid_amount !== undefined
      ? input.paid_amount
      : Number(currentInvoice.paid_amount ?? 0);

    updateData.outstanding_amount = calculateOutstandingAmount(
      Number(currentInvoice.total ?? 0),
      effectivePaidAmount
    );

    if (input.status === undefined && input.paid_amount !== undefined) {
      updateData.status = deriveArInvoiceStatus({
        currentStatus: currentInvoice.status,
        totalAmount: Number(currentInvoice.total ?? 0),
        paidAmount: effectivePaidAmount,
        dueDate: currentInvoice.due_date,
      });
    }

    const invoice = await prisma.org_invoice_mst.update({
      where: tenantInvoiceWhere(tenantId, invoiceId),
      data: updateData,
    });

    return mapInvoiceToType(invoice);
  });
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  updatedBy?: string
): Promise<Invoice> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.update({
      where: tenantInvoiceWhere(tenantId, invoiceId),
      data: {
        status: normalizeArInvoiceStatus(status),
        updated_at: new Date(),
        updated_by: updatedBy,
      },
    });

    return mapInvoiceToType(invoice);
  });
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  invoiceId: string,
  paidAmount: number,
  paidBy?: string
): Promise<Invoice> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newPaidAmount = Number(invoice.paid_amount) + paidAmount;
    const newStatus = deriveArInvoiceStatus({
      currentStatus: invoice.status,
      totalAmount: Number(invoice.total ?? 0),
      paidAmount: newPaidAmount,
      dueDate: invoice.due_date,
    }) as InvoiceStatus;

    return updateInvoice(invoiceId, {
      status: newStatus,
      paid_amount: newPaidAmount,
      rec_notes: invoice.rec_notes ?? undefined,
      paid_at: newStatus === AR_INVOICE_STATUSES.PAID ? new Date().toISOString() : undefined,
      paid_by: paidBy,
    });
  });
}

// ============================================================================
// Invoice Calculations
// ============================================================================

/**
 * Calculate invoice total.
 * VAT and additional tax are kept separate.
 */
export function calculateInvoiceTotal(params: {
  subtotal: number;
  discount: number;
  vatAmount?: number;
  additionalTax?: number;
}): number {
  const { subtotal, discount, vatAmount = 0, additionalTax = 0 } = params;
  return subtotal - discount + vatAmount + additionalTax;
}

/**
 * Calculate discount amount
 */
export function calculateDiscountAmount(
  subtotal: number,
  discountType: 'percentage' | 'amount',
  discountValue: number
): number {
  if (discountType === 'percentage') {
    return (subtotal * discountValue) / 100;
  }
  return discountValue;
}

/**
 * Calculate tax amount
 */
export function calculateTaxAmount(
  amount: number,
  taxRate: number
): number {
  return (amount * taxRate) / 100;
}

/**
 * Apply discount to invoice
 */
export async function applyDiscountToInvoice(
  invoiceId: string,
  discountAmount: number,
  reason?: string
): Promise<Invoice> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newTotal = calculateInvoiceTotal({
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount) + discountAmount,
      vatAmount: Number(invoice.vat_amount ?? 0),
      additionalTax: Number(invoice.tax ?? 0),
    });

    // Update metadata to track discount reason
    const metadata: InvoiceMetadata = parseInvoiceMetadata(invoice.metadata) ?? {};

    if (reason) {
      metadata.manual_discount_reason = reason;
    }

    const updated = await prisma.org_invoice_mst.update({
      where: tenantInvoiceWhere(tenantId, invoiceId),
      data: {
        discount: Number(invoice.discount) + discountAmount,
        total: newTotal,
        metadata: JSON.stringify(metadata),
        updated_at: new Date(),
      },
    });

    return mapInvoiceToType(updated);
  });
}

/**
 * Calculate payment summary for display
 */
export function calculatePaymentSummary(
  subtotal: number,
  manualDiscount: number,
  promoDiscount: number,
  giftCardApplied: number,
  taxRate: number = 0
): PaymentSummary {
  const totalDiscount = manualDiscount + promoDiscount;
  const amountAfterDiscount = subtotal - totalDiscount;
  const tax = calculateTaxAmount(amountAfterDiscount, taxRate);
  const total = Math.max(0, amountAfterDiscount + tax);

  return {
    subtotal,
    manualDiscount,
    promoDiscount,
    giftCardApplied,
    tax,
    total,
  };
}

// ============================================================================
// Invoice Status Checks
// ============================================================================

/**
 * Check if invoice is fully paid
 */
export async function isInvoicePaid(invoiceId: string): Promise<boolean> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!invoice) {
      return false;
    }

    return Number(invoice.paid_amount) >= Number(invoice.total);
  });
}

/**
 * Check if invoice is overdue
 */
export async function isInvoiceOverdue(invoiceId: string): Promise<boolean> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!invoice || !invoice.due_date) {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(invoice.due_date);

    return (
      now > dueDate &&
      normalizeArInvoiceStatus(invoice.status) !== AR_INVOICE_STATUSES.PAID &&
      normalizeArInvoiceStatus(invoice.status) !== AR_INVOICE_STATUSES.CANCELLED &&
      normalizeArInvoiceStatus(invoice.status) !== AR_INVOICE_STATUSES.VOID &&
      normalizeArInvoiceStatus(invoice.status) !== AR_INVOICE_STATUSES.REFUNDED
    );
  });
}

/**
 * Get remaining balance for invoice
 */
export async function getInvoiceBalance(invoiceId: string): Promise<number> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const invoice = await prisma.org_invoice_mst.findUnique({
      where: tenantInvoiceWhere(tenantId, invoiceId),
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return Number(
      invoice.outstanding_amount ??
      calculateOutstandingAmount(Number(invoice.total ?? 0), Number(invoice.paid_amount ?? 0))
    );
  });
}

// ============================================================================
// Invoice Statistics
// ============================================================================

/**
 * Get invoice statistics for tenant
 */
export async function getInvoiceStats(tenantOrgId: string): Promise<{
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  total_revenue: number;
  outstanding_amount: number;
}> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const invoices = await prisma.org_invoice_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
      },
    });

    const now = new Date();

    const stats = invoices.reduce(
      (acc, invoice) => {
        const normalizedStatus = normalizeArInvoiceStatus(invoice.status);
        const outstandingAmount = Number(
          invoice.outstanding_amount ??
          calculateOutstandingAmount(Number(invoice.total ?? 0), Number(invoice.paid_amount ?? 0))
        );

        acc.total_invoices++;

        if (normalizedStatus === AR_INVOICE_STATUSES.PAID) {
          acc.paid_invoices++;
          acc.total_revenue += Number(invoice.total);
        } else if (
          normalizedStatus === AR_INVOICE_STATUSES.OPEN ||
          normalizedStatus === AR_INVOICE_STATUSES.PARTIALLY_PAID ||
          normalizedStatus === AR_INVOICE_STATUSES.OVERDUE
        ) {
          acc.pending_invoices++;
          acc.outstanding_amount += outstandingAmount;

          // Check if overdue
          if (normalizedStatus === AR_INVOICE_STATUSES.OVERDUE) {
            acc.overdue_invoices++;
          }
        }

        return acc;
      },
      {
        total_invoices: 0,
        paid_invoices: 0,
        pending_invoices: 0,
        overdue_invoices: 0,
        total_revenue: 0,
        outstanding_amount: 0,
      }
    );

    return stats;
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse invoice metadata - Prisma Json columns return objects, raw DB may return strings
 */
function parseInvoiceMetadata(metadata: unknown): InvoiceMetadata | undefined {
  if (metadata == null) return undefined;
  if (typeof metadata === 'object') return metadata as InvoiceMetadata;
  if (typeof metadata === 'string') return JSON.parse(metadata) as InvoiceMetadata;
  return undefined;
}

/**
 * Map Prisma invoice model to Invoice type
 */
function mapInvoiceToType(invoice: any): Invoice {
  const customerName = invoice.org_customers_mst
    ? (invoice.org_customers_mst.name || invoice.org_customers_mst.name2 || undefined)
    : undefined;
  const orderNo = invoice.org_orders_mst?.order_no;
  return {
    id: invoice.id,
    order_id: invoice.order_id ?? undefined,
    order_no: orderNo,
    customer_id: invoice.customer_id ?? undefined,
    customerName,
    tenant_org_id: invoice.tenant_org_id,
    branch_id: invoice.branch_id ?? undefined,
    invoice_no: invoice.invoice_no,
    invoice_date: invoice.invoice_date?.toISOString?.()?.slice(0, 10),
    subtotal: Number(invoice.subtotal ?? 0),
    discount: Number(invoice.discount ?? 0),
    tax: Number(invoice.tax ?? 0),
    tax_rate: invoice.tax_rate != null ? Number(invoice.tax_rate) : undefined,
    total: Number(invoice.total ?? 0),
    vat_rate: invoice.vat_rate != null ? Number(invoice.vat_rate) : undefined,
    vat_amount: invoice.vat_amount != null ? Number(invoice.vat_amount) : undefined,
    discount_rate: invoice.discount_rate != null ? Number(invoice.discount_rate) : undefined,
    service_charge: invoice.service_charge != null ? Number(invoice.service_charge) : undefined,
    service_charge_type: invoice.service_charge_type ?? undefined,
    promo_discount_amount: invoice.promo_discount_amount != null ? Number(invoice.promo_discount_amount) : undefined,
    gift_card_applied_amount: invoice.gift_card_applied_amount != null ? Number(invoice.gift_card_applied_amount) : undefined,
    status: normalizeArInvoiceStatus(invoice.status) as InvoiceStatus,
    due_date: invoice.due_date?.toISOString?.()?.slice(0, 10),
    payment_terms: invoice.payment_terms ?? undefined,
    payment_method_code: invoice.payment_method_code,
    paid_amount: Number(invoice.paid_amount ?? 0),
    outstanding_amount: Number(
      invoice.outstanding_amount ??
      calculateOutstandingAmount(Number(invoice.total ?? 0), Number(invoice.paid_amount ?? 0))
    ),
    invoice_type_cd: invoice.invoice_type_cd ?? undefined,
    due_date_source_cd: invoice.due_date_source_cd ?? undefined,
    due_terms_days: invoice.due_terms_days ?? undefined,
    numbering_doc_type_cd: invoice.numbering_doc_type_cd ?? undefined,
    numbering_seq_no: invoice.numbering_seq_no != null ? Number(invoice.numbering_seq_no) : undefined,
    approval_required: invoice.approval_required ?? false,
    approval_action_cd: invoice.approval_action_cd ?? undefined,
    approved_at: invoice.approved_at?.toISOString?.(),
    approved_by: invoice.approved_by ?? undefined,
    approval_notes: invoice.approval_notes ?? undefined,
    issued_at: invoice.issued_at?.toISOString?.(),
    issued_by: invoice.issued_by ?? undefined,
    voided_at: invoice.voided_at?.toISOString?.(),
    voided_by: invoice.voided_by ?? undefined,
    void_reason: invoice.void_reason ?? undefined,
    paid_at: invoice.paid_at?.toISOString(),
    paid_by: invoice.paid_by ?? undefined,
    paid_by_name: invoice.paid_by_name ?? undefined,
    handed_to_name: invoice.handed_to_name ?? undefined,
    handed_to_mobile_no: invoice.handed_to_mobile_no ?? undefined,
    handed_to_date: invoice.handed_to_date?.toISOString(),
    handed_to_by_user: invoice.handed_to_by_user ?? undefined,
    trans_desc: invoice.trans_desc ?? undefined,
    customer_reference: invoice.customer_reference ?? undefined,
    metadata: parseInvoiceMetadata(invoice.metadata),
    rec_notes: invoice.rec_notes ?? undefined,
    currency_code: invoice.currency_code ?? '',
    currency_ex_rate: invoice.currency_ex_rate != null ? Number(invoice.currency_ex_rate) : undefined,
    created_at: invoice.created_at?.toISOString?.() ?? new Date().toISOString(),
    created_by: invoice.created_by ?? undefined,
    updated_at: invoice.updated_at?.toISOString(),
    updated_by: invoice.updated_by ?? undefined,
    rec_status: invoice.rec_status ?? undefined,
    is_active: invoice.is_active ?? undefined,
  };
}

// ── P8.11 — Financial Snapshot Extensions ─────────────────────────────────────

import type { FinancialBreakdownSnapshot } from '@/lib/types/order-financial';

/**
 * Persist snapshot totals on an invoice after order settlement.
 * Called inside the settlement transaction to keep invoice totals in sync.
 */
export async function updateInvoiceWithFinancialSnapshot(
  tx: PrismaTx,
  invoiceId: string,
  breakdown: FinancialBreakdownSnapshot
): Promise<void> {
  await tx.org_invoice_mst.updateMany({
    where:  { id: invoiceId },
    data: {
      subtotal:    breakdown.subtotal,
      discount:    breakdown.discountTotal,
      tax:         breakdown.taxTotal,
      total:       breakdown.grandTotal,
      paid_amount: breakdown.paymentLegsTotal,
      outstanding_amount: calculateOutstandingAmount(
        breakdown.grandTotal,
        breakdown.paymentLegsTotal
      ),
      updated_at:      new Date(),
    },
  });
}

/**
 * Fetch an invoice with its joined financial fact rows for the invoice detail view.
 */
export async function getInvoiceWithBreakdown(tenantId: string, invoiceId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_invoice_mst.findFirstOrThrow({
      where: { id: invoiceId, tenant_org_id: tenantId },
      include: {
        org_orders_mst: {
          include: {
            org_order_charges_dtl:  true,
            org_order_taxes_dtl:    true,
            org_order_discounts_dtl:true,
          },
        },
      },
    })
  );
}

function calculateOutstandingAmount(totalAmount: number, paidAmount: number): number {
  return Math.max(0, totalAmount - paidAmount);
}
