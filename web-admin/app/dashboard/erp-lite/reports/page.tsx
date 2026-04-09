import { getLocale, getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service'
import {
  type ErpLiteTrialBalanceRow,
  type ErpLiteStatementRow,
  ErpLiteReportingService,
} from '@/lib/services/erp-lite-reporting.service'
import { createClient } from '@/lib/supabase/server'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { ErpLiteReportsScreen } from '@features/erp-lite/ui/erp-lite-reports-screen'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteReportsPage() {
  const t = await getTranslations('erpLite.reports')
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const isEnabled =
    (await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_ENABLED)) &&
    (await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED))

  if (!isEnabled) {
    return (
      <ErpLitePageGuard
        feature={[FEATURE_FLAG_KEYS.ERP_LITE_ENABLED, FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED]}
        permissions={['erp_lite_reports:view']}
      >
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let trialBalanceRows: ErpLiteTrialBalanceRow[] = []
  let profitAndLossRows: ErpLiteStatementRow[] = []
  let balanceSheetRows: ErpLiteStatementRow[] = []
  let currencyCode = ORDER_DEFAULTS.CURRENCY
  let decimalPlaces = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES

  try {
    const authContext = await getAuthContext()
    const supabase = await createClient()
    const tenantSettings = createTenantSettingsService(supabase)
    ;[
      trialBalanceRows,
      profitAndLossRows,
      balanceSheetRows,
      { currencyCode, decimalPlaces },
    ] = await Promise.all([
      ErpLiteReportingService.getTrialBalance(locale),
      ErpLiteReportingService.getProfitAndLoss(locale),
      ErpLiteReportingService.getBalanceSheet(locale),
      tenantSettings.getCurrencyConfig(authContext.tenantId, undefined, authContext.userId).catch(() => ({
        currencyCode: ORDER_DEFAULTS.CURRENCY,
        decimalPlaces: ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
      })),
    ])
  } catch (error) {
    loadError = error instanceof Error ? error.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard
      feature={[FEATURE_FLAG_KEYS.ERP_LITE_ENABLED, FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED]}
      permissions={['erp_lite_reports:view']}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <ErpLiteReportsScreen
          trialBalanceRows={trialBalanceRows}
          profitAndLossRows={profitAndLossRows}
          balanceSheetRows={balanceSheetRows}
          currencyCode={currencyCode}
          decimalPlaces={decimalPlaces}
        />
      </div>
    </ErpLitePageGuard>
  )
}
