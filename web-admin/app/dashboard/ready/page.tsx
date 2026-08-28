import { Suspense } from 'react'
import { ReadyListScreen } from '@features/pickup/ui/ready-list-screen'
import { CmxSkeleton } from '@ui/primitives'

/**
 * Ready-area list. Pickup desk is the same page with `?focus=counter`.
 */
export default function ReadyPage() {
  return (
    <Suspense
      fallback={(
        <div className="mx-auto max-w-6xl space-y-4 p-6">
          <CmxSkeleton className="h-10 w-64" />
          <CmxSkeleton className="h-16 w-full" />
        </div>
      )}
    >
      <ReadyListScreen />
    </Suspense>
  )
}
