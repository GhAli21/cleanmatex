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
});
