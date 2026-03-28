import { ErpLiteShellScreen } from '@features/erp-lite/ui/erp-lite-shell-screen'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteGlPage() {
  return (
    <ErpLiteShellScreen
      moduleKey="gl"
      feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED}
      permissions={['erp_lite_gl:view']}
    />
  )
}
