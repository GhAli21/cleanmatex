import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/cash-drawer'
import { linkedDrawerCloseHref } from '@features/pos-sessions/model/pos-session-drawer-link'

const session = {
  cash_drawer_id: 'drawer-1',
  cash_drawer_session_id: 'session-1',
  cash_drawer_session_status: CASH_DRAWER_SESSION_STATUSES.OPEN,
}

describe('linkedDrawerCloseHref', () => {
  it('points an open drawer session at the close wizard', () => {
    expect(linkedDrawerCloseHref(session)).toBe(
      '/dashboard/internal_fin/cash-drawers/drawer-1?closeSession=session-1'
    )
  })

  it('points a closing drawer session at the same close wizard', () => {
    expect(
      linkedDrawerCloseHref({
        ...session,
        cash_drawer_session_status: CASH_DRAWER_SESSION_STATUSES.CLOSING,
      })
    ).toBe('/dashboard/internal_fin/cash-drawers/drawer-1?closeSession=session-1')
  })

  it('omits the link once the drawer session is finished', () => {
    expect(
      linkedDrawerCloseHref({
        ...session,
        cash_drawer_session_status: CASH_DRAWER_SESSION_STATUSES.CLOSED,
      })
    ).toBeNull()
  })

  it('keeps the link when close was refused and the listed status is stale', () => {
    expect(
      linkedDrawerCloseHref(
        { ...session, cash_drawer_session_status: CASH_DRAWER_SESSION_STATUSES.CLOSED },
        { whenBlocked: true }
      )
    ).toBe('/dashboard/internal_fin/cash-drawers/drawer-1?closeSession=session-1')
  })
})
