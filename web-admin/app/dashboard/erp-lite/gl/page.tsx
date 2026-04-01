import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import {
  ErpLiteReportingService,
  type ErpLiteGlInquiryRow,
} from '@/lib/services/erp-lite-reporting.service'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { Alert, AlertDescription } from '@ui/primitives'

export default async function ErpLiteGlPage() {
  const t = await getTranslations('erpLite.reports')
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED} permissions={['erp_lite_gl:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  let loadError: string | null = null
  let lines: ErpLiteGlInquiryRow[] = []

  try {
    lines = await ErpLiteReportingService.getGlInquiry(50, locale)
  } catch (error) {
    loadError = error instanceof Error ? error.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED}
      permissions={['erp_lite_gl:view']}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('gl.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('gl.subtitle')}
          </p>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">{t('columns.journal')}</th>
                <th className="px-3 py-2 text-left">{t('columns.postingDate')}</th>
                <th className="px-3 py-2 text-left">{t('columns.event')}</th>
                <th className="px-3 py-2 text-left">{t('columns.account')}</th>
                <th className="px-3 py-2 text-left">{t('columns.side')}</th>
                <th className="px-3 py-2 text-right">{t('columns.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    {t('gl.empty')}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={`${line.journal_id}-${line.line_no}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{line.journal_no}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.source_doc_type_code} {line.source_doc_no ?? ''}
                      </div>
                    </td>
                    <td className="px-3 py-2">{line.posting_date}</td>
                    <td className="px-3 py-2">{line.txn_event_code}</td>
                    <td className="px-3 py-2">
                      {line.account_code} · {line.account_name}
                    </td>
                    <td className="px-3 py-2">{line.entry_side}</td>
                    <td className="px-3 py-2 text-right">
                      {line.amount_txn_currency.toFixed(4)} {line.currency_code}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ErpLitePageGuard>
  )
}
