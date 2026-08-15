/** @jest-environment node */

const mockStopFindFirst = jest.fn();
const mockReceiptCreate = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageRemove = jest.fn();
const mockCreateAdminSupabaseClient = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_dlv_stops_dtl: { findFirst: (...args: unknown[]) => mockStopFindFirst(...args) },
    org_dlv_ev_uploads_tr: { create: (...args: unknown[]) => mockReceiptCreate(...args) },
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: (...args: unknown[]) => mockCreateAdminSupabaseClient(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import {
  createDeliveryEvidenceUpload,
  DeliveryEvidenceError,
} from '@/lib/services/delivery/delivery-evidence.service';

const COMMAND = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  stopId: '22222222-2222-2222-2222-222222222222',
  actorUserId: '33333333-3333-3333-3333-333333333333',
  evidenceType: 'signature' as const,
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]);

describe('createDeliveryEvidenceUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStopFindFirst.mockResolvedValue({ stop_status_code: 'in_transit' });
    mockReceiptCreate.mockResolvedValue({ id: 'receipt-id' });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockCreateAdminSupabaseClient.mockReturnValue({
      storage: {
        from: jest.fn(() => ({ upload: mockStorageUpload, remove: mockStorageRemove })),
      },
    });
  });

  it('writes a private tenant-stop object and receipt after validating image bytes', async () => {
    const result = await createDeliveryEvidenceUpload({ ...COMMAND, content: JPEG });

    expect(result).toMatchObject({
      evidenceType: 'signature',
      contentType: 'image/jpeg',
      fileSizeBytes: JPEG.length,
    });
    expect(mockStopFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: COMMAND.stopId,
        tenant_org_id: COMMAND.tenantId,
      }),
    }));
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${COMMAND.tenantId}/delivery/${COMMAND.stopId}/.+\\.jpeg$`)),
      JPEG,
      expect.objectContaining({ upsert: false, contentType: 'image/jpeg' }),
    );
    expect(mockReceiptCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_org_id: COMMAND.tenantId,
        stop_id: COMMAND.stopId,
        evidence_type: 'signature',
        upload_status: 'uploaded',
        content_type: 'image/jpeg',
      }),
    }));
  });

  it('rejects a non-image before looking up a stop or writing storage', async () => {
    await expect(createDeliveryEvidenceUpload({ ...COMMAND, content: Buffer.from('not-an-image') }))
      .rejects.toMatchObject<DeliveryEvidenceError>({ code: 'EVIDENCE_UNSUPPORTED', httpStatus: 422 });

    expect(mockStopFindFirst).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('does not allow an upload when the tenant-scoped stop cannot be found', async () => {
    mockStopFindFirst.mockResolvedValue(null);

    await expect(createDeliveryEvidenceUpload({ ...COMMAND, content: JPEG }))
      .rejects.toMatchObject<DeliveryEvidenceError>({ code: 'STOP_NOT_FOUND', httpStatus: 404 });

    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('removes the private object when its receipt cannot be committed', async () => {
    mockReceiptCreate.mockRejectedValue(new Error('database unavailable'));

    await expect(createDeliveryEvidenceUpload({ ...COMMAND, content: JPEG }))
      .rejects.toMatchObject<DeliveryEvidenceError>({ code: 'EVIDENCE_UPLOAD_FAILED', httpStatus: 500 });

    expect(mockStorageRemove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^${COMMAND.tenantId}/delivery/${COMMAND.stopId}/.+\\.jpeg$`)),
    ]);
  });
});
