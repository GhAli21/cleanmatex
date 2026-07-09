import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS } from '@features/billing/access/billing-access'
import { CashDrawerOverviewScreen } from '@features/cash-drawers/ui/cash-drawer-overview-screen'
import { getAuthContext } from '@lib/auth/server-auth'
import { getCashDrawerOverviewDetail } from '@lib/services/cash-drawer.service'

interface CashDrawerDetailPageProps {
  params: Promise<{ drawerId: string }>
}

/**
 * Drawer-level operational page.
 *
 * Why:
 * this route keeps daily drawer actions available without forcing operators
 * into the heavier session audit surface.
 *
 * @param params dynamic route params resolved by Next.js
 * @returns guarded drawer overview screen or a user-safe fallback
 */
export default async function CashDrawerDetailPage({
  params,
}: CashDrawerDetailPageProps) {
  const t = await getTranslations('billing.cashDrawers')
  const { drawerId } = await params
  let overview: Awaited<ReturnType<typeof getCashDrawerOverviewDetail>> | null = null

  try {
    const { tenantId } = await getAuthContext()
    overview = await getCashDrawerOverviewDetail(tenantId, drawerId)
  } catch (error) {
    const message = error instanceof Error ? error.message : null

    if (message === 'Cash drawer not found') {
      notFound()
    }

    return (
      <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS.page.permissions ?? []}>
        <div className="space-y-6 p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t('messages.loadFailed')}
          </div>
        </div>
      </RequireAnyPermission>
    )
  }

  if (!overview) {
    notFound()
  }

  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS.page.permissions ?? []}>
      <CashDrawerOverviewScreen drawerId={drawerId} overview={overview} />
    </RequireAnyPermission>
  )
}
