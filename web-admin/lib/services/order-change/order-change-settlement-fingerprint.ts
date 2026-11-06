/**
 * Settlement fingerprint for Order Edit review (WP18 OC-CON-005).
 *
 * Review signs a digest of the order's settlement facts; Apply reads the same facts again
 * while it holds the order lock and refuses (`REVIEW_CHANGED`) when anything moved in between:
 * a payment (status, amount, change handed back), a credit application, a refund or an
 * overpayment disposition. One read serves both, so they cannot drift.
 */
import { createHash } from 'node:crypto';

/** Any client with `$queryRaw` (Prisma client or interactive transaction). */
export interface SettlementFingerprintDb {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

/**
 * Digest of the settlement keys, order-independent.
 * @param keys one text key per active settlement fact
 * @returns a sha256 hex digest
 */
export function digestSettlementKeys(keys: readonly string[]): string {
  const raw = [...keys].sort().join('|');
  return createHash('sha256').update(`cleanmatex.order-change.settlement-fingerprint.v2.${raw}`).digest('hex');
}

/**
 * Reads the order's active settlement facts and returns their digest.
 * Every source table is filtered on `tenant_org_id` and `order_id`.
 * @param db Prisma client or the caller's transaction (inside Apply: after the order lock)
 * @param tenantId organization of the order
 * @param orderId the order
 * @returns the settlement fingerprint bound into the review proof
 */
export async function readSettlementFingerprint(db: SettlementFingerprintDb, tenantId: string, orderId: string): Promise<string> {
  const rows = await db.$queryRaw<Array<{ k: string }>>`
    SELECT 'P:' || p.id::text || ':' || COALESCE(p.payment_status, '') || ':' || p.amount::text
             || ':' || COALESCE(p.change_returned_amount::text, '') AS k
      FROM public.org_order_payments_dtl p
     WHERE p.tenant_org_id = ${tenantId}::uuid AND p.order_id = ${orderId}::uuid AND p.rec_status = 1
    UNION ALL
    SELECT 'C:' || c.id::text || ':' || COALESCE(c.application_status, '') || ':' || c.applied_amount::text
      FROM public.org_order_credit_apps_dtl c
     WHERE c.tenant_org_id = ${tenantId}::uuid AND c.order_id = ${orderId}::uuid AND c.rec_status = 1
    UNION ALL
    SELECT 'R:' || r.id::text || ':' || COALESCE(r.refund_status, '') || ':' || r.refund_amount::text
             || ':' || COALESCE(r.reopens_due_amount::text, '')
      FROM public.org_order_refunds_dtl r
     WHERE r.tenant_org_id = ${tenantId}::uuid AND r.order_id = ${orderId}::uuid AND r.rec_status = 1
    UNION ALL
    SELECT 'D:' || d.id::text || ':' || d.amount::text
      FROM public.org_fin_overpay_disp_dtl d
     WHERE d.tenant_org_id = ${tenantId}::uuid AND d.order_id = ${orderId}::uuid AND d.is_active = true`;
  return digestSettlementKeys(rows.map((row) => row.k));
}
