/**
 * Custom Item Modal
 * Modal for adding catalog-free custom items to the order
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useKeyboardNavigation, useFocusTrap } from '@/lib/hooks/use-keyboard-navigation';
import { sanitizeInput, sanitizeOrderNotes } from '@/lib/utils/security-helpers';
import { CmxButton } from '@ui/primitives/cmx-button';
import { cmxMessage } from '@ui/feedback';
import type { OrderItem } from '../../model/new-order-types';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

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
  onAdd: (item: OrderItem) => void;
  trackByPiece?: boolean;
  /**
   * Service category to associate with the custom item / product.
   * Typically the currently selected category in the product grid.
   */
  serviceCategoryCode?: string;
}

/**
 * Custom Item Modal Component
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

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Reset form when modal opens/closes
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Focus trap
  useFocusTrap(modalRef, open);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: open,
    onEscape: handleClose,
  });

  // Save previous focus and focus first element when modal opens
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus first input after a short delay
      setTimeout(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>('input, textarea, button');
        firstInput?.focus();
      }, ORDER_DEFAULTS.FOCUS_DELAY);
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [open, handleClose]);

  const resolveCustomProductId = async (
    name: string,
    name2: string | null,
    price: number,
  ): Promise<string | null> => {
    // Decide strategy based on env:
    // - 'use'  -> use NEXT_PUBLIC_CUSTOM_ITEM_DEFAULT_PRODUCT_ID
    // - 'new'  -> create a fresh product via /api/v1/products (default)
    const mode =
      process.env.NEXT_PUBLIC__CUSTOM_IIEM_USE_DEFAULT_ID_OR_CREATE_NEW_PRODUCT ??
      'new';

    const trimmedMode = mode.toLowerCase();

    // UUID v4 basic validation (must align with backend expectations)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (trimmedMode === 'use') {
      const rawId = process.env.NEXT_PUBLIC_CUSTOM_ITEM_DEFAULT_PRODUCT_ID ?? '';

      if (!rawId || !uuidRegex.test(rawId)) {
        cmxMessage.error(
          'Custom item default product ID is not configured or is invalid. Please contact your administrator.',
        );
        return null;
      }

      return rawId;
    }

    // Default behaviour: create a product via the Products API and return its UUID
    if (!serviceCategoryCode) {
      cmxMessage.error(
        'Service category is required for custom items. Please select a category first.',
      );
      return null;
    }

    try {
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          service_category_code: serviceCategoryCode,
          product_name: name,
          product_name2: name2,
          product_unit: 'piece',
          default_sell_price: price,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage =
          (errorBody && (errorBody.error as string)) ||
          'Failed to create custom product. Please try again.';
        cmxMessage.error(errorMessage);
        return null;
      }

      const json = (await response.json()) as {
        success?: boolean;
        data?: { id?: string };
        error?: string;
      };

      if (!json.success || !json.data?.id || !uuidRegex.test(json.data.id)) {
        cmxMessage.error(
          json.error ||
          'Product was created but a valid product ID was not returned. Please try again.',
        );
        return null;
      }

      return json.data.id;
    } catch (error) {
      console.error('Failed to create custom product', error);
      cmxMessage.error('Failed to create custom product. Please check your connection and try again.');
      return null;
    }
  };

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

    const customProductId = await resolveCustomProductId(
      sanitizedName,
      sanitizedName2,
      data.price,
    );

    if (!customProductId) {
      setIsSubmitting(false);
      return;
    }

    const customItem: OrderItem = {
      productId: customProductId,
      productName: sanitizedName,
      productName2: sanitizedName2,
      quantity: data.quantity,
      pricePerUnit: data.price,
      totalPrice: data.price * data.quantity,
      defaultSellPrice: data.price,
      defaultExpressSellPrice: null,
      serviceCategoryCode,
      notes: sanitizedNotes,
      pieces: trackByPiece
        ? generatePiecesForItem(customProductId, data.quantity)
        : undefined,
    };

    onAdd(customItem);
    handleClose();
    setIsSubmitting(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-item-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div
          className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'
            } p-6 border-b border-gray-200`}
        >
          <h2
            id="custom-item-modal-title"
            className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'
              }`}
          >
            {t('title') || 'Add Custom Item'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                    <label
                      className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      {t('name') || 'Item Name'} *
                    </label>
                    <input
                      {...field}
                      type="text"
                      className={`w-full px-4 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'
                        } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'
                        }`}
                      placeholder={t('namePlaceholder') || 'Enter item name'}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">
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
                    <label
                      className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      {t('name2') || 'Item Name (Arabic)'}
                    </label>
                    <input
                      {...field}
                      type="text"
                      dir="rtl"
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'
                        }`}
                      placeholder={t('name2Placeholder') || 'Enter item name in Arabic'}
                    />
                  </>
                )}
              />
            </div>

            {/* Price and Quantity Row */}
            <div className={`grid grid-cols-2 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Price */}
              <div>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label
                        className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'
                          }`}
                      >
                        {t('price') || 'Price (OMR)'} *
                      </label>
                      <input
                        {...field}
                        type="number"
                        step={ORDER_DEFAULTS.PRICE.STEP}
                        min={ORDER_DEFAULTS.PRICE.MIN}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        dir="ltr"
                        className={`w-full px-4 py-2 border ${errors.price ? 'border-red-500' : 'border-gray-300'
                          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center`}
                        placeholder={`0.${'0'.repeat(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES)}`}
                      />
                      {errors.price && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.price.message}
                        </p>
                      )}
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
                      <label
                        className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'
                          }`}
                      >
                        {t('quantity') || 'Quantity'} *
                      </label>
                      <input
                        {...field}
                        type="number"
                        min={ORDER_DEFAULTS.LIMITS.QUANTITY_MIN}
                        max={ORDER_DEFAULTS.LIMITS.QUANTITY_MAX}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                        dir="ltr"
                        className={`w-full px-4 py-2 border ${errors.quantity ? 'border-red-500' : 'border-gray-300'
                          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center`}
                        placeholder="1"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">
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
                    <label
                      className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      {t('notes') || 'Notes'}
                    </label>
                    <textarea
                      {...field}
                      rows={3}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'
                        }`}
                      placeholder={t('notesPlaceholder') || 'Add any special instructions...'}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </>
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}

