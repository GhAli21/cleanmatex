import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import {
  ErpLiteReportingService,
  type ErpLiteArAgingRow,
} from '@/lib/services/erp-lite-reporting.service'
import { formatErpLiteMoney, formatErpLiteNumber } from '@features/erp-lite/lib/display-format'
import { getErpLiteDisplayConfig } from '@features/erp-lite/server/get-erp-lite-display-config'
import { ErpLiteArAgingGrid } from '@features/erp-lite/ui/erp-lite-ar-aging-grid'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { CmxKpiStatCard } from '@ui/data-display'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteArPage() {
  const t = await getTranslations('erpLite.reports.arAging')
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const displayConfig = await getErpLiteDisplayConfig()
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED} permissions={['erp_lite_ar:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let rows: ErpLiteArAgingRow[] = []

  try {
    rows = await ErpLiteReportingService.getArAging(locale)
  } catch (error) {
    loadError = error instanceof Error ? error.message : tCommon('loadError')
  }
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding_amount, 0)
  const customerCount = new Set(rows.map((row) => row.customer_id)).size

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED}
      permissions={['erp_lite_ar:view']}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <CmxKpiStatCard
            title={t('summary.totalOutstanding')}
            value={formatErpLiteMoney(totalOutstanding, displayConfig)}
            subtitle={`${tCommon('currency')}: ${displayConfig.currencyCode}`}
          />
          <CmxKpiStatCard
            title={t('summary.customerCount')}
            value={formatErpLiteNumber(customerCount, locale)}
          />
        </div>

        <ErpLiteArAgingGrid rows={rows} displayConfig={displayConfig} />
      </div>
    </ErpLitePageGuard>
  )
}
