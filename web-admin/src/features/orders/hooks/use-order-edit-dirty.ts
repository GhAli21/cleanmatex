/**
 * useOrderEditDirty Hook
 * Detects if the order form has unsaved changes compared to original data
 */

'use client';

import { useMemo } from 'react';
import { useNewOrderState } from '../ui/context/new-order-context';
import {
  isOrderEditFormDirty,
  resolveEditCustomerSnapshot,
} from '../lib/order-edit-dirty';

/**
 * Returns true if the current form state differs from the original order data
 */
export function useOrderEditDirty(): { isDirty: boolean } {
  const state = useNewOrderState();

  const isDirty = useMemo(() => {
    if (!state.isEditMode || !state.originalOrderData) return false;

    const customer = resolveEditCustomerSnapshot(state.customerSnapshotOverride, {
      name: state.customerNameSnapshot || state.customerName,
      mobile: state.customerMobile,
      email: state.customerEmail,
    });

    return isOrderEditFormDirty(
      {
        customerId: state.customer?.id ?? null,
        branchId: state.branchId,
        notes: state.notes ?? '',
        customerNotes: state.customerNotes ?? '',
        paymentNotes: state.paymentNotes ?? '',
        express: state.express,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerEmail: customer.email,
        readyByAt: state.readyByAt,
        items: state.items,
        orderServicePrefs: state.orderServicePrefs ?? [],
      },
      state.originalOrderData
    );
  }, [
    state.isEditMode,
    state.originalOrderData,
    state.customer?.id,
    state.branchId,
    state.notes,
    state.customerNotes,
    state.paymentNotes,
    state.express,
    state.customerSnapshotOverride,
    state.customerNameSnapshot,
    state.customerName,
    state.customerMobile,
    state.customerEmail,
    state.readyByAt,
    state.items,
    state.orderServicePrefs,
  ]);

  return { isDirty };
}
