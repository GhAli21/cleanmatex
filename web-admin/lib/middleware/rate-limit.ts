/**
 * Rate Limiting Middleware
 * 
 * Provides rate limiting functionality to prevent brute force attacks and API abuse.
 * Uses Upstash Redis for distributed rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

// Import rate limiting dependencies (optional - will fail gracefully if not installed)
let Ratelimit: any;
let Redis: any;

try {
  // Use require for optional dependencies to avoid breaking if packages aren't installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ratelimitModule = require('@upstash/ratelimit');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const redisModule = require('@upstash/redis');
  Ratelimit = ratelimitModule.Ratelimit;
  Redis = redisModule.Redis;
} catch (error) {
  // Rate limiting dependencies not installed - will be disabled
  // This is fine for development, but should be configured in production
  if (process.env.NODE_ENV === 'development') {
    console.warn('Rate limiting dependencies not found. Install @upstash/ratelimit and @upstash/redis to enable rate limiting.');
  }
}

// Initialize Redis client
// Use Upstash Redis REST API if configured, otherwise create a no-op client for local dev
let redis: any = null;

if (Redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else if (process.env.NODE_ENV === 'development') {
  // In development, log warning but allow requests (fail open)
  console.warn(
    'Rate limiting disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured, or dependencies not installed'
  );
}

/**
 * Create rate limiter if Redis and Ratelimit are available
 */
function createRateLimiter(limit: number, window: string, prefix: string) {
  if (!redis || !Ratelimit) {
    return null; // Rate limiting disabled if Redis not configured or dependencies not installed
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `@upstash/ratelimit/${prefix}`,
  });
}

/**
 * Rate limiters for different use cases
 */
export const rateLimiters = {
  /**
   * Login attempts: 5 per 15 minutes per IP
   */
  login: createRateLimiter(5, '15 m', 'login'),

  /**
   * Password reset: 3 per hour per email
   */
  passwordReset: createRateLimiter(3, '1 h', 'password-reset'),

  /**
   * API endpoints: 1000 per hour per tenant
   */
  apiTenant: createRateLimiter(1000, '1 h', 'api-tenant'),

  /**
   * General API: 200 per minute per user
   */
  apiUser: createRateLimiter(200, '1 m', 'api-user'),

  /**
   * Registration: 5 per hour per IP
   */
  registration: createRateLimiter(5, '1 h', 'registration'),
};

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address (NextRequest doesn't have ip property)
  return 'unknown';
}

/**
 * Rate limit response with proper headers
 */
function createRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    },
    { status: 429 }
  );

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());
  response.headers.set('Retry-After', Math.ceil((reset - Date.now()) / 1000).toString());

  return response;
}

/**
 * Rate limit check for login attempts
 */
export async function checkLoginRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip rate limiting if Redis not configured (development mode)
  if (!rateLimiters.login) {
    return null;
  }

  try {
    const ip = getClientIP(request);
    const { success, limit, remaining, reset } = await rateLimiters.login.limit(ip);

    if (!success) {
      logger.warn('Login rate limit exceeded', {
        feature: 'rate-limit',
        action: 'login',
        ip,
        limit,
        remaining,
      });

      return createRateLimitResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    logger.error('Error checking login rate limit', error as Error, {
      feature: 'rate-limit',
      action: 'login',
    });

    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Rate limit check for password reset requests
 */
export async function checkPasswordResetRateLimit(
  email: string
): Promise<{ success: boolean; response?: NextResponse }> {
  // Skip rate limiting if Redis not configured (development mode)
  if (!rateLimiters.passwordReset) {
    return { success: true };
  }

  try {
    const { success, limit, remaining, reset } = await rateLimiters.passwordReset.limit(email);

    if (!success) {
      logger.warn('Password reset rate limit exceeded', {
        feature: 'rate-limit',
        action: 'password-reset',
        email,
        limit,
        remaining,
      });

      return {
        success: false,
        response: createRateLimitResponse(limit, remaining, reset),
      };
    }

    return { success: true };
  } catch (error) {
    logger.error('Error checking password reset rate limit', error as Error, {
      feature: 'rate-limit',
      action: 'password-reset',
    });

    // Fail open - allow request if rate limiting fails
    return { success: true };
  }
}

/**
 * Rate limit check for API endpoints (per tenant)
 */
export async function checkAPIRateLimitTenant(
  tenantId: string
): Promise<NextResponse | null> {
  // Skip rate limiting if Redis not configured (development mode)
  if (!rateLimiters.apiTenant) {
    return null;
  }

  try {
    const { success, limit, remaining, reset } = await rateLimiters.apiTenant.limit(tenantId);

    if (!success) {
      logger.warn('API rate limit exceeded (tenant)', {
        feature: 'rate-limit',
        action: 'api-tenant',
        tenantId,
        limit,
        remaining,
      });

      return createRateLimitResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    logger.error('Error checking API rate limit (tenant)', error as Error, {
      feature: 'rate-limit',
      action: 'api-tenant',
    });

    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Rate limit check for API endpoints (per user)
 */
export async function checkAPIRateLimitUser(
  userId: string
): Promise<NextResponse | null> {
  // Skip rate limiting if Redis not configured (development mode)
  if (!rateLimiters.apiUser) {
    return null;
  }

  try {
    const { success, limit, remaining, reset } = await rateLimiters.apiUser.limit(userId);

    if (!success) {
      logger.warn('API rate limit exceeded (user)', {
        feature: 'rate-limit',
        action: 'api-user',
        userId,
        limit,
        remaining,
      });

      return createRateLimitResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    logger.error('Error checking API rate limit (user)', error as Error, {
      feature: 'rate-limit',
      action: 'api-user',
    });

    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Rate limit check for registration
 */
export async function checkRegistrationRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip rate limiting if Redis not configured (development mode)
  if (!rateLimiters.registration) {
    return null;
  }

  try {
    const ip = getClientIP(request);
    const { success, limit, remaining, reset } = await rateLimiters.registration.limit(ip);

    if (!success) {
      logger.warn('Registration rate limit exceeded', {
        feature: 'rate-limit',
        action: 'registration',
        ip,
        limit,
        remaining,
      });

      return createRateLimitResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    logger.error('Error checking registration rate limit', error as Error, {
      feature: 'rate-limit',
      action: 'registration',
    });

    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
  limiter: 'tenant' | 'user' | 'ip',
  identifier?: (request: NextRequest) => Promise<string | null>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    let rateLimitResponse: NextResponse | null = null;

    try {
      if (limiter === 'ip') {
        rateLimitResponse = await checkAPIRateLimitUser(getClientIP(request));
      } else if (limiter === 'tenant') {
        const tenantId = identifier ? await identifier(request) : null;
        if (tenantId) {
          rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
        }
      } else if (limiter === 'user') {
        const userId = identifier ? await identifier(request) : null;
        if (userId) {
          rateLimitResponse = await checkAPIRateLimitUser(userId);
        }
      }

      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    } catch (error) {
      logger.error('Error in rate limit wrapper', error as Error, {
        feature: 'rate-limit',
        action: 'withRateLimit',
      });
      // Continue if rate limiting fails
    }

    return handler(request, ...args);
  };
}

