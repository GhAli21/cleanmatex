jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
}));

import {
  resolveWorkflowProfileBindingForOrderWithPrisma,
  resolveWorkflowProfileBindingWithPrisma,
  WorkflowProfileResolutionError,
} from '@/lib/services/workflow/workflow-profile-resolution.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const PROFILE_ID = 'a1000000-0000-4000-8000-000000000001';
const VERSION_ID = 'b1000000-0000-4000-8000-000000000001';

function executableVersion(
  versionNo: number,
  basedOnTemplateId: string | null,
  versionStatus: 'PUBLISHED' | 'PILOT' = 'PUBLISHED',
) {
  return {
    version_id: VERSION_ID,
    profile_id: PROFILE_ID,
    version_no: versionNo,
    based_on_template_id: basedOnTemplateId,
    version_status: versionStatus,
    policy_revision: 3,
  };
}

function validInitialRules() {
  return [{
    rule_code: 'DEFAULT',
    order_source_code: null,
    order_type_id: null,
    is_retail: null,
    is_quick_drop: null,
    initial_status: 'intake',
    priority: 1,
  }];
}

function transactionWithRows(...rows: unknown[][]) {
  const query = jest.fn();
  rows.forEach((row) => query.mockResolvedValueOnce(row));
  return { $queryRaw: query } as never;
}

function sqlTextFromQueryRawCall(call: unknown[]): string {
  const first = call[0];
  if (first && typeof first === 'object' && 'strings' in (first as object)) {
    return (first as { strings: readonly string[] }).strings.join(' ');
  }
  if (Array.isArray(first)) {
    return first.map(String).join(' ');
  }
  return String(first ?? '');
}

describe('workflow profile resolution', () => {
  it('requires an active tenant assignment before an order can be created', async () => {
    const tx = transactionWithRows([]);

    await expect(resolveWorkflowProfileBindingForOrderWithPrisma(tx, {
      tenantId: TENANT_ID,
    })).rejects.toMatchObject({
      code: 'PROFILE_ASSIGNMENT_REQUIRED',
    });
  });

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
      validInitialRules(),
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toEqual({
      profileId: PROFILE_ID,
      versionNo: 2,
      basedOnTemplateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      versionId: VERSION_ID,
      artifactId: null,
      policyRevision: 3,
      artifactSchemaVersion: null,
      artifactChecksum: null,
      initialRules: [expect.objectContaining({ rule_code: 'DEFAULT', initial_status: 'intake' })],
    });

    const initSql = sqlTextFromQueryRawCall(
      (tx as { $queryRaw: jest.Mock }).$queryRaw.mock.calls[3] as unknown[],
    );
    expect(initSql).toContain('sys_wf_prof_ver_init_cf');
    expect(initSql).not.toContain('sys_wf_prof_ver_artifact_cf');
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
      validInitialRules(),
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID, branchId })).resolves.toMatchObject({
      versionNo: 3,
    });
  });

  it('rejects different equally specific active assignments instead of choosing by timestamp', async () => {
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
          wf_profile_id: 'a1000000-0000-4000-8000-000000000002',
          wf_version_no: 1,
          branch_id: null,
          service_code: null,
          is_default: true,
          created_at: '2026-08-16T00:00:00.000Z',
        },
      ],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).rejects.toMatchObject({
      name: 'WorkflowProfileResolutionError',
      message: expect.stringContaining('Multiple equally specific'),
    });
  });

  it('requires a split when service-scoped assignments resolve different policy snapshots', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: 1,
        branch_id: null,
        service_code: 'DRY_CLEAN',
        is_default: false,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ is_hq_test_demo: false }],
      [executableVersion(1, null)],
      validInitialRules(),
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: 2,
        branch_id: null,
        service_code: 'WASH_FOLD',
        is_default: false,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ is_hq_test_demo: false }],
      [executableVersion(2, null)],
      validInitialRules(),
    );

    await expect(resolveWorkflowProfileBindingForOrderWithPrisma(tx, {
      tenantId: TENANT_ID,
      serviceCodes: ['WASH_FOLD', 'DRY_CLEAN'],
    })).rejects.toMatchObject({
      name: 'WorkflowProfileResolutionError',
      message: expect.stringContaining('Split the order'),
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

  it('permits a pinned Pilot version only on an HQ-validated test/demo tenant', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: 1,
        branch_id: null,
        service_code: null,
        is_default: true,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ is_hq_test_demo: true }],
      [executableVersion(1, null, 'PILOT')],
      validInitialRules(),
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toMatchObject({
      versionNo: 1,
      artifactId: null,
    });
  });

  it('rejects a pinned Pilot version on a production tenant', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: 1,
        branch_id: null,
        service_code: null,
        is_default: true,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ is_hq_test_demo: false }],
      [executableVersion(1, null, 'PILOT')],
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      WorkflowProfileResolutionError,
    );
  });

  it('ignores Pilot candidates when the assignment asks for the latest published version', async () => {
    const tx = transactionWithRows(
      [{
        wf_profile_id: PROFILE_ID,
        wf_version_no: null,
        branch_id: null,
        service_code: null,
        is_default: true,
        created_at: '2026-08-15T00:00:00.000Z',
      }],
      [{ is_hq_test_demo: true }],
      [
        { ...executableVersion(2, null, 'PILOT'), version_id: 'b1000000-0000-4000-8000-000000000002' },
        executableVersion(1, null, 'PUBLISHED'),
      ],
      validInitialRules(),
    );

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).resolves.toMatchObject({
      versionNo: 1,
    });
  });

  it('fails closed when no active profile assignment applies', async () => {
    const tx = transactionWithRows([]);

    await expect(resolveWorkflowProfileBindingWithPrisma(tx, { tenantId: TENANT_ID })).rejects.toMatchObject({
      code: 'PROFILE_ASSIGNMENT_REQUIRED',
    });
  });
});
