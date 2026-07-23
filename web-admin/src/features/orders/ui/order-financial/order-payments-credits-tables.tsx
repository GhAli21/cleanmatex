'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Badge } from '@ui/primitives/badge';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import { useMessage } from '@ui/feedback';
import { useFeature } from '@features/auth/ui/RequireFeature';
import { RefundInitiateDialog } from './refund-initiate-dialog';
import { PaymentTransitionDialog, type PaymentTransitionActionKind } from '@features/billing/ui/payment-transition-dialog';
import type {
  OrderFinancialSummaryViewModel,
} from '@features/orders/model/order-financial-summary-view';
import type { OrderPaymentRow } from '@/lib/services/order-financial-summary.service';
import { OrderFinancialMoneyValue } from './order-financial-money-value';
import { CREDIT_APPLICATION_STATUSES } from '@/lib/constants/order-financial';

interface OrderPaymentsCreditsTablesProps {
  viewModel: OrderFinancialSummaryViewModel;
}

function paymentStatusVariant(
  status: string | null,
): 'success' | 'warning' | 'destructive' | 'secondary' | 'info' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
    case 'PROCESSING':
      return 'warning';
    case 'FAILED':
      return 'destructive';
    case 'REFUNDED':
      return 'info';
    default:
      return 'secondary';
  }
}

/**
 *
 * @param root0
 * @param root0.viewModel
 */
