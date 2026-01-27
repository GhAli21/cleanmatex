/**
 * New Order Page - Thin Shell
 * PRD-010: Advanced Order Management
 * 
 * This page is a thin routing shell that composes the feature screen.
 * All business logic and UI components are in src/features/orders/
 */

'use client';

import { NewOrderProvider } from '@features/orders/ui/context/new-order-context';
import { NewOrderScreen } from '@features/orders/ui/new-order-screen';

/**
 * New Order Page
 * Thin shell that composes the feature screen
 */
export default function NewOrderPage() {
  return (
    <NewOrderProvider>
      <NewOrderScreen />
    </NewOrderProvider>
  );
}
