import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useNotificationBell } from '@features/notifications/hooks/use-notification-bell'
import { notificationKeys } from '@/lib/query/notification-keys'

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on() {
        return this
      },
      subscribe: () => 'SUBSCRIBED',
    }),
    removeChannel: jest.fn(),
  }),
}))

const { useAuth } = jest.requireMock('@/lib/auth/auth-context') as {
  useAuth: jest.Mock
}

const TENANT_A = 'tenant-a'
const USER_A = 'user-a'

function mockAuth(tenantId: string | null, userId: string | null, ready = true) {
  useAuth.mockReturnValue({
    currentTenant: tenantId ? { tenant_id: tenantId } : null,
    user: userId ? { id: userId } : null,
    isTenantContextReady: ready,
    isLoading: false,
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('notificationKeys', () => {
  it('keeps unread and recent keys under the shared prefix', () => {
    expect(notificationKeys.unreadCount(TENANT_A, USER_A)).toEqual([
      'notifications',
      'unread-count',
      TENANT_A,
      USER_A,
    ])
    expect(notificationKeys.recent(TENANT_A, USER_A)[0]).toBe('notifications')
  })
})

describe('useNotificationBell', () => {
  let queryClient: QueryClient
  let fetchMock: jest.Mock

  beforeEach(() => {
    queryClient = createQueryClient()
    fetchMock = jest.fn((url: string) => {
      if (String(url).includes('unread-count')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, count: 2 }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
    })
    global.fetch = fetchMock as unknown as typeof fetch
    mockAuth(TENANT_A, USER_A)
  })

  afterEach(() => {
    queryClient.clear()
    jest.resetAllMocks()
  })

  it('fetches unread count once and does not poll', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useNotificationBell(), { wrapper })

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/notifications/unread-count')

    const query = queryClient.getQueryCache().find({
      queryKey: notificationKeys.unreadCount(TENANT_A, USER_A),
    })
    const refetchInterval = (query?.options as { refetchInterval?: number | false } | undefined)
      ?.refetchInterval
    expect(refetchInterval).toBeFalsy()
  })

  it('does not fetch the recent list until the dropdown opens', async () => {
    const wrapper = createWrapper(queryClient)
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useNotificationBell({ dropdownOpen: open }),
      { wrapper, initialProps: { open: false } }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    rerender({ open: true })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v1/notifications?')
    expect(String(fetchMock.mock.calls[1][0])).toContain('is_read=false')
  })

  it('shares one unread-count request across observers', async () => {
    const wrapper = createWrapper(queryClient)
    renderHook(
      () => {
        useNotificationBell()
        useNotificationBell()
        return null
      },
      { wrapper }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('does not fetch when tenant context is not ready', async () => {
    mockAuth(TENANT_A, USER_A, false)
    const wrapper = createWrapper(queryClient)
    renderHook(() => useNotificationBell(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
