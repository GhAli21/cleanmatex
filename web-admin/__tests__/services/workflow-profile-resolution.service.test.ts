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
const VERSION_ID = 'b1000000-0000-4000-8000-000000000001';
const ARTIFACT_ID = 'c1000000-0000-4000-8000-000000000001';
const CHECKSUM = 'a'.repeat(64);

function executableVersion(versionNo: number, basedOnTemplateId: string | null) {
  return {
    version_id: VERSION_ID,
    profile_id: PROFILE_ID,
    version_no: versionNo,
    based_on_template_id: basedOnTemplateId,
    version_status: 'PUBLISHED',
    policy_revision: 3,
    compiled_schema_version: 1,
    compiled_checksum: CHECKSUM,
    current_artifact_id: ARTIFACT_ID,
  };
}

function validArtifact() {
  return {
    artifact_id: ARTIFACT_ID,
    version_id: VERSION_ID,
    policy_revision: 3,
    artifact_schema_version: 1,
    artifact_checksum: CHECKSUM,
    compiled_artifact: {
      initial_rules: [{
        rule_code: 'DEFAULT',
        order_source_code: null,
        order_type_id: null,
        is_retail: null,
        is_quick_drop: null,
        initial_status: 'intake',
        priority: 1,
      }],
    },
  };
}

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
      [{ is_hq_test_demo: false }],
      [executableVersion(2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
      [validArtifact()],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toEqual({
      profileId: PROFILE_ID,
      versionNo: 2,
      basedOnTemplateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      versionId: VERSION_ID,
      artifactId: ARTIFACT_ID,
      policyRevision: 3,
      artifactSchemaVersion: 1,
      artifactChecksum: CHECKSUM,
      initialRules: [expect.objectContaining({ rule_code: 'DEFAULT', initial_status: 'intake' })],
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
      [{ is_hq_test_demo: false }],
      [executableVersion(3, null)],
      [validArtifact()],
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
      [{ is_hq_test_demo: false }],
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
