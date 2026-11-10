'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_FLOWS, type TaxFlow } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { CmxSummaryMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation } from '../hooks/use-tax'
import type { TaxExplainFacts, TaxExplainResponse, TaxOptions, TaxPartyScopeValue } from '../model/tax-types'
import { EMPTY_TAX_CRITERIA, TaxCriteriaFields } from './tax-rule-fields'

/** Answers "which tax would apply here, and why?" without saving anything. */
export function TaxExplainDialog({ options, onClose }: { options: TaxOptions; onClose: () => void }) {
  const t = useTranslations('taxSetup.engine.explain')
  const tEngine = useTranslations('taxSetup.engine')
  const bilingual = useBilingual()
  const [flow, setFlow] = useState<TaxFlow>('OUTPUT')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [criteria, setCriteria] = useState(EMPTY_TAX_CRITERIA)
  const [result, setResult] = useState<TaxExplainResponse | null>(null)
  const run = useTaxMutation((facts: TaxExplainFacts) => taxApi.explain(facts), setResult)

  const submit = () =>
    run.mutate({
      tax_flow_code: flow,
      date,
      doc_type_code: criteria.docTypeCode || null,
      branch_id: criteria.branchId || null,
      place_of_supply_country: criteria.placeOfSupplyCountry || null,
      tax_item_class_code: criteria.taxItemClassCode || null,
      party_tax_class_code: criteria.partyTaxClassCode || null,
      party_country_scope: (criteria.partyCountryScope || null) as TaxPartyScopeValue,
      service_category_code: criteria.serviceCategoryCode || null,
    })

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <CmxDialogContent className="sm:max-w-[640px]">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pe-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CmxSelect label={t('flow')} value={flow} options={TAX_FLOWS.map((v) => ({ value: v, label: tEngine(`flows.${v}`) }))} onChange={(e) => setFlow(e.target.value as TaxFlow)} />
            <CmxInput label={t('date')} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
            <TaxCriteriaFields values={criteria} options={options} emptyLabel={t('notSet')} onChange={(p) => setCriteria((c) => ({ ...c, ...p }))} />
          </div>
          <CmxButton onClick={submit} disabled={!date || run.isPending}>{t('run')}</CmxButton>

          {result && result.status !== 'MATCHED' && (
            <CmxSummaryMessage type="error" title={t(`status.${result.status}`)} items={result.candidates.map((c) => `${c.rule_code} · ${bilingual(c.name, c.name2 ?? c.name)}`)} />
          )}
          {result?.status === 'MATCHED' && result.rule && (
            <div className="space-y-2 rounded border border-border p-3 text-sm">
              <div className="font-medium">{t('winner', { rule: bilingual(result.rule.name, result.rule.name2 ?? result.rule.name) })}</div>
              <ol className="list-decimal space-y-1 ps-5">
                {result.codes.map((c) => (
                  <li key={c.tax_code}>
                    {c.missing ? t('codeMissing', { code: c.tax_code }) : `${bilingual(c.name ?? c.tax_code, c.name2 ?? c.name ?? c.tax_code)}: ${c.amount_kind === 'FIXED' ? c.fixed_amount : c.rate === null ? t('rateMissing') : `${c.rate}%`}`}
                  </li>
                ))}
              </ol>
              {result.candidates.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {t('alsoMatched', { rules: result.candidates.slice(1).map((c) => c.rule_code).join(', ') })}
                </p>
              )}
            </div>
          )}
        </div>
      </CmxDialogContent>
    </CmxDialog>
  )
}
