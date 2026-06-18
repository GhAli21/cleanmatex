import { lookupAuditActors } from '@/lib/services/audit-actor.service'

const createAdminSupabaseClientMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: () => createAdminSupabaseClientMock(),
}))

function createQueryBuilder(
  handlers: {
    userIdQuery?: (values: string[]) => Promise<unknown>
    idQuery?: (values: string[]) => Promise<unknown>
  },
) {
  let selectedColumns = ''

  return {
    from: jest.fn(() => ({
      select: jest.fn((value: string) => {
        selectedColumns = value
        return {
          eq: jest.fn(() => ({
            in: jest.fn((column: string, values: string[]) => {
              if (selectedColumns.includes('user_id, display_name, email, phone') && column === 'user_id') {
                return handlers.userIdQuery?.(values) ?? Promise.resolve({ data: [], error: null })
              }

              if (selectedColumns.includes('id, user_id, display_name, email, phone') && column === 'id') {
                return handlers.idQuery?.(values) ?? Promise.resolve({ data: [], error: null })
              }

              return Promise.resolve({ data: [], error: null })
            }),
          })),
        }
      }),
    })),
  }
}

describe('lookupAuditActors', () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset()
  })

  it('falls back to org_users_mst.id when user_id lookup returns no rows', async () => {
    createAdminSupabaseClientMock.mockReturnValue(
      createQueryBuilder({
        userIdQuery: async () => ({ data: [], error: null }),
        idQuery: async (values) => ({
          data: [
            {
              id: values[0],
              user_id: '370466e6-8b45-4e7d-b377-f0f9421deb59',
              display_name: 'Aisha Rahman',
              email: 'aisha@cleanmatex.test',
              phone: '+968 9000 1111',
            },
          ],
          error: null,
        }),
      }),
    )

    await expect(
      lookupAuditActors('tenant_1', ['fallback-row-id']),
    ).resolves.toEqual([
      {
        id: 'fallback-row-id',
        displayName: 'Aisha Rahman',
        email: 'aisha@cleanmatex.test',
        phone: '+968 9000 1111',
      },
    ])
  })
})
