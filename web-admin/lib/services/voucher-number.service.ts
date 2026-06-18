/**
 * BVM Voucher Number Service
 * Generates sequential, tenant-scoped voucher numbers with per-type prefixes.
 * Uses pg_advisory_xact_lock to serialize within a transaction and prevent gaps.
 * Format: {PREFIX}-{YYYY}-{000001}
 */

import { prisma } from '@/lib/db/prisma';
import { VOUCHER_TYPE } from '../constants/voucher';
import type { VoucherType } from '../types/voucher';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const PREFIX_MAP: Record<VoucherType, string> = {
  [VOUCHER_TYPE.RECEIPT]:    'RV',
  [VOUCHER_TYPE.PAYMENT]:    'PV',
  [VOUCHER_TYPE.REFUND]:     'RF',
  [VOUCHER_TYPE.ADJUSTMENT]: 'ADJ',
  [VOUCHER_TYPE.TRANSFER]:   'TR',
};

const SEQ_LEN = 6;

/**
 * Generate the next BVM voucher number for a tenant + voucher type.
 * Must be called inside a Prisma $transaction.
 * Uses pg_advisory_xact_lock to prevent concurrent number generation for the same tenant.
 * @param tenantOrgId
 * @param voucherType
 * @param tx
 */
export async function generateBizVoucherNo(
  tenantOrgId: string,
  voucherType: VoucherType,
  tx: PrismaTx
): Promise<string> {
  const prefix = PREFIX_MAP[voucherType] ?? 'VCH';
  const year = new Date().getFullYear();

  // Serialize per-tenant to prevent duplicate numbers
  // Cast to TEXT: pg_advisory_xact_lock returns void, which Prisma cannot deserialize
  await tx.$queryRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext($1::text))::TEXT`,
    `bvm_voucher_no_${tenantOrgId}`
  );

  const result = await tx.$queryRaw<{ max_no: string | null }[]>`
    SELECT voucher_no AS max_no
    FROM org_fin_vouchers_mst
    WHERE tenant_org_id = ${tenantOrgId}::uuid
      AND voucher_no LIKE ${`${prefix}-${year}-%`}
      AND voucher_status IS NOT NULL
    ORDER BY voucher_no DESC
    LIMIT 1
  `;

  let seq = 1;
  if (result[0]?.max_no) {
    const parts = result[0].max_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1] ?? '0', 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  const seqStr = String(seq).padStart(SEQ_LEN, '0');
  return `${prefix}-${year}-${seqStr}`;
}
