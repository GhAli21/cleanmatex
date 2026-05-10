'use client';

/**
 * Gift Card Sell Dialog
 *
 * Sells a gift card at POS (issue_type=SOLD). The card is created and
 * immediately activated by sellGiftCardAction. On success the generated
 * gift_card_code is shown with a Copy button.
 *
 * Requires: gift_cards:sell permission (enforced server-side).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, CheckCircle2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@ui/primitives';
import { sellGiftCardAction } from '@/app/actions/marketing/gift-card-actions';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  card_name:             z.string().min(1, 'Required').max(200),
  card_name2:            z.string().max(200).optional(),
  amount:                z.coerce.number().positive('Amount must be positive'),
  expiry_date:           z.string().optional(),
  purchased_by_cust_id:  z.string().uuid().optional().or(z.literal('')),
  issued_to_customer_id: z.string().uuid().optional().or(z.literal('')),
  card_pin:              z.string().min(4).max(20).optional().or(z.literal('')),
  currency_code:         z.string().min(1).max(10),
  rec_notes:             z.string().max(500).optional(),
  same_as_buyer:         z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GiftCardSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GiftCardSellDialog({ open, onOpenChange, onSuccess }: GiftCardSellDialogProps) {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');

  const [serverError, setServerError]   = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      card_name:             '',
      card_name2:            '',
      amount:                0,
      expiry_date:           '',
      purchased_by_cust_id:  '',
      issued_to_customer_id: '',
      card_pin:              '',
      currency_code:         'KWD',
      rec_notes:             '',
      same_as_buyer:         false,
    },
  });

  const sameAsBuyer = form.watch('same_as_buyer');

  const { formState: { isSubmitting } } = form;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const issuedTo = sameAsBuyer
      ? (values.purchased_by_cust_id || undefined)
      : (values.issued_to_customer_id || undefined);

    const result = await sellGiftCardAction({
      card_name:                values.card_name,
      card_name2:               values.card_name2 || undefined,
      amount:                   values.amount,
      expiry_date:              values.expiry_date
        ? new Date(values.expiry_date).toISOString()
        : undefined,
      purchased_by_customer_id: values.purchased_by_cust_id || undefined,
      issued_to_customer_id:    issuedTo,
      card_pin:                 values.card_pin || undefined,
      currency_code:            values.currency_code,
    });

    if (result.success) {
      setGeneratedCode(result.data.gift_card_code);
      onSuccess?.();
    } else {
      setServerError(result.error);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    form.reset();
    setServerError(null);
    setGeneratedCode(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.sellCard')}</CmxDialogTitle>
          <CmxDialogDescription>
            {t('fields.generatedNotice')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        {/* ------------------------------------------------------------------ */}
        {/* Success state — show generated code                                */}
        {/* ------------------------------------------------------------------ */}
        {generatedCode ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-sm text-muted-foreground">{t('fields.giftCardCode')}</p>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xl font-bold tracking-widest border rounded px-3 py-2"
                dir="ltr"
              >
                {generatedCode}
              </span>
              <CmxButton
                variant="outline"
                size="sm"
                onClick={handleCopy}
                icon={<Copy className="h-4 w-4" />}
              >
                {copied ? tCommon('copied') : t('actions.copyCode')}
              </CmxButton>
            </div>
            <CmxButton onClick={handleClose}>{tCommon('close')}</CmxButton>
          </div>
        ) : (
          /* ---------------------------------------------------------------- */
          /* Form state                                                         */
          /* ---------------------------------------------------------------- */
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            {/* Card Name EN */}
            <div>
              <Label htmlFor="sell-card-name">{t('fields.cardName')} *</Label>
              <CmxInput
                id="sell-card-name"
                {...form.register('card_name')}
                placeholder="Birthday Gift"
              />
              {form.formState.errors.card_name && (
                <p className="text-destructive text-xs mt-1">
                  {form.formState.errors.card_name.message}
                </p>
              )}
            </div>

            {/* Card Name AR */}
            <div>
              <Label htmlFor="sell-card-name2">{t('fields.cardName2')}</Label>
              <CmxInput
                id="sell-card-name2"
                dir="rtl"
                {...form.register('card_name2')}
                placeholder="بطاقة هدية"
              />
            </div>

            {/* Amount + Currency */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="sell-amount">{t('fields.amount')} *</Label>
                <CmxInput
                  id="sell-amount"
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
              <div className="w-28">
                <Label htmlFor="sell-currency">{t('fields.currency')}</Label>
                <CmxInput
                  id="sell-currency"
                  {...form.register('currency_code')}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div>
              <Label htmlFor="sell-expiry">{t('fields.expiryDate')}</Label>
              <CmxInput
                id="sell-expiry"
                type="date"
                {...form.register('expiry_date')}
              />
            </div>

            {/* Purchased By */}
            <div>
              <Label htmlFor="sell-buyer">{t('fields.purchasedBy')}</Label>
              <CmxInput
                id="sell-buyer"
                {...form.register('purchased_by_cust_id')}
                placeholder={tCommon('optional')}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                UUID — customer search will be added in V2
              </p>
            </div>

            {/* Same as buyer toggle */}
            <div className="flex items-center gap-2">
              <input
                id="sell-same-as-buyer"
                type="checkbox"
                {...form.register('same_as_buyer')}
              />
              <Label htmlFor="sell-same-as-buyer" className="cursor-pointer">
                {t('fields.sameAsBuyer')}
              </Label>
            </div>

            {/* Recipient (hidden when sameAsBuyer) */}
            {!sameAsBuyer && (
              <div>
                <Label htmlFor="sell-recipient">{t('fields.recipient')}</Label>
                <CmxInput
                  id="sell-recipient"
                  {...form.register('issued_to_customer_id')}
                  placeholder={tCommon('optional')}
                  dir="ltr"
                />
              </div>
            )}

            {/* PIN */}
            <div>
              <Label htmlFor="sell-pin">{t('fields.pinOptional')}</Label>
              <CmxInput
                id="sell-pin"
                type="password"
                maxLength={20}
                {...form.register('card_pin')}
                dir="ltr"
                placeholder={tCommon('optional')}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="sell-notes">{t('fields.notes')}</Label>
              <CmxInput
                id="sell-notes"
                {...form.register('rec_notes')}
                placeholder={tCommon('optional')}
              />
            </div>

            <CmxDialogFooter>
              <CmxButton type="button" variant="outline" onClick={handleClose}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? tCommon('loading') : t('actions.sellCard')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        )}
      </CmxDialogContent>
    </CmxDialog>
  );
}
