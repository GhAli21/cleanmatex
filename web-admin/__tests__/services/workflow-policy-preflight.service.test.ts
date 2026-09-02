/** @jest-environment node */

const mockQueryRaw = jest.fn()
const mockExecuteRaw = jest.fn()
const mockResolveBinding = jest.fn()

jest.mock('server-only', () => ({}))
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}))
jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({
  resolveWorkflowProfileBindingWithPrisma: (...args: unknown[]) => mockResolveBinding(...args),
  WorkflowProfileResolutionError: class WorkflowProfileResolutionError extends Error {
    constructor(message: string, readonly code: string) {
      super(message)
      this.name = 'WorkflowProfileResolutionError'
    }
  },
}))

import { runWorkflowPolicyPreflight } from '@/lib/services/workflow/workflow-policy-preflight.service'
import { WorkflowProfileResolutionError } from '@/lib/services/workflow/workflow-profile-resolution.service'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const VERSION_ID = 'a1000000-0000-4000-8000-000000000013'

describe('workflow policy preflight', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails closed when the tenant does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(runWorkflowPolicyPreflight({ tenantId: TENANT_ID })).resolves.toMatchObject({
      tenantFound: false,
      readyForNewOrders: false,
      assignmentErrorCode: 'TENANT_NOT_FOUND',
    })
    expect(mockResolveBinding).not.toHaveBeenCalled()
  })

  it('reports assignment-required without leaking other tenants', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ is_hq_test_demo: false }])
    mockResolveBinding.mockRejectedValue(
      new WorkflowProfileResolutionError('No assignment', 'PROFILE_ASSIGNMENT_REQUIRED'),
    )

    await expect(runWorkflowPolicyPreflight({ tenantId: TENANT_ID })).resolves.toMatchObject({
      tenantFound: true,
      readyForNewOrders: false,
      assignmentErrorCode: 'PROFILE_ASSIGNMENT_REQUIRED',
      versionId: null,
    })
  })

  it('validates an explicit live version without requiring assignment', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ is_hq_test_demo: true }])
      .mockResolvedValueOnce([{ version_status: 'PUBLISHED', profile_code: 'WF_V2_SIMPLE' }])
      .mockResolvedValueOnce([{
        modules: 4, statuses: 8, executions: 6, channels: 6, gates: 1, initial_rules: 3, evidence: 1,
      }])
    mockExecuteRaw.mockResolvedValue(1)

    const report = await runWorkflowPolicyPreflight({
      tenantId: TENANT_ID,
      versionId: VERSION_ID,
    })

    expect(mockResolveBinding).not.toHaveBeenCalled()
    expect(report).toMatchObject({
      tenantFound: true,
      profileCode: 'WF_V2_SIMPLE',
      liveValidation: { ok: true, error: null },
      readyForNewOrders: true,
      sections: { modules: 4, executions: 6 },
    })
  })
})
