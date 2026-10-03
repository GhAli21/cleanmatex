/**
 * Request metadata for server components, server actions and helpers that have no `NextRequest`.
 *
 * Reads the current request's headers and device cookie via `next/headers`. Route handlers and the proxy
 * already have the request object — use {@link readRequestMeta} from `request-meta.ts` there instead.
 */

import { cookies, headers } from 'next/headers'
import { DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session'
import { readRequestMeta, type RequestMeta } from './request-meta'

/** Metadata of the request currently being handled (async: Next 15+ dynamic APIs). */
export async function getCurrentRequestMeta(): Promise<RequestMeta> {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()])
  return readRequestMeta(headerList, cookieStore.get(DEVICE_COOKIE_NAME)?.value)
}
