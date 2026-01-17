/**
 * CSRF Protection Utilities (Edge Compatible)
 * * Provides CSRF token generation and validation for protecting against
 * cross-site request forgery attacks.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const CSRF_TOKEN_COOKIE_NAME = 'csrf-token';
export const CSRF_TOKEN_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32; // 256 bits

/**
 * Helper: Convert ArrayBuffer/Uint8Array to Hex String
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure random CSRF token
 * Uses Web Crypto for Edge compatibility
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return bufferToHex(array);
}

/**
 * Get CSRF token from cookies (for server components/API routes)
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_COOKIE_NAME)?.value || null;
}

/**
 * Get CSRF token from request cookies (for middleware)
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value || null;
}

/**
 * Set CSRF token in cookies (for server components/API routes)
 */
export async function setCSRFToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Set CSRF token in response cookies (for middleware)
 */
export function setCSRFTokenInResponse(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Validate CSRF token from request
 * @param requestToken - Token from request header
 * @param cookieToken - Token from cookie
 * @returns true if tokens match
 */
export function validateCSRFToken(requestToken: string | null, cookieToken: string | null): boolean {
  if (!requestToken || !cookieToken) {
    return false;
  }

  // Note: Standard strict equality is not constant-time, 
  // but adequate for basic CSRF token comparison in Edge 
  // where timingSafeEqual is not readily available.
  return requestToken === cookieToken;
}

/**
 * Get CSRF token from request header
 */
export function getCSRFTokenFromHeader(headers: Headers): string | null {
  return headers.get(CSRF_TOKEN_HEADER_NAME);
}

/**
 * Hash token for additional security (optional)
 * WARNING: This is now ASYNC because Web Crypto is async
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}