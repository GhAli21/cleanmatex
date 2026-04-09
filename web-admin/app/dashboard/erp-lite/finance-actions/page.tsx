import { getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteFinanceAuditService } from '@/lib/services/erp-lite-finance-audit.service'
import { ErpLiteFinanceActionsAuditScreen } from '@features/erp-lite/ui/erp-lite-finance-actions-audit-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteFinanceActionsPage() {
  const tCommon = await getTranslations('erpLite.common')
  const isEnabled =
    (await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)) &&
    (await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED))

  if (!isEnabled) {
    return (
      <ErpLitePageGuard
        feature={[FEATURE_FLAG_KEYS.ERP_LITE_ENABLED, FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED]}
        permissions={['erp_lite_periods:view']}
      >
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows = []

  try {
    rows = await ErpLiteFinanceAuditService.listPostActions(250)
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard
      feature={[FEATURE_FLAG_KEYS.ERP_LITE_ENABLED, FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED]}
      permissions={['erp_lite_periods:view']}
    >
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLiteFinanceActionsAuditScreen rows={rows} />
      )}
    </ErpLitePageGuard>
  )
}
