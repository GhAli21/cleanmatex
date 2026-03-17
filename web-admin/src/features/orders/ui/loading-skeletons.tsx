/**
 * Loading Skeleton Components
 * Used for showing loading states during data fetching
 */

'use client';

import { useRTL } from '@/lib/hooks/useRTL';

/**
 * Category Tabs Skeleton
 */
export function CategoryTabsSkeleton() {
  const isRTL = useRTL();
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Product Grid Skeleton
 * Matches ProductCard layout: same grid breakpoints, card-like structure
 */
export function ProductGridSkeleton() {
  const isRTL = useRTL();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className={`h-7 w-32 bg-gray-200 rounded mb-4 animate-pulse ${isRTL ? 'ml-auto' : ''}`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg p-2 flex flex-col"
            >
              <div className="w-full h-14 bg-gray-200 rounded-lg mb-2 animate-pulse" />
              <div className="h-3 w-full bg-gray-200 rounded mb-1 animate-pulse" />
              <div className="h-3 w-2/3 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-9 w-full bg-gray-200 rounded-lg mt-auto animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
