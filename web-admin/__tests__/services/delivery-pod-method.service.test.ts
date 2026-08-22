/** @jest-environment node */

const findMany = jest.fn();
const queryRaw = jest.fn();
const loadArtifact = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_dlv_pod_method_cd: { findMany: (...args: unknown[]) => findMany(...args) },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

jest.mock('@/lib/services/workflow/semantic-workflow-artifact.service', () => ({
  loadSemanticWorkflowArtifactForOrder: (...args: unknown[]) => loadArtifact(...args),
}));

import { listDeliveryPodMethods } from '@/lib/services/delivery/delivery-pod-method.service';

const CATALOG = [
  {
    code: 'SIGNATURE',
    name: 'Signature',
    name2: null,
    description: null,
    description2: null,
    requires_verification: true,
  },
  {
    code: 'PHOTO',
    name: 'Photo',
    name2: null,
    description: null,
    description2: null,
    requires_verification: true,
  },
];

describe('listDeliveryPodMethods', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const stopId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue(CATALOG);
  });

  it('returns the live catalog when no stop is supplied', async () => {
    await expect(listDeliveryPodMethods()).resolves.toEqual([
      expect.objectContaining({ code: 'SIGNATURE' }),
      expect.objectContaining({ code: 'PHOTO' }),
    ]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('keeps the live catalog for unsnapshotted historic orders', async () => {
    queryRaw.mockResolvedValue([{ wf_profile_artifact_id: null }]);
    loadArtifact.mockResolvedValue(null);
    await expect(listDeliveryPodMethods({ tenantId, stopId })).resolves.toEqual([
      expect.objectContaining({ code: 'SIGNATURE' }),
      expect.objectContaining({ code: 'PHOTO' }),
    ]);
  });

  it('narrows methods to compiled delivery evidence and synthesizes NOTES', async () => {
    queryRaw.mockResolvedValue([{
      wf_profile_id: 'p',
      wf_version_no: 1,
      wf_profile_version_id: 'v',
      wf_profile_artifact_id: 'a',
      wf_profile_revision: 1,
      wf_profile_checksum: 'c',
      wf_profile_schema_version: 1,
    }]);
    loadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'notes',
        is_required: false,
        minimum_count: 0,
      }],
    });

    const methods = await listDeliveryPodMethods({ tenantId, stopId });
    expect(methods.map((method) => method.code).sort()).toEqual(['NOTES', 'POD']);
  });
});
