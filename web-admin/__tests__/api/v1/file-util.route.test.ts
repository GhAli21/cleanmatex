/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';

const mockRequirePermission = jest.fn();
const mockInit = jest.fn();
const mockList = jest.fn();

jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/middleware/rate-limit', () => ({ checkAPIRateLimitTenant: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (code: string) => () => mockRequirePermission(code),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/services/file-util/file-util.service', () => {
  class FileUtilError extends Error {}
  return {
    FileUtilError,
    initFileUpload: (...a: unknown[]) => mockInit(...a),
    listFiles: (...a: unknown[]) => mockList(...a),
  };
});

import { GET, POST } from '@/app/api/v1/file-util/route';

const ORDER = '22222222-2222-4222-8222-222222222222';
const AUTH = { tenantId: 'tenant-from-session', userId: 'u1', userName: 'U', user: {} };
const body = (category: string) => ({
  category, entityId: ORDER, source: 'ORDER_DETAIL', fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10,
  tenantId: 'attacker-tenant', // must be ignored
});
const post = (b: unknown) => new NextRequest('http://localhost/api/v1/file-util', { method: 'POST', body: JSON.stringify(b) });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequirePermission.mockResolvedValue(AUTH);
  mockInit.mockResolvedValue({ fileId: 'f1' });
  mockList.mockResolvedValue([]);
});

describe('/api/v1/file-util', () => {
  it.each([
    ['ORDER_FILE', 'orders:update'],
    ['CUSTOMER_FILE', 'customers:update'],
    ['PRODUCT_IMAGE', 'products:update'],
    ['TENANT_LOGO', 'settings:branding'],
  ])('upload of %s requires %s and uses the session tenant', async (category, code) => {
    const res = await POST(post(body(category)));
    expect(res.status).toBe(201);
    expect(mockRequirePermission).toHaveBeenCalledWith(code);
    expect(mockInit.mock.calls[0][0]).toMatchObject({ tenantId: 'tenant-from-session', userId: 'u1' });
  });

  it('lets floor staff with only orders:transition add order files', async () => {
    mockRequirePermission.mockImplementation(async (code: string) =>
      code === 'orders:transition' ? AUTH : NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const res = await POST(post(body('ORDER_FILE')));
    expect(res.status).toBe(201);
    expect(mockRequirePermission.mock.calls.map((c) => c[0])).toEqual(['orders:update', 'orders:transition']);
  });

  it('stops at a sign-in failure instead of trying the next permission', async () => {
    mockRequirePermission.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await POST(post(body('ORDER_FILE')));
    expect(res.status).toBe(401);
    expect(mockRequirePermission).toHaveBeenCalledTimes(1);
  });

  it('returns the permission denial and never calls the service', async () => {
    mockRequirePermission.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const res = await POST(post(body('ORDER_FILE')));
    expect(res.status).toBe(403);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('rejects an unknown category before any auth work', async () => {
    const res = await POST(post(body('ANYTHING')));
    expect(res.status).toBe(400);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('list uses the read permission and parses the id list', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/v1/file-util?category=ORDER_FILE&entityIds=${ORDER}&purposes=DAMAGE,STAIN`));
    expect(res.status).toBe(200);
    expect(mockRequirePermission).toHaveBeenCalledWith('orders:read');
    expect(mockList.mock.calls[0][0]).toMatchObject({ tenantId: 'tenant-from-session', entityIds: [ORDER], purposeCodes: ['DAMAGE', 'STAIN'] });
  });

  it('list passes the source and stage filters', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/v1/file-util?category=ORDER_FILE&entityIds=${ORDER}&sources=ORDER_QA,ORDER_PACKING&stages=qa,ready_for_pickup`));
    expect(res.status).toBe(200);
    expect(mockList.mock.calls[0][0]).toMatchObject({ sourceCodes: ['ORDER_QA', 'ORDER_PACKING'], stageCodes: ['qa', 'ready_for_pickup'] });
  });

  it('list rejects an unknown source and a malformed stage', async () => {
    const bad = await GET(new NextRequest(`http://localhost/api/v1/file-util?category=ORDER_FILE&entityIds=${ORDER}&sources=NOPE`));
    expect(bad.status).toBe(400);
    const badStage = await GET(new NextRequest(`http://localhost/api/v1/file-util?category=ORDER_FILE&entityIds=${ORDER}&stages=QA;drop`));
    expect(badStage.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('accepts seeded non-RFC4122 hex UUIDs for TENANT_LOGO while still rejecting malformed IDs', async () => {
    const seededTenant = '11111111-1111-1111-1111-111111111111';
    const ok = await GET(new NextRequest(`http://localhost/api/v1/file-util?category=TENANT_LOGO&entityIds=${seededTenant}`));
    expect(ok.status).toBe(200);
    expect(mockList.mock.calls[0][0]).toMatchObject({ categoryCode: 'TENANT_LOGO', entityIds: [seededTenant] });

    const malformed = await GET(new NextRequest('http://localhost/api/v1/file-util?category=TENANT_LOGO&entityIds=not-a-uuid'));
    expect(malformed.status).toBe(400);
  });
});
