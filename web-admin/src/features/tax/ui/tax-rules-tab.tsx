'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives'
import { CMX_DEFAULT_PAGE_SIZE, CmxDataTable } from '@ui/data-display'
import { CmxStatusBadge, cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation, useTaxOptions, useTaxRules } from '../hooks/use-tax'
import type { TaxRuleRow } from '../model/tax-types'
import { TaxExplainDialog } from './tax-explain-dialog'
import { TaxRuleDialog } from './tax-rule-dialog'

/** Advanced: the rules that choose tax codes, with the "why this tax?" preview. */
export function TaxRulesTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations('taxSetup.engine.rules')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<TaxRuleRow | 'new' | null>(null)
  const [explaining, setExplaining] = useState(false)
  const options = useTaxOptions()
  const { data, isLoading, isError } = useTaxRules({ page: page + 1, pageSize: CMX_DEFAULT_PAGE_SIZE, search: search.trim() || undefined, includeInactive })
  const toggle = useTaxMutation((r: TaxRuleRow) => taxApi.updateRule(r.id, { isActive: !r.is_active }), () => cmxMessage.success(t('saved')))

  const when = (r: TaxRuleRow) =>
    [r.doc_type_code, r.branch_id ? t('oneBranch') : null, r.place_of_supply_country, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope, r.service_category_code]
      .filter(Boolean)
      .join(' · ') || t('any')

  const columns: ColumnDef<TaxRuleRow, unknown>[] = [
    { id: 'name', header: t('name'), cell: ({ row }) => (
      <div>
        <div>{bilingual(row.original.name, row.original.name2 ?? row.original.name)}</div>
        <div className="font-mono text-xs text-muted-foreground" dir="ltr">{row.original.rule_code}</div>
      </div>
    ) },
    { id: 'flow', header: t('flow'), cell: ({ row }) => (row.original.tax_flow_code ? tEngine(`flows.${row.original.tax_flow_code}`) : t('any')) },
    { id: 'when', header: t('when'), cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{when(row.original)}</span> },
    { id: 'codes', header: t('codes'), cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{row.original.tax_codes.join(', ')}</span> },
    { id: 'priority', header: t('priority'), cell: ({ row }) => row.original.priority },
    { id: 'source', header: t('source'), cell: ({ row }) => <CmxStatusBadge size="sm" variant={row.original.source === 'HQ_KIT' ? 'info' : 'default'} label={tEngine(`source.${row.original.source}`)} /> },
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
        ] satisfies ColumnDef<TaxRuleRow, unknown>[])
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
        <div className="flex gap-2">
          <CmxButton variant="outline" disabled={!options.data} onClick={() => setExplaining(true)}>{t('whyThisTax')}</CmxButton>
          {canManage && <CmxButton disabled={!options.data} onClick={() => setEditing('new')}>{t('addRule')}</CmxButton>}
        </div>
      </div>
      {isError && <p className="text-sm text-destructive">{t('loadError')}</p>}
      <CmxDataTable columns={columns} data={data?.rows ?? []} loading={isLoading} page={page} pageSize={CMX_DEFAULT_PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} emptyStateTitle={t('empty')} />
      {editing && options.data && <TaxRuleDialog row={editing === 'new' ? null : editing} options={options.data} onClose={() => setEditing(null)} />}
      {explaining && options.data && <TaxExplainDialog options={options.data} onClose={() => setExplaining(false)} />}
    </div>
  )
}
