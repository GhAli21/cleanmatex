import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteApPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="ap"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_AP_ENABLED}
      permissions={['erp_lite_ap:view']}
    />
  )
}
