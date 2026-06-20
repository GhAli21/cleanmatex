import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { isEInvoiceActive } from '@/lib/payments/e-invoice';
import type { EInvoiceActivation } from '@/lib/types/e-invoice';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaClient = typeof prisma | PrismaTransactionClient;

/**
 * Resolve e-invoice activation for an order (F-05 / ADR-052).
 *
 * Reads the tenant enablement flags from `org_tenants_mst` and applies the pure
 * activation rule. Mirrors the `resolveTaxPricingMode` reader pattern so it is
 * safe inside a Prisma transaction (pass the tx client) or outside one (pass the
 * global prisma client). Disabled tenants and pre-start-date orders return
 * `active: false` → existing flat-VAT flow, no behavior change.
 *
 * @param client Prisma client or transaction client.
 * @param tenantId The tenant whose enablement to read.
 * @param orderDate The order's date (Date or ISO/date string).
 */
export async function resolveEInvoiceActivation(
  client: PrismaClient,
  tenantId: string,
  orderDate: Date | string,
): Promise<EInvoiceActivation> {
  const tenant = await (client as typeof prisma).org_tenants_mst.findFirst({
    where: { id: tenantId },
    select: {
      is_e_invoice_enabled: true,
      e_invoice_enabled_start_date: true,
    },
  });

  const isEnabled = tenant?.is_e_invoice_enabled ?? false;
  const startDate = tenant?.e_invoice_enabled_start_date ?? null;

  const active = isEInvoiceActive({ isEnabled, startDate }, orderDate);

  return { isEnabled, startDate, active };
}
