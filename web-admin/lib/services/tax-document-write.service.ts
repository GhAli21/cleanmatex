import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  TAX_DOCUMENT_STATUSES,
  TAX_DOCUMENT_TYPES,
} from '@/lib/constants/order-financial';
import type {
  TaxDocumentCreateInput,
} from '@/lib/types/order-financial';
import {
  allocateTaxDocumentSequence,
  formatTaxDocumentNo,
} from '@/lib/services/tax-document-sequence.service';
import { resolveEInvoiceActivation } from '@/lib/services/e-invoice.service';
import { resolveInitialEInvoiceStatus } from '@/lib/payments/e-invoice';
import { addMoney, toMoneyString } from '@/lib/utils/money';
import { logger } from '@/lib/utils/logger';
import { finalizeOrderTaxLines } from '@/lib/services/tax/tax-lines.writer';
import { netPrepaidTaxTx } from '@/lib/services/tax/prepaid-tax.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Creates a DRAFT tax document with its lines inside an existing transaction.
 *
 * Does NOT allocate a sequence number or transition to ISSUED — call
 * issueTaxDocumentTx() immediately after if the document should be issued
 * atomically in the same transaction.
 * @param tx
 * @param input
 */
export async function createTaxDocumentTx(
  tx: PrismaTransactionClient,
  input: TaxDocumentCreateInput,
): Promise<string> {
  const now = new Date();
  const fiscalYear = now.getFullYear();

  // F-05/ADR-052 (mig 0386): stamp the initial e-invoice status from the order's
  // activation window. PENDING when e-invoicing is active for the order's date,
  // else NOT_APPLICABLE (existing flat-VAT flow — no behavior change for disabled
  // tenants / pre-start-date orders). The order's created_at is the order date.
  const order = await tx.org_orders_mst.findFirst({
    where: { id: input.orderId, tenant_org_id: input.tenantId },
    select: { created_at: true },
  });
  const activation = await resolveEInvoiceActivation(tx, input.tenantId, order?.created_at ?? now);
  const eInvoiceStatus = resolveInitialEInvoiceStatus(activation.active);

  const doc = await tx.org_tax_documents_mst.create({
    data: {
      tenant_org_id:      input.tenantId,
      order_id:           input.orderId,
      document_type:      input.documentType,
      trigger_event:      input.triggerEvent,
      status:             TAX_DOCUMENT_STATUSES.DRAFT,
      e_invoice_status:   eInvoiceStatus,
      fiscal_year:        fiscalYear,
      sequence_number:    0,
      total_amount:       input.totalAmount,
      tax_amount:         input.taxAmount,
      currency_code:      input.currencyCode,
      currency_ex_rate:   input.currencyExRate ?? 1,
      base_currency_code: input.baseCurrencyCode ?? null,
      created_at:         now,
      created_by:         'system',
    },
    select: { id: true },
  });

  if (input.taxLines && input.taxLines.length > 0) {
    await tx.org_tax_doc_lines_dtl.createMany({
      data: input.taxLines.map((line) => ({
        tenant_org_id:      input.tenantId,
        tax_document_id:    doc.id,
        order_tax_line_id:  line.orderTaxLineId ?? null,
        tax_type:           line.taxType,
        label:              line.label,
        label2:             line.label2 ?? null,
        rate:               line.rate ?? null,
        base_amount:        line.baseAmount,
        tax_amount:         line.taxAmount,
        created_at:         now,
        created_by:         'system',
      })),
    });
  }

  await snapshotTaxDocumentItemsTx(tx, input.tenantId, input.orderId, doc.id, now);

  return doc.id;
}

/**
 * Copies each active item's line money onto the document (Line-Level §6.7,
 * P8-02): the document keeps its own item table and never re-reads live order
 * items; rows are never updated after issue, and credit notes reference them.
 * An order written before the calculator has no line money: no item lines are
 * written (logged), rather than invented figures.
 * @param tx - the issuing transaction
 * @param tenantId - session tenant
 * @param orderId - the document's order
 * @param taxDocumentId - the new document
 * @param now - creation time shared with the document
 */
async function snapshotTaxDocumentItemsTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
  taxDocumentId: string,
  now: Date,
): Promise<void> {
  const items = await tx.org_order_items_dtl.findMany({
    where: { order_id: orderId, tenant_org_id: tenantId, rec_status: 1 },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    select: {
      id: true, product_name: true, product_name2: true, quantity: true, price_per_unit: true,
      line_disc_amount: true, order_disc_alloc_amount: true, net_amount: true,
      tax_category_code: true, tax_rate: true, tax_amount: true, line_total_amount: true,
    },
  });
  if (items.length === 0) return;
  if (items.some((i) => i.net_amount == null || i.line_total_amount == null || !i.tax_category_code)) {
    logger.warn('Tax document item lines skipped: order has no line money (written before the calculator)', {
      feature: 'tax_document', action: 'snapshot_items', tenantId, orderId, taxDocumentId,
    });
    return;
  }
  await tx.org_tax_doc_items_dtl.createMany({
    data: items.map((i, index) => ({
      tenant_org_id: tenantId,
      tax_document_id: taxDocumentId,
      order_item_id: i.id,
      line_no: index + 1,
      product_name: i.product_name ?? i.product_name2 ?? '',
      product_name2: i.product_name2 ?? null,
      quantity: i.quantity ?? 0,
      price_per_unit: i.price_per_unit,
      // Line discount plus the order discount allocated to this line (§6.7).
      discount_amount: toMoneyString(addMoney(i.line_disc_amount ?? 0, i.order_disc_alloc_amount ?? 0)),
      net_amount: i.net_amount!,
      tax_category_code: i.tax_category_code!,
      tax_rate: i.tax_rate ?? 0,
      tax_amount: i.tax_amount ?? 0,
      line_total_amount: i.line_total_amount!,
      created_at: now,
      created_by: 'system',
    })),
  });
}

/**
 * Transitions a DRAFT tax document to ISSUED, allocating a fiscal sequence
 * number and setting the issued_at timestamp.
 *
 * Must be called inside the same transaction that created the document.
 * After this call the document is immutable (DB trigger enforces it).
 * @param tx
 * @param documentId
 * @param tenantId
 * @param issuedBy
 */
export async function issueTaxDocumentTx(
  tx: PrismaTransactionClient,
  documentId: string,
  tenantId:   string,
  issuedBy:   string,
): Promise<{ documentNo: string; sequenceNumber: number }> {
  const doc = await tx.org_tax_documents_mst.findUnique({
    where: { id: documentId, tenant_org_id: tenantId },
    select: { document_type: true, doc_type_code: true, fiscal_year: true, status: true, tenant_org_id: true, order_id: true },
  });

  if (!doc) {
    throw new Error(`tax_document_write: document ${documentId} not found`);
  }
  if (doc.tenant_org_id !== tenantId) {
    throw new Error(`tax_document_write: tenant mismatch on document ${documentId}`);
  }
  if (doc.status !== TAX_DOCUMENT_STATUSES.DRAFT) {
    throw new Error(
      `tax_document_write: document ${documentId} is ${doc.status}, expected DRAFT`,
    );
  }

  const sequenceNumber = await allocateTaxDocumentSequence(
    tx,
    tenantId,
    doc.document_type as Parameters<typeof allocateTaxDocumentSequence>[2],
    doc.fiscal_year,
  );

  const documentNo = formatTaxDocumentNo(
    doc.document_type as Parameters<typeof formatTaxDocumentNo>[0],
    doc.fiscal_year,
    sequenceNumber,
  );

  await tx.org_tax_documents_mst.update({
    where: { id: documentId, tenant_org_id: tenantId },
    data: {
      status:          TAX_DOCUMENT_STATUSES.ISSUED,
      sequence_number: sequenceNumber,
      document_no:     documentNo,
      issued_at:       new Date(),
      issued_by:       issuedBy,
      updated_at:      new Date(),
      updated_by:      issuedBy,
    },
  });

  // The invoice is the tax point: the order's tax record stops changing here.
  if (doc.document_type === TAX_DOCUMENT_TYPES.INVOICE || doc.document_type === TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE) {
    const at = new Date();
    await finalizeOrderTaxLines(tx, { tenantOrgId: tenantId, orderId: doc.order_id, userId: issuedBy, at });
    // Tax already recorded on advances and single-purpose gift cards that paid this order is netted here.
    await netPrepaidTaxTx(tx, {
      tenantOrgId: tenantId, orderId: doc.order_id, userId: issuedBy, at,
      invoice: { id: documentId, docTypeCode: doc.doc_type_code, no: documentNo },
    });
  }

  return { documentNo, sequenceNumber };
}

