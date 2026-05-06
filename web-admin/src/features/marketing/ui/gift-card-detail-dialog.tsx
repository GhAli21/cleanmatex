'use client';

/**
 * Gift Card Detail Dialog
 *
 * Shows current balance, card details, transaction history, and provides
 * the Adjust balance action.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Label } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { Alert, AlertDescription } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { adjustGiftCard } from '@/app/actions/marketing/gift-card-actions';
import { useGiftCardTransactions } from '../hooks/use-gift-cards';
import type { GiftCard, GiftCardTransaction } from '@/lib/types/payment';

const adjustSchema = z.object({
  adjustment_type: z.enum(['credit', 'debit']),
  amount: z.coerce.number().positive(),
  notes: z.string().min(1, 'Notes required'),
});
type AdjustValues = z.infer<typeof adjustSchema>;

interface GiftCardDetailDialogProps {
  card: GiftCard;
  onClose: () => void;
  onSuccess: () => void;
}

export function GiftCardDetailDialog({ card, onClose, onSuccess }: GiftCardDetailDialogProps) {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');

  const [serverError, setServerError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const { transactions, isLoading } = useGiftCardTransactions(card.id);

  const form = useForm<AdjustValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { adjustment_type: 'credit', amount: 0, notes: '' },
  });

  const onSubmit = async (values: AdjustValues) => {
    setServerError(null);
    const result = await adjustGiftCard(card.id, values);
    if (result.success) {
      setShowAdjust(false);
      onSuccess();
    } else {
      setServerError(result.error ?? 'Failed');
    }
  };

  return (
    <CmxDialog open onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('detail')}</CmxDialogTitle>
        </CmxDialogHeader>

        {/* Card summary */}
        <div className="grid grid-cols-2 gap-2 text-sm border rounded p-3">
          <div>
            <span className="text-muted-foreground">{t('fields.cardNumber')}: </span>
            <span className="font-mono">{card.card_number}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('fields.balance')}: </span>
            <span className="font-semibold">{card.current_balance.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{tCommon('status')}: </span>
            <Badge variant={card.status === 'active' ? 'default' : 'secondary'}>
              {t(`status.${card.status}`)}
            </Badge>
          </div>
          {card.expiry_date && (
            <div>
              <span className="text-muted-foreground">{t('fields.expiryDate')}: </span>
              <span>{new Date(card.expiry_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Adjust form */}
        {showAdjust && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border rounded p-3">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              {(['credit', 'debit'] as const).map((type) => (
                <CmxButton
                  key={type}
                  type="button"
                  variant={form.watch('adjustment_type') === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => form.setValue('adjustment_type', type)}
                >
                  {type === 'credit' ? '+' : '−'} {type}
                </CmxButton>
              ))}
            </div>
            <div>
              <Label>{t('fields.amount')}</Label>
              <CmxInput type="number" step="0.001" {...form.register('amount')} />
            </div>
            <div>
              <Label>{tCommon('notes')}</Label>
              <CmxInput {...form.register('notes')} />
            </div>
            <div className="flex gap-2">
              <CmxButton type="submit">{t('adjust')}</CmxButton>
              <CmxButton type="button" variant="outline" onClick={() => setShowAdjust(false)}>
                {tCommon('cancel')}
              </CmxButton>
            </div>
          </form>
        )}

        {!showAdjust && card.status === 'active' && (
          <CmxButton variant="outline" size="sm" onClick={() => setShowAdjust(true)}>
            {t('adjust')}
          </CmxButton>
        )}

        {/* Transaction history */}
        <h3 className="font-medium mt-2">{t('transactions')}</h3>
        <CmxDataTable
          isLoading={isLoading}
          columns={[
            {
              key: 'transaction_date',
              header: tCommon('date'),
              render: (row: GiftCardTransaction) =>
                new Date(row.transaction_date).toLocaleDateString(),
            },
            { key: 'transaction_type', header: 'Type', render: (row: GiftCardTransaction) => row.transaction_type },
            { key: 'amount', header: t('fields.amount'), render: (row: GiftCardTransaction) => row.amount.toFixed(3) },
            {
              key: 'balance_after',
              header: t('fields.balance'),
              render: (row: GiftCardTransaction) => row.balance_after.toFixed(3),
            },
            { key: 'notes', header: tCommon('notes'), render: (row: GiftCardTransaction) => row.notes ?? '—' },
          ]}
          data={transactions}
          totalCount={transactions.length}
          currentPage={1}
          pageSize={transactions.length || 10}
          onPageChange={() => {}}
        />

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose}>{tCommon('close')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
