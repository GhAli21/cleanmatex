/** @jest-environment node */

/**
 * Tests: retired readable public order routes — BF-16 (Reusable Order Fin View)
 *
 * GET  /api/v1/public/orders/[tenantId]/[orderNo]
 * POST /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received
 *
 * Both used to work with a guessable tenant ID + order number. They must now
 * answer a plain 404 without touching the database, the tracking service or
 * the workflow engine, and without any detail that tells a real order apart
 * from a made-up one.
 */

const mockLoggerWarn = jest.fn();
const mockGetPublicOrderTrackingResponse = jest.fn();
const mockConfirmPublicOrderReceivedResponse = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockLoggerWarn(...a), info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/services/public-order-tracking.service', () => ({
  getPublicOrderTrackingResponse: (...a: unknown[]) => mockGetPublicOrderTrackingResponse(...a),
  confirmPublicOrderReceivedResponse: (...a: unknown[]) => mockConfirmPublicOrderReceivedResponse(...a),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) },
}));

import { GET } from '@/app/api/v1/public/orders/[tenantId]/[orderNo]/route';
import { POST } from '@/app/api/v1/public/orders/[tenantId]/[orderNo]/confirm-received/route';

describe('retired readable public order routes (BF-16)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET answers 404 with no order data and no lookup', async () => {
    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ success: false });
    expect(mockGetPublicOrderTrackingResponse).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it('POST confirm-received answers 404 and never runs a workflow action', async () => {
    const response = await POST();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ success: false });
    expect(mockConfirmPublicOrderReceivedResponse).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
