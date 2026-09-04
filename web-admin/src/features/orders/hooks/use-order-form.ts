/**
 * use-order-form Hook
 * React Hook Form integration with Zod
 */

'use client';

import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newOrderFormSchema, type NewOrderFormData } from '../model/new-order-form-schema';
import { useNewOrderState } from '../ui/context/new-order-context';

/**
 * Bridges the reducer-backed New Order model into React Hook Form validation.
 *
 * @returns React Hook Form controls plus a reducer-to-form synchronization helper.
 * @example
 * const form = useOrderForm();
 * form.syncFormWithState();
 */
export function useOrderForm() {
  const state = useNewOrderState();

  const form = useForm<NewOrderFormData>({
    resolver: zodResolver(newOrderFormSchema) as Resolver<NewOrderFormData>,
    defaultValues: {
      customerId: state.customer?.id || '',
      orderTypeId: state.orderTypeId,
      orderSourceCode: state.orderSourceCode,
      items: [],
      isQuickDrop: state.isQuickDrop,
      quickDropQuantity: state.quickDropQuantity,
      express: state.express,
      priority: state.express ? 'express' : 'normal',
      customerNotes: state.notes,
      useOldWfCodeOrNew: false,
    },
    mode: 'onChange',
  });

  // Keep submission validation aligned with the reducer-owned creation context.
  // The top-bar selectors are outside the form tree, so they must be copied explicitly.
  const syncFormWithState = () => {
    form.setValue('customerId', state.customer?.id || '');
    form.setValue('orderTypeId', state.orderTypeId);
    form.setValue('orderSourceCode', state.orderSourceCode);
    form.setValue('items', state.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productName2: item.productName2,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      totalPrice: item.totalPrice,
      defaultSellPrice: item.defaultSellPrice,
      defaultExpressSellPrice: item.defaultExpressSellPrice,
      serviceCategoryCode: item.serviceCategoryCode,
      notes: item.notes,
      pieces: item.pieces,
    })));
    form.setValue('isQuickDrop', state.isQuickDrop);
    form.setValue('quickDropQuantity', state.quickDropQuantity);
    form.setValue('express', state.express);
    form.setValue('priority', state.express ? 'express' : 'normal');
    form.setValue('customerNotes', state.notes);
  };

  return {
    ...form,
    syncFormWithState,
  };
}

