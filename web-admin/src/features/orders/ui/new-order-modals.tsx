/**
 * New Order Modals
 * Container for all modals used in the new order flow
 */

'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { useOrderTotals } from '../hooks/use-order-totals';
import { useOrderSubmission } from '../hooks/use-order-submission';
import { AmountMismatchDialog } from './amount-mismatch-dialog';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useHasPermission } from '@/lib/hooks/use-has-permission';
import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MinimalCustomer } from '../model/new-order-types';
import type { Customer } from '@/lib/types/customer';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CustomItemModal } from './components/custom-item-modal';
import { PhotoCaptureModal } from './components/photo-capture-modal';
import { ReadyDatePickerModal } from './ready-date-picker-modal';
import type { PaymentFormData } from '../model/payment-form-schema';
import type { NewOrderPaymentPayload } from '@/lib/validations/new-order-payment-schemas';

// Lazy load heavy modals for code splitting
const CustomerPickerModal = dynamic(
  () => import('@features/orders/ui/customer-picker-modal').then(mod => ({ default: mod.CustomerPickerModal })),
  {
    ssr: false,
    loading: () => null // Modals handle their own loading states
  }
);

const CustomerEditModal = dynamic(
  () => import('@features/orders/ui/customer-edit-modal').then(mod => ({ default: mod.CustomerEditModal })),
  {
    ssr: false,
    loading: () => null
  }
);

const PaymentModalEnhanced02 = dynamic(
  () => import('@features/orders/ui/payment-modal-enhanced-02').then(mod => ({ default: mod.PaymentModalEnhanced02 })),
  {
    ssr: false,
    loading: () => null
  }
);

const PriceOverrideModal = dynamic(
  () => import('@features/orders/ui/price-override-modal').then(mod => ({ default: mod.PriceOverrideModal })),
  {
    ssr: false,
    loading: () => null
  }
);

import type { OrderItem } from '../model/new-order-types';

/**
 * New Order Modals Component
 */
