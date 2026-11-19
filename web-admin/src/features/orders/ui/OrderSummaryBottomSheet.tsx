/**
 * Order Summary Bottom Sheet
 * Mobile/tablet replacement for sidebar: floating bar + slide-up sheet
 * Uses inset-inline-0 for RTL correctness, focus trap, Escape dismiss, and CmxButton.
 */

'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

interface OrderSummaryBottomSheetProps {
  /** Item count */
  itemCount: number;
  /**
   * The server-quoted total of the current cart (P5-03); null when there is
   * none to show (Order Edit, or the cart is being priced), so no unverified
   * figure is ever labelled Total (BF-19).
   */
  total: number | null;
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

/**
 *
 * @param root0
 * @param root0.itemCount
 * @param root0.total
 * @param root0.currencyCode
 * @param root0.isOpen
 * @param root0.onOpen
 * @param root0.onClose
 * @param root0.onPrimaryAction
 * @param root0.primaryDisabled
 * @param root0.primaryLabel
 * @param root0.loading
 * @param root0.children
 */
export function OrderSummaryBottomSheet({
  itemCount,
  total,
  currencyCode = '',
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
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const trapRef = useFocusTrap(isOpen, { returnFocus: true });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const fmtTotal = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: currencyCode as string,
      decimalPlaces,
      locale: moneyLocale,
    });

  const hasItems = itemCount > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Slide-up sheet */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          />
          {/* Sheet - slide up animation */}
          <div
            ref={trapRef}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] transition-transform duration-300 ease-out"
            style={{ insetInline: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('title') || 'Order summary'}
          >
            {/* Drag / dismiss handle */}
            <CmxButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex w-full justify-center py-3 rounded-none touch-none cursor-grab active:cursor-grabbing"
              aria-label={tCommon('close') || 'Close'}
            >
              <div className="w-12 h-1 bg-border rounded-full" />
            </CmxButton>
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </div>
        </>
      )}

      {/* Floating bar - visible when items exist and sheet is closed */}
      {hasItems && !isOpen && (
        <div className="fixed bottom-0 inset-inline-0 z-30 bg-card border-t border-border shadow-lg safe-area-pb">
          <div className="flex items-center justify-between gap-4 p-4">
            <CmxButton
              type="button"
              variant="outline"
              onClick={isOpen ? onClose : onOpen}
              className="min-h-[44px] px-4 py-2 gap-2"
              aria-label={isOpen ? (tCommon('close') || 'Close') : (t('viewCart') || 'View cart')}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium tabular-nums">
                {tCommon('itemCount', { count: itemCount })}
              </span>
              <ChevronUp
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CmxButton>
            <div className="flex items-center gap-3">
              {total != null ? (
                <div className="text-sm text-end">
                  <p className="text-xs text-muted-foreground">{t('total')}</p>
                  <p className="font-bold text-foreground tabular-nums">
                    <bdi dir="ltr">{fmtTotal(total)}</bdi>
                  </p>
                </div>
              ) : null}
              <CmxButton
                type="button"
                variant="primary"
                onClick={onPrimaryAction}
                disabled={primaryDisabled || loading}
                loading={loading}
                className="min-h-[44px] px-6 py-3 bg-success hover:bg-success/90 text-on-solid font-semibold"
              >
                {loading ? (t('processing') || 'Processing...') : primaryLabel}
              </CmxButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
