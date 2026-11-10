'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_AMOUNT_KINDS, TAX_CALC_LEVELS, TAX_FLOWS } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSelect, CmxSwitch } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation } from '../hooks/use-tax'
import type { TaxCodeRow, TaxOptions } from '../model/tax-types'

interface TaxCodeDialogProps {
  /** The version being edited; null creates a new code. */
  row: TaxCodeRow | null
  options: TaxOptions
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Creates a tax code or changes a version. The server makes a new version if orders already used this one. */
export function TaxCodeDialog({ row, options, onClose }: TaxCodeDialogProps) {
  const t = useTranslations('taxSetup.engine.codes')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()

  const [f, setF] = useState({
    taxCode: row?.tax_code ?? '',
    name: row?.name ?? '',
    name2: row?.name2 ?? '',
    taxType: row?.tax_type ?? options.taxTypes[0]?.tax_type ?? '',
    amountKind: row?.amount_kind ?? 'PERCENT',
    rate: row?.rate != null ? String(Number(row.rate)) : '',
    fixedAmount: row?.fixed_amount != null ? String(Number(row.fixed_amount)) : '',
    calcLevel: row?.calc_level ?? 'LINE',
    taxCategoryCode: row?.tax_category_code ?? options.categories[0]?.code ?? '',
    exemptReasonCode: row?.exempt_reason_code ?? '',
    taxFlowCode: row?.tax_flow_code ?? 'OUTPUT',
    recoverablePct: row ? String(Number(row.recoverable_pct)) : '100',
    isReverseCharge: row?.is_reverse_charge ?? false,
    priority: String(row?.priority ?? 1),
    effectiveFrom: row?.effective_from?.slice(0, 10) ?? today(),
    effectiveTo: row?.effective_to?.slice(0, 10) ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const done = () => {
    cmxMessage.success(t('saved'))
    onClose()
  }
  const save = useTaxMutation((body: Record<string, unknown>) => (row ? taxApi.updateCode(row.id, body) : taxApi.createCode(body)), done)

  const isPercent = f.amountKind === 'PERCENT'
  const vatNeedsLine = f.taxType === 'VAT' && f.calcLevel === 'DOCUMENT'
  const amountOk = isPercent ? f.rate === '' || (Number(f.rate) >= 0 && Number(f.rate) <= 100) : f.fixedAmount !== '' && Number(f.fixedAmount) >= 0
  const valid = !!f.name.trim() && (!!row || /^[A-Za-z0-9_]{2,30}$/.test(f.taxCode)) && amountOk && !vatNeedsLine && !!f.effectiveFrom

  const submit = () =>
    save.mutate({
      ...(row ? {} : { taxCode: f.taxCode }),
      name: f.name.trim(),
      name2: f.name2.trim() || null,
      taxType: f.taxType,
      amountKind: f.amountKind,
      rate: isPercent && f.rate !== '' ? Number(f.rate) : null,
      fixedAmount: isPercent ? null : Number(f.fixedAmount),
      calcLevel: f.calcLevel,
      taxCategoryCode: f.taxCategoryCode,
      exemptReasonCode: f.exemptReasonCode || null,
      taxFlowCode: f.taxFlowCode,
      recoverablePct: Number(f.recoverablePct),
      isReverseCharge: f.isReverseCharge,
      priority: Number(f.priority),
      effectiveFrom: f.effectiveFrom,
      effectiveTo: f.effectiveTo || null,
    })

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
      <CmxDialogContent className="sm:max-w-[640px]">
        <CmxDialogHeader>
          <CmxDialogTitle>{row ? t('editTitle', { code: row.tax_code, version: row.version_no }) : t('addTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pe-1">
          {row && <p className="text-sm text-muted-foreground">{t('versionHint')}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!row && <CmxInput label={t('code')} dir="ltr" value={f.taxCode} maxLength={30} helpText={t('codeHint')} onChange={(e) => set('taxCode', e.target.value.toUpperCase())} />}
            <CmxInput label={t('name')} value={f.name} onChange={(e) => set('name', e.target.value)} />
            <CmxInput label={t('name2')} dir="rtl" value={f.name2} onChange={(e) => set('name2', e.target.value)} />
            <CmxSelect label={t('type')} value={f.taxType} options={options.taxTypes.map((o) => ({ value: o.tax_type, label: bilingual(o.name, o.name2 ?? o.name) }))} onChange={(e) => set('taxType', e.target.value)} />
            <CmxSelect label={t('category')} value={f.taxCategoryCode} options={options.categories.map((o) => ({ value: o.code, label: bilingual(o.name, o.name2 ?? o.name) }))} onChange={(e) => set('taxCategoryCode', e.target.value)} />
            <CmxSelect label={t('exemptReason')} value={f.exemptReasonCode} options={[{ value: '', label: t('none') }, ...options.exemptReasons.map((o) => ({ value: o.code, label: bilingual(o.name, o.name2 ?? o.name) }))]} onChange={(e) => set('exemptReasonCode', e.target.value)} />
            <CmxSelect label={t('flow')} value={f.taxFlowCode} options={TAX_FLOWS.map((v) => ({ value: v, label: tEngine(`flows.${v}`) }))} onChange={(e) => set('taxFlowCode', e.target.value as typeof f.taxFlowCode)} />
            <CmxSelect label={t('amountKind')} value={f.amountKind} options={TAX_AMOUNT_KINDS.map((v) => ({ value: v, label: t(`amountKinds.${v}`) }))} onChange={(e) => set('amountKind', e.target.value as typeof f.amountKind)} />
            {isPercent ? (
              <CmxInput label={t('rate')} type="number" dir="ltr" min={0} max={100} step="0.01" value={f.rate} onChange={(e) => set('rate', e.target.value)} />
            ) : (
              <CmxInput label={t('fixedAmount')} type="number" dir="ltr" min={0} step="0.0001" value={f.fixedAmount} onChange={(e) => set('fixedAmount', e.target.value)} />
            )}
            <CmxSelect label={t('calcLevel')} value={f.calcLevel} error={vatNeedsLine ? t('vatLineOnly') : undefined} options={TAX_CALC_LEVELS.map((v) => ({ value: v, label: t(`calcLevels.${v}`) }))} onChange={(e) => set('calcLevel', e.target.value as typeof f.calcLevel)} />
            <CmxInput label={t('recoverable')} type="number" dir="ltr" min={0} max={100} step="0.01" value={f.recoverablePct} onChange={(e) => set('recoverablePct', e.target.value)} />
            <CmxInput label={t('priority')} type="number" dir="ltr" min={1} max={999} helpText={t('priorityHint')} value={f.priority} onChange={(e) => set('priority', e.target.value)} />
            <CmxInput label={t('from')} type="date" dir="ltr" value={f.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
            <CmxInput label={t('to')} type="date" dir="ltr" value={f.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t('reverseCharge')}</span>
            <CmxSwitch checked={f.isReverseCharge} onCheckedChange={(v) => set('isReverseCharge', v)} aria-label={t('reverseCharge')} />
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
