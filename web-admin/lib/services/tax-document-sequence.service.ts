import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { TAX_DOCUMENT_TYPES } from '@/lib/constants/order-financial';
import type { TaxDocumentType } from '@/lib/types/order-financial';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Allocates the next fiscal sequence number for a given
 * (tenantId, documentType, fiscalYear) combination.
 *
 * Uses a SELECT ... FOR UPDATE lock on the counter row inside the caller's
 * transaction to guarantee monotonic gap-free numbering under concurrency.
 * The caller MUST pass an active transaction client — calling this outside
 * a transaction is a programming error and will throw.
 *
 * Sequence numbers start at 1. 0 is reserved for legacy backfill rows.
 * @param tx
 * @param tenantId
 * @param documentType
 * @param fiscalYear
 */
export async function allocateTaxDocumentSequence(
  tx: PrismaTransactionClient,
  tenantId: string,
  documentType: TaxDocumentType,
  fiscalYear: number,
): Promise<number> {
  // Acquire or create the counter row with a FOR UPDATE lock.
  // $executeRaw for the upsert + lock pattern — Prisma ORM doesn't expose
  // SELECT ... FOR UPDATE directly.
  await tx.$executeRaw`
    INSERT INTO public.org_tax_doc_seq_counters
      (tenant_org_id, document_type, fiscal_year, last_sequence, created_at, created_by)
    VALUES
      (${tenantId}::uuid, ${documentType}, ${fiscalYear}, 0, NOW(), 'system')
    ON CONFLICT (tenant_org_id, document_type, fiscal_year) DO NOTHING
  `;

  const rows = await tx.$queryRaw<{ last_sequence: number }[]>`
    SELECT last_sequence
    FROM public.org_tax_doc_seq_counters
    WHERE tenant_org_id = ${tenantId}::uuid
      AND document_type = ${documentType}
      AND fiscal_year   = ${fiscalYear}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new Error(
      `tax_document_sequence: counter row missing for tenant=${tenantId} type=${documentType} year=${fiscalYear}`,
    );
  }

  const nextSequence = rows[0].last_sequence + 1;

  await tx.$executeRaw`
    UPDATE public.org_tax_doc_seq_counters
    SET
      last_sequence = ${nextSequence},
      updated_at    = NOW(),
      updated_by    = 'system'
    WHERE tenant_org_id = ${tenantId}::uuid
      AND document_type = ${documentType}
      AND fiscal_year   = ${fiscalYear}
  `;

  return nextSequence;
}

/**
 * Formats a human-readable document number from type, fiscal year, and sequence.
 *
 * Examples:
 *   INV-2026-000001
 *   SIM-2026-000042
 *   CN-2026-000003
 *   DN-2026-000001
 * @param documentType
 * @param fiscalYear
 * @param sequenceNumber
 */
export function formatTaxDocumentNo(
  documentType: TaxDocumentType,
  fiscalYear: number,
  sequenceNumber: number,
): string {
  const prefix: Record<TaxDocumentType, string> = {
    [TAX_DOCUMENT_TYPES.INVOICE]:            'INV',
    [TAX_DOCUMENT_TYPES.SIMPLIFIED_INVOICE]: 'SIM',
    [TAX_DOCUMENT_TYPES.CREDIT_NOTE]:        'CN',
    [TAX_DOCUMENT_TYPES.DEBIT_NOTE]:         'DN',
  };
  const seq = String(sequenceNumber).padStart(6, '0');
  return `${prefix[documentType]}-${fiscalYear}-${seq}`;
}
