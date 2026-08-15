/** @jest-environment node */

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { getPickupReleaseSummaries } from '@/lib/services/pickup/pickup-release-state.service';

describe('pickup-release-state service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an explicit not-released state when no pickup release exists', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const summaries = await getPickupReleaseSummaries({
      tenantId: '11111111-1111-1111-1111-111111111111',
      orderIds: ['22222222-2222-2222-2222-222222222222'],
    });

    expect(summaries.get('22222222-2222-2222-2222-222222222222')).toMatchObject({
      state: 'not_released',
      releaseId: null,
    });
  });

  it('prioritizes an active pickup release for the customer-collection state', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        order_id: '22222222-2222-2222-2222-222222222222',
        id: '33333333-3333-3333-3333-333333333333',
        release_status: 'released',
        released_at: new Date('2026-08-15T08:00:00.000Z'),
        fulfilled_at: null,
      },
    ]);

    const summaries = await getPickupReleaseSummaries({
      tenantId: '11111111-1111-1111-1111-111111111111',
      orderIds: ['22222222-2222-2222-2222-222222222222'],
    });

    expect(summaries.get('22222222-2222-2222-2222-222222222222')).toEqual({
      state: 'available_for_pickup',
      releaseId: '33333333-3333-3333-3333-333333333333',
      releasedAt: '2026-08-15T08:00:00.000Z',
      fulfilledAt: null,
    });
  });
});
