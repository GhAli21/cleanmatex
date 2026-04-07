import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLitePeriodsService } from '@/lib/services/erp-lite-periods.service'
import { ErpLitePeriodsScreen } from '@features/erp-lite/ui/erp-lite-periods-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLitePeriodsPage() {
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'

  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED)
  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED} permissions={['erp_lite:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows = []

  try {
    rows = await ErpLitePeriodsService.listPeriods(locale)
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_PERIODS_ENABLED} permissions={['erp_lite:view']}>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLitePeriodsScreen rows={rows} />
      )}
    </ErpLitePageGuard>
  )
}
