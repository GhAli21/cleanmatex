import { getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLitePostAuditService } from '@/lib/services/erp-lite-post-audit.service'
import { ErpLitePostAuditScreen } from '@features/erp-lite/ui/erp-lite-post-audit-screen'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

interface PostingAuditPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; status?: string }>
}

export default async function ErpLitePostingAuditPage({ searchParams }: PostingAuditPageProps) {
  const tCommon = await getTranslations('erpLite.common')
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = Math.min(Math.max(10, parseInt(params.pageSize ?? '50', 10)), 200)
  const statusCode = params.status ?? undefined

  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)
  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite_post_audit:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let result = { rows: [], total: 0, page, pageSize }

  try {
    result = await ErpLitePostAuditService.listPostLogs({ page, pageSize, statusCode })
  } catch (err) {
    loadError = err instanceof Error ? err.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_ENABLED} permissions={['erp_lite_post_audit:view']}>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <ErpLitePostAuditScreen
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
        />
      )}
    </ErpLitePageGuard>
  )
}
