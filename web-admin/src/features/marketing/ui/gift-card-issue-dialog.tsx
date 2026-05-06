'use client';

/**
 * Gift Card Issue Dialog
 *
 * Form to issue a new gift card with amount, expiry, and optional PIN.
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
import { Alert, AlertDescription } from '@ui/primitives';
import { issueGiftCard } from '@/app/actions/marketing/gift-card-actions';

const schema = z.object({
  card_name: z.string().min(1, 'Required').max(200),
  card_name2: z.string().max(200).optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  expiry_date: z.string().optional(),
  card_pin: z.string().min(4).max(10).optional(),
});

type FormValues = z.infer<typeof schema>;

interface GiftCardIssueDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GiftCardIssueDialog({ open, onClose, onSuccess }: GiftCardIssueDialogProps) {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { card_name: '', amount: 0, card_pin: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const result = await issueGiftCard({
      card_name: values.card_name,
      card_name2: values.card_name2,
      amount: values.amount,
      expiry_date: values.expiry_date ? new Date(values.expiry_date).toISOString() : undefined,
      card_pin: values.card_pin || undefined,
    });
    if (result.success) {
      form.reset();
      onSuccess();
    } else {
      setServerError(result.error);
    }
  };

  const { formState: { isSubmitting } } = form;

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('issue')}</CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label>{t('fields.cardName')}</Label>
            <CmxInput {...form.register('card_name')} placeholder="Birthday Gift" />
            {form.formState.errors.card_name && (
              <p className="text-destructive text-xs mt-1">{form.formState.errors.card_name.message}</p>
            )}
          </div>

          <div>
            <Label>{t('fields.amount')}</Label>
            <CmxInput type="number" step="0.001" {...form.register('amount')} />
            {form.formState.errors.amount && (
              <p className="text-destructive text-xs mt-1">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div>
            <Label>{t('fields.expiryDate')}</Label>
            <CmxInput type="date" {...form.register('expiry_date')} />
          </div>

          <div>
            <Label>{t('fields.pin')}</Label>
            <CmxInput
              type="text"
              maxLength={10}
              {...form.register('card_pin')}
              placeholder={tCommon('optional')}
            />
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('loading') : t('issue')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
