'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useBilingual } from '@/lib/hooks/useBilingual'
import { TAX_CONFIG_STATUS } from '@/lib/constants/tax'
import { CmxButton, CmxSelect, CmxSwitch } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation, useTaxPackages } from '../hooks/use-tax'
import type { TaxConfigView } from '../model/tax-types'
import { TaxRegistrationsCard } from './tax-registrations-card'

const STATUS_VARIANT = { PENDING_CONFIRMATION: 'warning', ACTIVE: 'success', DISABLED: 'default' } as const

interface TaxOverviewTabProps {
  view: TaxConfigView
  canManage: boolean
}

/** Basic tax settings: status, on/off, mode, package and registrations. */
export function TaxOverviewTab({ view, canManage }: TaxOverviewTabProps) {
  const t = useTranslations('taxSetup.engine.overview')
  const bilingual = useBilingual()
  const packages = useTaxPackages()
  const config = view.config
  const [pkgCode, setPkgCode] = useState(config?.starter_pkg_code ?? '')

  const saved = () => cmxMessage.success(t('saved'))
  const update = useTaxMutation(taxApi.updateConfig, saved)
  const apply = useTaxMutation(taxApi.applyKit, saved)

  if (!config) return <CmxSummaryMessage type="warning" title={t('noKitTitle')} items={[t('noKit')]} />

  const active = config.status === TAX_CONFIG_STATUS.ACTIVE
  const pricing = view.tenant?.tax_pricing_mode === 'TAX_INCLUSIVE' ? t('pricingInclusive') : t('pricingExclusive')

  return (
    <div className="space-y-6">
      {!active && (
        <CmxSummaryMessage type="warning" title={t('pendingTitle')} items={[canManage ? t('pending') : t('pendingContact')]} />
      )}

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('title')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CmxStatusBadge label={t(`status.${config.status}`)} variant={STATUS_VARIANT[config.status]} />
            {view.kit && !view.kit.version.is_verified && <CmxStatusBadge label={t('unverified')} variant="warning" />}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t('kit')}</dt><dd className="font-medium">{view.kit ? `${bilingual(view.kit.name, view.kit.name2 ?? view.kit.name)} · v${view.kit.version.version_no}` : config.kit_code}</dd></div>
            <div><dt className="text-muted-foreground">{t('package')}</dt><dd className="font-medium">{view.pkg ? bilingual(view.pkg.name, view.pkg.name2 ?? view.pkg.name) : config.starter_pkg_code}</dd></div>
            <div>
              <dt className="text-muted-foreground">{t('pricing')}</dt>
              <dd className="font-medium">{pricing} · <Link className="text-primary underline" href="/dashboard/settings/tenant">{t('changeInSettings')}</Link></dd>
            </div>
            {view.counts && <div><dt className="text-muted-foreground">{t('contents')}</dt><dd className="font-medium">{t('contentsValue', view.counts)}</dd></div>}
          </dl>

          {canManage && !active && (
            <Link href="/dashboard/settings/tax/setup"><CmxButton>{t('review')}</CmxButton></Link>
          )}

          {active && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{t('enabled')}</div>
                <div className="text-xs text-muted-foreground">{t('enabledHint')}</div>
              </div>
              <CmxSwitch checked={config.tax_enabled} disabled={!canManage || update.isPending} onCheckedChange={(v) => update.mutate({ taxEnabled: v })} aria-label={t('enabled')} />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{t('advanced')}</div>
              <div className="text-xs text-muted-foreground">{t('advancedHint')}</div>
            </div>
            <CmxSwitch checked={config.setup_mode === 'ADVANCED'} disabled={!canManage || update.isPending} onCheckedChange={(v) => update.mutate({ setupMode: v ? 'ADVANCED' : 'BASIC' })} aria-label={t('advanced')} />
          </div>
        </CmxCardContent>
      </CmxCard>

      {canManage && (
        <CmxCard>
          <CmxCardHeader><CmxCardTitle>{t('changeKit')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{active ? t('changeKitActiveHint') : t('changeKitHint')}</p>
            <CmxSelect
              label={t('package')}
              value={pkgCode}
              options={(packages.data ?? []).map((p) => ({ value: p.pkg_code, label: bilingual(p.name, p.name2 ?? p.name) }))}
              onChange={(e) => setPkgCode(e.target.value)}
            />
            <CmxConfirmDialog
              title={t('applyTitle')}
              description={active ? t('applyBodyActive') : t('applyBody')}
              confirmLabel={t('apply')}
              onConfirm={() => apply.mutateAsync({ pkgCode, activate: active }).then(() => undefined)}
              trigger={<CmxButton variant="outline" disabled={!pkgCode || apply.isPending}>{t('apply')}</CmxButton>}
            />
          </CmxCardContent>
        </CmxCard>
      )}

      <TaxRegistrationsCard key={view.branches.map((b) => `${b.id}:${b.tax_registration_no}`).join()} view={view} canManage={canManage} />
    </div>
  )
}
