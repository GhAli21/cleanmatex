import { getNavigationForRole } from '@/config/navigation'

describe('getNavigationForRole permission menu', () => {
  it('shows a permission row only when the user holds that permission', () => {
    const sections = getNavigationForRole('cashier', {}, ['orders:read', 'customers:read', 'pos_session:view'])
    const keys = sections.map((section) => section.key)

    expect(keys).toContain('home')
    expect(keys).toContain('help')
    expect(keys).toContain('orders')
    expect(keys).toContain('customers')
    expect(keys).not.toContain('jhtestui')
    expect(keys).not.toContain('tenant_admin')

    const orders = sections.find((section) => section.key === 'orders')
    expect(orders?.children?.some((child) => child.key === 'orders_list')).toBe(true)
    expect(orders?.children?.some((child) => child.key === 'orders_new')).toBe(false)
  })

  it('uses sys_components_cd.main_permission_code when it differs from navigation.ts', () => {
    const sections = getNavigationForRole(
      'cashier',
      {},
      ['orders:read'],
      {
        // navigation.ts requires orders:create for New Order. The database code is orders:read.
        orders_new: 'orders:read',
        // navigation.ts requires admin:manage. A null database code is open to every signed-in user.
        jhtestui: null,
      },
    )

    const orders = sections.find((section) => section.key === 'orders')
    expect(orders?.children?.some((child) => child.key === 'orders_new')).toBe(true)
    expect(sections.some((section) => section.key === 'jhtestui')).toBe(true)
  })

  it('shows reports that have no permission only when the analytics flag is on', () => {
    const withoutFlag = getNavigationForRole('operator', {}, ['orders:read'])
    const reportsWithoutFlag = withoutFlag.find((section) => section.key === 'reports')
    expect(reportsWithoutFlag?.children?.some((child) => child.key === 'reports_orders') ?? false).toBe(false)

    const withFlag = getNavigationForRole('operator', { advanced_analytics: true }, ['orders:read'])
    expect(withFlag.find((section) => section.key === 'reports')?.children?.some((child) => child.key === 'reports_orders')).toBe(true)
  })
})
