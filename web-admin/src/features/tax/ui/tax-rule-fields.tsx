'use client'

import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_PARTY_SCOPES } from '@/lib/constants/tax'
import { CmxSelect } from '@ui/primitives'
import type { TaxOptions } from '../model/tax-types'

/** The criteria shared by a rule (empty = any) and the explain preview (empty = no value). */
export interface TaxCriteriaValues {
  docTypeCode: string
  branchId: string
  placeOfSupplyCountry: string
  taxItemClassCode: string
  partyTaxClassCode: string
  partyCountryScope: string
  serviceCategoryCode: string
}

export const EMPTY_TAX_CRITERIA: TaxCriteriaValues = {
  docTypeCode: '',
  branchId: '',
  placeOfSupplyCountry: '',
  taxItemClassCode: '',
  partyTaxClassCode: '',
  partyCountryScope: '',
  serviceCategoryCode: '',
}

interface TaxCriteriaFieldsProps {
  values: TaxCriteriaValues
  options: TaxOptions
  onChange: (patch: Partial<TaxCriteriaValues>) => void
  /** Label of the empty choice in every select. */
  emptyLabel: string
}

/** The criteria selects used by the rule form and the explain preview. */
export function TaxCriteriaFields({ values, options, onChange, emptyLabel }: TaxCriteriaFieldsProps) {
  const t = useTranslations('taxSetup.engine.rules')
  const bilingual = useBilingual()
  const empty = { value: '', label: emptyLabel }
  return (
    <>
      <CmxSelect label={t('docType')} value={values.docTypeCode} options={[empty, ...options.docTypes.map((o) => ({ value: o.doc_type_code, label: bilingual(o.name, o.name2 ?? o.name) }))]} onChange={(e) => onChange({ docTypeCode: e.target.value })} />
      <CmxSelect label={t('branch')} value={values.branchId} options={[empty, ...options.branches.map((o) => ({ value: o.id, label: bilingual(o.name ?? o.branch_name ?? '', o.name2 ?? o.name ?? o.branch_name ?? '') }))]} onChange={(e) => onChange({ branchId: e.target.value })} />
      <CmxSelect label={t('country')} value={values.placeOfSupplyCountry} options={[empty, ...options.countries.map((o) => ({ value: o.code, label: bilingual(o.name, o.name2 ?? o.name) }))]} onChange={(e) => onChange({ placeOfSupplyCountry: e.target.value })} />
      <CmxSelect label={t('itemClass')} value={values.taxItemClassCode} options={[empty, ...options.classes.map((o) => ({ value: o.class_code, label: bilingual(o.name, o.name2 ?? o.name) }))]} onChange={(e) => onChange({ taxItemClassCode: e.target.value })} />
      <CmxSelect label={t('partyClass')} value={values.partyTaxClassCode} options={[empty, ...options.partyClasses.map((o) => ({ value: o.party_class_code, label: bilingual(o.name, o.name2 ?? o.name) }))]} onChange={(e) => onChange({ partyTaxClassCode: e.target.value })} />
      <CmxSelect label={t('scope')} value={values.partyCountryScope} options={[empty, ...TAX_PARTY_SCOPES.map((v) => ({ value: v, label: t(`scopes.${v}`) }))]} onChange={(e) => onChange({ partyCountryScope: e.target.value })} />
      <CmxSelect label={t('serviceCategory')} value={values.serviceCategoryCode} options={[empty, ...options.serviceCategories.map((o) => ({ value: o.service_category_code, label: bilingual(o.ctg_name, o.ctg_name2 ?? o.ctg_name) }))]} onChange={(e) => onChange({ serviceCategoryCode: e.target.value })} />
    </>
  )
}
