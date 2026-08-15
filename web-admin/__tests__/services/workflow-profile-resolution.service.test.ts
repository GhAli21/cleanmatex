jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
}));

import {
  resolveWorkflowProfileBindingWithPrisma,
  WorkflowProfileResolutionError,
} from '@/lib/services/workflow/workflow-profile-resolution.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const PROFILE_ID = 'a1000000-0000-4000-8000-000000000001';

function transactionWithRows(...rows: unknown[][]) {
  const query = jest.fn();
  rows.forEach((row) => query.mockResolvedValueOnce(row));
  return { $queryRaw: query } as never;
}

describe('workflow profile resolution', () => {
  it('stamps the latest published version from an active tenant default assignment', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: null,
        branch_id: null,
        service_code: null,
        is_default: true,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ profile_id: PROFILE_ID, version_no: 2, based_on_template_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toEqual({
      profileId: PROFILE_ID,
      versionNo: 2,
      basedOnTemplateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });

  it('uses a branch assignment ahead of the tenant default', async () => {
    const branchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const tx = transactionWithRows(
      [
        {
          wf_profile_id: PROFILE_ID,
          wf_version_no: 1,
          branch_id: null,
          service_code: null,
          is_default: true,
          created_at: '2026-08-15T00:00:00.000Z',
        },
        {
          wf_profile_id: PROFILE_ID,
          wf_version_no: 3,
          branch_id: branchId,
          service_code: null,
          is_default: false,
          created_at: '2026-08-16T00:00:00.000Z',
        },
      ],
      [{ profile_id: PROFILE_ID, version_no: 3, based_on_template_id: null }],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID, branchId })).resolves.toMatchObject({
      versionNo: 3,
    });
  });

  it('fails safely when an active assignment is pinned to a version that is not published', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: 5,
        branch_id: null,
        service_code: null,
        is_default: true,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      WorkflowProfileResolutionError,
    );
  });

  it('keeps legacy compatibility only when the tenant has no applicable profile assignment', async () => {
    const tx = transactionWithRows([]);

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toBeNull();
  });
});
