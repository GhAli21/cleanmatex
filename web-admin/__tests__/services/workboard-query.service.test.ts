/** @jest-environment node */

const mockQueryRaw = jest.fn()
const mockBranchesFindMany = jest.fn()
const mockUsersFindMany = jest.fn()
const mockContract = jest.fn()
const mockLiveScreens = jest.fn()
const mockLoadPinnedGraph = jest.fn()
const mockPinnedMember = jest.fn()
const mockLoadSemanticArtifact = jest.fn()

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray | string, ...values: unknown[]) => ({ strings, values }),
    join: (values: unknown[], separator = ',') => {
      if (typeof separator !== 'string') {
        throw new TypeError('Prisma.join separator must be a SQL string')
      }
      return { values, separator }
    },
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
jest.mock('@/lib/services/workflow/semantic-workflow-artifact.service', () => ({
  loadSemanticWorkflowArtifactForOrder: (...args: unknown[]) => mockLoadSemanticArtifact(...args),
}))

import { WorkboardQueryService } from '@/lib/services/workboard/workboard-query.service'

describe('WorkboardQueryService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails closed when no Workboard status membership is configured', async () => {
    mockContract.mockResolvedValue({ statuses: [], additional_filters: {}, required_permissions: [] })
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 0, rows: [] })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('routes a live-contract order to its stage without exposing a workflow writer', async () => {
    mockContract.mockResolvedValue({ statuses: ['processing'], additional_filters: {}, required_permissions: [] })
    mockLiveScreens.mockResolvedValue(['processing'])
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'order-1', order_no: 'ORD-1', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: null, wf_version_no: null, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([{ current_status: 'processing', wf_profile_id: null, wf_version_no: null, total: BigInt(1) }])
      .mockResolvedValueOnce([{ status_code: 'processing', name: 'Processing' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })

    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ ownerScreenKey: 'processing', ownerPath: '/dashboard/processing/order-1' })]))
    expect(result.summary.byOwner.processing).toBe(1)
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
      .mockResolvedValueOnce([{ current_status: 'qa_pending', wf_profile_id: '22222222-2222-2222-2222-222222222222', wf_version_no: 3, total: BigInt(1) }])
      .mockResolvedValueOnce([{ status_code: 'qa_pending', name: 'QA pending' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })

    expect(mockLoadPinnedGraph).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222', 3)
    expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ ownerScreenKey: 'qa', ownerPath: '/dashboard/qa/order-2' })]))
    expect(result.summary.byOwner.qa).toBe(1)
  })

  it('uses a semantic order artifact even when the legacy Workboard contract is empty', async () => {
    const snapshot = {
      wf_profile_id: '33333333-3333-3333-3333-333333333333',
      wf_version_no: 1,
      wf_profile_version_id: '44444444-4444-4444-4444-444444444444',
      wf_profile_artifact_id: '55555555-5555-5555-5555-555555555555',
      wf_profile_revision: 1,
      wf_profile_checksum: 'a'.repeat(64),
      wf_profile_schema_version: 1,
    }
    mockContract.mockResolvedValue({ statuses: [], additional_filters: {}, required_permissions: [] })
    mockLoadSemanticArtifact.mockResolvedValue({
      modules: [
        { screen_key: 'workboard', module_mode: 'observer', is_enabled: true },
        { screen_key: 'processing', module_mode: 'primary_owner', is_enabled: true },
      ],
      module_statuses: [
        { screen_key: 'workboard', status_code: 'processing', visibility_mode: 'observer' },
        { screen_key: 'processing', status_code: 'processing', visibility_mode: 'owner' },
      ],
    })
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([{ id: 'order-semantic', order_no: 'ORD-SEM', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_artifact_id: snapshot.wf_profile_artifact_id, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([{ current_status: 'processing', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_artifact_id: snapshot.wf_profile_artifact_id, total: BigInt(1) }])
      .mockResolvedValueOnce([{ status_code: 'processing', name: 'Processing' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', { page: 1, pageSize: 25 })

    expect(mockLoadSemanticArtifact).toHaveBeenCalledWith(snapshot)
    expect(mockLoadPinnedGraph).not.toHaveBeenCalled()
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerScreenKey: 'processing', ownerPath: '/dashboard/processing/order-semantic' }),
    ]))

    const ownerMetricsQuery = mockQueryRaw.mock.calls[3]?.[0] as { strings?: TemplateStringsArray }
    expect(ownerMetricsQuery.strings?.join('')).toContain(
      'GROUP BY o.current_status, o.wf_profile_id, o.wf_version_no, o.wf_profile_artifact_id',
    )
  })

  it('filters rows by owner screen while preserving cross-stage summary counts', async () => {
    mockContract.mockResolvedValue({ statuses: ['processing', 'qa_pending'], additional_filters: {}, required_permissions: [] })
    mockLiveScreens
      .mockResolvedValueOnce(['processing'])
      .mockResolvedValueOnce(['qa'])
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'order-3', order_no: 'ORD-3', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: null, wf_version_no: null, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([
        { current_status: 'processing', wf_profile_id: null, wf_version_no: null, total: BigInt(1) },
        { current_status: 'qa_pending', wf_profile_id: null, wf_version_no: null, total: BigInt(1) },
      ])
      .mockResolvedValueOnce([
        { status_code: 'processing', name: 'Processing' },
        { status_code: 'qa_pending', name: 'QA pending' },
      ])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list('11111111-1111-1111-1111-111111111111', {
      page: 1,
      pageSize: 25,
      ownerScreenKey: 'processing',
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.ownerScreenKey).toBe('processing')
    expect(result.summary.total).toBe(1)
    expect(result.summary.byOwner.processing).toBe(1)
    expect(result.summary.byOwner.qa).toBe(1)
  })
})
