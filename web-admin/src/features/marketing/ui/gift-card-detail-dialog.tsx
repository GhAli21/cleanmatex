'use client';

/**
 * Gift Card Detail Dialog
 *
 * Shows all card fields, transaction history, and provides lifecycle actions:
 *   - Activate (GENERATED → ACTIVE)
 *   - Suspend / Unsuspend
 *   - Void (destructive, terminal)
 *   - Adjust Balance (credit or debit with live balance preview + two-step
 *     confirmation for debit operations)
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Label } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { Alert, AlertDescription } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import {
  adjustGiftCard,
  activateGiftCardAction,
  suspendGiftCardAction,
  voidGiftCardAction,
} from '@/app/actions/marketing/gift-card-actions';
import { useGiftCardTransactions } from '../hooks/use-gift-cards';
import type { GiftCard, GiftCardTransaction } from '@/lib/types/payment';
import { GIFT_CARD_STATUS, type GiftCardStatus } from '@/lib/constants/gift-card';

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<
  GiftCardStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  [GIFT_CARD_STATUS.ACTIVE]:             { variant: 'default',     className: 'bg-green-100 text-green-800 border-green-200' },
  [GIFT_CARD_STATUS.PARTIALLY_REDEEMED]: { variant: 'outline',     className: 'bg-amber-100 text-amber-800 border-amber-200' },
  [GIFT_CARD_STATUS.GENERATED]:          { variant: 'outline',     className: 'bg-blue-100 text-blue-800 border-blue-200' },
  [GIFT_CARD_STATUS.DRAFT]:              { variant: 'secondary',   className: 'bg-slate-100 text-slate-700 border-slate-200' },
  [GIFT_CARD_STATUS.FULLY_REDEEMED]:     { variant: 'secondary',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
  [GIFT_CARD_STATUS.EXPIRED]:            { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  [GIFT_CARD_STATUS.VOIDED]:             { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  [GIFT_CARD_STATUS.SUSPENDED]:          { variant: 'outline',     className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

// ---------------------------------------------------------------------------
// Adjust form schema
// ---------------------------------------------------------------------------

const adjustSchema = z.object({
  adjustment_type: z.enum(['credit', 'debit']),
  amount:          z.coerce.number().positive('Amount must be positive'),
  notes:           z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

type AdjustValues = z.infer<typeof adjustSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GiftCardDetailDialogProps {
  card: GiftCard;
  onClose: () => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GiftCardDetailDialog({ card, onClose, onSuccess }: GiftCardDetailDialogProps) {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');

  const [serverError,         setServerError]         = useState<string | null>(null);
  const [showAdjust,          setShowAdjust]          = useState(false);
  const [showDebitConfirm,    setShowDebitConfirm]    = useState(false);
  const [showVoidConfirm,     setShowVoidConfirm]     = useState(false);
  const [showSuspendConfirm,  setShowSuspendConfirm]  = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [pendingAdjust,       setPendingAdjust]       = useState<AdjustValues | null>(null);

  const [isPending, startTransition] = useTransition();

  const { transactions, isLoading: txLoading } = useGiftCardTransactions(card.id);

  // ---------------------------------------------------------------------------
  // Adjust form
  // ---------------------------------------------------------------------------

  const form = useForm<AdjustValues>({
    resolver: zodResolver(adjustSchema) as Resolver<AdjustValues>,
    defaultValues: { adjustment_type: 'credit', amount: 0, notes: '' },
  });

  const watchType   = form.watch('adjustment_type');
  const watchAmount = form.watch('amount') ?? 0;

  const newBalancePreview =
    watchType === 'credit'
      ? card.available_amount + watchAmount
      : card.available_amount - watchAmount;

  const onAdjustSubmit = async (values: AdjustValues) => {
    if (values.adjustment_type === 'debit') {
      // Two-step: store values and show debit confirm dialog
      setPendingAdjust(values);
      setShowDebitConfirm(true);
      return;
    }
    await doAdjust(values);
  };

  const doAdjust = async (values: AdjustValues) => {
    setServerError(null);
    const result = await adjustGiftCard(card.id, values);
    if (result.success) {
      form.reset();
      setShowAdjust(false);
      setShowDebitConfirm(false);
      setPendingAdjust(null);
      onSuccess();
    } else {
      setServerError(result.error ?? 'Failed');
    }
  };

  // ---------------------------------------------------------------------------
  // Lifecycle actions
  // ---------------------------------------------------------------------------

  const handleActivate = () => {
    startTransition(async () => {
      const result = await activateGiftCardAction(card.id);
      if (result.success) {
        setShowActivateConfirm(false);
        onSuccess();
      } else {
        setServerError(result.error ?? 'Failed');
      }
    });
  };

  const handleSuspend = () => {
    startTransition(async () => {
      const result = await suspendGiftCardAction(card.id, 'Suspended via admin detail view');
      if (result.success) {
        setShowSuspendConfirm(false);
        onSuccess();
      } else {
        setServerError(result.error ?? 'Failed');
      }
    });
  };

  const handleVoid = () => {
    startTransition(async () => {
      const result = await voidGiftCardAction(card.id, 'Voided via admin detail view');
      if (result.success) {
        setShowVoidConfirm(false);
        onSuccess();
      } else {
        setServerError(result.error ?? 'Failed');
      }
    });
  };

  const statusStyle = STATUS_STYLE[card.status] ?? { variant: 'outline' as const, className: '' };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Main detail dialog                                                   */}
      {/* ------------------------------------------------------------------ */}
      <CmxDialog open onOpenChange={(o) => !o && onClose()}>
        <CmxDialogContent className="max-w-2xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('detail')}</CmxDialogTitle>
          </CmxDialogHeader>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Card summary grid */}
          <div className="grid grid-cols-2 gap-2 text-sm border rounded p-3">
            <div>
              <span className="text-muted-foreground">{t('fields.giftCardCode')}: </span>
              <span className="font-mono" dir="ltr">{card.gift_card_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{tCommon('status')}: </span>
              <Badge variant={statusStyle.variant} className={statusStyle.className}>
                {t(`statuses.${card.status}`)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.issueType')}: </span>
              <span>{t(`issueTypes.${card.issue_type}`)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.cardType')}: </span>
              <span>{t(`cardTypes.${card.gift_card_type}`)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.originalAmount')}: </span>
              <span>{card.original_amount.toFixed(3)} {card.currency_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.availableBalance')}: </span>
              <span className="font-semibold">{card.available_amount.toFixed(3)} {card.currency_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.redeemedAmount')}: </span>
              <span>{card.redeemed_amount.toFixed(3)} {card.currency_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('fields.currency')}: </span>
              <span dir="ltr">{card.currency_code}</span>
            </div>
            {card.activation_date && (
              <div>
                <span className="text-muted-foreground">{t('fields.activationDate')}: </span>
                <span>{new Date(card.activation_date).toLocaleDateString()}</span>
              </div>
            )}
            {card.expiry_date && (
              <div>
                <span className="text-muted-foreground">{t('fields.expiryDate')}: </span>
                <span>{new Date(card.expiry_date).toLocaleDateString()}</span>
              </div>
            )}
            {card.issued_to_customer_name && (
              <div>
                <span className="text-muted-foreground">{t('fields.issuedToCustomer')}: </span>
                <span>{card.issued_to_customer_name}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Activate */}
            {card.status === GIFT_CARD_STATUS.GENERATED && (
              <CmxButton
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={() => setShowActivateConfirm(true)}
              >
                {t('actions.activate')}
              </CmxButton>
            )}

            {/* Suspend */}
            {(card.status === GIFT_CARD_STATUS.ACTIVE ||
              card.status === GIFT_CARD_STATUS.PARTIALLY_REDEEMED) && (
              <CmxButton
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setShowSuspendConfirm(true)}
              >
                {t('actions.suspend')}
              </CmxButton>
            )}

            {/* Unsuspend — re-use activate for suspended (shows as unsuspend label) */}
            {card.status === GIFT_CARD_STATUS.SUSPENDED && (
              <CmxButton
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setShowActivateConfirm(true)}
              >
                {t('actions.unsuspend')}
              </CmxButton>
            )}

            {/* Adjust Balance */}
            {(card.status === GIFT_CARD_STATUS.ACTIVE ||
              card.status === GIFT_CARD_STATUS.PARTIALLY_REDEEMED) && (
              <CmxButton
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setShowAdjust((prev) => !prev)}
              >
                {t('actions.adjustBalance')}
              </CmxButton>
            )}

            {/* Void */}
            {card.status !== GIFT_CARD_STATUS.VOIDED &&
              card.status !== GIFT_CARD_STATUS.EXPIRED && (
              <CmxButton
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => setShowVoidConfirm(true)}
              >
                {t('actions.voidCard')}
              </CmxButton>
            )}
          </div>

          {/* Adjust form */}
          {showAdjust && (
            <form onSubmit={form.handleSubmit(onAdjustSubmit)} className="space-y-3 border rounded p-3 mt-2">
              {/* Type toggle */}
              <div className="flex gap-2">
                {(['credit', 'debit'] as const).map((type) => (
                  <CmxButton
                    key={type}
                    type="button"
                    variant={watchType === type ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => form.setValue('adjustment_type', type)}
                  >
                    {type === 'credit' ? `+ ${t('fields.credit')}` : `− ${t('fields.debit')}`}
                  </CmxButton>
                ))}
              </div>

              {/* Amount */}
              <div>
                <Label>{t('fields.amount')}</Label>
                <CmxInput
                  type="number"
                  step="0.001"
                  {...form.register('amount')}
                  dir="ltr"
                />
                {form.formState.errors.amount && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              {/* Balance preview */}
              <p className="text-sm text-muted-foreground">
                {t('fields.newBalancePreview', {
                  balance: `${newBalancePreview.toFixed(3)} ${card.currency_code}`,
                })}
              </p>

              {/* Reason */}
              <div>
                <Label>{t('fields.adjustReason')} *</Label>
                <CmxInput {...form.register('notes')} />
                {form.formState.errors.notes && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.notes.message}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <CmxButton type="submit" disabled={isPending}>
                  {t('actions.adjustBalance')}
                </CmxButton>
                <CmxButton type="button" variant="outline" onClick={() => setShowAdjust(false)}>
                  {tCommon('cancel')}
                </CmxButton>
              </div>
            </form>
          )}

          {/* Transaction history */}
          <h3 className="font-medium mt-2">{t('transactions')}</h3>
          <CmxDataTable
            isLoading={txLoading}
            columns={[
              {
                key: 'transaction_date',
                header: tCommon('date'),
                render: (row: GiftCardTransaction) =>
                  new Date(row.transaction_date).toLocaleDateString(),
              },
              {
                key: 'transaction_type',
                header: t('fields.adjustType'),
                render: (row: GiftCardTransaction) => row.transaction_type,
              },
              {
                key: 'amount',
                header: t('fields.amount'),
                render: (row: GiftCardTransaction) => row.amount.toFixed(3),
              },
              {
                key: 'balance_after',
                header: t('fields.availableBalance'),
                render: (row: GiftCardTransaction) => row.balance_after.toFixed(3),
              },
              {
                key: 'notes',
                header: t('fields.notes'),
                render: (row: GiftCardTransaction) => row.notes ?? '—',
              },
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

      {/* ------------------------------------------------------------------ */}
      {/* Activate confirmation dialog                                         */}
      {/* ------------------------------------------------------------------ */}
      {showActivateConfirm && (
        <CmxDialog open onOpenChange={(o) => !o && setShowActivateConfirm(false)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('confirmations.activateTitle')}</CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.activateMessage', {
                  code:     card.gift_card_code,
                  amount:   card.original_amount.toFixed(3),
                  currency: card.currency_code,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <CmxDialogFooter>
              <CmxButton variant="outline" onClick={() => setShowActivateConfirm(false)}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton onClick={handleActivate} disabled={isPending}>
                {t('actions.activate')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Suspend confirmation dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      {showSuspendConfirm && (
        <CmxDialog open onOpenChange={(o) => !o && setShowSuspendConfirm(false)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('confirmations.suspendTitle')}</CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.suspendMessage', {
                  code:     card.gift_card_code,
                  amount:   card.available_amount.toFixed(3),
                  currency: card.currency_code,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <CmxDialogFooter>
              <CmxButton variant="outline" onClick={() => setShowSuspendConfirm(false)}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton variant="outline" onClick={handleSuspend} disabled={isPending}>
                {t('actions.suspend')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Void confirmation dialog (destructive)                               */}
      {/* ------------------------------------------------------------------ */}
      {showVoidConfirm && (
        <CmxDialog open onOpenChange={(o) => !o && setShowVoidConfirm(false)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t('confirmations.voidTitle')}
              </CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.voidMessage', {
                  code:     card.gift_card_code,
                  amount:   card.available_amount.toFixed(3),
                  currency: card.currency_code,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <div className="px-6 pb-2">
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">{t('fields.giftCardCode')}: <span dir="ltr">{card.gift_card_code}</span></p>
                <p>{t('fields.availableBalance')}: {card.available_amount.toFixed(3)} {card.currency_code}</p>
              </div>
            </div>
            <CmxDialogFooter>
              <CmxButton variant="outline" onClick={() => setShowVoidConfirm(false)}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton variant="destructive" onClick={handleVoid} disabled={isPending}>
                {t('actions.voidCard')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Debit adjustment confirmation (two-step)                             */}
      {/* ------------------------------------------------------------------ */}
      {showDebitConfirm && pendingAdjust && (
        <CmxDialog open onOpenChange={(o) => !o && setShowDebitConfirm(false)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('confirmations.debitAdjustTitle')}</CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.debitAdjustMessage', {
                  amount:     pendingAdjust.amount.toFixed(3),
                  code:       card.gift_card_code,
                  newBalance: (card.available_amount - pendingAdjust.amount).toFixed(3),
                  reason:     pendingAdjust.notes,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <CmxDialogFooter>
              <CmxButton
                variant="outline"
                onClick={() => {
                  setShowDebitConfirm(false);
                  setPendingAdjust(null);
                }}
              >
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton
                variant="destructive"
                disabled={isPending}
                onClick={() => pendingAdjust && doAdjust(pendingAdjust)}
              >
                {tCommon('confirm')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}
    </>
  );
}
