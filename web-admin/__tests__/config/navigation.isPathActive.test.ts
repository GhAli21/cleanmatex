import { isPathActive } from '@/config/navigation';

describe('isPathActive', () => {
  it('matches exact paths', () => {
    expect(isPathActive('/dashboard/preparation', '/dashboard/preparation')).toBe(true);
    expect(isPathActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('treats /dashboard as hub only (no prefix match for child routes)', () => {
    expect(isPathActive('/dashboard/preparation/abc', '/dashboard')).toBe(false);
    expect(isPathActive('/dashboard/orders', '/dashboard')).toBe(false);
  });

  it('matches nested routes for non-hub items', () => {
    expect(isPathActive('/dashboard/preparation/order-1', '/dashboard/preparation')).toBe(true);
    expect(isPathActive('/dashboard/orders/1/full', '/dashboard/orders')).toBe(true);
  });

  it('ignores trailing slashes when comparing', () => {
    expect(isPathActive('/dashboard/preparation/', '/dashboard/preparation')).toBe(true);
  });
});
