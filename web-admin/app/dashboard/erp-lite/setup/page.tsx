import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteSetupWizardScreen } from '@features/erp-lite/ui/erp-lite-setup-wizard-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'

export default async function ErpLiteSetupPage() {
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite:view']}>
      <ErpLiteSetupWizardScreen />
    </ErpLitePageGuard>
  )
}
