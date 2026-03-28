import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteExpensesPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="expenses"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED}
      permissions={['erp_lite_expenses:view']}
    />
  )
}
