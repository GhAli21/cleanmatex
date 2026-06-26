'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions/admin-perm'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { CmxEmptyState } from '@ui/data-display'

interface CatalogSectionGateProps {
  children: ReactNode
}

/** Gates catalog section routes that require admin:manage (matches nav parent). */
export function CatalogSectionGate({ children }: CatalogSectionGateProps) {
  const t = useTranslations('catalog.access')

  return (
    <RequireAnyPermission
      permissions={[ADMIN_PERMISSIONS.MANAGE]}
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <CmxEmptyState title={t('forbiddenTitle')} description={t('forbidden')} />
        </div>
      }
    >
      {children}
    </RequireAnyPermission>
  )
}
