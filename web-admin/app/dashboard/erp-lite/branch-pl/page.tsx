import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteBranchPlPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="branchPl"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED}
      permissions={['erp_lite_branch_pl:view']}
    />
  )
}
