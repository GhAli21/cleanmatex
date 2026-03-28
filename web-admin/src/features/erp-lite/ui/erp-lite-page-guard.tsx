'use client'

import type { ReactNode } from 'react'
import { Landmark, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxEmptyState } from '@ui/data-display/cmx-empty-state'
import { RequireFeature } from '@/src/features/auth/ui/RequireFeature'
import { RequireAnyPermission } from '@/src/features/auth/ui/RequirePermission'
import type { FeatureFlagKey } from '@/lib/constants/feature-flags'

interface ErpLitePageGuardProps {
  feature: FeatureFlagKey
  permissions: string[]
  children: ReactNode
}

function GuardIcon({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'primary' | 'warning'
}) {
  const palette =
    tone === 'warning'
      ? 'bg-amber-500/10 text-amber-600'
      : 'bg-[rgb(var(--cmx-primary-rgb,14_165_233))]/10 text-[rgb(var(--cmx-primary-rgb,14_165_233))]'

  return (
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${palette}`}>
      {children}
    </div>
  )
}

export function ErpLitePageGuard({
  feature,
  permissions,
  children,
}: ErpLitePageGuardProps) {
  const t = useTranslations('erpLite')

  return (
    <RequireFeature
      feature={feature}
      fallback={
        <CmxEmptyState
          icon={
            <GuardIcon tone="primary">
              <Landmark className="h-7 w-7" />
            </GuardIcon>
          }
          title={t('access.upgradeTitle')}
          description={t('access.upgradeDescription')}
        />
      }
    >
      <RequireAnyPermission
        permissions={permissions}
        fallback={
          <CmxEmptyState
            icon={
              <GuardIcon tone="warning">
                <Lock className="h-7 w-7" />
              </GuardIcon>
            }
            title={t('access.deniedTitle')}
            description={t('access.deniedDescription')}
          />
        }
      >
        {children}
      </RequireAnyPermission>
    </RequireFeature>
  )
}
