'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

/**
 *
 */
export type CreditNotePickerOption = {
  id: string;
  remaining_balance: number;
  currency_code: string;
};

type PaymentModalV4CreditNotePickerProps = {
  open: boolean;
  onClose: () => void;
  notes: CreditNotePickerOption[];
  selectedNoteId?: string | null;
  onSelect: (noteId: string) => void;
  isRTL: boolean;
};

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.notes
 * @param root0.selectedNoteId
 * @param root0.onSelect
 * @param root0.isRTL
 */
export function PaymentModalV4CreditNotePicker({
  open,
  onClose,
  notes,
  selectedNoteId,
  onSelect,
  isRTL,
}: PaymentModalV4CreditNotePickerProps) {
  const t = useTranslations('newOrder.payment.customerCredits');
  const { decimalPlaces } = useTenantCurrency();
  // CmxDialog portals after mount — land on the first note (or Cancel).
  // autoFocus={false} so the dialog trap does not steal focus to the close X.
  useEffect(() => {
    if (!open) return;
    let attempts = 0;
    let timer: number | undefined;

    const focusInitial = () => {
      const firstNote = document.querySelector<HTMLElement>(
        '[data-testid="credit-note-picker-first-option"]',
      );
      const cancel = document.querySelector<HTMLElement>(
        '[data-testid="credit-note-picker-cancel"]',
      );
      const target = firstNote ?? cancel;
      if (target) {
        target.focus();
        return;
      }
      // Portal may not be committed yet (mounted gate on CmxDialog).
      attempts += 1;
      if (attempts < 8) {
        timer = window.setTimeout(focusInitial, 0);
      }
    };

    timer = window.setTimeout(focusInitial, 0);
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [open, notes.length]);

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      autoFocus={false}
    >
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {t('creditNotePickerTitle')}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-2 py-2">
          {notes.length === 0 ? (
            <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('creditNotePickerEmpty')}
            </p>
          ) : (
            notes.map((note, index) => {
              const selected = note.id === selectedNoteId;
              return (
                <CmxButton
                  key={note.id}
                  type="button"
                  variant="outline"
                  onClick={() => onSelect(note.id)}
                  data-testid={
                    index === 0 ? 'credit-note-picker-first-option' : undefined
                  }
                  className={`h-auto w-full justify-between gap-3 rounded-xl border px-3 py-3 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                  } ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                >
                  <span className="truncate text-sm font-medium text-slate-800">
                    {t('creditNotePickerItem', { id: note.id.slice(0, 8) })}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {formatMoneyAmountWithCode(note.remaining_balance, {
                      currencyCode: note.currency_code,
                      decimalPlaces,
                    })}
                  </span>
                </CmxButton>
              );
            })
          )}
        </div>
        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="credit-note-picker-cancel"
          >
            {t('creditNotePickerCancel')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
