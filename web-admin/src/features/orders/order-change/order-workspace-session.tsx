'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { OrderChangeEditPolicyInfo } from '@/lib/types/order-change';

/**
 * Edit presentation session.
 * The shared workspace calls these callbacks. It does not choose Create or Change URLs.
 */
export interface OrderWorkspaceSessionValue {
  orderNo: string;
  revision: number;
  workflowStatus: string | null;
  dirtyCount: number;
  accessBlocked: boolean;
  accessReason: string | null;
  currentTotal: string;
  estimatedTotal: string | null;
  reviewStatus: string | null;
  reviewing: boolean;
  editPolicy: OrderChangeEditPolicyInfo;
  onReview: () => void;
  onDiscard: () => void;
  onExit: () => void;
  exiting: boolean;
  /** True after Apply, while the follow-up dialog is the only remaining action. */
  sealed: boolean;
}

const OrderWorkspaceSessionContext = createContext<OrderWorkspaceSessionValue | null>(null);

export function OrderWorkspaceSessionProvider({
  value,
  children,
}: {
  value: OrderWorkspaceSessionValue;
  children: ReactNode;
}) {
  return (
    <OrderWorkspaceSessionContext.Provider value={value}>
      {children}
    </OrderWorkspaceSessionContext.Provider>
  );
}

/** Present only on the Edit route. New Order leaves this unset. */
export function useOrderWorkspaceSessionOptional(): OrderWorkspaceSessionValue | null {
  return useContext(OrderWorkspaceSessionContext);
}