export function OrderPaymentsCreditsTables({ viewModel }: OrderPaymentsCreditsTablesProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  // BVM Phase 6 Sub-item 1: gate the Verify column on the dedicated
  // `orders:verify_payment` permission seeded by migration 0332. The
  // header is rendered for every viewer but the per-row CmxButton is
  // hidden when the viewer lacks the right — keeps column alignment
  // stable across roles and removes the action surface for operators.
  const canVerifyPayment = useHasPermission('orders', 'verify_payment');
  // B30: cancel/fail-bounce back-office actions on a PENDING/PROCESSING leg.
  const canCancelPayment = useHasPermission('orders', 'cancel_payment');
  const canFailPayment = useHasPermission('orders', 'fail_payment');
  // B34: the initiate-refund action ships behind the order_fin_refund_ui flag
  // (disabled by default in every environment — Safety block) and the
  // existing orders:process_refund permission. Server enforcement remains
  // authoritative; this only reveals the entry point.
  const refundUiEnabled = useFeature('order_fin_refund_ui');
  const canInitiateRefund = useHasPermission('orders', 'process_refund');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const { payments, creditApplications, refunds, currencyCode, orderId } = viewModel;
  const th = `px-3 py-2 text-xs font-semibold uppercase text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`;
  const td = `px-3 py-2 text-sm ${isRTL ? 'text-right' : 'text-left'}`;

  return (
    <div className="space-y-6">
      <CmxCard>
        <CmxCardHeader className="flex-row items-center justify-between space-y-0">
          <CmxCardTitle>{t('realPaymentsTable')}</CmxCardTitle>
          {refundUiEnabled && canInitiateRefund && (
            <CmxButton size="sm" variant="outline" onClick={() => setRefundDialogOpen(true)}>
              {t('refunds.initiate.openButton')}
            </CmxButton>
          )}
        </CmxCardHeader>
        <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={th}>{t('col.method')}</th>
                <th className={`${th} ${isRTL ? 'text-left' : 'text-right'}`}>{t('col.amount')}</th>
                <th className={th}>{t('col.status')}</th>
                <th className={th}>{t('col.voucher')}</th>
                <th className={th}>{t('col.reference')}</th>
                <th className={th}>{t('col.date')}</th>
                <th className={th}>{t('col.verify')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${td} py-8 text-muted-foreground`}>
                    {t('none')}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    orderId={orderId}
                    currencyCode={currencyCode}
                    canVerifyPayment={canVerifyPayment}
                    canCancelPayment={canCancelPayment}
                    canFailPayment={canFailPayment}
                    td={td}
                    isRTL={isRTL}
                  />
                ))
              )}
            </tbody>
          </table>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('creditApplicationsTable')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={th}>{t('col.creditType')}</th>
                <th className={`${th} ${isRTL ? 'text-left' : 'text-right'}`}>{t('col.amount')}</th>
                <th className={th}>{t('col.applicationStatus')}</th>
                <th className={th}>{t('col.reference')}</th>
                <th className={th}>{t('col.voucher')}</th>
                <th className={th}>{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {creditApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${td} py-8 text-muted-foreground`}>
                    {t('none')}
                  </td>
                </tr>
              ) : (
                creditApplications.map((c) => {
                  const appStatus = c.application_status ?? CREDIT_APPLICATION_STATUSES.APPLIED;
                  const statusVariant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' =
                    appStatus === CREDIT_APPLICATION_STATUSES.APPLIED ? 'success'
                    : appStatus === CREDIT_APPLICATION_STATUSES.PENDING
                      || appStatus === CREDIT_APPLICATION_STATUSES.RESERVED
                      || appStatus === CREDIT_APPLICATION_STATUSES.PROCESSING ? 'warning'
                    : appStatus === CREDIT_APPLICATION_STATUSES.FAILED
                      || appStatus === CREDIT_APPLICATION_STATUSES.CANCELLED
                      || appStatus === CREDIT_APPLICATION_STATUSES.EXPIRED ? 'destructive'
                    : appStatus === CREDIT_APPLICATION_STATUSES.REVERSED ? 'info'
                    : 'secondary';
                  return (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className={td}>{c.credit_type.replace(/_/g, ' ')}</td>
                      <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
                        <OrderFinancialMoneyValue
                          amount={c.applied_amount}
                          currencyCode={currencyCode}
                          variant="credit"
                        />
                      </td>
                      <td className={td}>
                        <Badge variant={statusVariant}>
                          {t(`creditApp.status.${appStatus.toLowerCase()}`)}
                        </Badge>
                      </td>
                      <td className={td}>{c.reference_no ?? '—'}</td>
                      <td className={td}>
                        {c.fin_voucher_id ? (
                          <Link
                            href={`/dashboard/internal_fin/vouchers/${c.fin_voucher_id}`}
                            className="text-primary hover:underline"
                          >
                            {t('openVoucher')}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={td}>{new Date(c.applied_at).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CmxCardContent>
      </CmxCard>

      {refunds.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('refundsTable')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={th}>{t('col.reference')}</th>
                  <th className={`${th} ${isRTL ? 'text-left' : 'text-right'}`}>{t('col.amount')}</th>
                  <th className={th}>{t('col.sourceType')}</th>
                  <th className={th}>{t('col.context')}</th>
                  <th className={th}>{t('col.method')}</th>
                  <th className={th}>{t('col.reopensDue')}</th>
                  <th className={th}>{t('col.status')}</th>
                  <th className={th}>{t('col.date')}</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className={td}>{r.refund_no ?? '—'}</td>
                    <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
                      <OrderFinancialMoneyValue
                        amount={r.refund_amount}
                        currencyCode={r.currency_code ?? currencyCode}
                        variant="credit"
                      />
                    </td>
                    <td className={td}>
                      {r.refund_source_type
                        ? t(`refunds.sourceTypeLabels.${r.refund_source_type}`)
                        : '—'}
                    </td>
                    <td className={td}>
                      {r.refund_context
                        ? t(`refunds.contextLabels.${r.refund_context}`)
                        : '—'}
                    </td>
                    <td className={td}>{r.refund_method_code?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
                      {r.reopens_due_amount > 0 ? (
                        <OrderFinancialMoneyValue
                          amount={r.reopens_due_amount}
                          currencyCode={r.currency_code ?? currencyCode}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{r.refund_status ?? '—'}</td>
                    <td className={td}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CmxCardContent>
        </CmxCard>
      )}

      {refundUiEnabled && canInitiateRefund && (
        <RefundInitiateDialog
          orderId={orderId}
          currencyCode={currencyCode}
          payments={payments}
          creditApplications={creditApplications}
          refunds={refunds}
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
        />
      )}
    </div>
  );
}

// ─── Per-row component ──────────────────────────────────────────────────────
// Each row owns its own dialog + verifying state so concurrent rows don't
// share local UI state. Rendered as a separate sub-component so React keeps
// per-row state stable across viewModel refreshes.

interface PaymentRowProps {
  payment: OrderPaymentRow;
  orderId: string;
  currencyCode: string;
  canVerifyPayment: boolean;
  canCancelPayment: boolean;
  canFailPayment: boolean;
  td: string;
  isRTL: boolean;
}

function PaymentRow({
  payment,
  orderId,
  currencyCode,
  canVerifyPayment,
  canCancelPayment,
  canFailPayment,
  td,
  isRTL,
}: PaymentRowProps) {
  const t = useTranslations('orders.detail.financial');
  const router = useRouter();
  const { token: csrfToken } = useCSRFToken();
  const { showSuccess, showError } = useMessage();
  const [open, setOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // B30: cancel/fail-bounce reuse the shared back-office transition dialog.
  const [transitionAction, setTransitionAction] = useState<PaymentTransitionActionKind | null>(null);

  const methodLabel = payment.payment_method_code?.replace(/_/g, ' ') ?? '—';
  const isRealPayment = payment.payment_nature_snapshot === 'REAL_PAYMENT';
  const isTransitionable =
    isRealPayment && (payment.payment_status === 'PENDING' || payment.payment_status === 'PROCESSING');
  const canShowVerifyAction =
    canVerifyPayment && isRealPayment && payment.payment_status === 'PENDING';

  async function handleConfirm() {
    setVerifying(true);
    try {
      const response = await fetch(
        `/api/v1/orders/${orderId}/payments/${payment.id}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getCSRFHeader(csrfToken),
          },
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        const message =
          (json && typeof json.error === 'string' && json.error) ||
          response.statusText ||
          'Unknown error';
        showError(t('verify.errorToast', { error: message }));
        return;
      }
      showSuccess(t('verify.successToast'));
      setOpen(false);
      // Re-fetch the order detail server data so the row flips to
      // COMPLETED and the outstanding amount in the header refreshes.
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      showError(t('verify.errorToast', { error: message }));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <tr className="border-b border-border/60">
      <td className={td}>{methodLabel}</td>
      <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
        <OrderFinancialMoneyValue amount={payment.amount} currencyCode={currencyCode} />
      </td>
      <td className={td}>
        <Badge variant={paymentStatusVariant(payment.payment_status)}>
          {payment.payment_status ?? '—'}
        </Badge>
      </td>
      <td className={td}>
        {payment.fin_voucher_id ? (
          <Link
            href={`/dashboard/internal_fin/vouchers/${payment.fin_voucher_id}`}
            className="text-primary hover:underline"
          >
            {t('openVoucher')}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className={td}>{payment.gateway_reference ?? '—'}</td>
      <td className={td}>{new Date(payment.created_at).toLocaleString()}</td>
      <td className={td}>
        {payment.payment_status === 'COMPLETED' ? (
          <Badge variant="success">{t('verify.verified')}</Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {canShowVerifyAction ? (
              <>
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(true)}
                  disabled={verifying}
                  aria-label={t('verify.action')}
                >
                  {t('verify.action')}
                </CmxButton>
                <CmxDialog open={open} onOpenChange={(v) => !verifying && setOpen(v)}>
                  <CmxDialogContent>
                    <CmxDialogHeader>
                      <CmxDialogTitle>{t('verify.confirmTitle')}</CmxDialogTitle>
                      <CmxDialogDescription>
                        {t('verify.confirmBody', {
                          method: methodLabel,
                          amount: new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: currencyCode,
                          }).format(payment.amount),
                        })}
                      </CmxDialogDescription>
                    </CmxDialogHeader>
                    <CmxDialogFooter>
                      <CmxButton
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        disabled={verifying}
                      >
                        {t('verify.cancel')}
                      </CmxButton>
                      <CmxButton
                        variant="primary"
                        onClick={handleConfirm}
                        loading={verifying}
                      >
                        {verifying ? t('verify.verifying') : t('verify.confirmCta')}
                      </CmxButton>
                    </CmxDialogFooter>
                  </CmxDialogContent>
                </CmxDialog>
              </>
            ) : payment.payment_status === 'PENDING' ? (
              <Badge variant="warning">{t('verify.unverified')}</Badge>
            ) : payment.payment_status === 'PROCESSING' ? (
              <Badge variant="info">{payment.payment_status}</Badge>
            ) : null}
            {isTransitionable && canFailPayment ? (
              <CmxButton variant="outline" size="sm" onClick={() => setTransitionAction('FAIL_BOUNCE')}>
                {t('transitions.failBounce')}
              </CmxButton>
            ) : null}
            {isTransitionable && canCancelPayment ? (
              <CmxButton variant="destructive" size="sm" onClick={() => setTransitionAction('CANCEL')}>
                {t('transitions.cancel')}
              </CmxButton>
            ) : null}
            {!isTransitionable && !canShowVerifyAction ? (
              <span className="text-muted-foreground">—</span>
            ) : null}
          </div>
        )}
        {transitionAction ? (
          <PaymentTransitionDialog
            open
            onOpenChange={(next) => { if (!next) setTransitionAction(null); }}
            orderId={orderId}
            paymentId={payment.id}
            action={transitionAction}
            onTransitioned={() => { setTransitionAction(null); router.refresh(); }}
          />
        ) : null}
      </td>
    </tr>
  );
}
