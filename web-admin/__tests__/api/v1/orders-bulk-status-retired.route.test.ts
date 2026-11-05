/** @jest-environment node */
/**
 * T12 — bulk/PATCH status writers must stay denied or engine-only.
 *
 * `POST /api/orders/bulk-status` is a retired writer: it must always answer
 * 410 with code USE_WORKFLOW_ACTIONS once authenticated and permitted, never
 * mutate a status. `GET /api/v1/orders/[id]/route.ts` must expose no PATCH
 * handler at all — status changes only ever happen through workflow engine
 * actions.
 */

// tenant-settings.service exports a module-level TenantSettingsService that calls
// the browser createClient() at import time — must be hoisted before any route imports.
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { POST as bulkStatusPost } from '@/app/api/orders/bulk-status/route';
import * as orderByIdRoute from '@/app/api/v1/orders/[id]/route';

const mockRequirePermission = requirePermission as jest.Mock;

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/orders/bulk-status', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('T12 — POST /api/orders/bulk-status is permanently retired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 410 USE_WORKFLOW_ACTIONS for an authorized tenant user and does not touch the database', async () => {
    mockRequirePermission.mockReturnValue(
      jest.fn().mockResolvedValue({ user: { id: 'u1' }, tenantId: 't1', userId: 'u1', userName: 'U1' }),
    );

    const response = await bulkStatusPost(
      buildRequest({ orderIds: ['o1', 'o2'], status: 'ready' }),
    );
    const body = await response.json();

    expect(requirePermission).toHaveBeenCalledWith('orders:update');
    expect(response.status).toBe(410);
    expect(body).toEqual({
      success: false,
      error: 'Bulk status updates are retired. Use per-order POST /api/v1/orders/{id}/actions.',
      code: 'USE_WORKFLOW_ACTIONS',
    });
  });

  it('rejects before ever reaching the retirement response when unauthenticated or unpermitted', async () => {
    mockRequirePermission.mockReturnValue(
      jest.fn().mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })),
    );

    const response = await bulkStatusPost(buildRequest({ orderIds: ['o1'], status: 'ready' }));
    expect(response.status).toBe(401);
  });
});

describe('T12 — GET /api/v1/orders/[id] exposes no PATCH handler', () => {
  it('has no exported PATCH (or PUT/DELETE) status writer on the order-by-id route', () => {
    expect(orderByIdRoute.PATCH).toBeUndefined();
    expect((orderByIdRoute as Record<string, unknown>).PUT).toBeUndefined();
    expect((orderByIdRoute as Record<string, unknown>).DELETE).toBeUndefined();
    expect(orderByIdRoute.GET).toBeDefined();
  });
});
