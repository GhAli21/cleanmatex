import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteUsageMapService } from '@/lib/services/erp-lite-usage-map.service'
import { ErpLiteUsageMapsScreen } from '@features/erp-lite/ui/erp-lite-usage-maps-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteUsageMapsPage() {
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'

  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)
  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite_usage_map:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows = []

  try {
    rows = await ErpLiteUsageMapService.listUsageMaps(locale)
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite_usage_map:view']}>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLiteUsageMapsScreen rows={rows} />
      )}
    </ErpLitePageGuard>
  )
}
