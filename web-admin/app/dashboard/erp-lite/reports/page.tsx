import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import {
  type ErpLiteStatementRow,
  ErpLiteReportingService,
} from '@/lib/services/erp-lite-reporting.service'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'

const BALANCE_SHEET_SECTION_ORDER = ['ASSETS', 'LIABILITIES', 'EQUITY']
const PROFIT_AND_LOSS_SECTION_ORDER = ['REVENUE', 'EXPENSES']

function groupStatementRows(rows: ErpLiteStatementRow[]) {
  const buckets = new Map<string, ErpLiteStatementRow[]>()
  for (const row of rows) {
    const current = buckets.get(row.section_code) ?? []
    current.push(row)
    buckets.set(row.section_code, current)
  }
  return buckets
}

export default async function ErpLiteReportsPage() {
  const t = await getTranslations('erpLite.reports')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED)

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED} permissions={['erp_lite_reports:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  const [trialBalanceRows, profitAndLossRows, balanceSheetRows] = await Promise.all([
    ErpLiteReportingService.getTrialBalance(locale),
    ErpLiteReportingService.getProfitAndLoss(locale),
    ErpLiteReportingService.getBalanceSheet(locale),
  ])
  const totalDebit = trialBalanceRows.reduce((sum, row) => sum + row.total_debit, 0)
  const totalCredit = trialBalanceRows.reduce((sum, row) => sum + row.total_credit, 0)
  const profitAndLossBySection = groupStatementRows(profitAndLossRows)
  const balanceSheetBySection = groupStatementRows(balanceSheetRows)
  const revenueTotal = (profitAndLossBySection.get('REVENUE') ?? []).reduce(
    (sum, row) => sum + row.amount,
    0
  )
  const expenseTotal = (profitAndLossBySection.get('EXPENSES') ?? []).reduce(
    (sum, row) => sum + row.amount,
    0
  )
  const netProfit = revenueTotal - expenseTotal

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_REPORTS_ENABLED}
      permissions={['erp_lite_reports:view']}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm text-muted-foreground">{t('summary.totalDebit')}</div>
            <div className="mt-2 text-2xl font-semibold">{totalDebit.toFixed(4)}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm text-muted-foreground">{t('summary.totalCredit')}</div>
            <div className="mt-2 text-2xl font-semibold">{totalCredit.toFixed(4)}</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-sm text-muted-foreground">{t('summary.netProfit')}</div>
            <div className="mt-2 text-2xl font-semibold">{netProfit.toFixed(4)}</div>
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{t('trialBalance.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('trialBalance.subtitle')}</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">{t('columns.account')}</th>
                  <th className="px-3 py-2 text-right">{t('columns.debit')}</th>
                  <th className="px-3 py-2 text-right">{t('columns.credit')}</th>
                  <th className="px-3 py-2 text-right">{t('columns.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {trialBalanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      {t('trialBalance.empty')}
                    </td>
                  </tr>
                ) : (
                  trialBalanceRows.map((row) => (
                    <tr key={row.account_id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {row.account_code} · {row.account_name}
                      </td>
                      <td className="px-3 py-2 text-right">{row.total_debit.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{row.total_credit.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{row.balance.toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{t('profitAndLoss.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('profitAndLoss.subtitle')}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {PROFIT_AND_LOSS_SECTION_ORDER.map((sectionCode) => {
              const rows = profitAndLossBySection.get(sectionCode) ?? []
              const total = rows.reduce((sum, row) => sum + row.amount, 0)
              return (
                <div key={sectionCode} className="rounded-lg border border-border bg-background">
                  <div className="border-b border-border px-4 py-3">
                    <div className="text-sm font-medium">{t(`sections.${sectionCode}`)}</div>
                    <div className="text-xs text-muted-foreground">{total.toFixed(4)}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">{t('columns.account')}</th>
                          <th className="px-3 py-2 text-right">{t('columns.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                              {t('profitAndLoss.empty')}
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.account_id} className="border-t border-border">
                              <td className="px-3 py-2">
                                {row.account_code} · {row.account_name}
                              </td>
                              <td className="px-3 py-2 text-right">{row.amount.toFixed(4)}</td>
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
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{t('balanceSheet.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('balanceSheet.subtitle')}</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {BALANCE_SHEET_SECTION_ORDER.map((sectionCode) => {
              const rows = balanceSheetBySection.get(sectionCode) ?? []
              const total = rows.reduce((sum, row) => sum + row.amount, 0)
              return (
                <div key={sectionCode} className="rounded-lg border border-border bg-background">
                  <div className="border-b border-border px-4 py-3">
                    <div className="text-sm font-medium">{t(`sections.${sectionCode}`)}</div>
                    <div className="text-xs text-muted-foreground">{total.toFixed(4)}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">{t('columns.account')}</th>
                          <th className="px-3 py-2 text-right">{t('columns.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                              {t('balanceSheet.empty')}
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.account_id} className="border-t border-border">
                              <td className="px-3 py-2">
                                {row.account_code} · {row.account_name}
                              </td>
                              <td className="px-3 py-2 text-right">{row.amount.toFixed(4)}</td>
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
        </section>
      </div>
    </ErpLitePageGuard>
  )
}
