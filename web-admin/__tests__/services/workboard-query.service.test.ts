/** @jest-environment node */

const mockQueryRaw = jest.fn()
const mockBranchesFindMany = jest.fn()
const mockUsersFindMany = jest.fn()
const mockLoadSemanticArtifact = jest.fn()

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray | string, ...values: unknown[]) => ({ strings, values }),
    join: (values: unknown[], separator = ',') => {
      if (typeof separator !== 'string') throw new TypeError('Prisma.join separator must be a SQL string')
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
jest.mock('@/lib/services/workflow/semantic-workflow-artifact.service', () => ({
  loadSemanticWorkflowArtifactForOrder: (...args: unknown[]) => mockLoadSemanticArtifact(...args),
}))

import { WorkboardQueryService } from '@/lib/services/workboard/workboard-query.service'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const snapshot = {
  wf_profile_id: '33333333-3333-3333-3333-333333333333',
  wf_version_no: 1,
  wf_profile_version_id: '44444444-4444-4444-4444-444444444444',
  wf_profile_artifact_id: null,
  wf_profile_revision: 1,
  wf_profile_checksum: 'a'.repeat(64),
  wf_profile_schema_version: 1,
}

function semanticWorkboardArtifact() {
  return {
    modules: [
      { screen_key: 'workboard', module_mode: 'observer', is_enabled: true },
      { screen_key: 'new_order', module_mode: 'primary_owner', is_enabled: true },
      { screen_key: 'preparation', module_mode: 'primary_owner', is_enabled: true },
      { screen_key: 'processing', module_mode: 'primary_owner', is_enabled: true },
      { screen_key: 'qa', module_mode: 'primary_owner', is_enabled: true },
      { screen_key: 'ready_release', module_mode: 'primary_owner', is_enabled: true },
      { screen_key: 'pickup_handover', module_mode: 'primary_owner', is_enabled: true },
    ],
    module_statuses: [
      { screen_key: 'workboard', status_code: 'intake', visibility_mode: 'observer' },
      { screen_key: 'workboard', status_code: 'processing', visibility_mode: 'observer' },
      { screen_key: 'workboard', status_code: 'qa_pending', visibility_mode: 'observer' },
      { screen_key: 'workboard', status_code: 'ready_for_pickup', visibility_mode: 'observer' },
      { screen_key: 'workboard', status_code: 'awaiting_collection', visibility_mode: 'observer' },
      { screen_key: 'new_order', status_code: 'intake', visibility_mode: 'owner' },
      { screen_key: 'processing', status_code: 'processing', visibility_mode: 'owner' },
      { screen_key: 'qa', status_code: 'qa_pending', visibility_mode: 'owner' },
      { screen_key: 'ready_release', status_code: 'ready', visibility_mode: 'owner' },
      { screen_key: 'pickup_handover', status_code: 'ready_for_pickup', visibility_mode: 'owner' },
    ],
  }
}

describe('WorkboardQueryService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails closed when the tenant has no complete semantic order snapshots', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(WorkboardQueryService.list(TENANT_ID, { page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ total: 0, rows: [] })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('excludes an incomplete order snapshot instead of resolving a pinned graph or live contract', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1 }])
    mockLoadSemanticArtifact.mockResolvedValue(null)

    const result = await WorkboardQueryService.list(TENANT_ID, { page: 1, pageSize: 25 })

    expect(mockLoadSemanticArtifact).not.toHaveBeenCalled()
    expect(result).toMatchObject({ total: 0, rows: [] })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('routes a live-policy order to its owner without requiring an artifact id', async () => {
    mockLoadSemanticArtifact.mockResolvedValue(semanticWorkboardArtifact())
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([{ id: 'order-semantic', order_no: 'ORD-SEM', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([{ current_status: 'processing', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) }])
      .mockResolvedValueOnce([{ status_code: 'processing', name: 'Processing' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list(TENANT_ID, { page: 1, pageSize: 25 })

    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerScreenKey: 'processing', ownerPath: '/dashboard/processing/order-semantic' }),
    ]))
    expect(result.summary.byOwner.processing).toBe(1)
    const ownerMetricsQuery = mockQueryRaw.mock.calls[3]?.[0] as { strings?: TemplateStringsArray }
    expect(ownerMetricsQuery.strings?.join('')).toContain(
      'GROUP BY o.current_status, o.wf_profile_id, o.wf_version_no, o.wf_profile_version_id',
    )
  })

  it('filters rows by semantic owner while preserving the full Workboard summary', async () => {
    mockLoadSemanticArtifact.mockResolvedValue(semanticWorkboardArtifact())
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([{ id: 'order-3', order_no: 'ORD-3', customer_name: 'Customer', customer_phone: null, branch_name: null, current_status: 'processing', priority: 'normal', has_issue: false, is_rejected: false, received_at: new Date('2026-08-20T10:00:00Z'), last_transition_at: null, ready_by_at: null, wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, assignee_name: null }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([
        { current_status: 'processing', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) },
        { current_status: 'qa_pending', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) },
      ])
      .mockResolvedValueOnce([
        { status_code: 'processing', name: 'Processing' },
        { status_code: 'qa_pending', name: 'QA pending' },
      ])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list(TENANT_ID, {
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

  it('includes intake and ready-for-pickup when Workboard observes those owner screens', async () => {
    mockLoadSemanticArtifact.mockResolvedValue(semanticWorkboardArtifact())
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([
        {
          id: 'order-intake',
          order_no: 'ORD-INT',
          customer_name: 'Customer',
          customer_phone: null,
          branch_name: null,
          current_status: 'intake',
          priority: 'normal',
          has_issue: false,
          is_rejected: false,
          received_at: new Date('2026-08-20T10:00:00Z'),
          last_transition_at: null,
          ready_by_at: null,
          wf_profile_id: snapshot.wf_profile_id,
          wf_version_no: 1,
          wf_profile_version_id: snapshot.wf_profile_version_id,
          assignee_name: null,
        },
        {
          id: 'order-pickup',
          order_no: 'ORD-RFP',
          customer_name: 'Customer',
          customer_phone: null,
          branch_name: null,
          current_status: 'ready_for_pickup',
          priority: 'normal',
          has_issue: false,
          is_rejected: false,
          received_at: new Date('2026-08-20T11:00:00Z'),
          last_transition_at: null,
          ready_by_at: null,
          wf_profile_id: snapshot.wf_profile_id,
          wf_version_no: 1,
          wf_profile_version_id: snapshot.wf_profile_version_id,
          assignee_name: null,
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(2), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([
        { current_status: 'intake', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) },
        { current_status: 'ready_for_pickup', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) },
      ])
      .mockResolvedValueOnce([
        { status_code: 'intake', name: 'Intake' },
        { status_code: 'ready_for_pickup', name: 'Ready for pickup' },
      ])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list(TENANT_ID, { page: 1, pageSize: 25 })

    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ownerScreenKey: 'new_order',
        ownerPath: '/dashboard/orders/order-intake',
        statusCode: 'intake',
      }),
      expect.objectContaining({
        ownerScreenKey: 'pickup_handover',
        ownerPath: '/dashboard/ready/order-pickup',
        statusCode: 'ready_for_pickup',
      }),
    ]))
    expect(result.summary.byOwner.new_order).toBe(1)
    expect(result.summary.byOwner.pickup_handover).toBe(1)
    expect(result.metadata.configurationGaps).toEqual([
      { statusCode: 'awaiting_collection', reason: 'no_stage_owner' },
    ])
  })

  it('lists Workboard-observed statuses even when no floor owner exists', async () => {
    mockLoadSemanticArtifact.mockResolvedValue(semanticWorkboardArtifact())
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([{
        id: 'order-awaiting',
        order_no: 'ORD-AWAIT',
        customer_name: 'Customer',
        customer_phone: null,
        branch_name: null,
        current_status: 'awaiting_collection',
        priority: 'normal',
        has_issue: false,
        is_rejected: false,
        received_at: new Date('2026-08-20T10:00:00Z'),
        last_transition_at: null,
        ready_by_at: null,
        wf_profile_id: snapshot.wf_profile_id,
        wf_version_no: 1,
        wf_profile_version_id: snapshot.wf_profile_version_id,
        assignee_name: null,
      }])
      .mockResolvedValueOnce([{ total: BigInt(1), blocked: BigInt(0), overdue: BigInt(0) }])
      .mockResolvedValueOnce([
        { current_status: 'awaiting_collection', wf_profile_id: snapshot.wf_profile_id, wf_version_no: 1, wf_profile_version_id: snapshot.wf_profile_version_id, total: BigInt(1) },
      ])
      .mockResolvedValueOnce([{ status_code: 'awaiting_collection', name: 'Awaiting collection' }])
      .mockResolvedValueOnce([{ priority: 'normal' }])
    mockBranchesFindMany.mockResolvedValue([])
    mockUsersFindMany.mockResolvedValue([])

    const result = await WorkboardQueryService.list(TENANT_ID, { page: 1, pageSize: 25 })

    expect(result.rows).toEqual([
      expect.objectContaining({
        statusCode: 'awaiting_collection',
        ownerScreenKey: 'order_detail',
        ownerPath: '/dashboard/orders/order-awaiting',
      }),
    ])
    expect(result.summary.byOwner.order_detail).toBe(1)
    expect(result.metadata.configurationGaps).toEqual([
      { statusCode: 'awaiting_collection', reason: 'no_stage_owner' },
    ])
  })
})
