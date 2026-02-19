'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import type { PaymentListItem } from '@/lib/types/payment';
import type { PaymentAuditEntry } from '@/lib/services/payment-audit.service';
import {
  updatePaymentNotesAction,
  cancelPaymentAction,
} from '@/app/actions/payments/payment-crud-actions';
import { RequirePermission } from '@features/auth/ui/RequirePermission';
import CancelPaymentDialog from '@features/billing/ui/cancel-payment-dialog';
import RefundPaymentDialog from '@features/billing/ui/refund-payment-dialog';

interface PaymentDetailClientProps {
  payment: PaymentListItem;
  auditEntries?: PaymentAuditEntry[];
  /** When set, back link goes to this invoice instead of payments list */
  returnToInvoiceId?: string;
}

export default function PaymentDetailClient({
  payment,
  auditEntries = [],
  returnToInvoiceId,
}: PaymentDetailClientProps) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const router = useRouter();

  // ---- Edit Notes State ----
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(payment.rec_notes || '');
  const [isSavingNotes, startSavingNotes] = useTransition();
  const [notesMessage, setNotesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---- Cancel Dialog State ----
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // ---- Refund Dialog State ----
  const [showRefundDialog, setShowRefundDialog] = useState(false);

  // ---- Formatters ----
  const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const fmtMoney = (val?: number) => (val != null ? val.toFixed(3) : '—');

  // ---- Status Badge ----
  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      refunded: 'bg-purple-100 text-purple-800',
      partially_refunded: 'bg-purple-100 text-purple-800',
    };
    return cls[status] ?? 'bg-gray-100 text-gray-800';
  };

  // ---- Handlers ----
  const handleSaveNotes = () => {
    setNotesMessage(null);
    startSavingNotes(async () => {
      const result = await updatePaymentNotesAction(payment.id, notesValue);
      if (result.success) {
        setNotesMessage({ type: 'success', text: t('editNotes.success') });
        setShowEditNotes(false);
        router.refresh();
      } else {
        setNotesMessage({ type: 'error', text: result.error || t('editNotes.error') });
      }
    });
  };

  const handleCancelSuccess = () => {
    setShowCancelDialog(false);
    router.refresh();
  };

  const handleRefundSuccess = () => {
    setShowRefundDialog(false);
    router.refresh();
  };

  const isCancelledOrRefunded =
    payment.status === 'cancelled' || payment.status === 'refunded';
  const hasRefunds = payment.hasRefunds === true;
  const kind = (payment.metadata as Record<string, unknown>)?.kind as string | undefined;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={
            returnToInvoiceId
              ? `/dashboard/billing/invoices/${returnToInvoiceId}`
              : '/dashboard/billing/payments'
          }
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr;{' '}
          {returnToInvoiceId
            ? t('detail.backToInvoice')
            : t('detail.backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('detail.title')}</h1>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(payment.status)}`}
        >
          {t(`statuses.${payment.status}`)}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column (col-span-2) */}
        <div className="space-y-6 md:col-span-2">
          {/* Payment Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.paymentSummary')}
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">{t('detail.paymentId')}</dt>
                <dd className="font-mono text-xs font-medium text-gray-900">
                  {payment.id.slice(0, 8)}...
                </dd>
              </div>
              {payment.transaction_id && (
                <div>
                  <dt className="text-gray-500">{t('detail.transactionId')}</dt>
                  <dd className="font-mono text-xs font-medium text-gray-900">
                    {payment.transaction_id}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">{t('detail.method')}</dt>
                <dd className="font-medium text-gray-900">
                  {payment.paymentMethodName || payment.payment_method_code}
                </dd>
              </div>
              {payment.paymentTypeName && (
                <div>
                  <dt className="text-gray-500">{t('detail.type')}</dt>
                  <dd className="font-medium text-gray-900">{payment.paymentTypeName}</dd>
                </div>
              )}
              {kind && (
                <div>
                  <dt className="text-gray-500">{t('detail.kind')}</dt>
                  <dd className="font-medium text-gray-900">{t(`kinds.${kind}`)}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">{t('detail.currency')}</dt>
                <dd className="font-medium text-gray-900">{payment.currency_code}</dd>
              </div>
              {payment.currency_ex_rate != null && payment.currency_ex_rate !== 1 && (
                <div>
                  <dt className="text-gray-500">{t('detail.exchangeRate')}</dt>
                  <dd className="font-medium text-gray-900">{payment.currency_ex_rate.toFixed(6)}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">{t('detail.paidAt')}</dt>
                <dd className="font-medium text-gray-900">{fmtDate(payment.paid_at)}</dd>
              </div>
              {payment.paid_by && (
                <div>
                  <dt className="text-gray-500">{t('detail.paidBy')}</dt>
                  <dd className="font-medium text-gray-900">{payment.paid_by}</dd>
                </div>
              )}
              {payment.gateway && (
                <div>
                  <dt className="text-gray-500">{t('detail.gateway')}</dt>
                  <dd className="font-medium text-gray-900">{payment.gateway}</dd>
                </div>
              )}
              {payment.payment_channel && (
                <div>
                  <dt className="text-gray-500">{t('detail.channel')}</dt>
                  <dd className="font-medium text-gray-900">{payment.payment_channel}</dd>
                </div>
              )}
              {payment.trans_desc && (
                <div className="col-span-2">
                  <dt className="text-gray-500">{t('detail.transDesc')}</dt>
                  <dd className="font-medium text-gray-900">{payment.trans_desc}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Amount Breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.amountBreakdown')}
            </h2>
            <div className="space-y-2 text-sm">
              {payment.subtotal != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('detail.subtotal')}</span>
                  <span className="font-medium text-gray-900">
                    {fmtMoney(payment.subtotal)} {payment.currency_code}
                  </span>
                </div>
              )}
              {payment.discount_amount != null && payment.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('detail.discount')}</span>
                  <span className="font-medium text-red-600">
                    -{fmtMoney(payment.discount_amount)} {payment.currency_code}
                  </span>
                </div>
              )}
              {payment.tax != null && payment.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('detail.tax')}</span>
                  <span className="font-medium text-gray-900">
                    {fmtMoney(payment.tax)} {payment.currency_code}
                  </span>
                </div>
              )}
              {payment.vat != null && payment.vat > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('detail.vat')}</span>
                  <span className="font-medium text-gray-900">
                    {fmtMoney(payment.vat)} {payment.currency_code}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">{t('detail.total')}</span>
                <span className="font-bold text-gray-900">
                  {fmtMoney(payment.paid_amount)} {payment.currency_code}
                </span>
              </div>
            </div>
          </div>

          {/* Related Entities */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.relatedEntities')}
            </h2>
            <dl className="space-y-3 text-sm">
              {payment.customerName && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">{t('detail.customer')}</dt>
                  <dd>
                    {payment.customer_id ? (
                      <Link
                        href={`/dashboard/customers/${payment.customer_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {payment.customerName}
                      </Link>
                    ) : (
                      <span className="text-gray-900">{payment.customerName}</span>
                    )}
                  </dd>
                </div>
              )}
              {payment.orderReference && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">{t('detail.order')}</dt>
                  <dd>
                    <Link
                      href={`/dashboard/orders/${payment.order_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {payment.orderReference}
                    </Link>
                  </dd>
                </div>
              )}
              {payment.invoiceNumber && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">{t('detail.invoice')}</dt>
                  <dd>
                    <Link
                      href={`/dashboard/billing/invoices/${payment.invoice_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {payment.invoiceNumber}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Check Details (conditional) */}
          {(payment.check_number || payment.check_bank || payment.check_date) && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t('detail.checkDetails')}
              </h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {payment.check_number && (
                  <div>
                    <dt className="text-gray-500">{t('detail.checkNumber')}</dt>
                    <dd className="font-medium text-gray-900">{payment.check_number}</dd>
                  </div>
                )}
                {payment.check_bank && (
                  <div>
                    <dt className="text-gray-500">{t('detail.checkBank')}</dt>
                    <dd className="font-medium text-gray-900">{payment.check_bank}</dd>
                  </div>
                )}
                {payment.check_date && (
                  <div>
                    <dt className="text-gray-500">{t('detail.checkDate')}</dt>
                    <dd className="font-medium text-gray-900">{fmtDate(payment.check_date)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.quickActions')}
            </h2>
            <div className="space-y-3">
              {/* Edit Notes Button */}
              {!isCancelledOrRefunded && (
                <button
                  onClick={() => {
                    setShowEditNotes(true);
                    setNotesMessage(null);
                  }}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('editNotes.title')}
                </button>
              )}

              {/* Cancel Payment Button (permission-gated; hidden if already refunded) */}
              {!isCancelledOrRefunded && !hasRefunds && (
                <RequirePermission resource="payments" action="cancel">
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    {t('cancel.title')}
                  </button>
                </RequirePermission>
              )}

              {/* Refund Payment Button (permission-gated, only for completed payments with amount > 0) */}
              {payment.status === 'completed' && payment.paid_amount > 0 && (
                <RequirePermission resource="payments" action="refund">
                  <button
                    onClick={() => setShowRefundDialog(true)}
                    className="w-full rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    {t('refund.title')}
                  </button>
                </RequirePermission>
              )}

              {/* Print Receipt Voucher Button */}
              {payment.status === 'completed' && payment.paid_amount > 0 && (
                <Link
                  href={`/dashboard/billing/payments/${payment.id}/print/receipt-voucher`}
                  target="_blank"
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="h-4 w-4" />
                  {t('printReceiptVoucher') ?? 'Print Receipt Voucher'}
                </Link>
              )}
            </div>

            {/* Notes display */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h3 className="mb-1 text-sm font-medium text-gray-500">{t('detail.notes')}</h3>
              <p className="text-sm text-gray-900">
                {payment.rec_notes || t('detail.noNotes')}
              </p>
            </div>
          </div>

          {/* Audit History */}
          {auditEntries.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t('audit.title')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">{t('audit.changedAt')}</th>
                      <th className="py-2 pr-4">{t('audit.action')}</th>
                      <th className="py-2 pr-4">{t('audit.changedBy')}</th>
                      <th className="py-2">{t('audit.summary')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium text-gray-900">
                          {fmtDate(entry.changed_at)}
                        </td>
                        <td className="py-2 pr-4">
                          {entry.action_type === 'CREATED'
                            ? t('audit.actionCreated')
                            : entry.action_type === 'CANCELLED'
                              ? t('audit.actionCancelled')
                              : entry.action_type === 'REFUNDED'
                                ? t('audit.actionRefunded')
                                : entry.action_type === 'NOTES_UPDATED'
                                  ? t('audit.actionNotesUpdated')
                                  : entry.action_type}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {entry.changed_by || '—'}
                        </td>
                        <td className="py-2 text-gray-600">
                          {entry.action_type === 'NOTES_UPDATED' &&
                          entry.before_value &&
                          entry.after_value &&
                          'rec_notes' in entry.before_value &&
                          'rec_notes' in entry.after_value
                            ? `${t('audit.before')}: ${String((entry.before_value as { rec_notes?: string }).rec_notes || '—')} → ${t('audit.after')}: ${String((entry.after_value as { rec_notes?: string }).rec_notes || '—')}`
                            : entry.action_type === 'REFUNDED' && entry.after_value && 'refund_amount' in entry.after_value
                              ? `${t('audit.refundAmount')}: ${Number((entry.after_value as { refund_amount?: number }).refund_amount)}`
                              : entry.action_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.auditInfo')}
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('detail.createdAt')}</dt>
                <dd className="font-medium text-gray-900">{fmtDate(payment.created_at)}</dd>
              </div>
              {payment.created_by && (
                <div>
                  <dt className="text-gray-500">{t('detail.createdBy')}</dt>
                  <dd className="font-medium text-gray-900">{payment.created_by}</dd>
                </div>
              )}
              {payment.updated_at && (
                <div>
                  <dt className="text-gray-500">{t('detail.updatedAt')}</dt>
                  <dd className="font-medium text-gray-900">{fmtDate(payment.updated_at)}</dd>
                </div>
              )}
              {payment.updated_by && (
                <div>
                  <dt className="text-gray-500">{t('detail.updatedBy')}</dt>
                  <dd className="font-medium text-gray-900">{payment.updated_by}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Edit Notes Dialog */}
      {showEditNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t('editNotes.title')}
            </h3>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder={t('editNotes.placeholder')}
              rows={4}
              maxLength={1000}
              className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {notesMessage && (
              <p
                className={`mt-2 text-sm ${
                  notesMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {notesMessage.text}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditNotes(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('editNotes.cancel')}
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingNotes ? t('editNotes.saving') : t('editNotes.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Payment Dialog */}
      {showCancelDialog && (
        <CancelPaymentDialog
          paymentId={payment.id}
          onClose={() => setShowCancelDialog(false)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {/* Refund Payment Dialog */}
      {showRefundDialog && (
        <RefundPaymentDialog
          paymentId={payment.id}
          maxAmount={payment.paid_amount}
          currencyCode={payment.currency_code}
          onClose={() => setShowRefundDialog(false)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
}
