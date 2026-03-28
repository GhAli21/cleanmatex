import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteReportsPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="reports"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED}
      permissions={['erp_lite_reports:view']}
    />
  )
}
