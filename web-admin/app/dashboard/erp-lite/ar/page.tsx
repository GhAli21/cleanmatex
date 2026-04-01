import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import { ErpLiteReportingService } from '@/lib/services/erp-lite-reporting.service'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'

const BUCKET_ORDER = ['CURRENT', 'DUE_1_30', 'DUE_31_60', 'DUE_61_90', 'DUE_91_PLUS'] as const

export default async function ErpLiteArPage() {
  const t = await getTranslations('erpLite.reports.arAging')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_AR_ENABLED} permissions={['erp_lite_ar:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  const rows = await ErpLiteReportingService.getArAging(locale)
  const grouped = new Map<string, typeof rows>()

  for (const row of rows) {
    const current = grouped.get(row.bucket_code) ?? []
    current.push(row)
    grouped.set(row.bucket_code, current)
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm text-muted-foreground">{t('summary.totalOutstanding')}</div>
            <div className="mt-2 text-2xl font-semibold">{totalOutstanding.toFixed(4)}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm text-muted-foreground">{t('summary.customerCount')}</div>
            <div className="mt-2 text-2xl font-semibold">{customerCount}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {BUCKET_ORDER.map((bucketCode) => {
            const bucketRows = grouped.get(bucketCode) ?? []
            const bucketTotal = bucketRows.reduce((sum, row) => sum + row.outstanding_amount, 0)

            return (
              <div key={bucketCode} className="rounded-lg border border-border bg-background">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-sm font-medium">{t(`buckets.${bucketCode}`)}</div>
                  <div className="text-xs text-muted-foreground">{bucketTotal.toFixed(4)}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">{t('columns.customer')}</th>
                        <th className="px-3 py-2 text-left">{t('columns.invoice')}</th>
                        <th className="px-3 py-2 text-left">{t('columns.dueDate')}</th>
                        <th className="px-3 py-2 text-right">{t('columns.daysOverdue')}</th>
                        <th className="px-3 py-2 text-right">{t('columns.outstanding')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucketRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                            {t('empty')}
                          </td>
                        </tr>
                      ) : (
                        bucketRows.map((row) => (
                          <tr key={row.invoice_id} className="border-t border-border">
                            <td className="px-3 py-2">{row.customer_name}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{row.invoice_no}</div>
                              <div className="text-xs text-muted-foreground">{row.invoice_date ?? '-'}</div>
                            </td>
                            <td className="px-3 py-2">{row.due_date ?? '-'}</td>
                            <td className="px-3 py-2 text-right">{row.days_overdue}</td>
                            <td className="px-3 py-2 text-right">
                              {row.outstanding_amount.toFixed(4)}
                              {row.currency_code ? ` ${row.currency_code}` : ''}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ErpLitePageGuard>
  )
}
