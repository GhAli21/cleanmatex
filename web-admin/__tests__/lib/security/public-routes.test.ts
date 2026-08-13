import { isPublicRoutePath } from '@/lib/security/public-routes';

describe('isPublicRoutePath', () => {
  it.each([
    '/',
    '/track/85d4c02b74176b3e25c84e0211f55c46',
    '/public/orders/tenant-id/order-number',
    '/login',
    '/auth/callback',
  ])('allows anonymous access to %s', (pathname) => {
    expect(isPublicRoutePath(pathname)).toBe(true);
  });

  it.each([
    '/dashboard/orders',
    '/tracker/85d4c02b74176b3e25c84e0211f55c46',
    '/publicity',
    '/login-history',
  ])('keeps non-public or lookalike path %s protected', (pathname) => {
    expect(isPublicRoutePath(pathname)).toBe(false);
  });
});
