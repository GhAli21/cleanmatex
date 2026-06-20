import { Suspense } from 'react'
import { PlatformInventoriesScreen } from '@features/help/ui/platform-inventories-screen'
import { CmxSpinner } from '@ui/primitives'

/**
 *
 */
export default function PlatformInventoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <CmxSpinner />
        </div>
      }
    >
      <PlatformInventoriesScreen />
    </Suspense>
  )
}
