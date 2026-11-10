'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_FLOWS } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation } from '../hooks/use-tax'
import type { TaxOptions, TaxRuleRow } from '../model/tax-types'
import { TaxCriteriaFields, type TaxCriteriaValues } from './tax-rule-fields'

interface TaxRuleDialogProps {
  /** The rule being edited; null creates a new one. */
  row: TaxRuleRow | null
  options: TaxOptions
  onClose: () => void
}

/** Creates or changes a tax rule: when it applies, and which codes it adds, in order. */
export function TaxRuleDialog({ row, options, onClose }: TaxRuleDialogProps) {
  const t = useTranslations('taxSetup.engine.rules')
  const tEngine = useTranslations('taxSetup.engine')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()

  const [ruleCode, setRuleCode] = useState(row?.rule_code ?? '')
  const [name, setName] = useState(row?.name ?? '')
  const [name2, setName2] = useState(row?.name2 ?? '')
  const [flow, setFlow] = useState<string>(row?.tax_flow_code ?? 'OUTPUT')
  const [criteria, setCriteria] = useState<TaxCriteriaValues>({
    docTypeCode: row?.doc_type_code ?? '',
    branchId: row?.branch_id ?? '',
    placeOfSupplyCountry: row?.place_of_supply_country ?? '',
    taxItemClassCode: row?.tax_item_class_code ?? '',
    partyTaxClassCode: row?.party_tax_class_code ?? '',
    partyCountryScope: row?.party_country_scope ?? '',
    serviceCategoryCode: row?.service_category_code ?? '',
  })
  const [priority, setPriority] = useState(String(row?.priority ?? 100))
  const [from, setFrom] = useState(row?.effective_from ?? new Date().toISOString().slice(0, 10))
  const [to, setTo] = useState(row?.effective_to ?? '')
  const [codes, setCodes] = useState<string[]>(row?.tax_codes ?? [])
  const [nextCode, setNextCode] = useState('')

  const save = useTaxMutation(
    (body: Record<string, unknown>) => (row ? taxApi.updateRule(row.id, body) : taxApi.createRule(body)),
    () => {
      cmxMessage.success(t('saved'))
      onClose()
    },
  )

  const free = options.codes.filter((c) => !codes.includes(c.tax_code))
  const valid = !!name.trim() && (!!row || /^[A-Za-z0-9_]{2,30}$/.test(ruleCode)) && codes.length > 0 && !!from && Number(priority) >= 1

  const submit = () =>
    save.mutate({
      ...(row ? {} : { ruleCode }),
      name: name.trim(),
      name2: name2.trim() || null,
      taxFlowCode: flow || null,
      docTypeCode: criteria.docTypeCode || null,
      branchId: criteria.branchId || null,
      placeOfSupplyCountry: criteria.placeOfSupplyCountry || null,
      taxItemClassCode: criteria.taxItemClassCode || null,
      partyTaxClassCode: criteria.partyTaxClassCode || null,
      partyCountryScope: criteria.partyCountryScope || null,
      serviceCategoryCode: criteria.serviceCategoryCode || null,
      priority: Number(priority),
      effectiveFrom: from,
      effectiveTo: to || null,
      taxCodes: codes,
    })

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
      <CmxDialogContent className="sm:max-w-[640px]">
        <CmxDialogHeader>
          <CmxDialogTitle>{row ? t('editTitle', { code: row.rule_code }) : t('addTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pe-1">
          <p className="text-sm text-muted-foreground">{t('anyHint')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!row && <CmxInput label={t('code')} dir="ltr" value={ruleCode} maxLength={30} onChange={(e) => setRuleCode(e.target.value.toUpperCase())} />}
            <CmxInput label={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
            <CmxInput label={t('name2')} dir="rtl" value={name2} onChange={(e) => setName2(e.target.value)} />
            <CmxSelect label={t('flow')} value={flow} options={[{ value: '', label: t('any') }, ...TAX_FLOWS.map((v) => ({ value: v, label: tEngine(`flows.${v}`) }))]} onChange={(e) => setFlow(e.target.value)} />
            <TaxCriteriaFields values={criteria} options={options} emptyLabel={t('any')} onChange={(p) => setCriteria((c) => ({ ...c, ...p }))} />
            <CmxInput label={t('priority')} type="number" dir="ltr" min={1} max={9999} helpText={t('priorityHint')} value={priority} onChange={(e) => setPriority(e.target.value)} />
            <CmxInput label={t('from')} type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
            <CmxInput label={t('to')} type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('codes')}</legend>
            <ol className="space-y-1">
              {codes.map((c, i) => (
                <li key={c} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
                  <span className="font-mono text-xs" dir="ltr">{i + 1}. {c}</span>
                  <CmxButton size="sm" variant="ghost" aria-label={t('removeCode', { code: c })} onClick={() => setCodes((l) => l.filter((x) => x !== c))}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </CmxButton>
                </li>
              ))}
            </ol>
            <div className="flex items-end gap-2">
              <CmxSelect label={t('addCode')} value={nextCode} placeholder={t('chooseCode')} options={free.map((c) => ({ value: c.tax_code, label: `${c.tax_code} · ${bilingual(c.name, c.name2 ?? c.name)}` }))} onChange={(e) => setNextCode(e.target.value)} />
              <CmxButton variant="outline" disabled={!nextCode} onClick={() => { setCodes((l) => [...l, nextCode]); setNextCode('') }}>{t('add')}</CmxButton>
            </div>
          </fieldset>
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={save.isPending}>{tCommon('cancel')}</CmxButton>
          <CmxButton onClick={submit} disabled={!valid || save.isPending}>{tCommon('save')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
