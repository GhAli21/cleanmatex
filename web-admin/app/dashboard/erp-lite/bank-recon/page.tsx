import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteBankReconPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="bankRecon"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED}
      permissions={['erp_lite_bank_recon:view']}
    />
  )
}
