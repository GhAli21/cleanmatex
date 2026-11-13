/**
 * Setup Health service (tenant app).
 *
 * Runs the database check runner fn_setup_health_run (migration 0709) and turns
 * its rows into what the signed-in user may see: checks behind a feature flag
 * that is off and HQ-only checks are dropped, and a fix link is kept only when
 * the user holds the check's fix permission. The checks themselves live in the
 * database so HQ shows the same results (docs/features/Setup_Health/PLAN.md §3.1).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'
import { hasPermissionServer } from '@/lib/services/permission-service-server'
import { SETUP_HEALTH_PERMISSIONS } from '@/lib/constants/permissions/setup-health-perm'
import { SETUP_HEALTH_SEVERITY, SETUP_HEALTH_STATUS } from '@/lib/constants/setup-health'
import type { SetupHealthDomain, SetupHealthItem, SetupHealthSeverity, SetupHealthStatus, SetupHealthSummary } from '@/lib/types/setup-health'
import { logger } from '@/lib/utils/logger'

/** Row shape returned by fn_setup_health_run. */
interface SetupHealthRunRow {
  check_code: string
  domain_code: string
  severity: string
  status: string
  issue_count: number
  sample_ids: unknown
  details: unknown
  name: string
  name2: string
  ok_name: string
  ok_name2: string
  description: string
  description2: string
  fix_route: string | null
  hq_fix_route: string | null
  fix_permission: string | null
  feature_flag_keys: string[]
  shows_banner: boolean
  is_hq_only: boolean
  domain_order: number
  display_order: number
}

/** Filters accepted by {@link listSetupHealth}. */
export interface SetupHealthFilter {
  /** Limit to one domain (e.g. CALENDAR); undefined = all. */
  domain?: string
  /** Judge one branch; undefined = the whole organization. */
  branchId?: string
}

/** Options for {@link listSetupHealth}. */
export interface SetupHealthListOptions {
  /**
   * Resolve fix links (one permission lookup per distinct fix permission). Default true.
   * Only failing checks ever show a Fix button, so passing checks never cost a lookup;
   * callers that do not show Fix buttons (the banner / home card summary) pass false.
   */
  withFixLinks?: boolean
}

/**
 * Runs every check for the tenant and returns the ones this user may see.
 * @param tenantOrgId - Tenant resolved server-side from the authenticated session
 * @param filter - Optional domain / branch
 * @param options - Optional: skip fix-link resolution
 * @returns Visible checks in screen order
 * @example
 * const items = await listSetupHealth(auth.tenantId, { domain: 'CALENDAR' })
 */
export async function listSetupHealth(
  tenantOrgId: string,
  filter: SetupHealthFilter = {},
  options: SetupHealthListOptions = {}
): Promise<SetupHealthItem[]> {
  const withFixLinks = options.withFixLinks ?? true
  const [rows, flags] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      // The tenant id is the function's tenant filter: every org_* read inside filters tenant_org_id = p_tenant.
      prisma.$queryRaw<SetupHealthRunRow[]>(Prisma.sql`
        SELECT * FROM public.fn_setup_health_run(
          ${tenantOrgId}::uuid,
          ${filter.branchId ?? null}::uuid,
          ${filter.domain ?? null}::text)
      `)
    ),
    getFeatureFlags(tenantOrgId),
  ])

  const flagValues = flags as unknown as Record<string, unknown>
  const visible = rows.filter(
    // A check is shown only when EVERY flag it names is on (same rule as SQL fn_setup_health_flags_on).
    (r) => !r.is_hq_only && (r.feature_flag_keys ?? []).every((k) => Boolean(flagValues[k]))
  )

  for (const r of visible) {
    if (r.status === SETUP_HEALTH_STATUS.ERROR) {
      logger.error('Setup health check failed to run', undefined, {
        feature: 'setup_health',
        action: 'run_check',
        tenantId: tenantOrgId,
        checkCode: r.check_code,
        details: JSON.stringify(r.details),
      })
    }
  }

  // One permission lookup per distinct fix permission, and only for rows that can show a Fix button.
  const needsLink = (r: SetupHealthRunRow) => withFixLinks && r.status === SETUP_HEALTH_STATUS.FAIL && !!r.fix_route
  const fixPerms = [...new Set(visible.filter(needsLink).map((r) => r.fix_permission).filter((p): p is string => !!p))]
  const allowed = new Map(
    await Promise.all(fixPerms.map(async (p) => [p, await hasPermissionServer(p)] as const))
  )

  return visible.map((r) => toItem(r, needsLink(r) && (!r.fix_permission || allowed.get(r.fix_permission)) ? r.fix_route : null))
}

/**
 * Counts failing visible checks and lists the banner blockers.
 * @param tenantOrgId - Tenant resolved server-side from the authenticated session
 * @returns Summary for the layout banner and home card
 * @example
 * const summary = await getSetupHealthSummary(auth.tenantId)
 */
export async function getSetupHealthSummary(tenantOrgId: string): Promise<SetupHealthSummary> {
  const [items, canView] = await Promise.all([
    // The summary shows counts and banner titles only: no Fix buttons, so no fix-permission lookups.
    listSetupHealth(tenantOrgId, {}, { withFixLinks: false }),
    hasPermissionServer(SETUP_HEALTH_PERMISSIONS.VIEW),
  ])
  const failing = items.filter((i) => i.status === SETUP_HEALTH_STATUS.FAIL)
  const count = (s: SetupHealthSeverity) => failing.filter((i) => i.severity === s).length

  return {
    blockers: count(SETUP_HEALTH_SEVERITY.BLOCKER),
    warnings: count(SETUP_HEALTH_SEVERITY.WARNING),
    infos: count(SETUP_HEALTH_SEVERITY.INFO),
    errors: items.filter((i) => i.status === SETUP_HEALTH_STATUS.ERROR).length,
    bannerItems: failing.filter((i) => i.showsBanner && i.severity === SETUP_HEALTH_SEVERITY.BLOCKER),
    canView,
  }
}

/**
 * Active domain labels for grouping the screen (platform data, no tenant column).
 * @returns Domains in display order
 * @example
 * const domains = await listSetupHealthDomains()
 */
export async function listSetupHealthDomains(): Promise<SetupHealthDomain[]> {
  const rows = await prisma.sys_setup_health_domain_cd.findMany({
    where: { is_active: true, rec_status: 1 },
    select: { domain_code: true, name: true, name2: true, display_order: true },
    orderBy: { display_order: 'asc' },
  })
  return rows.map((d) => ({ domainCode: d.domain_code, name: d.name, name2: d.name2, displayOrder: d.display_order }))
}

function toItem(r: SetupHealthRunRow, fixRoute: string | null): SetupHealthItem {
  return {
    checkCode: r.check_code,
    domainCode: r.domain_code,
    severity: r.severity as SetupHealthSeverity,
    status: r.status as SetupHealthStatus,
    issueCount: Number(r.issue_count) || 0,
    sampleIds: Array.isArray(r.sample_ids) ? r.sample_ids.map(String) : [],
    details: r.details && typeof r.details === 'object' ? (r.details as Record<string, unknown>) : {},
    name: r.name,
    name2: r.name2,
    okName: r.ok_name,
    okName2: r.ok_name2,
    description: r.description,
    description2: r.description2,
    fixRoute,
    showsBanner: r.shows_banner,
    domainOrder: Number(r.domain_order) || 0,
    displayOrder: Number(r.display_order) || 0,
  }
}
