'use client';

import { useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

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

  return (
    <CmxDialog open={open} onOpenChange={(next) => !next && onClose()}>
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
            notes.map((note) => {
              const selected = note.id === selectedNoteId;
              return (
                <CmxButton
                  key={note.id}
                  type="button"
                  variant="outline"
                  onClick={() => onSelect(note.id)}
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
                    })}
                  </span>
                </CmxButton>
              );
            })
          )}
        </div>
        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton type="button" variant="outline" onClick={onClose}>
            {t('creditNotePickerCancel')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
