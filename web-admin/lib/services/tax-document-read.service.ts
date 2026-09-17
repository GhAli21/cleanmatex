/**
 * B14 follow-up — Tax document print/view read model.
 */
import 'server-only';

import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { resolveTaxRegistrationNo } from '@/lib/services/tax-document-issuance.service';
import { generateTaxDocumentVerificationQRCode } from '@/lib/utils/qr-code-generator';

export class TaxDocumentReadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TaxDocumentReadError';
    this.code = code;
  }
}

export interface TaxDocumentPrintLine {
  id: string;
  taxType: string;
  label: string;
  label2: string | null;
  rate: number | null;
  baseAmount: number;
  taxAmount: number;
}

export interface TaxDocumentPrintDetail {
  id: string;
  documentType: string;
  triggerEvent: string;
  status: string;
  fiscalYear: number;
  sequenceNumber: number;
  documentNo: string | null;
  totalAmount: number;
  taxAmount: number;
  currencyCode: string | null;
  supersedesId: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  createdAt: string;
  lines: TaxDocumentPrintLine[];
  order: {
    id: string;
    orderNo: string | null;
    createdAt: string;
  };
  customer: {
    name: string | null;
    name2: string | null;
    phone: string | null;
  } | null;
  seller: {
    name: string;
    name2: string | null;
    address: string | null;
    logoUrl: string | null;
    taxRegistrationNo: string | null;
  };
  qrCodeDataUrl: string;
}

function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Reads one tax document plus its lines and the seller/customer/order
 * context needed to render a printable, bilingual fiscal document.
 * @param tenantId
 * @param orderId
 * @param documentId
 */
export async function getTaxDocumentPrintDetail(
  tenantId: string,
  orderId: string,
  documentId: string,
): Promise<TaxDocumentPrintDetail> {
  return withTenantContext(tenantId, async () => {
    const doc = await prisma.org_tax_documents_mst.findFirst({
      where: { id: documentId, order_id: orderId, tenant_org_id: tenantId },
    });
    if (!doc) {
      throw new TaxDocumentReadError('TAX_DOCUMENT_NOT_FOUND', 'Tax document not found');
    }

    const [lines, order] = await Promise.all([
      prisma.org_tax_doc_lines_dtl.findMany({
        where: { tenant_org_id: tenantId, tax_document_id: documentId },
        orderBy: { created_at: 'asc' },
      }),
      prisma.org_orders_mst.findFirst({
        where: { id: orderId, tenant_org_id: tenantId },
        select: {
          id: true,
          order_no: true,
          created_at: true,
          branch_id: true,
          customer_id: true,
        },
      }),
    ]);
    if (!order) {
      throw new TaxDocumentReadError('ORDER_NOT_FOUND', 'Order not found');
    }

    const [tenantRow, branchRow, customerRow] = await Promise.all([
      prisma.org_tenants_mst.findFirst({
        where: { id: tenantId },
        select: { name: true, name2: true, address: true, logo_url: true },
      }),
      order.branch_id
        ? prisma.$queryRaw<Array<{ branch_name: string | null; address: string | null }>>`
            SELECT branch_name, address
            FROM public.org_branches_mst
            WHERE id = ${order.branch_id}::uuid AND tenant_org_id = ${tenantId}::uuid
            LIMIT 1
          `
        : Promise.resolve([]),
      order.customer_id
        ? prisma.org_customers_mst.findFirst({
            where: { id: order.customer_id, tenant_org_id: tenantId },
            select: { name: true, name2: true, phone: true },
          })
        : Promise.resolve(null),
    ]);

    const sellerTaxRegistrationNo = await resolveTaxRegistrationNo(prisma, tenantId, order.branch_id);
    const branch = branchRow[0] ?? null;
    const sellerName = tenantRow?.name ?? '';

    const qrCodeDataUrl = await generateTaxDocumentVerificationQRCode({
      sellerName,
      sellerTaxRegistrationNo,
      documentNo: doc.document_no ?? null,
      issuedAt: toIso(doc.issued_at),
      totalAmount: toNumber(doc.total_amount),
      taxAmount: toNumber(doc.tax_amount),
      currencyCode: doc.currency_code ?? null,
    });

    return {
      id: doc.id,
      documentType: doc.document_type,
      triggerEvent: doc.trigger_event,
      status: doc.status,
      fiscalYear: doc.fiscal_year,
      sequenceNumber: doc.sequence_number,
      documentNo: doc.document_no ?? null,
      totalAmount: toNumber(doc.total_amount),
      taxAmount: toNumber(doc.tax_amount),
      currencyCode: doc.currency_code ?? null,
      supersedesId: doc.supersedes_id ?? null,
      issuedAt: toIso(doc.issued_at),
      issuedBy: doc.issued_by ?? null,
      createdAt: toIso(doc.created_at) ?? new Date(0).toISOString(),
      lines: lines.map((line) => ({
        id: line.id,
        taxType: line.tax_type,
        label: line.label,
        label2: line.label2 ?? null,
        rate: line.rate == null ? null : toNumber(line.rate),
        baseAmount: toNumber(line.base_amount),
        taxAmount: toNumber(line.tax_amount),
      })),
      order: {
        id: order.id,
        orderNo: order.order_no ?? null,
        createdAt: toIso(order.created_at) ?? new Date(0).toISOString(),
      },
      customer: customerRow
        ? { name: customerRow.name ?? null, name2: customerRow.name2 ?? null, phone: customerRow.phone ?? null }
        : null,
      seller: {
        name: sellerName,
        name2: tenantRow?.name2 ?? null,
        address: branch?.address ?? tenantRow?.address ?? null,
        logoUrl: tenantRow?.logo_url ?? null,
        taxRegistrationNo: sellerTaxRegistrationNo,
      },
      qrCodeDataUrl,
    };
  });
}
