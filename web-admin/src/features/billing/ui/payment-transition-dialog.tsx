'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Ban, CheckCircle2, Lock, RotateCcw, XCircle } from 'lucide-react'

import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxTextarea } from '@ui/primitives/cmx-textarea'
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms/cmx-select-dropdown'
import { cmxMessage } from '@ui/feedback'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token'
import { PAYMENT_METHODS } from '@/lib/constants/payment'
import { isCashPlacementRecoverable } from '@/lib/constants/cash-drawer'
import { CashPlacementPicker, type CashPlacementChoice } from '@features/cash-drawers/ui/cash-placement-picker'

export type PaymentTransitionActionKind = 'VERIFY' | 'CANCEL' | 'FAIL_BOUNCE' | 'VOID' | 'REVERSE' | 'CAPTURE' | 'SETTLE'

const FALLBACK_CLASSIFICATION_OPTIONS = [
  'RETRY_TENDER',
  'PAY_ON_COLLECTION',
  'AR_CREDIT_INVOICE',
  'CANCEL_ORDER_OR_REVERSE_SERVICE',
  'MANUAL_REVIEW',
] as const

/** B10 — CANCEL/FAIL_BOUNCE require a D009 fallback classification; VOID/REVERSE/CAPTURE/SETTLE never do (D004: no balance-routing decision to record; B08: positive gateway-confirmed progression, not an exception). */
const ACTIONS_REQUIRING_FALLBACK = new Set<PaymentTransitionActionKind>(['CANCEL', 'FAIL_BOUNCE'])

/** B08 — CAPTURE/SETTLE join VERIFY as no-reason-required, positive-progression actions. */
const NO_REASON_ACTIONS = new Set<PaymentTransitionActionKind>(['VERIFY', 'CAPTURE', 'SETTLE'])

const ACTION_ICON: Record<PaymentTransitionActionKind, typeof CheckCircle2> = {
  VERIFY: CheckCircle2,
  CANCEL: XCircle,
  FAIL_BOUNCE: AlertTriangle,
  VOID: Ban,
  REVERSE: RotateCcw,
  CAPTURE: Lock,
  SETTLE: CheckCircle2,
}

/**
 * B30/B10 — reusable back-office transition dialog for a single payment leg.
 * Shared by the cross-order pending-payments worklist and the per-order
 * payments tab (order-payments-credits-tables.tsx), so both entry points
 * carry the identical D001 legality/D009 fallback/D010 idempotency contract.
 *
 * VERIFY needs no reason (mirrors the existing per-order Verify button).
 * CANCEL/FAIL_BOUNCE require a mandatory reason and a D009 fallback
 * classification. VOID/REVERSE (B10) require a mandatory reason only — no
 * fallback classification (D004: a void/reversal has no balance-routing
 * decision to record). VERIFY / REVERSE of a cash-family leg are placed by the
 * cash-drawer ledger gate automatically; only when the gate refuses (the leg's
 * drawer was deactivated, wrong branch/currency …) does the dialog show a drawer
 * picker and retry with that explicit placement.
 */
