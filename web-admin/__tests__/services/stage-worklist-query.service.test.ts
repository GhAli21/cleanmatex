/** @jest-environment node */

const mockQueryRaw = jest.fn()
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
  },
}))
jest.mock('@/lib/services/workflow/semantic-workflow-artifact.service', () => ({
  loadSemanticWorkflowArtifactForOrder: (...args: unknown[]) => mockLoadSemanticArtifact(...args),
}))

import {
  canonicalStageWorklistScreens,
  listStageWorklistOrderPage,
} from '@/lib/services/workflow/stage-worklist-query.service'

describe('stage worklist membership', () => {
  beforeEach(() => jest.clearAllMocks())

  it('maps historical ready and delivery aliases onto catalog screens', () => {
    expect(canonicalStageWorklistScreens('ready')).toEqual(['ready', 'ready_release'])
    expect(canonicalStageWorklistScreens('delivery')).toEqual(['delivery', 'driver_delivery'])
    expect(canonicalStageWorklistScreens('unknown-screen')).toEqual([])
  })

  it('fails closed for an unknown floor screen without querying orders', async () => {
    await expect(listStageWorklistOrderPage('11111111-1111-1111-1111-111111111111', {
      screen: 'not-a-workflow-screen',
      page: 1,
      pageSize: 20,
    })).resolves.toEqual({ orderIds: [], total: 0 })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('lists a semantic processing order through its immutable artifact', async () => {
    const snapshot = {
      wf_profile_id: '33333333-3333-3333-3333-333333333333',
      wf_version_no: 1,
      wf_profile_version_id: '44444444-4444-4444-4444-444444444444',
      wf_profile_artifact_id: '55555555-5555-5555-5555-555555555555',
      wf_profile_revision: 1,
      wf_profile_checksum: 'a'.repeat(64),
      wf_profile_schema_version: 1,
    }
    mockQueryRaw
      .mockResolvedValueOnce([snapshot])
      .mockResolvedValueOnce([{ id: 'order-semantic' }])
      .mockResolvedValueOnce([{ total: BigInt(1) }])
    mockLoadSemanticArtifact.mockResolvedValue({
      modules: [{ screen_key: 'processing', module_mode: 'primary_owner', is_enabled: true }],
      module_statuses: [{ screen_key: 'processing', status_code: 'in_wash', visibility_mode: 'owner' }],
    })

    const result = await listStageWorklistOrderPage('11111111-1111-1111-1111-111111111111', {
      screen: 'processing',
      page: 1,
      pageSize: 20,
    })

    expect(mockLoadSemanticArtifact).toHaveBeenCalledWith(snapshot)
    expect(result).toEqual({ orderIds: ['order-semantic'], total: 1 })
  })

  it('does not list a semantic order whose artifact does not own the requested screen', async () => {
    const snapshot = {
      wf_profile_id: '33333333-3333-3333-3333-333333333333',
      wf_version_no: 1,
      wf_profile_version_id: '44444444-4444-4444-4444-444444444444',
      wf_profile_artifact_id: '55555555-5555-5555-5555-555555555555',
      wf_profile_revision: 1,
      wf_profile_checksum: 'a'.repeat(64),
      wf_profile_schema_version: 1,
    }
    mockQueryRaw.mockResolvedValueOnce([snapshot])
    mockLoadSemanticArtifact.mockResolvedValue({
      modules: [{ screen_key: 'qa', module_mode: 'primary_owner', is_enabled: true }],
      module_statuses: [{ screen_key: 'qa', status_code: 'processing', visibility_mode: 'owner' }],
    })

    const result = await listStageWorklistOrderPage('11111111-1111-1111-1111-111111111111', {
      screen: 'processing',
      page: 1,
      pageSize: 20,
    })

    expect(result).toEqual({ orderIds: [], total: 0 })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('does not list a profile-stamped order through a pinned graph', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { wf_profile_id: '22222222-2222-2222-2222-222222222222', wf_version_no: 3 },
    ])
    mockLoadSemanticArtifact.mockResolvedValue(null)

    const result = await listStageWorklistOrderPage('11111111-1111-1111-1111-111111111111', {
      screen: 'processing',
      page: 1,
      pageSize: 20,
    })

    expect(mockLoadSemanticArtifact).toHaveBeenCalledWith({
      wf_profile_id: '22222222-2222-2222-2222-222222222222',
      wf_version_no: 3,
    })
    expect(result).toEqual({ orderIds: [], total: 0 })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})
