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

interface OpenCashDrawerSessionOption {
  sessionId: string
  drawerName: string
  sessionNo: string
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
 * decision to record). REVERSE additionally requires an OPEN cash-drawer
 * session when `paymentMethodCode` is cash-family, so the compensating OUT
 * movement has somewhere to land.
 */
export function PaymentTransitionDialog({
  open,
  onOpenChange,
  orderId,
  paymentId,
  action,
  paymentMethodCode,
  onTransitioned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  paymentId: string
  action: PaymentTransitionActionKind
  /** Required to decide whether REVERSE needs a cash-drawer session picker. Omit for VERIFY/CANCEL/FAIL_BOUNCE/VOID. */
  paymentMethodCode?: string
  onTransitioned: () => void
}) {
  const t = useTranslations('billing.pendingPayments')
  const tCommon = useTranslations('common')
  const { token: csrfToken } = useCSRFToken()
  const [reason, setReason] = useState('')
  const [fallbackClassification, setFallbackClassification] = useState('')
  const [cashDrawerSessionId, setCashDrawerSessionId] = useState('')
  const [cashDrawerSessions, setCashDrawerSessions] = useState<OpenCashDrawerSessionOption[]>([])
  const [cashDrawerSessionsLoading, setCashDrawerSessionsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // D010: stable per-dialog-open idempotency key — a network retry of this
  // same attempt reuses it (server replays the original result); reopening
  // the dialog for a fresh attempt gets a new key.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  const isReverseCashLeg =
    action === 'REVERSE' && paymentMethodCode?.trim().toUpperCase() === PAYMENT_METHODS.CASH

  useEffect(() => {
    if (!open) return
    setReason('')
    setFallbackClassification('')
    setCashDrawerSessionId('')
    setIdempotencyKey(crypto.randomUUID())
  }, [open, paymentId, action])

  useEffect(() => {
    if (!open || !isReverseCashLeg) {
      setCashDrawerSessions([])
      return
    }
    let cancelled = false
    setCashDrawerSessionsLoading(true)
    fetch('/api/v1/cash-drawers')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return
        const options: OpenCashDrawerSessionOption[] = (json.data ?? [])
          .filter((drawer: { currentSession: { id: string } | null }) => drawer.currentSession)
          .map((drawer: { drawer_name: string; currentSession: { id: string; session_no: string } }) => ({
            sessionId: drawer.currentSession!.id,
            drawerName: drawer.drawer_name,
            sessionNo: drawer.currentSession!.session_no,
          }))
        setCashDrawerSessions(options)
        if (options.length === 1) setCashDrawerSessionId(options[0].sessionId)
      })
      .catch(() => { /* handled by the blocking-message fallback below */ })
      .finally(() => { if (!cancelled) setCashDrawerSessionsLoading(false) })
    return () => { cancelled = true }
  }, [open, isReverseCashLeg])

  const requiresReason = !NO_REASON_ACTIONS.has(action)
  const requiresFallback = ACTIONS_REQUIRING_FALLBACK.has(action)
  const canSubmit =
    (!requiresReason || reason.trim().length > 0) &&
    (!requiresFallback || fallbackClassification.length > 0) &&
    (!isReverseCashLeg || cashDrawerSessionId.length > 0)
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
          cashDrawerSessionId: isReverseCashLeg ? cashDrawerSessionId : undefined,
          idempotencyKey,
        }),
      })
      const json = await res.json()
      if (json.success) {
        cmxMessage.success(t(`transition.${actionKey}Success`))
        close()
        onTransitioned()
      } else {
        cmxMessage.error(mapTransitionError(json.error, t))
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
          {isReverseCashLeg ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {t('transition.cashDrawerSessionLabel')}
              </label>
              {cashDrawerSessionsLoading ? (
                <p className="text-xs text-muted-foreground">{t('transition.cashDrawerSessionLoading')}</p>
              ) : cashDrawerSessions.length === 0 ? (
                <p className="text-xs text-destructive">{t('transition.cashDrawerSessionNoneOpen')}</p>
              ) : (
                <CmxSelectDropdown value={cashDrawerSessionId} onValueChange={setCashDrawerSessionId}>
                  <CmxSelectDropdownTrigger className="w-full text-sm">
                    {cashDrawerSessionId
                      ? cashDrawerSessions.find((s) => s.sessionId === cashDrawerSessionId)?.drawerName
                      : t('transition.cashDrawerSessionPlaceholder')}
                  </CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {cashDrawerSessions.map((s) => (
                      <CmxSelectDropdownItem key={s.sessionId} value={s.sessionId}>
                        {s.drawerName} — {s.sessionNo}
                      </CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              )}
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
function mapTransitionError(code: string, t: (key: string) => string): string {
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
    case 'CASH_DRAWER_SESSION_REQUIRED':
      return t('transition.errors.cashDrawerSessionRequired')
    case 'CASH_DRAWER_SESSION_NOT_OPEN':
      return t('transition.errors.cashDrawerSessionNotOpen')
    case 'PAYMENT_NOT_FOUND':
      return t('transition.errors.notFound')
    case 'NOT_REAL_PAYMENT_LEG':
      return t('transition.errors.notRealPayment')
    default:
      return t('transition.failed')
  }
}
