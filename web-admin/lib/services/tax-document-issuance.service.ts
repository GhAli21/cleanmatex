import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  TAX_DOCUMENT_STATUSES,
  TAX_DOCUMENT_TYPES,
} from '@/lib/constants/order-financial';
import type {
  TaxDocumentCreateInput,
  TaxDocumentTriggerEvent,
} from '@/lib/types/order-financial';
import {
  createTaxDocumentTx,
  issueTaxDocumentTx,
  getTaxDocumentTriggerConfigs,
} from '@/lib/services/tax-document-write.service';
import {
  decideTaxDocumentIssuance,
  decideCorrectionDocumentType,
} from '@/lib/services/tax-document-decision.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolves the VAT/tax-registration number that gates tax-document issuance
 * (B14 prerequisite). Branch override falls back to the tenant value,
 * mirroring `resolveTaxPricingMode`'s branch-then-tenant pattern.
 *
 * Reads via raw SQL rather than the Prisma model: `tax_registration_no` is
 * added by migration 0440, which this code may reach production ahead of
 * (STOP-AND-WAIT migration policy) — a typed Prisma field would force a
 * default-select on `org_tenants_mst`/`org_branches_mst` (both extremely
 * widely queried) to break platform-wide the moment the client regenerates,
 * before the column exists. Raw SQL only fails the (non-blocking, see
 * `maybeIssueTaxDocumentTx`) tax-document path itself.
 * @param tx
 * @param tenantId
 * @param branchId
 */
export async function resolveTaxRegistrationNo(
  tx: PrismaTransactionClient,
  tenantId: string,
  branchId: string | null,
): Promise<string | null> {
  if (branchId) {
    const branchRows = await tx.$queryRaw<Array<{ tax_registration_no: string | null }>>`
      SELECT tax_registration_no FROM public.org_branches_mst
      WHERE id = ${branchId}::uuid AND tenant_org_id = ${tenantId}::uuid
      LIMIT 1
    `;
    const branchNo = branchRows[0]?.tax_registration_no?.trim();
    if (branchNo) return branchNo;
  }

  const tenantRows = await tx.$queryRaw<Array<{ tax_registration_no: string | null }>>`
    SELECT tax_registration_no FROM public.org_tenants_mst
    WHERE id = ${tenantId}::uuid
    LIMIT 1
  `;
  const tenantNo = tenantRows[0]?.tax_registration_no?.trim();
  return tenantNo || null;
}

/**
 * Primary issuance trigger — call at a real order lifecycle point (order
 * submit, payment confirmation, service completion, delivery, AR invoice
 * issue). No-ops (returns null) unless ALL of:
 *   1. the tenant/branch has a tax-registration number (prerequisite gate),
 *   2. the tenant has an enabled `org_tax_doc_triggers_cfg` row for this
 *      trigger event (per-tenant opt-in — zero rows today for every tenant,
 *      so this is dormant until an owner configures a pilot tenant),
 *   3. the order's status is eligible for this trigger, and it has tax.
 *
 * Must run inside the caller's existing transaction so the document commits
 * atomically with whatever operation triggered it.
 * @param tx
 * @param params
 */
export async function maybeIssueTaxDocumentTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    branchId: string | null;
    triggerEvent: TaxDocumentTriggerEvent;
    orderStatus: string;
    issuedBy: string;
  },
): Promise<{ documentId: string; documentNo: string } | null> {
  const registrationNo = await resolveTaxRegistrationNo(tx, params.tenantId, params.branchId);
  if (!registrationNo) {
    return null;
  }

  const configs = await getTaxDocumentTriggerConfigs(params.tenantId);
  if (configs.length === 0) {
    return null;
  }

  const order = await tx.org_orders_mst.findUnique({
    where: { id: params.orderId, tenant_org_id: params.tenantId },
    select: {
      total_amount: true,
      total_tax_amount: true,
      currency_code: true,
      currency_ex_rate: true,
      base_cur_currency_code: true,
    },
  });
  if (!order) {
    return null;
  }

  const totalAmount = toNumber(order.total_amount);
  const taxAmount = toNumber(order.total_tax_amount);

  const decision = decideTaxDocumentIssuance(
    params.triggerEvent,
    { status: params.orderStatus, outstanding: 0, hasTaxLines: taxAmount > 0 },
    configs as Parameters<typeof decideTaxDocumentIssuance>[2],
  );
  if (!decision.shouldIssue || !decision.documentType) {
    return null;
  }

  const input: TaxDocumentCreateInput = {
    orderId: params.orderId,
    tenantId: params.tenantId,
    documentType: decision.documentType,
    triggerEvent: params.triggerEvent,
    totalAmount,
    taxAmount,
    currencyCode: order.currency_code ?? '',
    currencyExRate: toNumber(order.currency_ex_rate) || 1,
    baseCurrencyCode: order.base_cur_currency_code ?? null,
  };

  const documentId = await createTaxDocumentTx(tx, input);
  const { documentNo } = await issueTaxDocumentTx(tx, documentId, params.tenantId, params.issuedBy);
  return { documentId, documentNo };
}

