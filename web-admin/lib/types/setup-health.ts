/**
 * Setup Health DTOs shared by the API routes and the web-admin feature.
 */
import type { SetupHealthSeverity, SetupHealthStatus } from '@/lib/constants/setup-health'

export type { SetupHealthSeverity, SetupHealthStatus } from '@/lib/constants/setup-health'
export { SETUP_HEALTH_SEVERITY, SETUP_HEALTH_STATUS } from '@/lib/constants/setup-health'

/** One check result as shown to a tenant user. */
export interface SetupHealthItem {
  checkCode: string
  domainCode: string
  severity: SetupHealthSeverity
  status: SetupHealthStatus
  issueCount: number
  sampleIds: string[]
  details: Record<string, unknown>
  name: string
  name2: string
  description: string
  description2: string
  /** Tenant fix screen, only when one exists AND the user holds its permission; otherwise null = "contact support". */
  fixRoute: string | null
  showsBanner: boolean
  domainOrder: number
  displayOrder: number
}

/** A check group label (sys_setup_health_domain_cd). */
export interface SetupHealthDomain {
  domainCode: string
  name: string
  name2: string
  displayOrder: number
}

/** GET /api/v1/setup-health response data. */
export interface SetupHealthList {
  items: SetupHealthItem[]
  domains: SetupHealthDomain[]
}

/** Light summary for the layout banner and the home card. */
export interface SetupHealthSummary {
  blockers: number
  warnings: number
  infos: number
  /** Checks that could not run (status ERROR); shown so a broken check is never read as "all good". */
  errors: number
  /** Failing banner checks (BLOCKER + shows_banner). */
  bannerItems: SetupHealthItem[]
  /** The user may open the Setup Health screen (setup_health:view). */
  canView: boolean
}
