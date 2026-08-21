import type { WorkboardListResponse, WorkboardQueryInput } from '@features/workboard/model/workboard-types'

/** Fetches a paginated read-only Workboard projection from the API boundary. */
export async function fetchWorkboard(input: WorkboardQueryInput): Promise<WorkboardListResponse> {
  const params = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize), blocker: input.blocker ?? 'all', sla: input.sla ?? 'all', sort: input.sort ?? 'age_desc' })
  if (input.search) params.set('search', input.search)
  if (input.branchId) params.set('branchId', input.branchId)
  if (input.assigneeId) params.set('assigneeId', input.assigneeId)
  if (input.priority) params.set('priority', input.priority)
  if (input.ownerScreenKey) params.set('ownerScreenKey', input.ownerScreenKey)
  const response = await fetch(`/api/v1/workboard/orders?${params.toString()}`)
  const payload = await response.json() as { success?: boolean; data?: WorkboardListResponse; error?: string }
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Unable to load the Workboard.')
  return payload.data
}
