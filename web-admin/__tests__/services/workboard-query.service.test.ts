/** @jest-environment node */

const mockQueryRaw = jest.fn()
const mockBranchesFindMany = jest.fn()
const mockUsersFindMany = jest.fn()
const mockContract = jest.fn()
const mockLiveScreens = jest.fn()
const mockLoadPinnedGraph = jest.fn()
const mockPinnedMember = jest.fn()

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray | string, ...values: unknown[]) => ({ strings, values }),
    join: (values: unknown[], separator?: unknown) => ({ values, separator }),
  },
}))

jest.mock('server-only', () => ({}))
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    org_branches_mst: { findMany: (...args: unknown[]) => mockBranchesFindMany(...args) },
    org_users_mst: { findMany: (...args: unknown[]) => mockUsersFindMany(...args) },
  },
}))
jest.mock('@/lib/services/workflow-profile.service', () => ({
  getWorkflowScreenContract: (...args: unknown[]) => mockContract(...args),
  listWorkflowScreenKeysForStatus: (...args: unknown[]) => mockLiveScreens(...args),
}))
jest.mock('@/lib/services/workflow/pinned-workflow-graph.service', () => ({
  loadPinnedGraphForProfileVersion: (...args: unknown[]) => mockLoadPinnedGraph(...args),
  isPinnedScreenStatusMember: (...args: unknown[]) => mockPinnedMember(...args),
}))

import { WorkboardQueryService } from '@/lib/services/workboard/workboard-query.service'

describe('WorkboardQueryService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails closed when no Workboard status membership is configured', async () => {
    mockContract.mockResolvedValue({ statuses: [], additional_filters: {}, required_permissions: [] })

    await expect(WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 0, rows: [] })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('routes a live-contract order to its stage without exposing a workflow writer', async () => {
    mockContract.mockResolvedValue({ statuses: ['processing'], additional_filters: {}, required_permissions: [] })
    mockLiveScreens.mockResolvedValue(['processing'])
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'order-1', order_no: 'ORD-1', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: null, wf_version_no: null, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([{ status_code: 'processing', name: 'Processing' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })

    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ ownerScreenKey: 'processing', ownerPath: '/dashboard/processing/order-1' })]))
  })

  it('uses a V2 order pinned graph instead of live stage ownership', async () => {
    mockContract.mockResolvedValue({ statuses: ['qa_pending'], additional_filters: {}, required_permissions: [] })
    mockLiveScreens.mockResolvedValue([])
    mockLoadPinnedGraph.mockResolvedValue({ screen_status_memberships: [] })
    mockPinnedMember.mockImplementation((_graph: unknown, screen: string) => screen === 'workboard' || screen === 'qa')
    mockQueryRaw
      .mockResolvedValueOnce([{ wf_profile_id: '22222222-2222-2222-2222-222222222222', wf_version_no: 3 }])
      .mockResolvedValueOnce([{ id: 'order-2', order_no: 'ORD-2', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'qa_pending', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: '22222222-2222-2222-2222-222222222222', wf_version_no: 3, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([{ status_code: 'qa_pending', name: 'QA pending' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })

    expect(mockLoadPinnedGraph).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222', 3)
    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ ownerScreenKey: 'qa', ownerPath: '/dashboard/qa/order-2' })]))
  })
})
