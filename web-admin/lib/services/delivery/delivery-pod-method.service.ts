import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { compiledDeliveryPodMethodCodes } from '@/lib/services/delivery/compiled-delivery-evidence';
import { loadSemanticWorkflowArtifactForOrder } from '@/lib/services/workflow/semantic-workflow-artifact.service';

/** A configured proof method that can be selected by a staff delivery client. */
export interface DeliveryPodMethod {
  code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  requiresVerification: boolean;
}

const SYNTHETIC_METHODS: Record<string, Pick<DeliveryPodMethod, 'name' | 'name2'>> = {
  POD: { name: 'POD confirmation', name2: 'تأكيد دليل التسليم' },
  NOTES: { name: 'Delivery notes', name2: 'ملاحظات التسليم' },
};

/**
 * Lists active, staff-supported proof methods.
 *
 * OTP is intentionally excluded until its expiry, resend, retry, and audit
 * controls are released as a complete capability. When a stop is supplied,
 * live profile evidence narrows the catalog instead of widening it.
 */
export async function listDeliveryPodMethods(input?: {
  tenantId?: string;
  stopId?: string;
}): Promise<DeliveryPodMethod[]> {
  const methods = await prisma.sys_dlv_pod_method_cd.findMany({
    where: {
      is_active: true,
      rec_status: 1,
      code: { not: 'OTP' },
    },
    orderBy: [{ rec_order: 'asc' }, { code: 'asc' }],
    select: {
      code: true,
      name: true,
      name2: true,
      description: true,
      description2: true,
      requires_verification: true,
    },
  });

  const catalog = methods.map((method) => ({
    code: method.code,
    name: method.name,
    name2: method.name2 ?? null,
    description: method.description ?? null,
    description2: method.description2 ?? null,
    requiresVerification: method.requires_verification ?? true,
  }));

  if (!input?.tenantId || !input.stopId) return catalog;

  const permitted = await loadCompiledMethodCodes(input.tenantId, input.stopId);
  if (!permitted) return catalog;
  const permittedSet = new Set(permitted);
  const filtered = catalog.filter((method) => permittedSet.has(method.code));
  for (const code of permitted) {
    if (filtered.some((method) => method.code === code)) continue;
    const synthetic = SYNTHETIC_METHODS[code];
    if (!synthetic) continue;
    filtered.push({
      code,
      name: synthetic.name,
      name2: synthetic.name2,
      description: null,
      description2: null,
      requiresVerification: false,
    });
  }
  return filtered;
}

async function loadCompiledMethodCodes(tenantId: string, stopId: string): Promise<string[] | null> {
  // wf_profile_artifact_id/wf_profile_revision/wf_profile_checksum/
  // wf_profile_schema_version: retired compiled-artifact fields (Gate 5,
  // ADR-SAAS-MNG-0010), historical audit only — see the full note on
  // SemanticWorkflowOrderSnapshot in semantic-workflow-artifact.service.ts.
  const rows = await prisma.$queryRaw<Array<{
    wf_profile_id: string | null;
    wf_version_no: number | null;
    wf_profile_version_id: string | null;
    wf_profile_artifact_id: string | null;
    wf_profile_revision: number | null;
    wf_profile_checksum: string | null;
    wf_profile_schema_version: number | null;
  }>>`
    SELECT
      o.wf_profile_id::text,
      o.wf_version_no,
      o.wf_profile_version_id::text,
      o.wf_profile_artifact_id::text,
      o.wf_profile_revision,
      o.wf_profile_checksum,
      o.wf_profile_schema_version
    FROM public.org_dlv_stops_dtl s
    INNER JOIN public.org_orders_mst o
      ON o.id = s.order_id
     AND o.tenant_org_id = s.tenant_org_id
    WHERE s.id = ${stopId}::uuid
      AND s.tenant_org_id = ${tenantId}::uuid
      AND s.is_active = true
    LIMIT 1
  `;
  const snapshot = rows[0];
  if (!snapshot) return [];
  const artifact = await loadSemanticWorkflowArtifactForOrder(snapshot);
  if (!artifact) return null;
  const codes = compiledDeliveryPodMethodCodes(artifact.evidence ?? []);
  return codes.length > 0 ? codes : null;
}
