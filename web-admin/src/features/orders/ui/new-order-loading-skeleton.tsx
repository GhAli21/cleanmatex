/**
 * New Order Loading Skeleton
 * Loading state for the new order screen
 */

'use client';

// Temporary import - will move to feature folder later
import { CategoryTabsSkeleton, ProductGridSkeleton } from '@/app/dashboard/orders/new/components/loading-skeletons';

/**
 * New Order Loading Skeleton Component
 */
export function NewOrderLoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              <CategoryTabsSkeleton />
              <ProductGridSkeleton />
            </div>
          </div>
          <div className="w-96 border-l border-gray-200 bg-white">
            <div className="p-6 space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
              <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

