/** @jest-environment node */

const mockOrderFindFirst = jest.fn();
const mockStopsFindMany = jest.fn();
const mockOperatorsFindMany = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockCreateAdminSupabaseClient = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { findFirst: (...args: unknown[]) => mockOrderFindFirst(...args) },
    org_dlv_stops_dtl: { findMany: (...args: unknown[]) => mockStopsFindMany(...args) },
    org_users_mst: { findMany: (...args: unknown[]) => mockOperatorsFindMany(...args) },
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: (...args: unknown[]) => mockCreateAdminSupabaseClient(...args),
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { warn: jest.fn() } }));

import { DeliveryProofAuditService } from '@/lib/services/delivery/delivery-proof-audit.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-8222-222222222222';
const STOP_ID = '33333333-3333-3333-8333-333333333333';
const ACTOR_ID = '44444444-4444-4444-8444-444444444444';

describe('DeliveryProofAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderFindFirst.mockResolvedValue({
      id: ORDER_ID,
      order_no: 'ORD-20260821-0001',
      current_status: 'delivered',
      outstanding_amount: { toString: () => '0.0000' },
      currency_code: 'OMR',
    });
    mockStopsFindMany.mockResolvedValue([{
      id: STOP_ID,
      route_id: '55555555-5555-4555-8555-555555555555',
      sequence: 2,
      stop_status_code: 'delivered',
      actual_time: new Date('2026-08-21T08:00:00.000Z'),
      org_dlv_pod_tr: [{
        id: '66666666-6666-4666-8666-666666666666',
        pod_method_code: 'SIGNATURE_PHOTO',
        pod_notes: 'Received by the customer at the front door.',
        signature_object_key: `${TENANT_ID}/delivery/${STOP_ID}/signature.jpeg`,
        photo_object_keys: [
          `${TENANT_ID}/delivery/${STOP_ID}/photo.jpeg`,
          'other-tenant/delivery/not-this-stop/photo.jpeg',
        ],
        signature_url: null,
        photo_urls: ['https://legacy.example/first.jpg', 'https://legacy.example/second.jpg'],
        verified_at: new Date('2026-08-21T08:01:00.000Z'),
        verified_by: ACTOR_ID,
        created_by: ACTOR_ID,
      }],
    }]);
    mockOperatorsFindMany.mockResolvedValue([{
      user_id: ACTOR_ID,
      display_name: 'Delivery Operator',
      name: null,
      first_name: null,
      last_name: null,
    }]);
    mockCreateSignedUrl.mockImplementation((objectKey: string) => Promise.resolve({
      data: { signedUrl: `https://signed.example/${encodeURIComponent(objectKey)}` },
      error: null,
    }));
    mockCreateAdminSupabaseClient.mockReturnValue({
      storage: { from: jest.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
    });
  });

  it('returns a tenant-scoped audit and signs only evidence owned by that tenant stop', async () => {
    const audit = await DeliveryProofAuditService.getOrderAudit(TENANT_ID, ORDER_ID);

    expect(mockOrderFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: ORDER_ID, tenant_org_id: TENANT_ID }),
    }));
    expect(mockStopsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ order_id: ORDER_ID, tenant_org_id: TENANT_ID }),
      select: expect.objectContaining({
        org_dlv_pod_tr: expect.objectContaining({
          where: expect.objectContaining({ tenant_org_id: TENANT_ID }),
        }),
      }),
    }));
    expect(mockOperatorsFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_org_id: TENANT_ID, user_id: { in: [ACTOR_ID] } }),
    }));
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      `${TENANT_ID}/delivery/${STOP_ID}/signature.jpeg`,
      expect.any(Number),
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      `${TENANT_ID}/delivery/${STOP_ID}/photo.jpeg`,
      expect.any(Number),
    );
    expect(audit).toMatchObject({
      order: { id: ORDER_ID, paymentState: 'settled', workflowOutcome: 'delivered' },
      deliveryStopCount: 1,
      entries: [{
        stopId: STOP_ID,
        deliveredBy: 'Delivery Operator',
        signature: { source: 'private_signed' },
        photos: [{ source: 'private_signed' }, { source: 'legacy', url: 'https://legacy.example/second.jpg' }],
      }],
    });
  });

  it('does not read stops, staff, or storage when the tenant cannot access the order', async () => {
    mockOrderFindFirst.mockResolvedValue(null);

    await expect(DeliveryProofAuditService.getOrderAudit(TENANT_ID, ORDER_ID)).resolves.toBeNull();

    expect(mockStopsFindMany).not.toHaveBeenCalled();
    expect(mockOperatorsFindMany).not.toHaveBeenCalled();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
