'use client'

/**
 * Page gate for /dashboard/setup-health. Unlike RequireAnyPermission (which renders
 * nothing when denied) this shows a skeleton while sign-in and permissions load and an
 * explicit refusal afterwards, so a direct URL never ends on a blank page (QA T3/T4).
 * Frontend gating is UX only: GET /api/v1/setup-health enforces setup_health:view again.
 */
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxSkeleton } from '@ui/primitives'
import { CmxEmptyState } from '@ui/data-display'
import { useAuth } from '@/lib/auth/auth-context'
import { useHasAnyPermission } from '@/lib/hooks/usePermissions'

interface SetupHealthPageGuardProps {
  /** Permission codes of which the user needs at least one (from the page access contract). */
  permissions: string[]
  children: ReactNode
}

/**
 * Renders children when the user holds one of the permissions.
 * @param props - Required permissions and the protected page
 * @returns Skeleton while loading, children when allowed, a refusal otherwise
 * @example
 * <SetupHealthPageGuard permissions={['setup_health:view']}><SetupHealthScreen /></SetupHealthPageGuard>
 */
export function SetupHealthPageGuard({ permissions, children }: SetupHealthPageGuardProps) {
  const t = useTranslations('setupHealth.accessDenied')
  const { isLoading, isTenantContextReady } = useAuth()
  const allowed = useHasAnyPermission(permissions)

  // Permissions are empty until the tenant context is ready; deciding earlier would flash a false refusal.
  if (isLoading || !isTenantContextReady) {
    return <CmxSkeleton className="h-40 w-full" />
  }
  if (!allowed) {
    return (
      <CmxEmptyState
        icon={<Lock className="mx-auto h-8 w-8 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]" aria-hidden="true" />}
        title={t('title')}
        description={t('description')}
      />
    )
  }
  return <>{children}</>
}
