import { selectSessionTenant } from '@/lib/auth/session-tenant'

describe('selectSessionTenant', () => {
  const laundryA = { tenant_id: 'a', is_active: true, tenant_name: 'North' }
  const laundryB = { tenant_id: 'b', is_active: true, tenant_name: 'South' }

  it('keeps the session laundry when it is not the first row', () => {
    expect(selectSessionTenant([laundryA, laundryB], 'b')).toEqual(laundryB)
  })

  it('returns null when the session laundry is missing or inactive', () => {
    expect(selectSessionTenant([laundryA], 'b')).toBeNull()
    expect(selectSessionTenant([{ ...laundryB, is_active: false }], 'b')).toBeNull()
    expect(selectSessionTenant([laundryA, laundryB], null)).toBeNull()
  })

  it('does not fall back to the first organization', () => {
    expect(selectSessionTenant([laundryA, laundryB], 'missing')).toBeNull()
  })
})
