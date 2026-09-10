/** @jest-environment node */
/**
 * T12 — bulk/PATCH status writers must stay denied or engine-only.
 *
 * `POST /api/orders/bulk-status` is a retired writer: it must always answer
 * 410 with code USE_WORKFLOW_ACTIONS once authenticated, never mutate a
 * status. `GET /api/v1/orders/[id]/route.ts` must expose no PATCH handler at
 * all — status changes only ever happen through workflow engine actions.
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

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POST as bulkStatusPost } from '@/app/api/orders/bulk-status/route';
import * as orderByIdRoute from '@/app/api/v1/orders/[id]/route';

const mockCreateClient = createClient as jest.Mock;

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

  it('returns 410 USE_WORKFLOW_ACTIONS for an authenticated tenant user and does not touch the database', async () => {
    const mockFrom = jest.fn();
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1', user_metadata: { tenant_org_id: 't1' } } },
          error: null,
        }),
      },
      from: mockFrom,
    });

    const response = await bulkStatusPost(
      buildRequest({ orderIds: ['o1', 'o2'], status: 'ready' }),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({
      success: false,
      error: 'Bulk status updates are retired. Use per-order POST /api/v1/orders/{id}/actions.',
      code: 'USE_WORKFLOW_ACTIONS',
    });
    // No table was ever queried/mutated to perform the requested bulk write.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects with 401 before ever reaching the retirement response when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no session' } }),
      },
      from: jest.fn(),
    });

    const response = await bulkStatusPost(buildRequest({ orderIds: ['o1'], status: 'ready' }));
    expect(response.status).toBe(401);
  });

  it('still requires a resolvable tenant even for an authenticated user', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', user_metadata: {} } }, error: null }),
      },
      from: jest.fn(),
    });

    const response = await bulkStatusPost(buildRequest({ orderIds: ['o1'], status: 'ready' }));
    expect(response.status).toBe(400);
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
