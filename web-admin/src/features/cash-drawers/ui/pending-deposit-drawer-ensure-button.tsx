'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle } from 'lucide-react'
import {
  fetchBranchPendingDepositStatus,
  ensureBranchPendingDepositDrawer,
} from '@features/cash-drawers/api/cash-drawer-api'
import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives'

/** Shared cache key — every instance of this button queries the same status
 * list, so N branch rows on one screen cost exactly one network request. */
export const PENDING_DEPOSIT_STATUS_QUERY_KEY = ['cash-drawers', 'pending-deposit-status']

/**
 * Shared "Create pending-deposit drawer" button (CLF §4B.2a-B). Used on the
 * three tenant screens that provision the branch's system PENDING_DEPOSIT
 * drawer: `/dashboard/settings/branches`, the Cash drawers tab under
 * `/dashboard/settings/payments`, and the cash-control-settings status card.
 * Renders nothing once the branch already has one; a second click anywhere
 * is a no-op (the underlying API is idempotent).
 * @param props.branchId branch to provision
 * @param props.onCreated optional callback after a successful create
 */
export function PendingDepositDrawerEnsureButton({
  branchId,
  onCreated,
}: {
  branchId: string
  onCreated?: () => void
}) {
  const t = useTranslations('billing.cashDrawers.pendingDeposit')
  const { token: csrfToken } = useCSRFToken()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  const statusQuery = useQuery({
    queryKey: PENDING_DEPOSIT_STATUS_QUERY_KEY,
    queryFn: fetchBranchPendingDepositStatus,
    staleTime: 30_000,
  })

  const row = statusQuery.data?.find((r) => r.branchId === branchId)
  if (statusQuery.isLoading || row?.hasPendingDepositDrawer) {
    return null
  }

  const handleCreate = () => {
    startTransition(async () => {
      try {
        await ensureBranchPendingDepositDrawer({ branchId, csrfToken })
        cmxMessage.success(t('created'))
        await queryClient.invalidateQueries({ queryKey: PENDING_DEPOSIT_STATUS_QUERY_KEY })
        onCreated?.()
      } catch (error) {
        cmxMessage.error(error instanceof Error ? error.message : t('createFailed'))
      }
    })
  }

  return (
    <CmxButton variant="outline" size="sm" loading={isPending} onClick={handleCreate}>
      <PlusCircle className="me-2 h-4 w-4" aria-hidden />
      {t('createButton')}
    </CmxButton>
  )
}
