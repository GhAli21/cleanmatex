import { guardedInAppPath } from '@/src/features/orders/hooks/guarded-in-app-path';

const HERE = 'http://localhost:3000/dashboard/orders/order-1/edit';

describe('guardedInAppPath', () => {
  it('guards a same-origin sidebar link', () => {
    expect(guardedInAppPath({
      href: '/dashboard/orders',
      target: null,
      hasDownload: false,
      currentHref: HERE,
      primaryUnmodifiedClick: true,
    })).toBe('/dashboard/orders');
  });

  it('leaves a new tab, an external site, and the current page alone', () => {
    expect(guardedInAppPath({
      href: '/dashboard/orders',
      target: '_blank',
      hasDownload: false,
      currentHref: HERE,
      primaryUnmodifiedClick: true,
    })).toBeNull();
    expect(guardedInAppPath({
      href: 'https://example.com/orders',
      target: null,
      hasDownload: false,
      currentHref: HERE,
      primaryUnmodifiedClick: true,
    })).toBeNull();
    expect(guardedInAppPath({
      href: '/dashboard/orders/order-1/edit',
      target: null,
      hasDownload: false,
      currentHref: HERE,
      primaryUnmodifiedClick: true,
    })).toBeNull();
    expect(guardedInAppPath({
      href: '/dashboard/orders',
      target: null,
      hasDownload: false,
      currentHref: HERE,
      primaryUnmodifiedClick: false,
    })).toBeNull();
  });
});
