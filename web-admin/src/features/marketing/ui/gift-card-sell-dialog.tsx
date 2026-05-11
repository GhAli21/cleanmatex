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

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
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
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
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
    resolver: zodResolver(schema),
    defaultValues: {
      card_name:             '',
      card_name2:            '',
      amount:                0,
      expiry_date:           defaultExpiry,
      purchased_by_cust_id:  '',
      issued_to_customer_id: '',
      card_pin:              '',
      currency_code:         ORDER_DEFAULTS.CURRENCY,
      rec_notes:             '',
      same_as_buyer:         false,
    },
  });

  // Sync tenant currency once it resolves from context
  useEffect(() => {
    if (tenantCurrency) form.setValue('currency_code', tenantCurrency);
  }, [tenantCurrency, form]);

  const sameAsBuyer  = form.watch('same_as_buyer');
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
    form.reset({
      card_name: '', card_name2: '', amount: 0,
      expiry_date: defaultExpiry, purchased_by_cust_id: '',
      issued_to_customer_id: '', card_pin: '',
      currency_code: tenantCurrency || ORDER_DEFAULTS.CURRENCY,
      rec_notes: '', same_as_buyer: false,
    });
    setServerError(null);
    setGeneratedCode(null);
    setCopied(false);
    setPinVisible(false);
    setBuyerDisplay('');
    setRecipientDisplay('');
    setCustomerPickerTarget(null);
    onOpenChange(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <CmxDialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('actions.sellCard')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t('fields.generatedNotice')}
            </CmxDialogDescription>
          </CmxDialogHeader>

          {/* ---------------------------------------------------------------- */}
          {/* Success state — show generated code                              */}
          {/* ---------------------------------------------------------------- */}
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
            /* -------------------------------------------------------------- */
            /* Form state                                                       */
            /* -------------------------------------------------------------- */
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

              {/* Amount + Currency (read-only badge) */}
              <div className="flex gap-2 items-end">
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
                <Label htmlFor="sell-expiry">{t('fields.expiryDate')}</Label>
                <CmxInput
                  id="sell-expiry"
                  type="date"
                  {...form.register('expiry_date')}
                />
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
                      size="icon"
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

              {/* Recipient — customer picker (hidden when sameAsBuyer) */}
              {!sameAsBuyer && (
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
                        size="icon"
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
              )}

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
