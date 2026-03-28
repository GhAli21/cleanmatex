import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLitePoPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="po"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_PO_ENABLED}
      permissions={['erp_lite_po:view']}
    />
  )
}
