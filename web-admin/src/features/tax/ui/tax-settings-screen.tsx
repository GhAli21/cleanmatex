'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { TAX_PERMISSIONS } from '@/lib/constants/permissions/tax-perm'
import { CmxButton, CmxSpinner } from '@ui/primitives'
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation'
import { useTaxConfig, useTaxErrorText } from '../hooks/use-tax'
import { TaxClassesTab } from './tax-classes-tab'
import { TaxCodesTab } from './tax-codes-tab'
import { TaxOverviewTab } from './tax-overview-tab'
import { TaxRulesTab } from './tax-rules-tab'

interface TaxSettingsScreenProps {
  /** The old profiles and exemptions editor: it still drives order tax until T4. */
  currentOrderTax: ReactNode
}

/** Tax settings: Basic overview, and in Advanced mode the codes, rules and classes. */
export function TaxSettingsScreen({ currentOrderTax }: TaxSettingsScreenProps) {
  const t = useTranslations('taxSetup')
  const tEngine = useTranslations('taxSetup.engine.tabs')
  const errorText = useTaxErrorText()
  const canManage = useHasPermissionCode(TAX_PERMISSIONS.MANAGE_CONFIG)
  const { data: view, isLoading, error, refetch } = useTaxConfig()

  let body: ReactNode
  if (isLoading) {
    body = <div className="flex justify-center py-16"><CmxSpinner /></div>
  } else if (error || !view) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{errorText(error)}</p>
        <CmxButton variant="outline" onClick={() => refetch()}>{t('engine.retry')}</CmxButton>
      </div>
    )
  } else {
    const tabs: CmxTabItem[] = [
      { id: 'overview', label: tEngine('overview'), content: <TaxOverviewTab view={view} canManage={canManage} /> },
      ...(view.config?.setup_mode === 'ADVANCED'
        ? [
            { id: 'codes', label: tEngine('codes'), content: <TaxCodesTab canManage={canManage} /> },
            { id: 'rules', label: tEngine('rules'), content: <TaxRulesTab canManage={canManage} /> },
            { id: 'classes', label: tEngine('classes'), content: <TaxClassesTab canManage={canManage} /> },
          ]
        : []),
      { id: 'current', label: tEngine('currentOrderTax'), content: currentOrderTax },
    ]
    body = <CmxTabsPanel tabs={tabs} />
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('engine.description')}</p>
      </div>
      {body}
    </div>
  )
}
