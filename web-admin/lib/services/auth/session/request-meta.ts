/**
 * Request metadata used by session registration/validation: client IP, User-Agent and the device cookie.
 *
 * Pure header/cookie readers so they work in the proxy, route handlers and server actions alike.
 */

import { DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session'
import { isValidDeviceId } from './domain/device'

/** What we learn about the caller from the HTTP request. */
export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
  /** Raw device cookie value when present and well-formed; null otherwise. */
  deviceId: string | null
}

/** Minimal header reader (NextRequest.headers and next/headers both satisfy it). */
interface HeaderReader {
  get(name: string): string | null
}

/**
 * Client IP: first hop of x-forwarded-for (the INET column needs a single address), else x-real-ip.
 *
 * @param headers - Request headers
 */
export function getClientIp(headers: HeaderReader): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || null
}

/**
 * Collect request metadata.
 *
 * @param headers - Request headers
 * @param deviceCookie - Raw `cmx-did` cookie value (may be undefined)
 */
export function readRequestMeta(headers: HeaderReader, deviceCookie: string | undefined | null): RequestMeta {
  return {
    ipAddress: getClientIp(headers),
    userAgent: headers.get('user-agent'),
    deviceId: isValidDeviceId(deviceCookie) ? deviceCookie : null,
  }
}

/**
 * Cookie options for the device cookie: httpOnly (not readable by scripts), SameSite=Lax, ~400 days.
 *
 * @param secure - true in production (HTTPS only)
 */
export function deviceCookieOptions(secure: boolean) {
  return {
    name: DEVICE_COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
  }
}
