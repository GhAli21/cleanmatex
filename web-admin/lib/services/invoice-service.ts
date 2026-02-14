/**
 * Invoice Service for CleanMateX
 *
 * Handles all invoice-related operations including:
 * - Invoice creation and management
 * - Invoice calculation (totals, discounts, taxes)
 * - Invoice status tracking
 * - Invoice retrieval and updates
 */

import { prisma } from '@/lib/db/prisma';

/** Transaction client for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import { withTenantContext, getTenantIdFromSession } from '@/lib/db/tenant-context';
import type {
  Invoice,
  InvoiceStatus,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceMetadata,
  PaymentSummary,
} from '../types/payment';

// ============================================================================
// Invoice Creation
// ============================================================================

/**
 * Create an invoice for an order.
 * When tx is provided, all operations run inside that transaction.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  tx?: PrismaTx
): Promise<Invoice> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  const db = tx ?? prisma;

  return withTenantContext(tenantId, async () => {
    const order = await db.org_orders_mst.findUnique({
      where: { id: input.order_id },
      include: {
        org_order_items_dtl: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const invoiceNo = await generateInvoiceNumber(order.tenant_org_id, db);

    const vatAmount = input.vatAmount ?? Number(order.vat_amount ?? 0);
    const additionalTax = input.tax ?? 0;
    const total = calculateInvoiceTotal({
      subtotal: input.subtotal,
      discount: input.discount || 0,
      vatAmount,
      additionalTax,
    });

    const now = new Date();
    const invoice = await db.org_invoice_mst.create({
      data: {
        order_id: input.order_id,
        customer_id: order.customer_id ?? input.customer_id,
        tenant_org_id: order.tenant_org_id,
        branch_id: order.branch_id ?? undefined,
        invoice_no: invoiceNo,
        invoice_date: now,
        subtotal: input.subtotal,
        discount: input.discount || 0,
        tax: additionalTax,
        tax_rate: order.tax_rate ?? undefined,
        vat_amount: vatAmount,
        total,
        status: 'pending',
        due_date: input.due_date ? new Date(input.due_date) : undefined,
        payment_method_code: input.payment_method_code,
        payment_terms: order.payment_terms ?? undefined,
        paid_amount: 0,
        service_charge: order.service_charge ?? undefined,
        service_charge_type: order.service_charge_type ?? undefined,
        gift_card_id: order.gift_card_id ?? undefined,
        gift_card_discount_amount: order.gift_card_discount_amount ?? undefined,
        vat_rate: order.vat_rate ?? undefined,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        rec_notes: input.rec_notes,
        created_at: now,
      },
    });

    return mapInvoiceToType(invoice);
  });
}

/**
 * Generate unique invoice number for tenant
 */
async function generateInvoiceNumber(
  tenantOrgId: string,
  db: typeof prisma | PrismaTx = prisma
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}`;

  const count = await db.org_invoice_mst.count({
    where: {
      tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
      invoice_no: {
        startsWith: prefix,
      },
    },
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}-${sequence}`;
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
      where: { id: invoiceId },
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
    const updateData: any = {
      updated_at: new Date(),
      updated_by: input.paid_by,
    };

    if (input.status !== undefined) {
      updateData.status = input.status;
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

    const invoice = await prisma.org_invoice_mst.update({
      where: { id: invoiceId },
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
      where: { id: invoiceId },
      data: {
        status,
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
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newPaidAmount = Number(invoice.paid_amount) + paidAmount;
    const newStatus: InvoiceStatus =
      newPaidAmount >= Number(invoice.total) ? 'paid' : 'partial';

    return updateInvoice(invoiceId, {
      status: newStatus,
      paid_amount: newPaidAmount,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined,
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
      where: { id: invoiceId },
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
      where: { id: invoiceId },
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
  const totalBeforeGiftCard = amountAfterDiscount + tax;
  const total = Math.max(0, totalBeforeGiftCard - giftCardApplied);

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
      where: { id: invoiceId },
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
      where: { id: invoiceId },
    });

    if (!invoice || !invoice.due_date) {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(invoice.due_date);

    return (
      now > dueDate &&
      invoice.status !== 'paid' &&
      invoice.status !== 'cancelled'
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
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return Number(invoice.total) - Number(invoice.paid_amount);
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
        acc.total_invoices++;

        if (invoice.status === 'paid') {
          acc.paid_invoices++;
          acc.total_revenue += Number(invoice.total);
        } else if (invoice.status === 'pending' || invoice.status === 'partial') {
          acc.pending_invoices++;
          const remaining = Number(invoice.total) - Number(invoice.paid_amount);
          acc.outstanding_amount += remaining;

          // Check if overdue
          if (invoice.due_date && new Date(invoice.due_date) < now) {
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
    gift_card_discount_amount: invoice.gift_card_discount_amount != null ? Number(invoice.gift_card_discount_amount) : undefined,
    status: invoice.status as InvoiceStatus,
    due_date: invoice.due_date?.toISOString?.()?.slice(0, 10),
    payment_terms: invoice.payment_terms ?? undefined,
    payment_method_code: invoice.payment_method_code,
    paid_amount: Number(invoice.paid_amount ?? 0),
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
    currency_code: invoice.currency_code ?? undefined,
    currency_ex_rate: invoice.currency_ex_rate != null ? Number(invoice.currency_ex_rate) : undefined,
    created_at: invoice.created_at?.toISOString?.() ?? new Date().toISOString(),
    created_by: invoice.created_by ?? undefined,
    updated_at: invoice.updated_at?.toISOString(),
    updated_by: invoice.updated_by ?? undefined,
    rec_status: invoice.rec_status ?? undefined,
    is_active: invoice.is_active ?? undefined,
  };
}

/**
 * Format amount to OMR currency
 */
export function formatOMR(amount: number): string {
  return `OMR ${amount.toFixed(3)}`;
}

/**
 * Parse OMR string to number
 */
export function parseOMR(omrString: string): number {
  return parseFloat(omrString.replace('OMR', '').trim());
}
