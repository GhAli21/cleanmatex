/**
 * New Order Screen
 * Main screen component for creating new orders
 * PRD-010: Advanced Order Management
 */

'use client';

import { Suspense } from 'react';
import { NewOrderLayout } from './new-order-layout';
import { NewOrderContent } from './new-order-content';
import { NewOrderModals } from './new-order-modals';
import { NewOrderLoadingSkeleton } from './new-order-loading-skeleton';

/**
 * New Order Screen Component
 */
export function NewOrderScreen() {
  return (
    <NewOrderLayout>
      <Suspense fallback={<NewOrderLoadingSkeleton />}>
        <NewOrderContent />
      </Suspense>
      <NewOrderModals />
    </NewOrderLayout>
  );
}

