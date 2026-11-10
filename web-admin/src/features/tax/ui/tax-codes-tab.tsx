'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives'
import { CMX_DEFAULT_PAGE_SIZE, CmxDataTable } from '@ui/data-display'
import { CmxStatusBadge, cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxCodes, useTaxMutation, useTaxOptions } from '../hooks/use-tax'
import type { TaxCodeRow } from '../model/tax-types'
import { TaxCodeDialog } from './tax-code-dialog'

/** Advanced: every version of every tax code. */
export function TaxCodesTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations('taxSetup.engine.codes')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<TaxCodeRow | 'new' | null>(null)
  const options = useTaxOptions()
  const { data, isLoading, isError } = useTaxCodes({ page: page + 1, pageSize: CMX_DEFAULT_PAGE_SIZE, search: search.trim() || undefined, includeInactive })
  const toggle = useTaxMutation((r: TaxCodeRow) => taxApi.updateCode(r.id, { isActive: !r.is_active }), () => cmxMessage.success(t('saved')))

  const amount = (r: TaxCodeRow) =>
    r.amount_kind === 'FIXED' ? Number(r.fixed_amount).toString() : r.rate === null ? t('rateMissing') : `${Number(r.rate)}%`

  const columns: ColumnDef<TaxCodeRow, unknown>[] = [
    { id: 'code', header: t('code'), cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{row.original.tax_code} · v{row.original.version_no}</span> },
    { id: 'name', header: t('name'), cell: ({ row }) => bilingual(row.original.name, row.original.name2 ?? row.original.name) },
    { id: 'category', header: t('category'), cell: ({ row }) => row.original.tax_category_code },
    { id: 'flow', header: t('flow'), cell: ({ row }) => tEngine(`flows.${row.original.tax_flow_code}`) },
    { id: 'amount', header: t('rate'), cell: ({ row }) => amount(row.original) },
    { id: 'from', header: t('from'), cell: ({ row }) => row.original.effective_from.slice(0, 10) },
    {
      id: 'source',
      header: t('source'),
      cell: ({ row }) => <CmxStatusBadge size="sm" variant={row.original.source === 'HQ_KIT' ? 'info' : 'default'} label={tEngine(`source.${row.original.source}`)} />,
    },
    ...(canManage
      ? ([
          {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) => (
              <div className="flex gap-1">
                <CmxButton size="sm" variant="ghost" disabled={!options.data} onClick={() => setEditing(row.original)}>{tCommon('edit')}</CmxButton>
                <CmxButton size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(row.original)}>
                  {row.original.is_active ? t('deactivate') : t('activate')}
                </CmxButton>
              </div>
            ),
          },
        ] satisfies ColumnDef<TaxCodeRow, unknown>[])
      : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-72">
          <CmxInput label={tCommon('search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <CmxSwitch checked={includeInactive} onCheckedChange={(v) => { setIncludeInactive(v); setPage(0) }} aria-label={t('showInactive')} />
          {t('showInactive')}
        </label>
        {canManage && <CmxButton disabled={!options.data} onClick={() => setEditing('new')}>{t('add')}</CmxButton>}
      </div>
      {isError && <p className="text-sm text-destructive">{t('loadError')}</p>}
      <CmxDataTable columns={columns} data={data?.rows ?? []} loading={isLoading} page={page} pageSize={CMX_DEFAULT_PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} emptyStateTitle={t('empty')} />
      {editing && options.data && <TaxCodeDialog row={editing === 'new' ? null : editing} options={options.data} onClose={() => setEditing(null)} />}
    </div>
  )
}
