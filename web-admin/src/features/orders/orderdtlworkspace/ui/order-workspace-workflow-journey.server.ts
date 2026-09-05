import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

import type { OrderWorkspaceWorkflowJourneyStage } from './order-workspace-types';

/**
 * Minimal status-catalog projection used to preserve the policy's configured order.
 *
 * Keeping this query result separate from the display contract prevents database
 * column naming from leaking into the client workspace.
 */
type WorkflowJourneyRow = {
  status_code: string;
  name: string;
  name2: string | null;
  is_terminal: boolean;
};

/**
 * Loads the ordered workflow journey configured for the order's pinned profile version.
 *
 * The tenant-scoped order predicate and active Pilot/Published version checks mirror the
 * live semantic runtime, preventing an obsolete or another tenant's configuration from
 * becoming a misleading operational rail.
 *
 * @param tenantId - Authenticated tenant that owns the order.
 * @param orderId - Canonical order UUID resolved by the tenant-scoped detail loader.
 * @param locale - Active application locale for status labels.
 * @returns Ordered policy stages, or an empty list when no runnable journey is configured.
 */
export async function getOrderWorkspaceWorkflowJourney(
  tenantId: string,
  orderId: string,
  locale: string,
): Promise<OrderWorkspaceWorkflowJourneyStage[]> {
  // All Prisma queries run in tenant RLS context; the explicit predicate also protects this raw SQL read.
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<WorkflowJourneyRow[]>`
      SELECT
        status_catalog.status_code,
        status_catalog.name,
        status_catalog.name2,
        status_catalog.is_terminal
      FROM public.org_orders_mst AS order_row
      INNER JOIN public.sys_wf_profile_ver_mst AS profile_version
        ON profile_version.version_id = order_row.wf_profile_version_id
       AND profile_version.version_status IN ('PILOT', 'PUBLISHED')
       AND COALESCE(profile_version.is_active, true) = true
       AND COALESCE(profile_version.rec_status, 1) = 1
      INNER JOIN public.sys_wf_prof_ver_policy_cf AS policy
        ON policy.version_id = profile_version.version_id
       AND policy.is_active = true
       AND policy.rec_status = 1
      CROSS JOIN LATERAL unnest(policy.stage_sequence) WITH ORDINALITY
        AS configured_stage(status_code, stage_order)
      INNER JOIN public.sys_wf_statuses_cd AS status_catalog
        ON status_catalog.status_code = configured_stage.status_code
       AND status_catalog.is_active = true
       AND status_catalog.rec_status = 1
      WHERE order_row.id = ${orderId}::uuid
        AND order_row.tenant_org_id = ${tenantId}::uuid
      ORDER BY configured_stage.stage_order ASC
    `;

    return rows.map((row) => ({
      statusCode: row.status_code,
      label: locale.startsWith('ar') && row.name2 ? row.name2 : row.name,
      isTerminal: row.is_terminal,
    }));
  });
}
