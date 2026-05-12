'use client';

/**
 * Gift Card Issue Dialog (Admin — Promotional / Corporate / Goodwill)
 *
 * Creates a gift card in GENERATED status. The operator must manually
 * activate it afterwards. On success the generated gift_card_code is shown
 * with a Copy button and an activation reminder.
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info, Copy, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
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
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import {
  GIFT_CARD_TYPE,
  GIFT_CARD_ISSUE_TYPE,
} from '@/lib/constants/gift-card';
import type { CustomerSearchItem } from '@/lib/api/customers';

// ---------------------------------------------------------------------------
// Lazy-loaded customer picker (avoids SSR issues)
// ---------------------------------------------------------------------------

const CustomerPickerModal = dynamic(
  () =>
    import('@features/orders/ui/customer-picker-modal').then((m) => ({
      default: m.CustomerPickerModal,
    })),
  { ssr: false, loading: () => null }
);

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

  const { currencyCode: tenantCurrency } = useTenantCurrency();

  const [serverError, setServerError]     = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);
  const [pinVisible, setPinVisible]       = useState(false);
  const [customerPickerTarget, setCustomerPickerTarget] =
    useState<'buyer' | 'recipient' | null>(null);
  const [buyerDisplay, setBuyerDisplay]         = useState('');
  const [recipientDisplay, setRecipientDisplay] = useState('');

  const defaultExpiry = `${new Date().getFullYear()}-12-31`;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      card_name:             '',
      card_name2:            '',
      amount:                0,
      expiry_date:           defaultExpiry,
      issued_to_customer_id: '',
      purchased_by_cust_id:  '',
      card_pin:              '',
      issue_type:            GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
      gift_card_type:        GIFT_CARD_TYPE.FIXED_VALUE,
      currency_code:         ORDER_DEFAULTS.CURRENCY,
    },
  });

  // Sync tenant currency once it resolves from context
  useEffect(() => {
    if (tenantCurrency) form.setValue('currency_code', tenantCurrency);
  }, [tenantCurrency, form]);

  const currencyCode = form.watch('currency_code');

  const { formState: { isSubmitting } } = form;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCustomerSelect = (customer: CustomerSearchItem) => {
    const name =
      customer.displayName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      customer.phone ||
      'Customer';
    if (customerPickerTarget === 'buyer') {
      form.setValue('purchased_by_cust_id', customer.id, { shouldValidate: true });
      setBuyerDisplay(name);
    } else {
      form.setValue('issued_to_customer_id', customer.id, { shouldValidate: true });
      setRecipientDisplay(name);
    }
    setCustomerPickerTarget(null);
  };

  const suggestPin = () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    form.setValue('card_pin', pin, { shouldValidate: true });
    setPinVisible(true);
  };

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

    if (result.success === false) {
      setServerError(result.error);
    } else {
      setGeneratedCode(result.data.gift_card_code);
      onSuccess(); // refresh the list in the background
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    form.reset({
      card_name: '', card_name2: '', amount: 0,
      expiry_date: defaultExpiry, issued_to_customer_id: '',
      purchased_by_cust_id: '', card_pin: '',
      issue_type: GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
      gift_card_type: GIFT_CARD_TYPE.FIXED_VALUE,
      currency_code: tenantCurrency || ORDER_DEFAULTS.CURRENCY,
    });
    setServerError(null);
    setGeneratedCode(null);
    setCopied(false);
    setPinVisible(false);
    setBuyerDisplay('');
    setRecipientDisplay('');
    setCustomerPickerTarget(null);
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <CmxDialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('actions.issueCard')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t('fields.generatedNotice')}
            </CmxDialogDescription>
          </CmxDialogHeader>

          {/* ---------------------------------------------------------------- */}
          {/* Success state — show generated code + activation reminder        */}
          {/* ---------------------------------------------------------------- */}
          {generatedCode ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
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
                  className="inline-flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? tCommon('copied') : t('actions.copyCode')}
                </CmxButton>
              </div>
              <p className="text-xs text-amber-600 max-w-xs">
                {t('fields.activateReminder')}
              </p>
              <CmxButton onClick={handleClose}>{tCommon('close')}</CmxButton>
            </div>
          ) : (
            /* -------------------------------------------------------------- */
            /* Form state                                                       */
            /* -------------------------------------------------------------- */
            <>
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

                {/* Amount + Currency (read-only badge) */}
                <div className="flex gap-2 items-end">
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
                  <div className="w-24 pb-0.5">
                    <Label>{t('fields.currency')}</Label>
                    <div className="h-9 flex items-center justify-center rounded-md border bg-muted/40 px-3">
                      <span className="font-mono text-sm font-semibold">{currencyCode}</span>
                    </div>
                    <input type="hidden" {...form.register('currency_code')} />
                  </div>
                </div>

                {/* Expiry Date */}
                <div>
                  <Label htmlFor="issue-expiry">{t('fields.expiryDate')}</Label>
                  <CmxInput id="issue-expiry" type="date" {...form.register('expiry_date')} />
                </div>

                {/* Purchased By — customer picker */}
                <div>
                  <Label>{t('fields.purchasedBy')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 min-h-9 flex items-center border rounded-md px-3 py-2 text-sm bg-muted/20 overflow-hidden">
                      {buyerDisplay
                        ? <span className="truncate">{buyerDisplay}</span>
                        : <span className="text-muted-foreground">{tCommon('optional')}</span>
                      }
                    </div>
                    <CmxButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomerPickerTarget('buyer')}
                    >
                      {t('actions.selectCustomer')}
                    </CmxButton>
                    {buyerDisplay && (
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          form.setValue('purchased_by_cust_id', '');
                          setBuyerDisplay('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </CmxButton>
                    )}
                  </div>
                  <input type="hidden" {...form.register('purchased_by_cust_id')} />
                </div>

                {/* Recipient — customer picker */}
                <div>
                  <Label>{t('fields.recipient')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 min-h-9 flex items-center border rounded-md px-3 py-2 text-sm bg-muted/20 overflow-hidden">
                      {recipientDisplay
                        ? <span className="truncate">{recipientDisplay}</span>
                        : <span className="text-muted-foreground">{tCommon('optional')}</span>
                      }
                    </div>
                    <CmxButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomerPickerTarget('recipient')}
                    >
                      {t('actions.selectCustomer')}
                    </CmxButton>
                    {recipientDisplay && (
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          form.setValue('issued_to_customer_id', '');
                          setRecipientDisplay('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </CmxButton>
                    )}
                  </div>
                  <input type="hidden" {...form.register('issued_to_customer_id')} />
                </div>

                {/* PIN — with show/hide toggle + suggest button */}
                <div>
                  <Label>{t('fields.pinOptional')}</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <CmxInput
                        type={pinVisible ? 'text' : 'password'}
                        maxLength={20}
                        {...form.register('card_pin')}
                        dir="ltr"
                        placeholder={tCommon('optional')}
                      />
                      <button
                        type="button"
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setPinVisible((v) => !v)}
                        tabIndex={-1}
                      >
                        {pinVisible
                          ? <EyeOff className="h-4 w-4" />
                          : <Eye className="h-4 w-4" />
                        }
                      </button>
                    </div>
                    <CmxButton type="button" variant="outline" size="sm" onClick={suggestPin}>
                      {t('actions.suggestPin')}
                    </CmxButton>
                  </div>
                </div>

                <CmxDialogFooter>
                  <CmxButton type="button" variant="outline" onClick={handleClose}>
                    {tCommon('cancel')}
                  </CmxButton>
                  <CmxButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? tCommon('loading') : t('actions.issueCard')}
                  </CmxButton>
                </CmxDialogFooter>
              </form>
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>

      {/* Customer picker — rendered outside the dialog to avoid stacking context issues */}
      {customerPickerTarget !== null && (
        <CustomerPickerModal
          open
          onClose={() => setCustomerPickerTarget(null)}
          onSelectCustomer={handleCustomerSelect}
        />
      )}
    </>
  );
}
