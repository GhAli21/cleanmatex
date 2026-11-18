/** @jest-environment node */

const mockOrderFindFirst = jest.fn();
const mockStopsFindMany = jest.fn();
const mockOperatorsFindMany = jest.fn();
const mockListFiles = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { findFirst: (...args: unknown[]) => mockOrderFindFirst(...args) },
    org_dlv_stops_dtl: { findMany: (...args: unknown[]) => mockStopsFindMany(...args) },
    org_users_mst: { findMany: (...args: unknown[]) => mockOperatorsFindMany(...args) },
  },
}));

jest.mock('@/lib/services/file-util/file-util.service', () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
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
    const file = (id: string, purposeCode: string, refId: string, locked: boolean) => ({
      id, purposeCode, refTypeCode: 'DELIVERY_STOP', refId,
      lockedAt: locked ? '2026-08-21T08:01:00.000Z' : null, url: `https://signed.example/${id}`,
    });
    mockListFiles.mockResolvedValue([
      file('sig', 'SIGNATURE', STOP_ID, true),
      file('photo', 'DELIVERY_PROOF', STOP_ID, true),
      file('draft', 'DELIVERY_PROOF', STOP_ID, false), // uploaded but never used by a completion
      file('other-stop', 'DELIVERY_PROOF', '99999999-9999-4999-8999-999999999999', true),
    ]);
  });

  it('returns a tenant-scoped audit with only the locked proof files of each stop', async () => {
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
    expect(mockListFiles).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      categoryCode: 'ORDER_FILE',
      entityIds: [ORDER_ID],
      purposeCodes: ['SIGNATURE', 'DELIVERY_PROOF'],
    });
    expect(audit).toMatchObject({
      order: { id: ORDER_ID, paymentState: 'settled', workflowOutcome: 'delivered' },
      deliveryStopCount: 1,
      entries: [{
        stopId: STOP_ID,
        deliveredBy: 'Delivery Operator',
        signature: { source: 'private_signed', url: 'https://signed.example/sig' },
        photos: [{ source: 'private_signed', url: 'https://signed.example/photo' }],
      }],
    });
    expect(audit?.entries[0].photos).toHaveLength(1);
  });

  it('still returns the audit, without links, when signing fails', async () => {
    mockListFiles.mockRejectedValue(new Error('storage down'));
    const audit = await DeliveryProofAuditService.getOrderAudit(TENANT_ID, ORDER_ID);
    expect(audit?.entries[0]).toMatchObject({ signature: null, photos: [] });
  });

  it('does not read stops, staff, or storage when the tenant cannot access the order', async () => {
    mockOrderFindFirst.mockResolvedValue(null);

    await expect(DeliveryProofAuditService.getOrderAudit(TENANT_ID, ORDER_ID)).resolves.toBeNull();

    expect(mockStopsFindMany).not.toHaveBeenCalled();
    expect(mockOperatorsFindMany).not.toHaveBeenCalled();
    expect(mockListFiles).not.toHaveBeenCalled();
  });
});
