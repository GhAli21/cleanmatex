/**
 * Custom Item Modal
 * Adds a catalog-free line (P5-03e): the cashier enters its name and unit price.
 * No catalog product is created; the server prices it as MANUAL, which needs
 * `pricing:override` (the entry point is hidden without it).
 */

'use client';

import { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { sanitizeInput, sanitizeOrderNotes } from '@/lib/utils/security-helpers';
import { CmxButton, CmxInput, CmxTextarea, Label } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { cmxMessage } from '@ui/feedback';
import type { OrderItem } from '../../model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { CUSTOM_ITEM_KEY_PREFIX } from '../../model/checkout-line-intent';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

/**
 * Custom item form schema
 */
const customItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  name2: z.string().optional(),
  price: z.number().min(ORDER_DEFAULTS.PRICE.MIN, `Price must be at least ${ORDER_DEFAULTS.PRICE.MIN}`),
  quantity: z
    .number()
    .int()
    .min(ORDER_DEFAULTS.LIMITS.QUANTITY_MIN)
    .max(ORDER_DEFAULTS.LIMITS.QUANTITY_MAX),
  notes: z.string().optional(),
});

type CustomItemFormData = z.infer<typeof customItemSchema>;

interface CustomItemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: OrderItem) => void | Promise<void>;
  trackByPiece?: boolean;
  /**
   * Service category to associate with the custom item / product.
   * Typically the currently selected category in the product grid.
   */
  serviceCategoryCode?: string;
}

/**
 * Custom Item Modal Component
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onAdd
 * @param root0.trackByPiece
 * @param root0.serviceCategoryCode
 */
export function CustomItemModal({
  open,
  onClose,
  onAdd,
  trackByPiece = false,
  serviceCategoryCode,
}: CustomItemModalProps) {
  const t = useTranslations('newOrder.customItem');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const priceStep = decimalPlaces <= 0 ? 1 : 10 ** -decimalPlaces;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CustomItemFormData>({
    defaultValues: {
      name: '',
      name2: '',
      price: 0,
      quantity: 1,
      notes: '',
    },
    mode: 'onChange',
  });

  // Reset form when modal opens/closes
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const onSubmit = async (data: CustomItemFormData) => {
    // Validate form data
    const validation = customItemSchema.safeParse(data);
    if (!validation.success) {
      // Show first error
      const firstError = validation.error.issues[0];
      cmxMessage.error(firstError.message || 'Please fix the form errors');
      return;
    }

    // Sanitize user inputs to prevent XSS
    const sanitizedName = sanitizeInput(data.name);
    const sanitizedName2 = data.name2 ? sanitizeInput(data.name2) : null;
    const sanitizedNotes = data.notes ? sanitizeOrderNotes(data.notes) : undefined;
    setIsSubmitting(true);

    // P5-03e: a custom item is a line with no catalog product (PLAN §7). The key
    // only identifies it in the cart; the server prices the entered unit price as
    // MANUAL and never creates a catalog product for it.
    const customProductId = `${CUSTOM_ITEM_KEY_PREFIX}${crypto.randomUUID()}`;

    const customItem: OrderItem = {
      productId: customProductId,
      customItem: { name: sanitizedName, name2: sanitizedName2, unitPrice: data.price },
      productName: sanitizedName,
      productName2: sanitizedName2,
      quantity: data.quantity,
      pricePerUnit: data.price,
      totalPrice: data.price * data.quantity,
      defaultSellPrice: data.price,
      serviceCategoryCode,
      notes: sanitizedNotes,
      pieces: trackByPiece
        ? generatePiecesForItem(customProductId, data.quantity)
        : undefined,
    };

    await onAdd(customItem);
    handleClose();
    setIsSubmitting(false);
  };

  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <CmxDialogContent className="max-w-md w-full" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle id="custom-item-modal-title">
            {t('title') || 'Add Custom Item'}
          </CmxDialogTitle>
        </CmxDialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            {/* Item Name */}
            <div>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <>
                    <Label
                      className="block text-sm font-medium text-foreground mb-2 text-start"
                    >
                      {t('name') || 'Item Name'} *
                    </Label>
                    <CmxInput
                      {...field}
                      type="text"
                      className={`px-4 py-2 ${errors.name ? 'border-destructive' : ''}`}
                      placeholder={t('namePlaceholder') || 'Enter item name'}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-danger-text">
                        {errors.name.message}
                      </p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Item Name (Arabic) */}
            <div>
              <Controller
                name="name2"
                control={control}
                render={({ field }) => (
                  <>
                    <Label
                      className="block text-sm font-medium text-foreground mb-2 text-start"
                    >
                      {t('name2') || 'Item Name (Arabic)'}
                    </Label>
                    <CmxInput
                      {...field}
                      type="text"
                      dir="rtl"
                      className="px-4 py-2 text-start"
                      placeholder={t('name2Placeholder') || 'Enter item name in Arabic'}
                    />
                  </>
                )}
              />
            </div>

            {/* Price and Quantity Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Price */}
              <div>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Label
                        className="block text-sm font-medium text-foreground mb-2 text-start"
                      >
                        {t('price') || 'Price'} ({currencyCode}) *
                      </Label>
                      <CmxInput
                        {...field}
                        type="number"
                        step={priceStep}
                        min={ORDER_DEFAULTS.PRICE.MIN}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        dir="ltr"
                        className={`px-4 py-2 text-center ${errors.price ? 'border-destructive' : ''}`}
                        placeholder={`0.${'0'.repeat(Math.max(0, decimalPlaces - 1))}1`}
                      />
                      {errors.price && (
                        <p className="mt-1 text-sm text-danger-text">
                          {errors.price.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{t('priceHint')}</p>
                    </>
                  )}
                />
              </div>

              {/* Quantity */}
              <div>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Label
                        className="block text-sm font-medium text-foreground mb-2 text-start"
                      >
                        {t('quantity') || 'Quantity'} *
                      </Label>
                      <CmxInput
                        {...field}
                        type="number"
                        min={ORDER_DEFAULTS.LIMITS.QUANTITY_MIN}
                        max={ORDER_DEFAULTS.LIMITS.QUANTITY_MAX}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                        dir="ltr"
                        className={`px-4 py-2 text-center ${errors.quantity ? 'border-destructive' : ''}`}
                        placeholder="1"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-danger-text">
                          {errors.quantity.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <>
                    <Label
                      className="block text-sm font-medium text-foreground mb-2 text-start"
                    >
                      {t('notes') || 'Notes'}
                    </Label>
                    <CmxTextarea
                      {...field}
                      rows={3}
                      className="w-full text-start"
                      placeholder={t('notesPlaceholder') || 'Add any special instructions...'}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </>
                )}
              />
            </div>
          </div>

          <CmxDialogFooter className="gap-3 pt-4">
            <CmxButton
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="submit"
              variant="primary"
              disabled={!isValid || isSubmitting}
              className="flex-1"
            >
              {t('add') || 'Add Item'}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

