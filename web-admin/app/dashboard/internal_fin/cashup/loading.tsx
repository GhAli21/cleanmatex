/**
 * Loading State for Cash Up Page
 */

export default function CashUpLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-96 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Date + Form Skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 h-10 w-48 animate-pulse rounded bg-gray-200" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-10 flex-1 animate-pulse rounded bg-gray-200" />
              <div className="h-10 flex-1 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-10 w-40 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}
