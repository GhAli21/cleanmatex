import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteArPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="ar"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED}
      permissions={['erp_lite_ar:view']}
    />
  )
}
