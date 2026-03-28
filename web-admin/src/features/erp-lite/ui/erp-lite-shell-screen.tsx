import { Landmark } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxEmptyState } from '@ui/data-display/cmx-empty-state'
import type { FeatureFlagKey } from '@/lib/constants/feature-flags'
import { ErpLitePageGuard } from './erp-lite-page-guard'

interface ErpLiteShellScreenProps {
  moduleKey:
    | 'coa'
    | 'gl'
    | 'reports'
    | 'ar'
    | 'expenses'
    | 'bankRecon'
    | 'ap'
    | 'po'
    | 'branchPl'
  feature: FeatureFlagKey
  permissions: string[]
}

/**
 * Phase 1 shell screen keeps ERP-Lite routes visible to the app without
 * implying that runtime finance functionality already exists.
 */
export function ErpLiteShellScreen({
  moduleKey,
  feature,
  permissions,
}: ErpLiteShellScreenProps) {
  const t = useTranslations('erpLite')

  return (
    <ErpLitePageGuard feature={feature} permissions={permissions}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            {t(`modules.${moduleKey}.title`)}
          </h1>
          <p className="max-w-3xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t(`modules.${moduleKey}.subtitle`)}
          </p>
        </div>

        <CmxEmptyState
          icon={
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--cmx-primary-rgb,14_165_233))]/10">
              <Landmark className="h-7 w-7 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
            </div>
          }
          title={t('shell.title')}
          description={t('shell.description')}
        />
      </div>
    </ErpLitePageGuard>
  )
}