export function PaymentTransitionDialog({
  open,
  onOpenChange,
  orderId,
  paymentId,
  action,
  paymentMethodCode,
  branchId,
  currencyCode,
  onTransitioned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  paymentId: string
  action: PaymentTransitionActionKind
  /** Lets the dialog tell a cash-family leg (drawer re-placement possible) from the rest. */
  paymentMethodCode?: string
  /** Branch / currency of the leg — narrow the re-placement drawer list (the gate enforces them again). */
  branchId?: string | null
  currencyCode?: string | null
  onTransitioned: () => void
}) {
  const t = useTranslations('billing.pendingPayments')
  const tCommon = useTranslations('common')
  const tLedger = useTranslations('cashControl.ledgerErrors')
  const { token: csrfToken } = useCSRFToken()
  const [reason, setReason] = useState('')
  const [fallbackClassification, setFallbackClassification] = useState('')
  const [placementRequired, setPlacementRequired] = useState(false)
  const [placement, setPlacement] = useState<CashPlacementChoice | null>(null)
  const [refusedDrawerId, setRefusedDrawerId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // D010: stable per-dialog-open idempotency key — a network retry of this
  // same attempt reuses it (server replays the original result); reopening
  // the dialog for a fresh attempt gets a new key.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  const isPlaceableCashLeg =
    (action === 'VERIFY' || action === 'REVERSE') &&
    paymentMethodCode?.trim().toUpperCase() === PAYMENT_METHODS.CASH

  useEffect(() => {
    if (!open) return
    setReason('')
    setFallbackClassification('')
    setPlacementRequired(false)
    setPlacement(null)
    setRefusedDrawerId(null)
    setIdempotencyKey(crypto.randomUUID())
  }, [open, paymentId, action])

  const requiresReason = !NO_REASON_ACTIONS.has(action)
  const requiresFallback = ACTIONS_REQUIRING_FALLBACK.has(action)
  const canSubmit =
    (!requiresReason || reason.trim().length > 0) &&
    (!requiresFallback || fallbackClassification.length > 0) &&
    (!placementRequired || placement !== null)
  const actionKey = action.toLowerCase()

  const close = () => onOpenChange(false)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/finance/pending-payments/${paymentId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({
          orderId,
          action,
          reason: requiresReason ? reason.trim() : undefined,
          fallbackClassification: requiresFallback ? fallbackClassification : undefined,
          cashDrawerId: placement?.cashDrawerId,
          cashDrawerSessionId: placement?.cashDrawerSessionId ?? undefined,
          idempotencyKey,
        }),
      })
      const json = await res.json()
      if (json.success) {
        cmxMessage.success(t(`transition.${actionKey}Success`))
        close()
        onTransitioned()
      } else if (isPlaceableCashLeg && isCashPlacementRecoverable(json.error)) {
        // The gate could not place the cash: ask for a drawer instead of dead-ending.
        // A fresh key — the refused attempt rolled back, and the payload now differs.
        setPlacementRequired(true)
        setRefusedDrawerId(placement?.cashDrawerId ?? null)
        setPlacement(null)
        setIdempotencyKey(crypto.randomUUID())
        cmxMessage.error(mapTransitionError(json.error, t, tLedger))
      } else {
        cmxMessage.error(mapTransitionError(json.error, t, tLedger))
      }
    } catch {
      cmxMessage.error(t('transition.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const Icon = ACTION_ICON[action]

  return (
    <CmxDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" aria-hidden />
            {t(`transition.${actionKey}Title`)}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {t(`transition.${actionKey}Description`)}
          </div>
          {requiresReason ? (
            <CmxTextarea
              value={reason}
              placeholder={t('transition.reasonPlaceholder')}
              onChange={(event) => setReason(event.target.value)}
              aria-label={t('transition.reasonPlaceholder')}
            />
          ) : null}
          {requiresFallback ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {t('transition.fallbackClassificationLabel')}
              </label>
              <CmxSelectDropdown value={fallbackClassification} onValueChange={setFallbackClassification}>
                <CmxSelectDropdownTrigger className="w-full text-sm">
                  {fallbackClassification
                    ? t(`transition.fallback.${fallbackClassification}`)
                    : t('transition.fallbackClassificationPlaceholder')}
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {FALLBACK_CLASSIFICATION_OPTIONS.map((code) => (
                    <CmxSelectDropdownItem key={code} value={code}>
                      {t(`transition.fallback.${code}`)}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          ) : null}
          {placementRequired ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">{t('transition.placement.explain')}</p>
              <CashPlacementPicker
                branchId={branchId}
                currencyCode={currencyCode}
                value={placement}
                onChange={setPlacement}
                disabled={submitting}
                excludeDrawerId={refusedDrawerId}
              />
            </div>
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={close} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant={NO_REASON_ACTIONS.has(action) ? 'primary' : 'destructive'}
            disabled={!canSubmit}
            loading={submitting}
            onClick={submit}
          >
            {t(`transition.${actionKey}Confirm`)}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Map the transition route's stable error codes to i18n-resolved text. */
function mapTransitionError(
  code: string,
  t: (key: string) => string,
  tLedger: { has: (key: string) => boolean } & ((key: string) => string),
): string {
  // Cash-drawer ledger refusals carry stable codes with shared EN/AR text.
  if (tLedger.has(code)) return tLedger(code)
  switch (code) {
    case 'TRANSITION_REASON_REQUIRED':
      return t('transition.errors.reasonRequired')
    case 'FALLBACK_CLASSIFICATION_REQUIRED':
      return t('transition.errors.fallbackRequired')
    case 'INVALID_FALLBACK_CLASSIFICATION':
      return t('transition.errors.invalidFallback')
    case 'ILLEGAL_TRANSITION':
      return t('transition.errors.illegalTransition')
    case 'PAYMENT_TRANSITION_RACE_DETECTED':
      return t('transition.errors.raceDetected')
    case 'IDEMPOTENCY_CONFLICT':
      return t('transition.errors.idempotencyConflict')
    case 'PAYMENT_NOT_FOUND':
      return t('transition.errors.notFound')
    case 'NOT_REAL_PAYMENT_LEG':
      return t('transition.errors.notRealPayment')
    default:
      return t('transition.failed')
  }
}
