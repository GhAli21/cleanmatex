import {
  collapseUserPrefRows,
  pickLatestUserPrefRow,
  userPrefScopeKey,
} from '@lib/notifications/user-prefs'

describe('notification user pref collapse', () => {
  it('treats null event and branch as the same coarse scope', () => {
    expect(
      userPrefScopeKey({ user_id: 'u1', channel_code: 'WHATSAPP', event_code: null, branch_id: null }),
    ).toBe(userPrefScopeKey({ user_id: 'u1', channel_code: 'WHATSAPP' }))
  })

  it('does not collapse the same channel across different users', () => {
    const rows = collapseUserPrefRows([
      {
        user_id: 'u1',
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: false,
        updated_at: '2026-09-12T02:00:00.000Z',
      },
      {
        user_id: 'u2',
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: true,
        updated_at: '2026-09-12T03:00:00.000Z',
      },
    ])

    expect(rows).toHaveLength(2)
  })

  it('keeps the newest WhatsApp row when older disabled duplicates exist', () => {
    const latest = pickLatestUserPrefRow([
      {
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: false,
        created_at: '2026-07-24T08:01:00.000Z',
        updated_at: '2026-07-24T08:01:00.000Z',
      },
      {
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: true,
        created_at: '2026-09-12T02:16:52.000Z',
        updated_at: '2026-09-12T02:16:52.000Z',
      },
    ])

    expect(latest?.is_enabled).toBe(true)
  })

  it('collapses duplicates per channel and leaves other channels alone', () => {
    const rows = collapseUserPrefRows([
      {
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: false,
        updated_at: '2026-07-24T08:01:00.000Z',
      },
      {
        channel_code: 'WHATSAPP',
        event_code: null,
        is_enabled: true,
        updated_at: '2026-09-12T02:16:52.000Z',
      },
      {
        channel_code: 'SMS',
        event_code: null,
        is_enabled: false,
        updated_at: '2026-06-18T09:51:04.000Z',
      },
    ])

    const whatsapp = rows.find((row) => row.channel_code === 'WHATSAPP')
    const sms = rows.find((row) => row.channel_code === 'SMS')
    expect(rows).toHaveLength(2)
    expect(whatsapp?.is_enabled).toBe(true)
    expect(sms?.is_enabled).toBe(false)
  })
})
