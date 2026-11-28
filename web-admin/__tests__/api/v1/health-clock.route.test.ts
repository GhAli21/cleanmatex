/** @jest-environment node */

/**
 * S7 (§7.7, T55): GET /api/v1/health/clock needs the setup-health permission, reads only the
 * session tenant, and returns the report with Z instants.
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
let allowed = true;
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: () => async () => (allowed ? { tenantId: 'tenant-1', userId: 'u1' } : NextResponse.json({}, { status: 403 })),
}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
const mockHealth = jest.fn();
jest.mock('@/lib/clock/clock-health.server', () => ({ getClockHealth: (...a: unknown[]) => mockHealth(...a) }));

import { GET } from '@/app/api/v1/health/clock/route';

const req = () => new NextRequest(new URL('http://localhost/api/v1/health/clock?tenantId=other'));

beforeEach(() => {
  allowed = true;
  mockHealth.mockReset();
});

it('403 without permission', async () => {
  allowed = false;
  expect((await GET(req())).status).toBe(403);
  expect(mockHealth).not.toHaveBeenCalled();
});

it('200 with the report for the session tenant only', async () => {
  mockHealth.mockResolvedValue({ status: 'ok', checkedAt: '2026-11-27T03:00:00.000Z', findings: [] });
  const res = await GET(req());
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(mockHealth.mock.calls[0][1]).toBe('tenant-1');
  const body = await res.json();
  expect(body.data.checkedAt).toMatch(/Z$/);
});

it('500 with a code when the check fails', async () => {
  mockHealth.mockRejectedValue(new Error('db down'));
  const res = await GET(req());
  expect(res.status).toBe(500);
  expect((await res.json()).code).toBe('CLOCK_HEALTH_FAILED');
});
