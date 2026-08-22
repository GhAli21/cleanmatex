import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url'

describe('resolveSafeDashboardReturnUrl', () => {
  it('preserves an internal dashboard route and its query context', () => {
    expect(resolveSafeDashboardReturnUrl(
      '/dashboard/workboard?page=2&ownerScreenKey=processing',
      '/dashboard/processing',
    )).toBe('/dashboard/workboard?page=2&ownerScreenKey=processing')
  })

  it('falls back for missing, external, and protocol-relative paths', () => {
    const fallback = '/dashboard/processing'

    expect(resolveSafeDashboardReturnUrl(undefined, fallback)).toBe(fallback)
    expect(resolveSafeDashboardReturnUrl('https://example.com', fallback)).toBe(fallback)
    expect(resolveSafeDashboardReturnUrl('//example.com', fallback)).toBe(fallback)
  })

  it('rejects paths that normalize outside the Dashboard boundary', () => {
    const fallback = '/dashboard/processing'

    expect(resolveSafeDashboardReturnUrl('/dashboard/../settings', fallback)).toBe(fallback)
    expect(resolveSafeDashboardReturnUrl('/dashboard%2f..%2fsettings', fallback)).toBe(fallback)
  })
})
