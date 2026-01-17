/**
 * CSRF Protection Middleware
 * 
 * Validates CSRF tokens on state-changing HTTP methods (POST, PUT, DELETE, PATCH)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCSRFToken, getCSRFTokenFromRequest, validateCSRFToken, getCSRFTokenFromHeader } from '@/lib/security/csrf';
import { logger } from '@/lib/utils/logger';

/**
 * HTTP methods that require CSRF protection
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Routes that should skip CSRF validation
 * (e.g., webhooks, public APIs that use other auth methods)
 */
const CSRF_EXEMPT_ROUTES = [
  '/api/webhooks/',
  '/api/public/',
];

/**
 * Check if route is exempt from CSRF protection
 */
function isExemptRoute(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * CSRF validation middleware
 * Should be applied to API routes that handle state-changing operations
 */
export async function validateCSRF(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method;
  const pathname = request.nextUrl.pathname;

  // Skip CSRF validation for non-protected methods
  if (!PROTECTED_METHODS.includes(method)) {
    return null;
  }

  // Skip CSRF validation for exempt routes
  if (isExemptRoute(pathname)) {
    return null;
  }

  try {
    // Get token from header
    const requestToken = getCSRFTokenFromHeader(request.headers);

    // Get token from cookie (try request first for middleware, then async cookies for API routes)
    let cookieToken: string | null = null;
    try {
      cookieToken = getCSRFTokenFromRequest(request);
    } catch {
      // Fallback to async cookies for API routes
      cookieToken = await getCSRFToken();
    }

    // Validate tokens match
    if (!validateCSRFToken(requestToken, cookieToken)) {
      logger.warn('CSRF validation failed', {
        feature: 'csrf',
        action: 'validate',
        method,
        pathname,
        hasRequestToken: !!requestToken,
        hasCookieToken: !!cookieToken,
      });

      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      );
    }

    return null; // Validation passed
  } catch (error) {
    logger.error('Error validating CSRF token', error as Error, {
      feature: 'csrf',
      action: 'validate',
      method,
      pathname,
    });

    // Fail closed - reject request if validation fails
    return NextResponse.json(
      {
        error: 'CSRF validation error',
        message: 'An error occurred while validating the request. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * Higher-order function to wrap API route handlers with CSRF protection
 */
export function withCSRF<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    return handler(request, ...args);
  };
}

