import { prisma } from '@/lib/db/prisma';

export type OrderSourceCatalogRow = {
  order_source_code: string;
  requires_remote_intake_confirm: boolean;
  is_active: boolean;
};

/**
 * Tenant allowlist: zero rows in org_tenant_order_sources_cf means all active global sources are allowed.
 * If the tenant has any rows, an order source must have an explicit row with is_allowed=true.
 */
export async function assertTenantAllowsOrderSource(
  tenantId: string,
  orderSourceCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rules = await prisma.org_tenant_order_sources_cf.findMany({
    where: { tenant_org_id: tenantId, is_active: true },
    select: { order_source_code: true, is_allowed: true },
  });

  if (rules.length === 0) {
    return { ok: true };
  }

  const row = rules.find((r) => r.order_source_code === orderSourceCode);
  if (!row) {
    return {
      ok: false,
      error: 'Order source is not enabled for this tenant',
    };
  }
  if (!row.is_allowed) {
    return {
      ok: false,
      error: 'Order source is disabled for this tenant',
    };
  }
  return { ok: true };
}

export async function fetchActiveOrderSource(
  orderSourceCode: string
): Promise<{ ok: true; row: OrderSourceCatalogRow } | { ok: false; error: string }> {
  const row = await prisma.sys_order_sources_cd.findUnique({
    where: { order_source_code: orderSourceCode },
  });
  if (!row || !row.is_active) {
    return { ok: false, error: 'Unknown or inactive order source' };
  }
  return {
    ok: true,
    row: {
      order_source_code: row.order_source_code,
      requires_remote_intake_confirm: row.requires_remote_intake_confirm,
      is_active: row.is_active,
    },
  };
}

export async function validateOrderSourceForCreation(
  tenantId: string,
  orderSourceCode: string
): Promise<
  | { ok: true; row: OrderSourceCatalogRow }
  | { ok: false; error: string }
> {
  const tenantOk = await assertTenantAllowsOrderSource(tenantId, orderSourceCode);
  if (tenantOk.ok === false) {
    return { ok: false, error: tenantOk.error };
  }
  return fetchActiveOrderSource(orderSourceCode);
}
