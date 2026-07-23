'use client';

/**
 * B34 — Initiate Refund dialog (order Financial tab).
 *
 * Collects the D002 v2 inputs — source leg (lineage), amount with live
 * remaining-cap display, destination, reason-code, reason_context, and note —
 * and submits them with a per-attempt idempotency key (B01 §12). The UI never
 * picks the classification: it sends lineage + context and the refund service
 * derives `refund_source_type`.
 *
 * Availability: rendered only behind the `order_fin_refund_ui` feature flag +
 * `orders:process_refund` permission (see order-payments-credits-tables.tsx).
 * REFUND_AND_REBILL / MANUAL_EXCEPTION are intentionally not offered pre-B27.
 * CASH / ORIGINAL_METHOD destinations are labeled record-only until B09.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { CmxButton, CmxMoneyField, CmxTextarea, Label, Alert, AlertDescription } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { useMessage } from '@ui/feedback';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useFeature } from '@features/auth/ui/RequireFeature';
import {
  REFUND_CONTEXTS,
  REFUND_METHODS,
  REFUND_REASON_CODES,
  type RefundContext,
} from '@/lib/constants/order-financial';
import type {
  OrderCreditApplicationRow,
  OrderPaymentRow,
  OrderRefundRow,
} from '@/lib/services/order-financial-summary.service';
import {
  REFUND_UI_CONTEXTS,
  computeRefundLegOptions,
  createRefundAttemptKey,
  validateRefundInitiate,
  type RefundLegOption,
} from '@features/orders/model/refund-initiate';

const GOODWILL_LEG_KEY = 'GOODWILL';

interface RefundInitiateDialogProps {
  orderId: string;
  currencyCode: string;
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * @param props see {@link RefundInitiateDialogProps}
 */
