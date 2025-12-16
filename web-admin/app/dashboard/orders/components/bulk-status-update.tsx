'use client';

import { useState } from 'react';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META } from '@/lib/types/workflow';

interface BulkStatusUpdateProps {
  selectedOrderIds: string[];
  onComplete: () => void;
  onCancel: () => void;
}

interface BulkUpdateResult {
  success: boolean;
  results: {
    orderId: string;
    success: boolean;
    error?: string;
  }[];
}

export function BulkStatusUpdate({
  selectedOrderIds,
  onComplete,
  onCancel,
}: BulkStatusUpdateProps) {
  const t = useTranslations('orders.bulkStatusUpdate');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<BulkUpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableStatuses: OrderStatus[] = [
    'DRAFT',
    'INTAKE',
    'PREPARATION',
    'SORTING',
    'WASHING',
    'DRYING',
    'FINISHING',
    'ASSEMBLY',
    'QA',
    'PACKING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CLOSED',
  ];

  const handleSubmit = async () => {
    if (!selectedStatus) {
      setError(t('errors.selectStatus'));
      return;
    }

    if (selectedOrderIds.length === 0) {
      setError(t('errors.noOrdersSelected'));
      return;
    }

    if (selectedOrderIds.length > 100) {
      setError(t('errors.tooManyOrders'));
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          newStatus: selectedStatus,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('errors.updateFailed'));
      }

      setUpdateResult(data);
    } catch (err) {
      console.error('Error updating orders:', err);
      setError(err instanceof Error ? err.message : t('errors.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (updateResult?.success) {
      onComplete();
    } else {
      onCancel();
    }
  };

  const successCount = updateResult?.results.filter((r) => r.success).length || 0;
  const failureCount = updateResult?.results.filter((r) => !r.success).length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} border-b border-gray-200 p-6`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h2 className={`text-xl font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('title')}
            </h2>
            <p className={`mt-1 text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {selectedOrderIds.length === 1 
                ? t('subtitle', { count: selectedOrderIds.length })
                : t('subtitlePlural', { count: selectedOrderIds.length })}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={isUpdating}
            aria-label={tCommon('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {updateResult ? (
            // Results view
            <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="rounded-lg bg-green-50 p-4">
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <h3 className="font-medium text-green-900">
                      {t('results.updateComplete')}
                    </h3>
                    <p className="mt-1 text-sm text-green-700">
                      {failureCount > 0 
                        ? (successCount === 1 
                            ? t('results.successWithFailures', { successCount, failureCount })
                            : t('results.successWithFailuresPlural', { successCount, failureCount }))
                        : (successCount === 1 
                            ? t('results.successMessage', { successCount })
                            : t('results.successMessagePlural', { successCount }))}
                    </p>
                  </div>
                </div>
              </div>

              {failureCount > 0 && (
                <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <h4 className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('results.failedUpdates')}:
                  </h4>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {updateResult.results
                      .filter((r) => !r.success)
                      .map((result) => (
                        <div
                          key={result.orderId}
                          className={`rounded-lg bg-red-50 p-3 text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className={isRTL ? 'text-right' : 'text-left'}>
                              <div className="font-medium text-red-900">
                                {t('results.order')} {result.orderId.slice(0, 8)}...
                              </div>
                              <div className="text-red-700">
                                {result.error || t('results.unknownError')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Form view
            <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {/* Status selection */}
              <div>
                <label
                  htmlFor="status"
                  className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('form.newStatus')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  disabled={isUpdating}
                >
                  <option value="">{t('form.selectStatus')}</option>
                  {availableStatuses.map((status) => {
                    const meta = STATUS_META[status];
                    const label = locale === 'ar' ? meta?.labelAr : meta?.label;
                    return (
                      <option key={status} value={status}>
                        {label || status}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="notes"
                  className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('form.notes')} ({tCommon('optional')})
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  placeholder={t('form.notesPlaceholder')}
                  disabled={isUpdating}
                />
              </div>

              {/* Preview */}
              {selectedStatus && (
                <div className={`rounded-lg bg-blue-50 p-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className={`text-sm text-blue-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="font-medium mb-1">{t('form.confirmationRequired')}</div>
                      <div>
                        {selectedOrderIds.length === 1
                          ? t('form.confirmationMessage', {
                              count: selectedOrderIds.length,
                              status: locale === 'ar' 
                                ? STATUS_META[selectedStatus]?.labelAr 
                                : STATUS_META[selectedStatus]?.label || selectedStatus
                            })
                          : t('form.confirmationMessagePlural', {
                              count: selectedOrderIds.length,
                              status: locale === 'ar' 
                                ? STATUS_META[selectedStatus]?.labelAr 
                                : STATUS_META[selectedStatus]?.label || selectedStatus
                            })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className={`rounded-lg bg-red-50 p-4 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-start' : 'justify-end'} gap-3 border-t border-gray-200 p-6`}>
          {updateResult ? (
            <button
              onClick={handleClose}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {tCommon('close')}
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={isUpdating}
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedStatus || isUpdating}
                className={`flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('form.updating')}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{t('form.updateOrders')}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
