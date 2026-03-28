import type { ReactNode } from 'react'
import { ErpLitePageGuard } from '@/src/features/erp-lite/ui/erp-lite-page-guard'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'

export default function ErpLiteLayout({ children }: { children: ReactNode }) {
  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED}
      permissions={['erp_lite:view']}
    >
      {children}
    </ErpLitePageGuard>
  )
}
