import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { ReactNode } from 'react'
import { RequireFeature } from '@features/auth/ui/RequireFeature'
import { fetchTenantFeatureFlags } from '@/lib/api/feature-flags-client'
import {
  useFeature,
  useFeatureFlagsQuery,
  useFeatureOptional,
} from '@/lib/hooks/use-feature-flags'
import {
  featureFlagKeys,
  invalidateTenantFeatureFlags,
  removeAllFeatureFlagQueries,
} from '@/lib/query/feature-flag-keys'

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}))

const { useAuth } = jest.requireMock('@/lib/auth/auth-context') as {
  useAuth: jest.Mock
}

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

function mockAuth(tenantId: string | null, ready = true) {
  useAuth.mockReturnValue({
    currentTenant: tenantId ? { tenant_id: tenantId } : null,
    isTenantContextReady: ready,
    isLoading: false,
    user: tenantId ? { id: 'user-1' } : null,
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 5 * 60 * 1000,
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

describe('featureFlagKeys', () => {
  it('keeps tenant keys under the shared prefix', () => {
    expect(featureFlagKeys.all).toEqual(['feature-flags'])
    expect(featureFlagKeys.tenant(TENANT_A)).toEqual(['feature-flags', TENANT_A])
  })
})

describe('shared feature-flags query', () => {
  let queryClient: QueryClient
  let fetchMock: jest.Mock

  beforeEach(() => {
    queryClient = createQueryClient()
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pdf_invoices: true, b2b_contracts: false }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    mockAuth(TENANT_A)
  })

  afterEach(() => {
    queryClient.clear()
    jest.resetAllMocks()
  })

  it('dedupes RequireFeature, useFeature, and the shared query into one request', async () => {
    const wrapper = createWrapper(queryClient)

    renderHook(() => useFeatureFlagsQuery(), { wrapper })
    renderHook(() => useFeature('pdf_invoices'), { wrapper })
    renderHook(() => useFeature('b2b_contracts'), { wrapper })
    render(
      <>
        <RequireFeature feature="pdf_invoices">invoices</RequireFeature>
        <RequireFeature feature="b2b_contracts">b2b</RequireFeature>
      </>,
      { wrapper }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('invoices')).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/feature-flags')
    expect(screen.queryByText('b2b')).not.toBeInTheDocument()
  })

  it('does not fetch again while the tenant cache is fresh', async () => {
    const wrapper = createWrapper(queryClient)
    const first = renderHook(() => useFeature('pdf_invoices'), { wrapper })
    await waitFor(() => expect(first.result.current).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useFeatureFlagsQuery(), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not start a request for useFeatureOptional(undefined)', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useFeatureOptional(undefined), { wrapper })
    expect(result.current).toBe(true)
    await waitFor(() => expect(result.current).toBe(true))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never shows Tenant A flags for Tenant B', async () => {
    queryClient.setQueryData(featureFlagKeys.tenant(TENANT_A), {
      pdf_invoices: true,
    })
    queryClient.setQueryData(featureFlagKeys.tenant(TENANT_B), {
      pdf_invoices: false,
    })
    mockAuth(TENANT_B)

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useFeature('pdf_invoices'), { wrapper })
    expect(result.current).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the new tenant after a tenant switch', async () => {
    const wrapper = createWrapper(queryClient)
    const { result, rerender } = renderHook(() => useFeatureFlagsQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pdf_invoices: false }),
    })
    mockAuth(TENANT_B)
    rerender()

    await waitFor(() => {
      expect(result.current.data?.pdf_invoices).toBe(false)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('invalidateTenantFeatureFlags targets the canonical tenant key', async () => {
    const qc = {
      invalidateQueries: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient
    await invalidateTenantFeatureFlags(qc, TENANT_A)
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: featureFlagKeys.tenant(TENANT_A),
    })
  })

  it('fails closed when the request errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useFeature('pdf_invoices'), { wrapper })
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('shows a loading skeleton until flags resolve', async () => {
    let resolveJson: ((value: Record<string, boolean>) => void) | undefined
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveJson = (flags) =>
          resolve({
            ok: true,
            json: async () => flags,
          })
      })
    )

    const wrapper = createWrapper(queryClient)
    render(
      <RequireFeature feature="pdf_invoices">ready</RequireFeature>,
      { wrapper }
    )
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('ready')).toBeNull()

    resolveJson?.({ pdf_invoices: true })
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
  })

  it('drops cached flags on logout so they cannot leak into a later session', async () => {
    queryClient.setQueryData(featureFlagKeys.tenant(TENANT_A), { pdf_invoices: true })
    removeAllFeatureFlagQueries(queryClient)
    expect(queryClient.getQueryData(featureFlagKeys.tenant(TENANT_A))).toBeUndefined()
  })
})

describe('fetchTenantFeatureFlags', () => {
  it('is the only GET /api/feature-flags client', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pdf_invoices: true }),
    }) as unknown as typeof fetch

    await expect(fetchTenantFeatureFlags()).resolves.toEqual({ pdf_invoices: true })
    expect(global.fetch).toHaveBeenCalledWith('/api/feature-flags')
  })
})
