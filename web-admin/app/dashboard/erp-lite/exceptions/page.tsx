import { getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteExceptionsService } from '@/lib/services/erp-lite-exceptions.service'
import { ErpLiteExceptionsScreen } from '@features/erp-lite/ui/erp-lite-exceptions-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteExceptionsPage() {
  const tCommon = await getTranslations('erpLite.common')

  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)
  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows = []

  try {
    rows = await ErpLiteExceptionsService.listOpenExceptions()
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
        <ErpLiteExceptionsScreen rows={rows} />
      )}
    </ErpLitePageGuard>
  )
}
