'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { TAX_PERMISSIONS } from '@/lib/constants/permissions/tax-perm'
import { TAX_CONFIG_STATUS, type TaxReadinessCode } from '@/lib/constants/tax'
import { CmxButton, CmxInput, CmxSpinner, CmxTextarea, Label } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { CmxConfirmDialog, CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import { TaxApiError, taxApi } from '../api/tax-api'
import { useTaxConfig, useTaxErrorText, useTaxMutation, useTaxOptions } from '../hooks/use-tax'
import type { TaxConfigView } from '../model/tax-types'
import { TaxRegistrationsCard } from './tax-registrations-card'

function RateEditor({ code, canManage }: { code: TaxConfigView['ratesMissing'][number]; canManage: boolean }) {
  const t = useTranslations('taxSetup.engine.review')
  const tCommon = useTranslations('common')
  const bilingual = useBilingual()
  const [rate, setRate] = useState('')
  const save = useTaxMutation((value: number) => taxApi.updateCode(code.id, { rate: value }))
  const value = Number(rate)
  const valid = rate.trim() !== '' && value >= 0 && value <= 100
  return (
    <div className="flex items-end gap-2">
      <CmxInput
        label={t('rateFor', { name: bilingual(code.name, code.name2 ?? code.name) })}
        type="number"
        min={0}
        max={100}
        step="0.01"
        dir="ltr"
        value={rate}
        disabled={!canManage}
        onChange={(e) => setRate(e.target.value)}
      />
      {canManage && (
        <CmxButton onClick={() => save.mutate(value)} disabled={!valid || save.isPending}>
          {tCommon('save')}
        </CmxButton>
      )}
    </div>
  )
}

function SalesSummary({ view }: { view: TaxConfigView }) {
  const t = useTranslations('taxSetup.engine.review')
  const bilingual = useBilingual()
  const options = useTaxOptions()
  const { currentTenant } = useAuth()
  const defaultClass = options.data?.classes.find((c) => c.tax_flow_code === 'OUTPUT' && c.is_default)?.class_code ?? null
  const country = view.tenant?.country?.toUpperCase() ?? null
  const today = new Date().toISOString().slice(0, 10)

  const preview = useQuery({
    queryKey: ['tax', currentTenant?.tenant_id, 'review-preview', defaultClass, country, view.config?.kit_code, view.ratesMissing.length],
    enabled: !!options.data,
    queryFn: () =>
      taxApi.explain({
        doc_type_code: null,
        tax_flow_code: 'OUTPUT',
        branch_id: null,
        place_of_supply_country: country,
        tax_item_class_code: defaultClass,
        party_tax_class_code: 'CONSUMER',
        party_country_scope: 'DOMESTIC',
        service_category_code: null,
        date: today,
      }),
  })

  if (!preview.data) return null
  const rateText = preview.data.codes
    .map((c) => (c.rate != null ? `${bilingual(c.name ?? c.tax_code, c.name2 ?? c.name ?? c.tax_code)} ${c.rate}%` : c.tax_code))
    .join(' + ')
  return <p className="text-base font-medium">{preview.data.status === 'MATCHED' && rateText ? t('salesSummary', { taxes: rateText }) : t('salesSummaryNone')}</p>
}

/** Owner-side review of a pending tax setup, in plain words, ending with Confirm. */
export function TaxReviewScreen() {
  const t = useTranslations('taxSetup.engine.review')
  const tDocs = useTranslations('taxDocuments')
  const tReady = useTranslations('taxSetup.engine.readiness')
  const bilingual = useBilingual()
  const router = useRouter()
  const errorText = useTaxErrorText()
  const canManage = useHasPermissionCode(TAX_PERMISSIONS.MANAGE_CONFIG)
  const { data: view, isLoading, error, refetch } = useTaxConfig()
  const [note, setNote] = useState('')
  const [blockers, setBlockers] = useState<TaxReadinessCode[]>([])

  const confirm = useTaxMutation(taxApi.confirm, (r) => {
    if (r.ok) {
      cmxMessage.success(t('confirmed'))
      router.push('/dashboard/settings/tax')
    } else {
      setBlockers(r.errors)
    }
  })

  if (isLoading) return <div className="flex justify-center py-16"><CmxSpinner /></div>
  if (error || !view) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">{error instanceof TaxApiError ? errorText(error) : t('loadError')}</p>
        <CmxButton variant="outline" onClick={() => refetch()}>{t('retry')}</CmxButton>
      </div>
    )
  }
  if (!view.config) return <p className="p-6 text-sm text-muted-foreground">{t('noKit')}</p>

  const active = view.config.status === TAX_CONFIG_STATUS.ACTIVE
  const pricing = view.pkg?.tax_pricing_mode === 'INCLUSIVE' ? t('pricingInclusive') : t('pricingExclusive')
  const conflicts = view.config.last_apply_summary?.conflicts ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>

      {!canManage && <CmxSummaryMessage type="info" title={t('noPermissionTitle')} items={[t('noPermission')]} />}
      {active && <CmxSummaryMessage type="success" title={t('alreadyActiveTitle')} items={[t('alreadyActive')]} />}

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{view.kit ? bilingual(view.kit.name, view.kit.name2 ?? view.kit.name) : view.config.kit_code}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3 text-sm">
          <SalesSummary view={view} />
          <ul className="list-disc space-y-1 ps-5">
            <li>{pricing}</li>
            {view.triggers.map((tr) => (
              <li key={tr.trigger_event}>
                {t('invoiceWhen', {
                  document: tDocs(`type.${tr.document_type}` as 'type.INVOICE'),
                  event: tDocs(`triggerEvent.${tr.trigger_event}` as 'triggerEvent.ON_DELIVERY'),
                })}
              </li>
            ))}
          </ul>
          {view.kit && !view.kit.version.is_verified && (
            <CmxSummaryMessage type="warning" title={t('unverifiedTitle')} items={[t('unverified')]} />
          )}
          {conflicts.length > 0 && (
            <CmxSummaryMessage type="warning" title={t('conflictsTitle')} items={conflicts.map((c) => `${c.code}: ${t(`conflictReason.${c.reason}` as 'conflictReason.SAME_CRITERIA')}`)} />
          )}
        </CmxCardContent>
      </CmxCard>

      {view.ratesMissing.length > 0 && (
        <CmxCard>
          <CmxCardHeader><CmxCardTitle>{t('ratesTitle')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent className="space-y-3">
            {view.ratesMissing.map((c) => <RateEditor key={c.id} code={c} canManage={canManage} />)}
          </CmxCardContent>
        </CmxCard>
      )}

      <TaxRegistrationsCard key={view.branches.map((b) => b.id).join()} view={view} canManage={canManage} />

      {view.examples.length > 0 && (
        <CmxCard>
          <CmxCardHeader><CmxCardTitle>{t('examplesTitle')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent>
            <ul className="space-y-2 text-sm">
              {view.examples.map((ex) => (
                <li key={ex.vector_code}>
                  <div>{bilingual(ex.description, ex.description2 ?? ex.description)}</div>
                  <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {Object.entries(ex.expected).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          </CmxCardContent>
        </CmxCard>
      )}

      {blockers.length > 0 && <CmxSummaryMessage type="error" title={t('notReadyTitle')} items={blockers.map((b) => tReady(b))} />}

      {canManage && !active && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tax-confirm-note">{t('note')}</Label>
            <CmxTextarea id="tax-confirm-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <CmxConfirmDialog
              title={t('confirmTitle')}
              description={t('confirmBody', { pricing })}
              confirmLabel={t('confirm')}
              onConfirm={() => confirm.mutateAsync(note.trim() || undefined).then(() => undefined)}
              trigger={<CmxButton disabled={confirm.isPending}>{t('confirm')}</CmxButton>}
            />
            <Link href="/dashboard/settings/tax"><CmxButton variant="outline">{t('later')}</CmxButton></Link>
          </div>
        </div>
      )}
    </div>
  )
}
