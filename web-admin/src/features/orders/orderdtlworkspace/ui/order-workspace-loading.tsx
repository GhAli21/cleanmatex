import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'

/** Layout-preserving skeleton for the async workspace shell. */
export function OrderWorkspaceLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading order workspace">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <CmxCard>
        <CmxCardHeader className="space-y-3">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
        </CmxCardHeader>
        <CmxCardContent><div className="h-16 animate-pulse rounded bg-muted" /></CmxCardContent>
      </CmxCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((key) => <CmxCard key={key}><CmxCardContent className="h-32 animate-pulse" /></CmxCard>)}
      </div>
    </div>
  )
}
