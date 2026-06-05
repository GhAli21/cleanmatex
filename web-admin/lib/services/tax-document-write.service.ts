import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  TAX_DOCUMENT_STATUSES,
} from '@/lib/constants/order-financial';
import type {
  TaxDocumentCreateInput,
} from '@/lib/types/order-financial';
import {
  allocateTaxDocumentSequence,
  formatTaxDocumentNo,
} from '@/lib/services/tax-document-sequence.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Creates a DRAFT tax document with its lines inside an existing transaction.
 *
 * Does NOT allocate a sequence number or transition to ISSUED — call
 * issueTaxDocumentTx() immediately after if the document should be issued
 * atomically in the same transaction.
 */
export async function createTaxDocumentTx(
  tx: PrismaTransactionClient,
  input: TaxDocumentCreateInput,
): Promise<string> {
  const now = new Date();
  const fiscalYear = now.getFullYear();

  const doc = await tx.org_tax_documents_mst.create({
    data: {
      tenant_org_id:      input.tenantId,
      order_id:           input.orderId,
      document_type:      input.documentType,
      trigger_event:      input.triggerEvent,
      status:             TAX_DOCUMENT_STATUSES.DRAFT,
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

  return doc.id;
}

/**
 * Transitions a DRAFT tax document to ISSUED, allocating a fiscal sequence
 * number and setting the issued_at timestamp.
 *
 * Must be called inside the same transaction that created the document.
 * After this call the document is immutable (DB trigger enforces it).
 */
export async function issueTaxDocumentTx(
  tx: PrismaTransactionClient,
  documentId: string,
  tenantId:   string,
  issuedBy:   string,
): Promise<{ documentNo: string; sequenceNumber: number }> {
  const doc = await tx.org_tax_documents_mst.findUnique({
    where:  { id: documentId },
    select: { document_type: true, fiscal_year: true, status: true, tenant_org_id: true },
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
    where: { id: documentId },
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

  return { documentNo, sequenceNumber };
}

/**
 * Convenience wrapper: creates a DRAFT document and immediately issues it
 * in a single atomic transaction.
 *
 * Sequence number allocation and ISSUED status are committed together —
 * if anything fails, both are rolled back with no fiscal gap.
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
 */
export async function supersedeTaxDocument(
  originalDocumentId: string,
  correctionInput:    TaxDocumentCreateInput,
  issuedBy:           string,
): Promise<{ correctionDocumentId: string; correctionDocumentNo: string }> {
  return prisma.$transaction(async (tx) => {
    // Verify original document exists and is ISSUED
    const original = await tx.org_tax_documents_mst.findUnique({
      where:  { id: originalDocumentId },
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
      where: { id: correctionDocumentId },
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
      where: { id: originalDocumentId },
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
