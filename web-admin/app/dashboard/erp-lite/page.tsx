import { getLocale } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { hasPermissionServer } from '@/lib/services/permission-service-server'
import { ErpLiteReadinessService } from '@/lib/services/erp-lite-readiness.service'
import { ErpLitePeriodsService } from '@/lib/services/erp-lite-periods.service'
import {
  ErpLiteHomeScreen,
  type ErpLiteHomeVisibility,
} from '@features/erp-lite/ui/erp-lite-home-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'

async function buildVisibility(): Promise<ErpLiteHomeVisibility> {
  const [
    fEnabled,
    fReadiness,
    fUsage,
    fExceptions,
    fPeriods,
    fGl,
    fReports,
    fAudit,
  ] = await Promise.all([
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_READINESS_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_USAGE_MAP_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_EXCEPTIONS_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED),
    currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_POST_AUDIT_ENABLED),
  ])

  const [pLite, pUsage, pCoa, pGl, pReports, pAudit, pPeriods] = await Promise.all([
    hasPermissionServer('erp_lite:view'),
    hasPermissionServer('erp_lite_usage_map:view'),
    hasPermissionServer('erp_lite_coa:view'),
    hasPermissionServer('erp_lite_gl:view'),
    hasPermissionServer('erp_lite_reports:view'),
    hasPermissionServer('erp_lite_post_audit:view'),
    hasPermissionServer('erp_lite_periods:view'),
  ])

  const base = fEnabled && pLite

  return {
    readiness: base && fReadiness && pLite,
    usageMaps: base && fUsage && pUsage,
    exceptions: base && fExceptions && pLite,
    periods: base && fPeriods && pPeriods,
    coa: base && pCoa,
    gl: base && fGl && pGl,
    journals: base && fGl && pGl,
    reports: base && fReports && pReports,
    postingAudit: base && fAudit && pAudit,
    financeActions: base && fPeriods && pPeriods,
    setup: base && pLite,
  }
}

export default async function ErpLiteHomePage() {
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let readiness = null
  let openPeriodCode: string | null = null
  let visibility: ErpLiteHomeVisibility

  try {
    visibility = await buildVisibility()
  } catch {
    visibility = {
      readiness: false,
      usageMaps: false,
      exceptions: false,
      periods: false,
      coa: false,
      gl: false,
      journals: false,
      reports: false,
      postingAudit: false,
      financeActions: false,
      setup: false,
    }
  }

  try {
    const [r, periods] = await Promise.all([
      ErpLiteReadinessService.getReadiness(),
      ErpLitePeriodsService.listPeriods(locale),
    ])
    readiness = r
    const open = periods.find((p) => p.status_code === 'OPEN')
    openPeriodCode = open?.period_code ?? null
  } catch {
    loadError = 'Failed to load ERP-Lite home data.'
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
      <ErpLiteHomeScreen
        readiness={readiness}
        openPeriodCode={openPeriodCode}
        visibility={visibility}
        loadError={loadError}
      />
    </ErpLitePageGuard>
  )
}
