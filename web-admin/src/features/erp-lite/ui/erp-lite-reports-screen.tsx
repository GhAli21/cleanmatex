'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type {
  ErpLiteStatementRow,
  ErpLiteTrialBalanceRow,
} from '@/lib/services/erp-lite-reporting.service'
import { CmxDataTable, CmxKpiStatCard } from '@ui/data-display'
import {
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives'

const BALANCE_SHEET_SECTION_ORDER = ['ASSETS', 'LIABILITIES', 'EQUITY'] as const
const PROFIT_AND_LOSS_SECTION_ORDER = ['REVENUE', 'EXPENSES'] as const

type ErpLiteReportsScreenProps = {
  trialBalanceRows: ErpLiteTrialBalanceRow[]
  profitAndLossRows: ErpLiteStatementRow[]
  balanceSheetRows: ErpLiteStatementRow[]
  currencyCode: string
  decimalPlaces: number
}

function groupStatementRows(rows: ErpLiteStatementRow[]) {
  const buckets = new Map<string, ErpLiteStatementRow[]>()
  for (const row of rows) {
    const current = buckets.get(row.section_code) ?? []
    current.push(row)
    buckets.set(row.section_code, current)
  }
  return buckets
}

function getNumberLocale(locale: string) {
  return locale === 'ar' ? 'ar-OM' : 'en-OM'
}

export function ErpLiteReportsScreen({
  trialBalanceRows,
  profitAndLossRows,
  balanceSheetRows,
  currencyCode,
  decimalPlaces,
}: ErpLiteReportsScreenProps) {
  const t = useTranslations('erpLite.reports')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const numberLocale = getNumberLocale(locale)
  const isRtl = locale === 'ar'

  const formatter = new Intl.NumberFormat(numberLocale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'code',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })

  const formatMoney = (value: number) => formatter.format(value)

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

  const trialBalanceColumns: ColumnDef<ErpLiteTrialBalanceRow>[] = [
    {
      accessorKey: 'account_name',
      header: t('columns.account'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">
            {row.original.account_code} · {row.original.account_name}
          </div>
        </div>
      ),
    },
    {
      id: 'total_debit',
      header: () => <div className="text-right">{t('columns.debit')}</div>,
      cell: ({ row }) => <div className="text-right">{formatMoney(row.original.total_debit)}</div>,
    },
    {
      id: 'total_credit',
      header: () => <div className="text-right">{t('columns.credit')}</div>,
      cell: ({ row }) => <div className="text-right">{formatMoney(row.original.total_credit)}</div>,
    },
    {
      id: 'balance',
      header: () => <div className="text-right">{t('columns.balance')}</div>,
      cell: ({ row }) => <div className="text-right">{formatMoney(row.original.balance)}</div>,
    },
  ]

  const statementColumns: ColumnDef<ErpLiteStatementRow>[] = [
    {
      accessorKey: 'account_name',
      header: t('columns.account'),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.account_code} · {row.original.account_name}
        </div>
      ),
    },
    {
      id: 'amount',
      header: () => <div className="text-right">{t('columns.amount')}</div>,
      cell: ({ row }) => <div className="text-right">{formatMoney(row.original.amount)}</div>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <CmxKpiStatCard
          title={t('summary.totalDebit')}
          value={formatMoney(totalDebit)}
          subtitle={`${tCommon('currency')}: ${currencyCode}`}
        />
        <CmxKpiStatCard
          title={t('summary.totalCredit')}
          value={formatMoney(totalCredit)}
          subtitle={`${tCommon('currency')}: ${currencyCode}`}
        />
        <CmxKpiStatCard
          title={t('summary.netProfit')}
          value={formatMoney(netProfit)}
          subtitle={`${tCommon('currency')}: ${currencyCode}`}
        />
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('trialBalance.title')}</CmxCardTitle>
          <CmxCardDescription>{t('trialBalance.subtitle')}</CmxCardDescription>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={trialBalanceColumns}
            data={trialBalanceRows}
            page={0}
            pageSize={Math.max(trialBalanceRows.length, 1)}
            total={trialBalanceRows.length}
            emptyMessage={t('trialBalance.empty')}
          />
        </CmxCardContent>
      </CmxCard>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{t('profitAndLoss.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('profitAndLoss.subtitle')}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {PROFIT_AND_LOSS_SECTION_ORDER.map((sectionCode) => {
            const rows = profitAndLossBySection.get(sectionCode) ?? []
            const total = rows.reduce((sum, row) => sum + row.amount, 0)
            return (
              <CmxCard key={sectionCode}>
                <CmxCardHeader className={isRtl ? 'text-right' : undefined}>
                  <CmxCardTitle>{t(`sections.${sectionCode}`)}</CmxCardTitle>
                  <CmxCardDescription>{formatMoney(total)}</CmxCardDescription>
                </CmxCardHeader>
                <CmxCardContent>
                  <CmxDataTable
                    columns={statementColumns}
                    data={rows}
                    page={0}
                    pageSize={Math.max(rows.length, 1)}
                    total={rows.length}
                    emptyMessage={t('profitAndLoss.empty')}
                  />
                </CmxCardContent>
              </CmxCard>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{t('balanceSheet.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('balanceSheet.subtitle')}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {BALANCE_SHEET_SECTION_ORDER.map((sectionCode) => {
            const rows = balanceSheetBySection.get(sectionCode) ?? []
            const total = rows.reduce((sum, row) => sum + row.amount, 0)
            return (
              <CmxCard key={sectionCode}>
                <CmxCardHeader className={isRtl ? 'text-right' : undefined}>
                  <CmxCardTitle>{t(`sections.${sectionCode}`)}</CmxCardTitle>
                  <CmxCardDescription>{formatMoney(total)}</CmxCardDescription>
                </CmxCardHeader>
                <CmxCardContent>
                  <CmxDataTable
                    columns={statementColumns}
                    data={rows}
                    page={0}
                    pageSize={Math.max(rows.length, 1)}
                    total={rows.length}
                    emptyMessage={t('balanceSheet.empty')}
                  />
                </CmxCardContent>
              </CmxCard>
            )
          })}
        </div>
      </section>
    </div>
  )
}
