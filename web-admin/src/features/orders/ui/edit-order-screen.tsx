/**
 * Edit Order Screen
 * Loads existing order data into the order form for editing
 * PRD: Edit Order Feature - Phase 2 - Frontend UI
 */

'use client';

import { useEffect } from 'react';
import { Suspense } from 'react';
import { useNewOrderDispatch } from './context/new-order-context';
import { NewOrderLayout } from './new-order-layout';
import { NewOrderContent } from './new-order-content';
import { NewOrderModals } from './new-order-modals';
import { NewOrderLoadingSkeleton } from './new-order-loading-skeleton';
import type { MinimalCustomer, OrderItem, PreSubmissionPiece } from '../model/new-order-types';

interface EditOrderScreenProps {
  orderId: string;
  initialOrderData: any;
}

/**
 * Edit Order Screen Component
 * Loads order data into form and renders in edit mode
 */
export function EditOrderScreen({ orderId, initialOrderData }: EditOrderScreenProps) {
  const dispatch = useNewOrderDispatch();

  useEffect(() => {
    // Transform order data to match form state
    const order = initialOrderData;

    // Map customer data
    const customer: MinimalCustomer | null = order.customer_id
      ? {
          id: order.customer_id,
          name: order.customer_name || undefined,
          phone: order.customer_mobile || undefined,
          email: order.customer_email || undefined,
          displayName: order.customer_name || undefined,
        }
      : null;

    // Map order items
    const items: OrderItem[] = (order.items || []).map((item: any) => {
      // Map pieces if they exist
      const pieces: PreSubmissionPiece[] | undefined = item.pieces?.map((piece: any, index: number) => ({
        id: `temp-${item.product_id}-${index + 1}`,
        itemId: item.product_id,
        pieceSeq: index + 1,
        color: piece.color || undefined,
        brand: piece.brand || undefined,
        hasStain: piece.has_stain || false,
        hasDamage: piece.has_damage || false,
        notes: piece.notes || undefined,
        rackLocation: piece.rack_location || undefined,
        metadata: piece.metadata || undefined,
      }));

      return {
        productId: item.product_id,
        productName: item.product_name || null,
        productName2: item.product_name2 || null,
        quantity: item.quantity || 1,
        pricePerUnit: item.price_per_unit || 0,
        totalPrice: item.total_price || 0,
        defaultSellPrice: item.default_sell_price || null,
        defaultExpressSellPrice: item.default_express_sell_price || null,
        serviceCategoryCode: item.service_category_code || undefined,
        notes: item.notes || undefined,
        pieces,
        priceOverride: item.price_override || null,
        overrideReason: item.override_reason || null,
        overrideBy: item.override_by || null,
      };
    });

    // Dispatch LOAD_ORDER_FOR_EDIT action
    dispatch({
      type: 'LOAD_ORDER_FOR_EDIT',
      payload: {
        orderId,
        orderNo: order.order_no || orderId,
        customer,
        customerName: order.customer_name || '',
        customerMobile: order.customer_mobile || '',
        customerEmail: order.customer_email || '',
        branchId: order.branch_id || null,
        items,
        express: order.is_express || false,
        notes: order.internal_notes ?? order.notes ?? '',
        customerNotes: order.customer_notes ?? '',
        paymentNotes: order.payment_notes ?? '',
        readyByAt: order.ready_by_at ? new Date(order.ready_by_at).toISOString() : '',
        originalData: order,
        expectedUpdatedAt: order.updated_at ? new Date(order.updated_at) : new Date(),
      },
    });
  }, [orderId, initialOrderData, dispatch]);

  return (
    <NewOrderLayout>
      <Suspense fallback={<NewOrderLoadingSkeleton />}>
        <NewOrderContent />
      </Suspense>
      <NewOrderModals />
    </NewOrderLayout>
  );
}
