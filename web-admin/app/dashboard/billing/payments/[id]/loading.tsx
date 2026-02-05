/**
 * Payment Detail Loading Skeleton
 */

export default function PaymentDetailLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>

      {/* Two-column layout skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 md:col-span-2">
          {/* Payment summary card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 h-6 w-40 rounded bg-gray-200" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="h-5 w-32 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
          {/* Amount breakdown card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 h-6 w-40 rounded bg-gray-200" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 h-6 w-32 rounded bg-gray-200" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
