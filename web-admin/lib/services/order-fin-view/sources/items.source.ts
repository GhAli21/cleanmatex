import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { DOC_SEQ_TYPES } from '@/lib/constants/doc-seq';

/** One tax code's share of a line's tax (Tax Engine T4). */
export interface OrderItemTaxPart {
  taxCode: string;
  ratePercent: number | null;
  taxAmount: number;
}

/**
 * Each line's tax by code from the order's tax record (`org_tax_lines_tr`).
 * Reversal rows are stored negative, so the sum per line and code is the
 * current tax; a code that nets to 0 after an Edit is left out. Charge and
 * order-discount rows have no line and are not shown here.
 */
async function loadItemTaxParts(tenantId: string, orderId: string): Promise<Map<string, OrderItemTaxPart[]>> {
  const groups = await prisma.org_tax_lines_tr.groupBy({
    by: ['source_doc_line_id', 'tax_code', 'rate'],
    where: {
      tenant_org_id: tenantId, source_doc_type_code: DOC_SEQ_TYPES.ORDER, source_doc_id: orderId,
      source_doc_line_id: { not: null }, is_active: true, rec_status: 1,
    },
    _sum: { tax_amount: true },
    orderBy: [{ source_doc_line_id: 'asc' }, { tax_code: 'asc' }],
  });
  const byLine = new Map<string, OrderItemTaxPart[]>();
  for (const g of groups) {
    const amount = g._sum.tax_amount;
    if (!g.source_doc_line_id || amount == null || amount.isZero()) continue;
    const parts = byLine.get(g.source_doc_line_id) ?? [];
    parts.push({ taxCode: g.tax_code, ratePercent: g.rate == null ? null : g.rate.toNumber(), taxAmount: amount.toNumber() });
    byLine.set(g.source_doc_line_id, parts);
  }
  return byLine;
}

/** Live item lines with their stored line money (Line-Level snapshot) and their tax by code; removed lines have rec_status 0. */
export function loadOrderItems(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, async () => {
    const [items, taxParts] = await Promise.all([
      prisma.org_order_items_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
        orderBy: [{ rec_order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          product_id: true,
          product_name: true,
          product_name2: true,
          service_category_code: true,
          quantity: true,
          price_per_unit: true,
          total_price: true,
          service_pref_charge: true,
          speed_premium_amount: true,
          line_disc_amount: true,
          order_disc_alloc_amount: true,
          net_amount: true,
          tax_rate: true,
          taxable_amount: true,
          tax_amount: true,
          line_total_amount: true,
        },
      }),
      loadItemTaxParts(tenantId, orderId),
    ]);
    return items.map((item) => ({ ...item, taxParts: taxParts.get(item.id) ?? [] }));
  });
}
