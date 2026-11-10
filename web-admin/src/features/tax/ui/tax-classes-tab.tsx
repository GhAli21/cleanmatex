'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_CLASS_FLOWS, type TaxClassFlow } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSelect, CmxSwitch } from '@ui/primitives'
import { CmxDataTable } from '@ui/data-display'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { CmxStatusBadge, cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxClasses, useTaxMutation } from '../hooks/use-tax'
import type { TaxClassRow } from '../model/tax-types'

function TaxClassDialog({ row, onClose }: { row: TaxClassRow | null; onClose: () => void }) {
  const t = useTranslations('taxSetup.engine.classes')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const [classCode, setClassCode] = useState(row?.class_code ?? '')
  const [flow, setFlow] = useState<TaxClassFlow>(row?.tax_flow_code ?? 'OUTPUT')
  const [name, setName] = useState(row?.name ?? '')
  const [name2, setName2] = useState(row?.name2 ?? '')
  const [isDefault, setIsDefault] = useState(row?.is_default ?? false)

  const save = useTaxMutation(
    (body: Record<string, unknown>) => (row ? taxApi.updateClass(row.id, body) : taxApi.createClass(body)),
    () => {
      cmxMessage.success(t('saved'))
      onClose()
    },
  )
  const valid = !!name.trim() && (!!row || /^[A-Za-z0-9_]{2,30}$/.test(classCode))
  const submit = () =>
    save.mutate({
      ...(row ? {} : { classCode, taxFlowCode: flow }),
      name: name.trim(),
      name2: name2.trim() || null,
      description: row?.description ?? null,
      description2: row?.description2 ?? null,
      isDefault,
    })

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
      <CmxDialogContent className="sm:max-w-[480px]">
        <CmxDialogHeader>
          <CmxDialogTitle>{row ? t('editTitle', { code: row.class_code }) : t('addTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-3">
          {!row && (
            <>
              <CmxInput label={t('code')} dir="ltr" value={classCode} maxLength={30} onChange={(e) => setClassCode(e.target.value.toUpperCase())} />
              <CmxSelect label={t('flow')} value={flow} options={TAX_CLASS_FLOWS.map((v) => ({ value: v, label: tEngine(`flows.${v}`) }))} onChange={(e) => setFlow(e.target.value as TaxClassFlow)} />
            </>
          )}
          <CmxInput label={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
          <CmxInput label={t('name2')} dir="rtl" value={name2} onChange={(e) => setName2(e.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t('isDefault')}</span>
            {/* A default can only be replaced by choosing another class. */}
            <CmxSwitch checked={isDefault} disabled={row?.is_default} onCheckedChange={setIsDefault} aria-label={t('isDefault')} />
          </div>
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={save.isPending}>{tCommon('cancel')}</CmxButton>
          <CmxButton onClick={submit} disabled={!valid || save.isPending}>{tCommon('save')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Advanced: item tax classes. */
export function TaxClassesTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations('taxSetup.engine.classes')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<TaxClassRow | 'new' | null>(null)
  const { data = [], isLoading, isError } = useTaxClasses(includeInactive)
  const toggle = useTaxMutation((r: TaxClassRow) => taxApi.updateClass(r.id, { isActive: !r.is_active }), () => cmxMessage.success(t('saved')))

  const columns: ColumnDef<TaxClassRow, unknown>[] = [
    { id: 'code', header: t('code'), cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{row.original.class_code}</span> },
    { id: 'name', header: t('name'), cell: ({ row }) => bilingual(row.original.name, row.original.name2 ?? row.original.name) },
    { id: 'flow', header: t('flow'), cell: ({ row }) => tEngine(`flows.${row.original.tax_flow_code}`) },
    { id: 'default', header: t('isDefault'), cell: ({ row }) => (row.original.is_default ? <CmxStatusBadge size="sm" variant="info" label={t('default')} /> : null) },
    { id: 'source', header: t('source'), cell: ({ row }) => tEngine(`source.${row.original.source}`) },
    ...(canManage
      ? ([
          {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) => (
              <div className="flex gap-1">
                <CmxButton size="sm" variant="ghost" onClick={() => setEditing(row.original)}>{tCommon('edit')}</CmxButton>
                <CmxButton size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(row.original)}>
                  {row.original.is_active ? t('deactivate') : t('activate')}
                </CmxButton>
              </div>
            ),
          },
        ] satisfies ColumnDef<TaxClassRow, unknown>[])
      : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <CmxSwitch checked={includeInactive} onCheckedChange={setIncludeInactive} aria-label={t('showInactive')} />
          {t('showInactive')}
        </label>
        {canManage && <CmxButton onClick={() => setEditing('new')}>{t('add')}</CmxButton>}
      </div>
      {isError && <p className="text-sm text-destructive">{t('loadError')}</p>}
      <CmxDataTable columns={columns} data={data} loading={isLoading} page={0} pageSize={Math.max(data.length, 1)} total={data.length} showPageSizeSelector={false} emptyStateTitle={t('empty')} />
      {editing && <TaxClassDialog row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
