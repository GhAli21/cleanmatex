'use client'

import { Suspense } from 'react'
import {
  PLATFORM_INVENTORIES_PERMISSION,
  PlatformInventoriesScreen,
} from '@features/help/ui/platform-inventories-screen'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { CmxSpinner } from '@ui/primitives'
import { CmxEmptyState } from '@ui/data-display'
import { useTranslations } from 'next-intl'

function PlatformInventoriesGate() {
  const t = useTranslations('help.platformInventories')

  return (
    <RequireAnyPermission
      permissions={[PLATFORM_INVENTORIES_PERMISSION]}
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <CmxEmptyState
            title={t('errors.forbiddenTitle')}
            description={t('errors.forbidden')}
          />
        </div>
      }
    >
      <PlatformInventoriesScreen />
    </RequireAnyPermission>
  )
}

/**
 * Platform inventories Help viewer (requires help:platform_inventories).
 */
export default function PlatformInventoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <CmxSpinner />
        </div>
      }
    >
      <PlatformInventoriesGate />
    </Suspense>
  )
}
