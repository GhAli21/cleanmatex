'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useLocale, useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { CmxButton, CmxInput, CmxSelect, CmxSpinner } from '@ui/primitives'
import { CMX_DEFAULT_PAGE_SIZE, CmxDataTable, CmxMoneyText } from '@ui/data-display'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback'
import { useTaxErrorText, useTaxPeriods, useTaxReturn, useTaxReturnLines } from '../hooks/use-tax'
import type { TaxReturnBoxRow, TaxReturnLineRow, TaxReturnView } from '../model/tax-types'

const CUSTOM = 'CUSTOM'
type Range = { from: string; to: string }

function BoxLinesDialog({ range, box, view, onClose }: { range: Range; box: TaxReturnBoxRow; view: TaxReturnView; onClose: () => void }) {
  const t = useTranslations('taxSetup.return')
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  const bilingual = useBilingual()
  const [page, setPage] = useState(0)
  const { data, isLoading, isError } = useTaxReturnLines({ ...range, box: box.code, page: page + 1, pageSize: CMX_DEFAULT_PAGE_SIZE })
  const money = (v: string) => <CmxMoneyText amount={v} currencyCode={view.currencyCode} decimalPlaces={view.currencyDecimals} locale={locale} hideCode />
  const columns: ColumnDef<TaxReturnLineRow, unknown>[] = [
    { id: 'date', header: t('lines.date'), cell: ({ row }) => <span dir="ltr">{row.original.tax_date}</span> },
    {
      id: 'doc',
      header: t('lines.document'),
      cell: ({ row }) => (
        <span dir="ltr" className="font-mono text-xs">{row.original.source_doc_type_code} {row.original.source_doc_no ?? ''}</span>
      ),
    },
    { id: 'code', header: t('lines.code'), cell: ({ row }) => <span dir="ltr">{row.original.tax_code}{row.original.rate ? ` · ${row.original.rate}%` : ''}</span> },
    { id: 'taxable', header: t('amount'), cell: ({ row }) => money(row.original.taxable) },
    { id: 'tax', header: t('tax'), cell: ({ row }) => money(row.original.tax) },
    { id: 'recoverable', header: t('lines.recoverable'), cell: ({ row }) => money(row.original.recoverable) },
    { id: 'kind', header: '', cell: ({ row }) => (row.original.is_reversal ? <CmxStatusBadge size="sm" variant="warning" label={t('lines.reversal')} /> : null) },
  ]
  return (
    <CmxDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <CmxDialogContent className="sm:max-w-[900px]">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('lines.title', { box: box.code, name: bilingual(box.name, box.name2 ?? box.name) })}</CmxDialogTitle>
        </CmxDialogHeader>
        {isError && <p className="text-sm text-destructive">{t('loadError')}</p>}
        <CmxDataTable columns={columns} data={data?.items ?? []} loading={isLoading} page={page} pageSize={CMX_DEFAULT_PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} emptyStateTitle={t('lines.empty')} />
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Builds the CSV of the boxes (form order) for filing or the accountant. */
function returnCsv(view: TaxReturnView, name: (b: TaxReturnBoxRow) => string, headers: string[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = view.boxes.map((b) => [b.code, name(b), b.showsAmount ? b.amount : '', b.showsTax ? b.tax : ''])
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** VAT Return report: boxes of the organization's return form for a tax period or any date range. */
export function TaxReturnScreen() {
  const t = useTranslations('taxSetup.return')
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  const bilingual = useBilingual()
  const errorText = useTaxErrorText()
  const periods = useTaxPeriods()
  const [periodId, setPeriodId] = useState('')
  const [custom, setCustom] = useState<Range>({ from: '', to: '' })
  const [openBox, setOpenBox] = useState<TaxReturnBoxRow | null>(null)

  const period = periods.data?.find((p) => p.id === periodId)
  const range: Range | null = period
    ? { from: period.periodStart, to: period.periodEnd }
    : periodId === CUSTOM && custom.from && custom.to && custom.to >= custom.from ? custom : null
  const report = useTaxReturn(range)
  const view = report.data
  const nameOf = (b: TaxReturnBoxRow) => bilingual(b.name, b.name2 ?? b.name)
  const money = (v: string) => <CmxMoneyText amount={v} currencyCode={view?.currencyCode ?? null} decimalPlaces={view?.currencyDecimals ?? null} locale={locale} hideCode />

  const exportCsv = () => {
    if (!view || !range) return
    // BOM so spreadsheet apps read the Arabic names as UTF-8.
    const blob = new Blob(['﻿' + returnCsv(view, nameOf, [t('box'), t('description'), t('amount'), t('tax')])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vat-return-${range.from}-${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: ColumnDef<TaxReturnBoxRow, unknown>[] = [
    {
      id: 'box',
      header: t('box'),
      cell: ({ row }) =>
        row.original.kind === 'LINES' ? (
          <CmxButton size="sm" variant="ghost" className="font-mono underline" onClick={() => setOpenBox(row.original)} aria-label={t('lines.open', { box: row.original.code })}>
            <span dir="ltr">{row.original.code}</span>
          </CmxButton>
        ) : (
          <span dir="ltr" className="font-mono text-sm">{row.original.code}</span>
        ),
    },
    {
      id: 'name',
      header: t('description'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div>{nameOf(row.original)}</div>
          {row.original.kind === 'MANUAL' && <div className="text-xs text-muted-foreground">{t('manualHelp')}</div>}
        </div>
      ),
    },
    { id: 'amount', header: t('amount'), cell: ({ row }) => (row.original.showsAmount && row.original.kind !== 'MANUAL' ? money(row.original.amount) : '—') },
    { id: 'tax', header: t('tax'), cell: ({ row }) => (row.original.showsTax && row.original.kind !== 'MANUAL' ? money(row.original.tax) : '—') },
  ]

  let body = null
  if (!range) {
    body = <p className="text-sm text-muted-foreground">{t('pickRange')}</p>
  } else if (report.isLoading) {
    body = <div className="flex justify-center py-16"><CmxSpinner /></div>
  } else if (report.isError || !view) {
    body = <p className="text-sm text-destructive">{errorText(report.error)}</p>
  } else if (!view.kitCode || view.boxes.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t('noLayout')}</p>
  } else {
    body = (
      <div className="space-y-6">
        {view.boxes.some((b) => !b.isVerified) && <CmxSummaryMessage type="warning" title={t('unverifiedTitle')} items={[t('unverifiedHelp')]} />}
        {(['SALES', 'PURCHASES', 'NET'] as const).map((section) => {
          const rows = view.boxes.filter((b) => b.section === section)
          if (rows.length === 0) return null
          return (
            <section key={section} className="space-y-2">
              <h2 className="text-lg font-semibold">{t(`sections.${section}`)}</h2>
              <CmxDataTable columns={columns} data={rows} page={0} pageSize={Math.max(rows.length, 1)} total={rows.length} showPageSizeSelector={false} />
            </section>
          )
        })}
        {view.notOnReturn.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t('notOnReturn')}</h2>
            <p className="text-sm text-muted-foreground">{t('notOnReturnHelp')}</p>
            <ul className="space-y-1 text-sm">
              {view.notOnReturn.map((g) => (
                <li key={`${g.flow}-${g.category}-${g.reverseCharge}-${g.emirate ?? ''}`} className="flex flex-wrap gap-2">
                  <span>{t(`flows.${g.flow}`)} · {g.category}{g.reverseCharge ? ` · ${t('reverseCharge')}` : ''}{g.emirate ? ` · ${g.emirate}` : ''}</span>
                  <span>{t('amount')}: {money(g.taxable)}</span>
                  <span>{t('tax')}: {money(g.tax)}</span>
                  <span className="text-muted-foreground">{t('lineCount', { count: g.lineCount })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-muted-foreground">{t('footnote', { count: view.lineCount, currency: view.currencyCode ?? '—' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description2')}</p>
        </div>
        <CmxButton variant="outline" onClick={exportCsv} disabled={!view || view.boxes.length === 0}>{t('export')}</CmxButton>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <CmxSelect
            label={t('period')}
            value={periodId}
            placeholder={t('periodPlaceholder')}
            options={[
              ...(periods.data ?? []).map((p) => ({ value: p.id, label: `${p.periodStart} → ${p.periodEnd} · ${t(`statuses.${p.status}`)}` })),
              { value: CUSTOM, label: t('customRange') },
            ]}
            onChange={(e) => setPeriodId(e.target.value)}
          />
        </div>
        {periodId === CUSTOM && (
          <>
            <CmxInput type="date" label={t('from')} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <CmxInput type="date" label={t('to')} value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>
        )}
      </div>
      {body}
      {openBox && range && view && <BoxLinesDialog range={range} box={openBox} view={view} onClose={() => setOpenBox(null)} />}
    </div>
  )
}
