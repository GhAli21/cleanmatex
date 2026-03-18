/**
 * New Order Screen
 * Main screen component for creating new orders
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import { NewOrderLayout } from './new-order-layout';
import { NewOrderContent } from './new-order-content';
import { NewOrderModals } from './new-order-modals';
import { NewOrderLoadingSkeleton } from './new-order-loading-skeleton';
import { NewOrderContentV2 } from './v2/new-order-content-v2';

/**
 * New Order Screen Component
 */
export function NewOrderScreen() {
  const [useV2, setUseV2] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('newOrderV2') === 'true'
  );

  return (
    <NewOrderLayout>
      {/* V2 Toggle */}
      <div className="absolute top-2 end-2 z-50 flex items-center gap-2 text-xs text-gray-500 select-none">
        <span>New UI</span>
        <button
          type="button"
          role="switch"
          aria-checked={useV2}
          onClick={() => {
            const next = !useV2;
            setUseV2(next);
            localStorage.setItem('newOrderV2', String(next));
          }}
          className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${useV2 ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <span
            className={`block w-4 h-4 bg-white rounded-full shadow transition-transform absolute top-0.5 ${useV2 ? 'translate-x-5 start-0' : 'translate-x-0 start-0.5'}`}
          />
        </button>
      </div>
      <Suspense fallback={<NewOrderLoadingSkeleton />}>
        {useV2 ? <NewOrderContentV2 /> : <NewOrderContent />}
      </Suspense>
      <NewOrderModals />
    </NewOrderLayout>
  );
}
