'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxSwitch, CmxTextarea, Label } from '@ui/primitives'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useHasAnyPermission } from '@/lib/hooks/usePermissions'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { fetchPosSessionUsers } from '@features/pos-sessions/api/pos-session-api'
import { useDrawerCountMethod, type CountMethod } from '@features/cash-drawers/hooks/use-drawer-count-method'
import { CashCountMethodField } from '@features/cash-drawers/ui/cash-count-method-field'
import {
  openCashDrawerSessionV2,
  fetchCurrencyDenominations,
  type OpenCashDrawerSessionV2Result,
} from '@features/cash-drawers/api/cash-drawer-api'

const ASSIGN_SESSION_USER_PERMISSIONS = [
  POS_SESSION_PERMISSIONS.OPEN_OTHERS,
  POS_SESSION_PERMISSIONS.FULL_MANAGE_OTHERS,
]

interface CashDrawerOpenSessionDialogProps {
  drawerId: string
  currencyCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpened: (result: OpenCashDrawerSessionV2Result) => void
}

/**
 * Opens a cash drawer session on the CLF two-step lifecycle (plan §4B.10
 * CLF-8-4). The opening-expected figure is always computed server-side from
 * drawer history (chained off the previous session's disposition plus any
 * between-session activity) — this dialog never lets the operator declare a
 * float directly; it only offers an optional physical count taken against
 * that computed figure. Establishing a drawer's first float is a `FLOAT_ISSUE`
 * custody transaction, a separate workflow.
 *
 * Shared by the drawer overview screen and the POS session hub's drawer
 * linker — one dialog, one contract, instead of two independent forms
 * drifting apart.
 */
export function CashDrawerOpenSessionDialog({
  drawerId,
  currencyCode,
  open,
  onOpenChange,
  onOpened,
}: CashDrawerOpenSessionDialogProps) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const { token: csrfToken } = useCSRFToken()
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency()

  const [countNow, setCountNow] = useState(false)
  const [countChoice, setCountMode] = useState<CountMethod>('TOTAL_ONLY')
  const countPolicy = useDrawerCountMethod(drawerId, 'opening', open)
  const countMode = countPolicy.resolve(countChoice)
  const [totalAmount, setTotalAmount] = useState('')
  const [denomQuantities, setDenomQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [sessionUserId, setSessionUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canAssignUser = useHasAnyPermission(ASSIGN_SESSION_USER_PERMISSIONS)

  const usersQuery = useQuery({
    queryKey: ['pos-sessions', 'users', 'drawer-open'],
    enabled: open && canAssignUser,
    queryFn: () => fetchPosSessionUsers(),
  })
  const sessionUsers = usersQuery.data?.items ?? []

  const denominationsQuery = useQuery({
    queryKey: ['cash-drawers', 'currencies', currencyCode, 'denominations'],
    enabled: open && countNow && countMode === 'DENOMINATION',
    queryFn: () => fetchCurrencyDenominations(currencyCode),
  })
  const denominations = denominationsQuery.data ?? []

  const reset = () => {
    setCountNow(false)
    setCountMode('TOTAL_ONLY')
    setTotalAmount('')
    setDenomQuantities({})
    setNotes('')
    setSessionUserId('')
  }

  const handleSubmit = async () => {
    if (countNow && countMode === 'TOTAL_ONLY') {
      // A blank field is not a zero count: Number('') is 0, which would silently book a full shortage.
      const numeric = Number(totalAmount)
      if (totalAmount.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
        cmxMessage.error(t('wizard.countedAmountRequired'))
        return
      }
    }
    if (countNow && countMode === 'DENOMINATION' && denominations.length > 0) {
      const hasAny = denominations.some((d) => (denomQuantities[d.id] ?? 0) > 0)
      if (!hasAny) {
        cmxMessage.error(t('wizard.denominationBreakdownRequired'))
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await openCashDrawerSessionV2({
        drawerId,
        openingCount: countNow
          ? {
              countMode,
              totalAmount: countMode === 'TOTAL_ONLY' ? Number(totalAmount) : undefined,
              denominations:
                countMode === 'DENOMINATION'
                  ? denominations
                      .filter((d) => (denomQuantities[d.id] ?? 0) > 0)
                      .map((d) => ({ denominationId: d.id, quantity: denomQuantities[d.id] }))
                  : undefined,
            }
          : undefined,
        notes: notes.trim() || undefined,
        sessionUserId: sessionUserId || undefined,
        csrfToken,
      })

      const openingRow = result.currencyBalances.find((b) => b.currencyCode === currencyCode) ?? result.currencyBalances[0]
      if (openingRow?.openingVariance != null && Number(openingRow.openingVariance) !== 0) {
        cmxMessage.success(
          t('wizard.openSuccessWithVariance', {
            variance: formatMoneyWithCode(Number(openingRow.openingVariance), currencyCode),
          }),
        )
      } else {
        cmxMessage.success(t('messages.sessionOpened'))
      }

      onOpened(result)
      reset()
      onOpenChange(false)
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('messages.openFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('openSessionConfirm')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('wizard.openDescription')}
          </p>

          {canAssignUser ? (
            <div className="space-y-2">
              <CmxSelect
                label={t('sessionUserOptional')}
                value={sessionUserId}
                onChange={(event) => setSessionUserId(event.target.value)}
                options={[
                  { value: '', label: t('sessionUserNone') },
                  ...sessionUsers.map((user) => ({
                    value: user.id,
                    label: user.secondaryLabel ? `${user.label} (${user.secondaryLabel})` : user.label,
                  })),
                ]}
              />
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('sessionUserHint')}
              </p>
            </div>
          ) : null}

          <CmxSwitch
            checked={countNow}
            onCheckedChange={setCountNow}
            label={t('wizard.countNow')}
            description={t('wizard.countNowDescription')}
          />

          {countNow ? (
            <div className="space-y-4 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
              <CashCountMethodField methods={countPolicy.methods} value={countMode} onChange={setCountMode} />

              {countMode === 'TOTAL_ONLY' ? (
                <CmxInput
                  label={t('wizard.countedAmount')}
                  type="number"
                  min="0"
                  step="0.001"
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                />
              ) : denominationsQuery.isLoading ? (
                <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tCommon('loading')}</p>
              ) : denominations.length === 0 ? (
                <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  {t('wizard.noDenominationCatalog')}
                </p>
              ) : (
                <CmxDenominationCounter
                  denominations={denominations.map((d) => ({ id: d.id, label: d.name, valueMinor: d.denominationMinor }))}
                  value={denomQuantities}
                  onChange={setDenomQuantities}
                  minorUnit={decimalPlaces}
                  formatTotal={(totalMajor) => formatMoneyWithCode(totalMajor, currencyCode)}
                  quantityLabel={t('wizard.denominationBreakdown')}
                  totalLabel={t('wizard.countedAmount')}
                  disabled={submitting}
                />
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t('notesOptional')}</Label>
            <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton loading={submitting} onClick={handleSubmit}>
            {t('openSession')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