export function NewOrderModals() {
  const { currentTenant, user } = useAuth();
  const state = useNewOrderStateWithDispatch();
  const totals = useOrderTotals();
  const { submitOrder, amountMismatch, setAmountMismatch } = useOrderSubmission();
  const { trackByPiece } = useTenantSettingsWithDefaults(
    currentTenant?.tenant_id || ''
  );
  const t = useTranslations('newOrder');
  const hasPriceOverridePermission = useHasPermission('pricing', 'override');

  // Get unique service categories from items
  const serviceCategories = useMemo(() => {
    return Array.from(
      new Set(
        state.state.items
          .map((item) => item.serviceCategoryCode)
          .filter(Boolean)
      )
    ) as string[];
  }, [state.state.items]);

  // Retail-only: all items are RETAIL_ITEMS (payment must be at POS, no PAY_ON_COLLECTION)
  const isRetailOnlyOrder = useMemo(() => {
    const items = state.state.items;
    return items.length > 0 && items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');
  }, [state.state.items]);

  // Handle customer selection
  const handleSelectCustomer = useCallback(
    (customer: MinimalCustomer) => {
      if (!customer.id) {
        cmxMessage.error(t('errors.invalidCustomer') || 'Invalid customer selected');
        return;
      }

      const customerName = customer.phone
        ? `${customer.phone} - ${customer.name || customer.name2 || customer.displayName || ''}`
        : customer.name || customer.name2 || customer.displayName || '';

      state.setCustomer(customer, customerName);
      state.closeModal('customerPicker');
    },
    [state, t]
  );

  // Handle customer update success
  const handleCustomerUpdateSuccess = useCallback(
    (updatedCustomer: Customer) => {
      const displayName = updatedCustomer.phone
        ? `${updatedCustomer.phone} - ${updatedCustomer.name || updatedCustomer.name2 || updatedCustomer.displayName || ''}`
        : updatedCustomer.name || updatedCustomer.name2 || updatedCustomer.displayName || '';

      state.setCustomer(
        {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          name2: updatedCustomer.name2,
          displayName: updatedCustomer.displayName,
          firstName: updatedCustomer.firstName,
          lastName: updatedCustomer.lastName,
          phone: updatedCustomer.phone,
          email: updatedCustomer.email,
        },
        displayName
      );
      state.closeModal('customerEdit');
      cmxMessage.success(t('success.customerUpdated') || 'Customer updated successfully');
    },
    [state, t]
  );

  // Handle payment submit (extended payload: amountToCharge, totals for invoice/payment flow)
  const handlePaymentSubmit = useCallback(
    async (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => {
      await submitOrder(paymentData, payload);
    },
    [submitOrder]
  );

  // Handle custom item add (retail vs services: cannot mix)
  const handleAddCustomItem = useCallback(
    (item: OrderItem) => {
      const isNewRetail = item.serviceCategoryCode === 'RETAIL_ITEMS';
      const existingItems = state.state.items;
      if (existingItems.length > 0) {
        const isExistingRetail = existingItems[0].serviceCategoryCode === 'RETAIL_ITEMS';
        if (isNewRetail !== isExistingRetail) {
          cmxMessage.error(t('errors.mixedRetailServices'));
          return;
        }
      }
      state.addItem(item);
      state.closeModal('customItem');
    },
    [state, t]
  );

  // Handle photo capture
  const handlePhotoCapture = useCallback(
    (photo: File) => {
      // Store photo and attach to order/item
      // Photos can be stored in order metadata or attached to specific items
      // For now, just close the modal - photo storage will be implemented in future phase
      state.closeModal('photoCapture');
    },
    [state]
  );

  // Handle ready-by date change
  const handleReadyByChange = useCallback(
    (date: Date, time: string) => {
      const dateTime = new Date(`${date.toDateString()} ${time}`);
      state.setReadyByAt(dateTime.toISOString());
      state.closeModal('readyBy');
    },
    [state]
  );

  // Handle price override save
  const handlePriceOverrideSave = useCallback(
    (override: { price: number; reason: string }) => {
      if (!state.state.priceOverrideItemId) return;

      const item = state.state.items.find(i => i.productId === state.state.priceOverrideItemId);
      if (!item) return;

      // Get current user ID from auth context
      const userId = user?.id || 'system';

      state.updateItemPriceOverride(
        state.state.priceOverrideItemId,
        override.price,
        override.reason,
        userId
      );
      state.closeModal('priceOverride');
    },
    [state, user]
  );

  // Get current item for price override modal
  const priceOverrideItem = useMemo(() => {
    if (!state.state.priceOverrideItemId) return null;
    const item = state.state.items.find(i => i.productId === state.state.priceOverrideItemId);
    if (!item) return null;

    // Calculate the original price (before override)
    const originalPrice = item.defaultSellPrice || item.defaultExpressSellPrice || item.pricePerUnit;

    return {
      id: item.productId,
      productName: item.productName || 'Unknown Product',
      quantity: item.quantity,
      calculatedPrice: originalPrice,
      currentPrice: item.priceOverride !== null && item.priceOverride !== undefined ? item.priceOverride : item.pricePerUnit,
    };
  }, [state.state.priceOverrideItemId, state.state.items]);

  // Expose function to open price override modal (for use in other components)
  // We'll use a ref or context to expose this, but for now let's use a simpler approach
  // by storing the itemId in the modal state when opening

  return (
    <>
      {/* Amount Mismatch Dialog (server vs client totals) */}
      <AmountMismatchDialog
        open={amountMismatch.open}
        onClose={() => setAmountMismatch((prev) => ({ ...prev, open: false }))}
        onRefresh={() => window.location.reload()}
        message={amountMismatch.message}
        differences={amountMismatch.differences}
      />

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        open={state.state.modals.customerPicker}
        onClose={() => state.closeModal('customerPicker')}
        onSelectCustomer={handleSelectCustomer}
      />

      {/* Customer Edit Modal */}
      <CustomerEditModal
        open={state.state.modals.customerEdit}
        customerId={state.state.customer?.id || ''}
        onClose={() => state.closeModal('customerEdit')}
        onSuccess={handleCustomerUpdateSuccess}
      />

      {/* Payment Modal */}
      {currentTenant && (
        <PaymentModalEnhanced02
          open={state.state.modals.payment}
          onClose={() => state.closeModal('payment')}
          onSubmit={handlePaymentSubmit}
          total={totals.subtotal}
          items={state.state.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))}
          isExpress={state.state.express}
          tenantOrgId={currentTenant.tenant_id}
          customerId={state.state.customer?.id || ''}
          branchId={state.state.branchId ?? undefined}
          serviceCategories={serviceCategories}
          isRetailOnlyOrder={isRetailOnlyOrder}
          loading={state.state.loading}
        />
      )}

      {/* Custom Item Modal */}
      {currentTenant && (
        <CustomItemModal
          open={state.state.modals.customItem}
          onClose={() => state.closeModal('customItem')}
          onAdd={handleAddCustomItem}
          trackByPiece={trackByPiece}
          serviceCategoryCode={state.state.selectedCategory || undefined}
        />
      )}

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        open={state.state.modals.photoCapture}
        onClose={() => state.closeModal('photoCapture')}
        onCapture={handlePhotoCapture}
        maxPhotos={ORDER_DEFAULTS.LIMITS.MAX_PHOTOS}
      />

      {/* Ready By Date Picker Modal */}
      <ReadyDatePickerModal
        open={state.state.modals.readyBy}
        onClose={() => state.closeModal('readyBy')}
        onApply={handleReadyByChange}
        initialDate={state.state.readyByAt ? new Date(state.state.readyByAt) : undefined}
        initialTime={state.state.readyByAt ? new Date(state.state.readyByAt).toTimeString().slice(0, 5) : undefined}
        allowNow={isRetailOnlyOrder}
      />

      {/* Price Override Modal */}
      {priceOverrideItem && (
        <PriceOverrideModal
          open={state.state.modals.priceOverride}
          onClose={() => state.closeModal('priceOverride')}
          item={priceOverrideItem}
          onSave={handlePriceOverrideSave}
          hasPermission={hasPriceOverridePermission}
        />
      )}
    </>
  );
}