export function RefundInitiateDialog({
  orderId,
  currencyCode,
  payments,
  creditApplications,
  refunds,
  open,
  onOpenChange,
}: RefundInitiateDialogProps) {
  const t = useTranslations('orders.detail.financial.refunds.initiate');
  const tErrors = useTranslations('orders.detail.financial.refunds.errors');
  const router = useRouter();
  const { showSuccess } = useMessage();
  const { token: csrfToken } = useCSRFToken();

  const { legs, overallRemaining } = useMemo(
    () => computeRefundLegOptions({ payments, creditApplications, refunds }),
    [payments, creditApplications, refunds],
  );

  const [legKey, setLegKey] = useState<string>('');
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<string>(REFUND_METHODS.WALLET);
  const [reasonCode, setReasonCode] = useState<string>(REFUND_REASON_CODES.OTHER);
  const [refundContext, setRefundContext] = useState<RefundContext>(REFUND_CONTEXTS.STANDARD);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // One idempotency key per dialog attempt (B01 §12): a retry of the same
  // submission replays server-side instead of creating a second refund.
  const [attemptKey, setAttemptKey] = useState(createRefundAttemptKey);

  const selectedLeg: RefundLegOption | null =
    legKey && legKey !== GOODWILL_LEG_KEY
      ? legs.find((leg) => `${leg.kind}:${leg.id}` === legKey) ?? null
      : null;
  const isGoodwill = legKey === GOODWILL_LEG_KEY;

  const validation = validateRefundInitiate({
    amount: amount ?? 0,
    selectedLeg,
    overallRemaining,
    notes,
  });
  const legMissing = legKey === '';
  const capHint = selectedLeg ? selectedLeg.remaining : overallRemaining;

  function resetAndClose(nextOpen: boolean) {
    if (!nextOpen) {
      setLegKey('');
      setAmount(null);
      setMethod(REFUND_METHODS.WALLET);
      setReasonCode(REFUND_REASON_CODES.OTHER);
      setRefundContext(REFUND_CONTEXTS.STANDARD);
      setNotes('');
      setServerError(null);
      setAttemptKey(createRefundAttemptKey());
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (submitting || legMissing || !validation.valid) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify({
          amount,
          reason: reasonCode,
          method,
          refundContext,
          notes: notes.trim() || undefined,
          currencyCode,
          originalPaymentId: selectedLeg?.kind === 'PAYMENT' ? selectedLeg.id : undefined,
          originalCreditAppId: selectedLeg?.kind === 'CREDIT_APP' ? selectedLeg.id : undefined,
          idempotencyKey: attemptKey,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; code?: string }
        | null;
      if (!response.ok || !payload?.success) {
        const code = payload?.code;
        setServerError(
          code ? tErrors(code as never) : payload?.error ?? t('errors.submitFailed'),
        );
        return;
      }
      showSuccess(t('success'));
      resetAndClose(false);
      router.refresh();
    } catch {
      setServerError(t('errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // B9: once order_fin_refund_execution is ON, CASH/ORIGINAL_METHOD are no
  // longer record-only — the accountant completes real execution (drawer
  // cash-out or a manual-settlement reference) at the Process step.
  const refundExecutionEnabled = useFeature('order_fin_refund_execution');
  const isRecordOnlyDestination =
    !refundExecutionEnabled &&
    (method === REFUND_METHODS.CASH || method === REFUND_METHODS.ORIGINAL_METHOD);

  return (
    <CmxDialog open={open} onOpenChange={resetAndClose}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          <CmxDialogDescription>{t('description')}</CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="refund-leg">{t('sourceLeg')}</Label>
            <CmxSelectDropdown value={legKey} onValueChange={setLegKey}>
              <CmxSelectDropdownTrigger id="refund-leg">
                <CmxSelectDropdownValue placeholder={t('sourceLegPlaceholder')} />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {legs.map((leg) => (
                  <CmxSelectDropdownItem
                    key={`${leg.kind}:${leg.id}`}
                    value={`${leg.kind}:${leg.id}`}
                    disabled={leg.remaining <= 0}
                  >
                    {t(leg.kind === 'PAYMENT' ? 'paymentLeg' : 'creditLeg', {
                      code: leg.code,
                      remaining: leg.remaining,
                      currency: currencyCode,
                    })}
                  </CmxSelectDropdownItem>
                ))}
                <CmxSelectDropdownItem value={GOODWILL_LEG_KEY}>
                  {t('goodwillLeg')}
                </CmxSelectDropdownItem>
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
            {isGoodwill && (
              <p className="text-xs text-muted-foreground">{t('goodwillHint')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">{t('amount')}</Label>
            <CmxMoneyField
              id="refund-amount"
              value={amount}
              onValueChange={(value) => setAmount(value)}
              aria-describedby="refund-amount-cap"
            />
            <p id="refund-amount-cap" className="text-xs text-muted-foreground">
              {t('capHint', { remaining: capHint, currency: currencyCode })}
            </p>
            {!validation.valid && validation.errorKey && amount != null && (
              <p className="text-xs text-destructive" role="alert">
                {t(`errors.${validation.errorKey}`)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="refund-method">{t('destination')}</Label>
              <CmxSelectDropdown value={method} onValueChange={setMethod}>
                <CmxSelectDropdownTrigger id="refund-method">
                  <CmxSelectDropdownValue />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {Object.values(REFUND_METHODS).map((code) => (
                    <CmxSelectDropdownItem key={code} value={code}>
                      {t(`destinations.${code}`)}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
              {isRecordOnlyDestination && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t('recordOnlyHint')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-context">{t('context')}</Label>
              <CmxSelectDropdown
                value={refundContext}
                onValueChange={(value) => setRefundContext(value as RefundContext)}
              >
                <CmxSelectDropdownTrigger id="refund-context">
                  <CmxSelectDropdownValue />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {REFUND_UI_CONTEXTS.map((code) => (
                    <CmxSelectDropdownItem key={code} value={code}>
                      {t(`contexts.${code}`)}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason-code">{t('reasonCode')}</Label>
            <CmxSelectDropdown value={reasonCode} onValueChange={setReasonCode}>
              <CmxSelectDropdownTrigger id="refund-reason-code">
                <CmxSelectDropdownValue />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(REFUND_REASON_CODES).map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>
                    {t(`reasonCodes.${code}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-notes">
              {isGoodwill ? t('reasonRequired') : t('reasonOptional')}
            </Label>
            <CmxTextarea
              id="refund-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              aria-required={isGoodwill}
            />
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => resetAndClose(false)} disabled={submitting}>
            {t('cancel')}
          </CmxButton>
          <CmxButton
            onClick={handleSubmit}
            disabled={submitting || legMissing || !validation.valid}
          >
            {submitting ? t('submitting') : t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
