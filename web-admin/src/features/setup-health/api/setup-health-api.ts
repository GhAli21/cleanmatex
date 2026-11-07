/**
 * Setup Health API client (feature-owned).
 */
import type { SetupHealthList, SetupHealthSummary } from '@/lib/types/setup-health'

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', signal })
  const body = (await res.json().catch(() => ({}))) as Envelope<T>
  if (!res.ok || !body.data) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body.data
}

/** All visible checks plus domain labels (GET /api/v1/setup-health). */
export function fetchSetupHealth(signal?: AbortSignal): Promise<SetupHealthList> {
  return get<SetupHealthList>('/api/v1/setup-health', signal)
}

/** Counts and banner blockers (GET /api/v1/setup-health/summary). */
export function fetchSetupHealthSummary(signal?: AbortSignal): Promise<SetupHealthSummary> {
  return get<SetupHealthSummary>('/api/v1/setup-health/summary', signal)
}
