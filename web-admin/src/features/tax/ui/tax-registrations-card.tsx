'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_EMIRATES, type TaxEmirate } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation } from '../hooks/use-tax'
import type { TaxConfigView } from '../model/tax-types'

interface TaxRegistrationsCardProps {
  view: TaxConfigView
  canManage: boolean
}

interface Row {
  taxRegistrationNo: string
  emirateCode: TaxEmirate | ''
}

/** Tax registration numbers of the organization and its branches; UAE branches also pick an emirate. */
export function TaxRegistrationsCard({ view, canManage }: TaxRegistrationsCardProps) {
  const t = useTranslations('taxSetup.engine.registrations')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()
  const orgCountry = view.tenant?.country?.toUpperCase() ?? null

  const [orgNo, setOrgNo] = useState(view.tenant?.tax_registration_no ?? '')
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(view.branches.map((b) => [b.id, { taxRegistrationNo: b.tax_registration_no ?? '', emirateCode: b.emirate_code ?? '' }])),
  )
  const save = useTaxMutation(taxApi.updateConfig, () => cmxMessage.success(t('saved')))
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const submit = () =>
    save.mutate({
      orgRegistrationNo: orgNo.trim() || null,
      registrations: view.branches.map((b) => ({
        branchId: b.id,
        taxRegistrationNo: rows[b.id].taxRegistrationNo.trim() || null,
        emirateCode: rows[b.id].emirateCode || null,
      })),
    })

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
        <CmxInput label={t('organization')} dir="ltr" value={orgNo} disabled={!canManage} maxLength={50} onChange={(e) => setOrgNo(e.target.value)} />
        {view.branches.map((b) => {
          const isUae = (b.country?.toUpperCase() ?? orgCountry) === 'AE'
          return (
            <div key={b.id} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CmxInput
                label={t('branch', { name: bilingual(b.name ?? b.branch_name ?? '', b.name2 ?? b.name ?? b.branch_name ?? '') })}
                dir="ltr"
                value={rows[b.id].taxRegistrationNo}
                disabled={!canManage}
                maxLength={50}
                onChange={(e) => setRow(b.id, { taxRegistrationNo: e.target.value })}
              />
              {isUae && (
                <CmxSelect
                  label={t('emirate')}
                  value={rows[b.id].emirateCode}
                  disabled={!canManage}
                  placeholder={t('chooseEmirate')}
                  options={TAX_EMIRATES.map((e) => ({ value: e, label: t(`emirates.${e}`) }))}
                  onChange={(e) => setRow(b.id, { emirateCode: e.target.value as TaxEmirate })}
                />
              )}
            </div>
          )
        })}
        {canManage && (
          <CmxButton onClick={submit} disabled={save.isPending}>
            {tCommon('save')}
          </CmxButton>
        )}
      </CmxCardContent>
    </CmxCard>
  )
}
