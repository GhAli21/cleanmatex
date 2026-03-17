/**
 * Order Summary Bottom Sheet
 * Mobile/tablet replacement for sidebar: floating bar + slide-up sheet
 * Uses inset-inline-0 for RTL correctness.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

interface OrderSummaryBottomSheetProps {
  /** Item count */
  itemCount: number;
  /** Total amount */
  total: number;
  /** Currency code */
  currencyCode?: string;
  /** Whether sheet is open */
  isOpen: boolean;
  /** Callback to open sheet */
  onOpen: () => void;
  /** Callback to close sheet */
  onClose: () => void;
  /** Primary action (Add Order / Submit) */
  onPrimaryAction: () => void;
  /** Whether primary action is disabled */
  primaryDisabled?: boolean;
  /** Primary button label */
  primaryLabel: string;
  /** Whether loading */
  loading?: boolean;
  /** Sheet content (OrderSummaryPanel) */
  children: React.ReactNode;
}

export function OrderSummaryBottomSheet({
  itemCount,
  total,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  isOpen,
  onOpen,
  onClose,
  onPrimaryAction,
  primaryDisabled = false,
  primaryLabel,
  loading = false,
  children,
}: OrderSummaryBottomSheetProps) {
  const t = useTranslations('newOrder.orderSummary');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  const hasItems = itemCount > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Slide-up sheet */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
            aria-label={tCommon('close') || 'Close'}
          />
          {/* Sheet - slide up animation */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] transition-transform duration-300 ease-out"
            style={{ insetInline: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('title') || 'Order summary'}
          >
            {/* Drag handle */}
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center py-3 touch-none cursor-grab active:cursor-grabbing"
              aria-label={tCommon('close') || 'Close'}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </button>
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </div>
        </>
      )}

      {/* Floating bar - visible when items exist and sheet is closed */}
      {hasItems && !isOpen && (
        <div
          className="fixed bottom-0 inset-inline-0 z-30 bg-white border-t border-gray-200 shadow-lg safe-area-pb"
        >
          <div
            className={`flex items-center justify-between gap-4 p-4 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <button
              type="button"
              onClick={isOpen ? onClose : onOpen}
              className={`flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              aria-label={isOpen ? (tCommon('close') || 'Close') : (t('viewCart') || 'View cart')}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">
                {tCommon('itemCount', { count: itemCount })}
              </span>
              <ChevronUp
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`text-sm ${isRTL ? 'text-left' : 'text-right'}`}>
                <p className="text-xs text-gray-500">{t('total')}</p>
                <p className="font-bold text-gray-900">
                  {currencyCode} {total.toFixed(3)}
                </p>
              </div>
              <button
                type="button"
                onClick={onPrimaryAction}
                disabled={primaryDisabled || loading}
                className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                {loading ? (t('processing') || 'Processing...') : primaryLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
