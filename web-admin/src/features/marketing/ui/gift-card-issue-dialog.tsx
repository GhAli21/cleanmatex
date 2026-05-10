'use client';

/**
 * Gift Card Issue Dialog (Admin — Promotional / Corporate / Goodwill)
 *
 * Creates a gift card in GENERATED status. The operator must manually
 * activate it afterwards. Replaces the legacy issueGiftCard action with
 * the new issueGiftCardAdmin action that accepts issue_type and
 * gift_card_type.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from 'lucide-react';
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
import { issueGiftCardAdmin } from '@/app/actions/marketing/gift-card-actions';
import {
  GIFT_CARD_TYPE,
  GIFT_CARD_ISSUE_TYPE,
} from '@/lib/constants/gift-card';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  card_name:             z.string().min(1, 'Required').max(200),
  card_name2:            z.string().max(200).optional(),
  amount:                z.coerce.number().positive('Amount must be positive'),
  expiry_date:           z.string().optional(),
  issued_to_customer_id: z.string().uuid().optional().or(z.literal('')),
  purchased_by_cust_id:  z.string().uuid().optional().or(z.literal('')),
  card_pin:              z.string().min(4).max(20).optional().or(z.literal('')),
  issue_type:            z.enum([
    GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
    GIFT_CARD_ISSUE_TYPE.CORPORATE,
    GIFT_CARD_ISSUE_TYPE.GOODWILL,
    GIFT_CARD_ISSUE_TYPE.MIGRATION,
    GIFT_CARD_ISSUE_TYPE.REPLACEMENT,
  ]),
  gift_card_type:        z.enum([
    GIFT_CARD_TYPE.FIXED_VALUE,
    GIFT_CARD_TYPE.PROMOTIONAL,
    GIFT_CARD_TYPE.CORPORATE,
  ]),
  currency_code:         z.string().min(1).max(10),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GiftCardIssueDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GiftCardIssueDialog({ open, onClose, onSuccess }: GiftCardIssueDialogProps) {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      card_name:             '',
      card_name2:            '',
      amount:                0,
      expiry_date:           '',
      issued_to_customer_id: '',
      purchased_by_cust_id:  '',
      card_pin:              '',
      issue_type:            GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
      gift_card_type:        GIFT_CARD_TYPE.FIXED_VALUE,
      currency_code:         'KWD',
    },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const result = await issueGiftCardAdmin({
      card_name:             values.card_name,
      card_name2:            values.card_name2 || undefined,
      amount:                values.amount,
      expiry_date:           values.expiry_date
        ? new Date(values.expiry_date).toISOString()
        : undefined,
      issued_to_customer_id: values.issued_to_customer_id || undefined,
      card_pin:              values.card_pin || undefined,
      issue_type:            values.issue_type,
      currency_code:         values.currency_code,
    });

    if (result.success) {
      form.reset();
      onSuccess();
    } else {
      setServerError(result.error);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.issueCard')}</CmxDialogTitle>
          <CmxDialogDescription>
            {t('fields.generatedNotice')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        {/* Notice banner */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t('fields.generatedNotice')}
          </AlertDescription>
        </Alert>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Issue type */}
          <div>
            <Label htmlFor="issue-type">{t('fields.issueType')} *</Label>
            <select
              id="issue-type"
              {...form.register('issue_type')}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[
                GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
                GIFT_CARD_ISSUE_TYPE.CORPORATE,
                GIFT_CARD_ISSUE_TYPE.GOODWILL,
                GIFT_CARD_ISSUE_TYPE.MIGRATION,
                GIFT_CARD_ISSUE_TYPE.REPLACEMENT,
              ].map((it) => (
                <option key={it} value={it}>{t(`issueTypes.${it}`)}</option>
              ))}
            </select>
          </div>

          {/* Card type */}
          <div>
            <Label htmlFor="gift-card-type">{t('fields.cardType')} *</Label>
            <select
              id="gift-card-type"
              {...form.register('gift_card_type')}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[
                GIFT_CARD_TYPE.FIXED_VALUE,
                GIFT_CARD_TYPE.PROMOTIONAL,
                GIFT_CARD_TYPE.CORPORATE,
              ].map((ct) => (
                <option key={ct} value={ct}>{t(`cardTypes.${ct}`)}</option>
              ))}
            </select>
          </div>

          {/* Card Name EN */}
          <div>
            <Label htmlFor="issue-card-name">{t('fields.cardName')} *</Label>
            <CmxInput
              id="issue-card-name"
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
            <Label htmlFor="issue-card-name2">{t('fields.cardName2')}</Label>
            <CmxInput
              id="issue-card-name2"
              dir="rtl"
              {...form.register('card_name2')}
              placeholder="بطاقة هدية"
            />
          </div>

          {/* Amount + Currency */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="issue-amount">{t('fields.amount')} *</Label>
              <CmxInput
                id="issue-amount"
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
              <Label htmlFor="issue-currency">{t('fields.currency')}</Label>
              <CmxInput
                id="issue-currency"
                {...form.register('currency_code')}
                dir="ltr"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <Label htmlFor="issue-expiry">{t('fields.expiryDate')}</Label>
            <CmxInput id="issue-expiry" type="date" {...form.register('expiry_date')} />
          </div>

          {/* Purchased By */}
          <div>
            <Label htmlFor="issue-buyer">{t('fields.purchasedBy')}</Label>
            <CmxInput
              id="issue-buyer"
              {...form.register('purchased_by_cust_id')}
              placeholder={tCommon('optional')}
              dir="ltr"
            />
          </div>

          {/* Recipient */}
          <div>
            <Label htmlFor="issue-recipient">{t('fields.recipient')}</Label>
            <CmxInput
              id="issue-recipient"
              {...form.register('issued_to_customer_id')}
              placeholder={tCommon('optional')}
              dir="ltr"
            />
          </div>

          {/* PIN */}
          <div>
            <Label htmlFor="issue-pin">{t('fields.pinOptional')}</Label>
            <CmxInput
              id="issue-pin"
              type="password"
              maxLength={20}
              {...form.register('card_pin')}
              dir="ltr"
              placeholder={tCommon('optional')}
            />
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('loading') : t('actions.issueCard')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
