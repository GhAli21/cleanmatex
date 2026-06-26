import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  isEInvoiceActive,
  buildTaxDecomposition,
  reconcileTaxDecomposition,
} from '@/lib/payments/e-invoice';
import { EMPTY_TAX_DECOMPOSITION } from '@/lib/types/e-invoice';
import type {
  EInvoiceActivation,
  TaxCategoryDecomposition,
  FiscalTotalCheck,
} from '@/lib/types/e-invoice';

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

/** Resolved tax decomposition for one order (ADR-052 follow-up). */
export interface OrderTaxDecomposition {
  /** True only when e-invoicing is active for this order's date. */
  active: boolean;
  /** Real per-category buckets (zeroed when not active). */
  decomposition: TaxCategoryDecomposition;
  /** Σbuckets vs the order's total taxable+non-taxable base. */
  reconciliation: FiscalTotalCheck;
}

/**
 * Resolve the REAL per-category tax decomposition for an order (F-05 completion).
 *
 * Reads the per-category base columns the financial recalc already maintains on
 * `org_orders_mst` (`taxable_amount` → STANDARD, `exempt_amount` → EXEMPT,
 * `zero_rated_amount` → ZERO_RATED, `out_of_scope_amount` → OUT_OF_SCOPE) and
 * emits a faithful decomposition that reconciles to their sum. The order's
 * `created_at` is used as the order date for the activation check.
 *
 * When e-invoicing is NOT active for the order (disabled tenant / pre-start-date),
 * returns `active: false` with a zeroed decomposition — the existing flat-VAT flow
 * is unchanged.
 *
 * @param client Prisma client or transaction client.
 * @param tenantId The tenant.
 * @param orderId The order.
 */
export async function resolveOrderTaxDecomposition(
  client: PrismaClient,
  tenantId: string,
  orderId: string,
): Promise<OrderTaxDecomposition> {
  const order = await (client as typeof prisma).org_orders_mst.findFirst({
    where: { id: orderId, tenant_org_id: tenantId },
    select: {
      created_at: true,
      taxable_amount: true,
      exempt_amount: true,
      zero_rated_amount: true,
      out_of_scope_amount: true,
    },
  });

  if (!order) {
    return { active: false, decomposition: EMPTY_TAX_DECOMPOSITION, reconciliation: { ok: true, difference: 0, epsilon: 0 } };
  }

  const orderDate = order.created_at ?? new Date();
  const activation = await resolveEInvoiceActivation(client, tenantId, orderDate);
  if (!activation.active) {
    return { active: false, decomposition: EMPTY_TAX_DECOMPOSITION, reconciliation: { ok: true, difference: 0, epsilon: 0 } };
  }

  const standard = Number(order.taxable_amount ?? 0);
  const exempt = Number(order.exempt_amount ?? 0);
  const zeroRated = Number(order.zero_rated_amount ?? 0);
  const outOfScope = Number(order.out_of_scope_amount ?? 0);

  const decomposition = buildTaxDecomposition({ standard, exempt, zeroRated, outOfScope });
  const reconciliation = reconcileTaxDecomposition(
    decomposition,
    standard + exempt + zeroRated + outOfScope,
  );

  return { active: true, decomposition, reconciliation };
}
