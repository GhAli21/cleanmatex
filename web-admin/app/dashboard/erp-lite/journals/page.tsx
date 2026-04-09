import { getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteJournalsService } from '@/lib/services/erp-lite-journals.service'
import { ErpLiteJournalsScreen } from '@features/erp-lite/ui/erp-lite-journals-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteJournalsPage() {
  const tCommon = await getTranslations('erpLite.common')
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED} permissions={['erp_lite_gl:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows = []

  try {
    rows = await ErpLiteJournalsService.listRecentJournals(200)
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED} permissions={['erp_lite_gl:view']}>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLiteJournalsScreen rows={rows} />
      )}
    </ErpLitePageGuard>
  )
}