/**
 * Correction-document issuance for a governed financial delta on an order
 * that already has an ISSUED tax document (refund → B34, amendment → B12).
 *
 * Issues a companion CREDIT_NOTE/DEBIT_NOTE referencing the original via
 * `supersedes_id` — the original stays ISSUED (per the DB immutability
 * trigger's own guidance: "Issue a CREDIT_NOTE or DEBIT_NOTE to correct an
 * issued document"). This is deliberately NOT `supersedeTaxDocument()`,
 * which flips the original to SUPERSEDED — that is the separate "this
 * document was wrong, void and replace it" lifecycle action, not a routine
 * correction for a legitimate post-issuance change.
 *
 * No-ops (returns null) when there is no ISSUED original to correct against
 * (registration-driven: if the tenant never had tax documents enabled, there
 * is nothing to correct) or when the delta is within tolerance.
 *
 * The correction's tax_amount is derived proportionally from the original
 * document's tax:total ratio — an honest approximation (assumes a uniform
 * effective rate across the order), not a full per-tax-type recomputation
 * of the delta. Documented as a known simplification (B14 Design decisions).
 * @param tx
 * @param params
 */
export async function issueCorrectionTaxDocumentTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    netDelta: number;
    triggerEvent: Extract<TaxDocumentTriggerEvent, 'ON_REFUND' | 'ON_AMENDMENT'>;
    issuedBy: string;
  },
): Promise<{ documentId: string; documentNo: string } | null> {
  const documentType = decideCorrectionDocumentType(params.netDelta);
  if (!documentType) {
    return null;
  }

  const original = await tx.org_tax_documents_mst.findFirst({
    where: {
      tenant_org_id: params.tenantId,
      order_id: params.orderId,
      status: TAX_DOCUMENT_STATUSES.ISSUED,
      document_type: { in: [TAX_DOCUMENT_TYPES.INVOICE, TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE] },
      is_active: true,
    },
    orderBy: { issued_at: 'desc' },
    select: {
      id: true,
      total_amount: true,
      tax_amount: true,
      currency_code: true,
      currency_ex_rate: true,
      base_currency_code: true,
    },
  });
  if (!original) {
    return null;
  }

  const absDelta = Math.abs(params.netDelta);
  const originalTotal = toNumber(original.total_amount);
  const originalTax = toNumber(original.tax_amount);
  const taxRatio = originalTotal > 0 ? originalTax / originalTotal : 0;
  const correctionTaxAmount = Math.round(absDelta * taxRatio * 100) / 100;

  const input: TaxDocumentCreateInput = {
    orderId: params.orderId,
    tenantId: params.tenantId,
    documentType,
    triggerEvent: params.triggerEvent,
    totalAmount: absDelta,
    taxAmount: correctionTaxAmount,
    currencyCode: original.currency_code ?? '',
    currencyExRate: toNumber(original.currency_ex_rate) || 1,
    baseCurrencyCode: original.base_currency_code ?? null,
  };

  const documentId = await createTaxDocumentTx(tx, input);
  await tx.org_tax_documents_mst.update({
    where: { id: documentId },
    data: { supersedes_id: original.id },
  });
  const { documentNo } = await issueTaxDocumentTx(tx, documentId, params.tenantId, params.issuedBy);
  return { documentId, documentNo };
}