/**
 * Convenience wrapper: creates a DRAFT document and immediately issues it
 * in a single atomic transaction.
 *
 * Sequence number allocation and ISSUED status are committed together —
 * if anything fails, both are rolled back with no fiscal gap.
 * @param input
 * @param issuedBy
 */
export async function createAndIssueTaxDocument(
  input: TaxDocumentCreateInput,
  issuedBy: string,
): Promise<{ documentId: string; documentNo: string; sequenceNumber: number }> {
  return prisma.$transaction(async (tx) => {
    const documentId = await createTaxDocumentTx(tx, input);
    const { documentNo, sequenceNumber } = await issueTaxDocumentTx(
      tx,
      documentId,
      input.tenantId,
      issuedBy,
    );
    return { documentId, documentNo, sequenceNumber };
  });
}

/**
 * Supersedes an ISSUED document as part of a credit/debit-note chain.
 * Creates the correction document, issues it, and marks the original as SUPERSEDED.
 *
 * The DB immutability trigger allows ISSUED → SUPERSEDED and will reject any
 * other update on the original row.
 * @param originalDocumentId
 * @param correctionInput
 * @param issuedBy
 */
export async function supersedeTaxDocument(
  originalDocumentId: string,
  correctionInput:    TaxDocumentCreateInput,
  issuedBy:           string,
): Promise<{ correctionDocumentId: string; correctionDocumentNo: string }> {
  return prisma.$transaction(async (tx) => {
    // Verify original document exists and is ISSUED
    const original = await tx.org_tax_documents_mst.findUnique({
      where: { id: originalDocumentId, tenant_org_id: correctionInput.tenantId },
      select: { status: true, tenant_org_id: true },
    });

    if (!original) {
      throw new Error(`tax_document_write: original document ${originalDocumentId} not found`);
    }
    if (original.tenant_org_id !== correctionInput.tenantId) {
      throw new Error(`tax_document_write: tenant mismatch on document ${originalDocumentId}`);
    }
    if (original.status !== TAX_DOCUMENT_STATUSES.ISSUED) {
      throw new Error(
        `tax_document_write: cannot supersede document ${originalDocumentId} with status=${original.status}`,
      );
    }

    // Create and issue the correction document
    const correctionDocumentId = await createTaxDocumentTx(tx, {
      ...correctionInput,
      // Correction document links back to original via supersedes_id
    });

    // Set supersedes_id on the correction document
    await tx.org_tax_documents_mst.update({
      where: { id: correctionDocumentId, tenant_org_id: correctionInput.tenantId },
      data:  { supersedes_id: originalDocumentId },
    });

    const { documentNo: correctionDocumentNo } = await issueTaxDocumentTx(
      tx,
      correctionDocumentId,
      correctionInput.tenantId,
      issuedBy,
    );

    // Transition original to SUPERSEDED (allowed by immutability trigger)
    await tx.org_tax_documents_mst.update({
      where: { id: originalDocumentId, tenant_org_id: correctionInput.tenantId },
      data: {
        status:     TAX_DOCUMENT_STATUSES.SUPERSEDED,
        updated_at: new Date(),
        updated_by: issuedBy,
      },
    });

    return { correctionDocumentId, correctionDocumentNo };
  });
}

/**
 * Loads per-tenant trigger configurations for the decision service.
 * Returns only enabled, active rows.
 * @param tenantId
 */
export async function getTaxDocumentTriggerConfigs(
  tenantId: string,
): Promise<{ triggerEvent: string; documentType: string; isEnabled: boolean }[]> {
  const rows = await prisma.org_tax_doc_triggers_cfg.findMany({
    where:  { tenant_org_id: tenantId, is_active: true, is_enabled: true },
    select: { trigger_event: true, document_type: true, is_enabled: true },
  });

  return rows.map((r) => ({
    triggerEvent: r.trigger_event,
    documentType: r.document_type,
    isEnabled:    r.is_enabled,
  }));
}
