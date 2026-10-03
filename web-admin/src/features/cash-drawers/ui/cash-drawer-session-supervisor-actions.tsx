'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Calculator, Siren } from 'lucide-react'

import { CmxButton } from '@ui/primitives'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import {
  fetchSessionClosure,
  type CurrencyBalancePreview,
} from '@features/cash-drawers/api/cash-drawer-api'
import { CashDrawerForceCloseDialog } from '@features/cash-drawers/ui/cash-drawer-force-close-dialog'
import { CashDrawerRecountDialog } from '@features/cash-drawers/ui/cash-drawer-recount-dialog'

interface CashDrawerSessionSupervisorActionsProps {
  drawerId: string
  sessionId: string
  branchId: string | null
  /** Session status from the detail payload (`OPEN`, `CLOSING`, `CLOSED`, `FORCE_CLOSED`). */
  status: string
  /** The drawer currency - the only balance row a session that never reached the count step can show. */
  currencyCode: string
}

/**
 * The supervisor entry points on a drawer session page:
 * - **Recount** (session `CLOSING`, `cash_drawer:approve_variance`): supersede the closing count.
 * - **Force close** (session `OPEN` or `CLOSING`, `pos_session:force_close`): close a session that
 *   was abandoned or is stuck mid-close, with a mandatory reason and a disposition of the cash.
 *
 * Both are hidden - not disabled - for anyone without the permission or when the session is not in
 * a state they apply to; the API enforces the same rules again. Shares the closure query with the
 * closure section, so opening a dialog costs no extra request.
 */
export function CashDrawerSessionSupervisorActions({
  drawerId,
  sessionId,
  branchId,
  status,
  currencyCode,
}: CashDrawerSessionSupervisorActionsProps) {
  const t = useTranslations('billing.cashDrawers')
  const router = useRouter()
  const queryClient = useQueryClient()
  const canRecount = useHasPermissionCode('cash_drawer:approve_variance')
  const canForceClose = useHasPermissionCode('pos_session:force_close')

  const showRecount = status === 'CLOSING' && canRecount
  const showForceClose = (status === 'OPEN' || status === 'CLOSING') && canForceClose

  const closureQuery = useQuery({
    queryKey: ['cash-drawers', drawerId, 'session', sessionId, 'closure'],
    queryFn: () => fetchSessionClosure(drawerId, sessionId),
    enabled: showRecount || showForceClose,
  })

  const [recountOpen, setRecountOpen] = useState(false)
  const [forceCloseOpen, setForceCloseOpen] = useState(false)

  if (!showRecount && !showForceClose) return null

  const closure = closureQuery.data
  const balances: CurrencyBalancePreview[] =
    closure && closure.balances.length > 0
      ? closure.balances.map((b) => ({
          currencyCode: b.currencyCode,
          closingExpected: b.closingExpected ?? undefined,
          closingCounted: b.closingCounted,
          closingVariance: b.closingVariance,
        }))
      : [{ currencyCode }]

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['cash-drawers', drawerId, 'session', sessionId] })
    router.refresh()
  }

  return (
    <>
      {showRecount ? (
        <CmxButton variant="outline" size="sm" disabled={!closure} onClick={() => setRecountOpen(true)}>
          <Calculator className="me-2 h-4 w-4" aria-hidden />
          {t('recount.action')}
        </CmxButton>
      ) : null}
      {showForceClose ? (
        <CmxButton variant="outline" size="sm" onClick={() => setForceCloseOpen(true)}>
          <Siren className="me-2 h-4 w-4" aria-hidden />
          {t('forceClose.action')}
        </CmxButton>
      ) : null}

      {closure ? (
        <CashDrawerRecountDialog
          open={recountOpen}
          onOpenChange={setRecountOpen}
          drawerId={drawerId}
          sessionId={sessionId}
          balances={closure.balances}
          counts={closure.counts}
          onRecounted={() => void refresh()}
        />
      ) : null}
      <CashDrawerForceCloseDialog
        open={forceCloseOpen}
        onOpenChange={setForceCloseOpen}
        drawerId={drawerId}
        sessionId={sessionId}
        branchId={branchId}
        balances={balances}
        onClosed={() => void refresh()}
      />
    </>
  )
}
