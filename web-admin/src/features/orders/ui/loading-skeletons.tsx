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
 */
export function ProductGridSkeleton() {
  const isRTL = useRTL();
  
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className={`h-7 w-32 bg-gray-200 rounded mb-4 animate-pulse ${isRTL ? 'ml-auto' : ''}`} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div
              key={i}
              className="border-2 border-gray-200 rounded-xl p-4 min-h-[200px] flex flex-col items-center justify-center gap-2"
            >
              <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
