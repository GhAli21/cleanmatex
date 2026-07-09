import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_ACCESS } from '@features/billing/access/billing-access'
import { CashDrawerSessionDetailScreen } from '@features/cash-drawers/ui/cash-drawer-session-detail-screen'
import { getAuthContext } from '@lib/auth/server-auth'
import { getCashDrawerSessionDetail } from '@lib/services/cash-drawer.service'
import { cashDrawerSessionDetailQuerySchema } from '@lib/validations/cash-drawer-schemas'

interface CashDrawerSessionDetailPageProps {
  params: Promise<{ drawerId: string; sessionId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function normalizeSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  )
}

/**
 * Canonical session truth page.
 *
 * Why:
 * this route is the audit/reconciliation source for one drawer session and
 * keeps all heavy data loading on the server for a stable first render.
 *
 * @param params dynamic route params resolved by Next.js
 * @param searchParams independent movements/payments pagination URL state
 * @returns guarded session detail screen or a user-safe fallback
 */
export default async function CashDrawerSessionDetailPage({
  params,
  searchParams,
}: CashDrawerSessionDetailPageProps) {
  const t = await getTranslations('billing.cashDrawers')
  const [{ drawerId, sessionId }, rawSearchParams] = await Promise.all([params, searchParams])
  let detail: Awaited<ReturnType<typeof getCashDrawerSessionDetail>> | null = null

  const parsedQuery = cashDrawerSessionDetailQuerySchema.safeParse(
    normalizeSearchParams(rawSearchParams),
  )
  const query = parsedQuery.success
    ? parsedQuery.data
    : cashDrawerSessionDetailQuerySchema.parse({})

  try {
    const { tenantId } = await getAuthContext()
    detail = await getCashDrawerSessionDetail(tenantId, drawerId, sessionId, query)
  } catch (error) {
    const message = error instanceof Error ? error.message : null

    if (message === 'Cash drawer not found' || message === 'Cash drawer session not found') {
      notFound()
    }

    return (
      <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_ACCESS.page.permissions ?? []}>
        <div className="space-y-6 p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t('messages.loadFailed')}
          </div>
        </div>
      </RequireAnyPermission>
    )
  }

  if (!detail) {
    notFound()
  }

  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_SESSION_ACCESS.page.permissions ?? []}>
      <CashDrawerSessionDetailScreen drawerId={drawerId} sessionId={sessionId} detail={detail} />
    </RequireAnyPermission>
  )
}
