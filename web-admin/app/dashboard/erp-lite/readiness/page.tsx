import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteReadinessService } from '@/lib/services/erp-lite-readiness.service'
import { getErpLiteDisplayConfig } from '@features/erp-lite/server/get-erp-lite-display-config'
import { ErpLiteReadinessScreen } from '@features/erp-lite/ui/erp-lite-readiness-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteReadinessPage() {
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const displayConfig = await getErpLiteDisplayConfig()

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
  let missingUsage = []

  try {
    ;[readiness, missingUsage] = await Promise.all([
      ErpLiteReadinessService.getReadiness(),
      ErpLiteReadinessService.getMissingUsage(locale),
    ])
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLiteReadinessScreen
          readiness={readiness}
          missingUsage={missingUsage}
          displayConfig={displayConfig}
        />
      )}
    </ErpLitePageGuard>
  )
}
