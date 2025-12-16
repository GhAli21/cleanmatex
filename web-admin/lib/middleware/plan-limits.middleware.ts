/**
 * PRD-002: Plan Limits Middleware
 * Enforces subscription plan limits for orders, users, and branches
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  canCreateOrder,
  canAddUser,
  canAddBranch,
  type LimitCheckResult,
} from '@/lib/services/usage-tracking.service';

// ========================
// Error Responses
// ========================

/**
 * Create a 402 Payment Required error response
 * @param limitResult - Limit check result
 * @param upgradeUrl - URL to upgrade page
 * @returns NextResponse with 402 status
 */
function createLimitExceededResponse(
  limitResult: LimitCheckResult,
  upgradeUrl: string = '/dashboard/subscription/upgrade'
): NextResponse {
  return NextResponse.json(
    {
      error: 'LIMIT_EXCEEDED',
      message: limitResult.message,
      details: {
        limitType: limitResult.limitType,
        current: limitResult.current,
        limit: limitResult.limit,
        upgradeUrl,
      },
    },
    { status: 402 } // 402 Payment Required
  );
}

// ========================
// Limit Check Helpers
// ========================

/**
 * Extract tenant ID from request
 * Assumes tenant ID is available in user metadata or headers
 * @param request - Next.js request object
 * @returns Tenant ID or null
 */
async function getTenantIdFromRequest(request: NextRequest): Promise<string | null> {
  // Option 1: From custom header (if set by auth middleware)
  const tenantHeader = request.headers.get('x-tenant-id');
  if (tenantHeader) {
    return tenantHeader;
  }

  // Option 2: From JWT (requires decoding)
  // This would need proper JWT verification
  // For now, we'll rely on the server-side services to handle this

  return null;
}

// ========================
// Middleware Functions
// ========================

/**
 * Check order creation limit before processing request
 * Use this middleware on order creation endpoints
 * @param request - Next.js request
 * @param tenantId - Tenant ID
 * @returns NextResponse if limit exceeded, null otherwise
 */
export async function checkOrderLimit(
  request: NextRequest,
  tenantId: string
): Promise<NextResponse | null> {
  try {
    const result = await canCreateOrder(tenantId);

    if (!result.canProceed) {
      return createLimitExceededResponse(result);
    }

    return null; // Proceed with request
  } catch (error) {
    console.error('Error checking order limit:', error);
    // Don't block request on error, just log it
    return null;
  }
}

/**
 * Check user creation limit before processing request
 * Use this middleware on user creation endpoints
 * @param request - Next.js request
 * @param tenantId - Tenant ID
 * @returns NextResponse if limit exceeded, null otherwise
 */
export async function checkUserLimit(
  request: NextRequest,
  tenantId: string
): Promise<NextResponse | null> {
  try {
    const result = await canAddUser(tenantId);

    if (!result.canProceed) {
      return createLimitExceededResponse(result);
    }

    return null; // Proceed with request
  } catch (error) {
    console.error('Error checking user limit:', error);
    return null;
  }
}

/**
 * Check branch creation limit before processing request
 * Use this middleware on branch creation endpoints
 * @param request - Next.js request
 * @param tenantId - Tenant ID
 * @returns NextResponse if limit exceeded, null otherwise
 */
export async function checkBranchLimit(
  request: NextRequest,
  tenantId: string
): Promise<NextResponse | null> {
  try {
    const result = await canAddBranch(tenantId);

    if (!result.canProceed) {
      return createLimitExceededResponse(result);
    }

    return null; // Proceed with request
  } catch (error) {
    console.error('Error checking branch limit:', error);
    return null;
  }
}

// ========================
// Generic Limit Checker
// ========================

export type LimitType = 'order' | 'user' | 'branch';

/**
 * Generic limit checker
 * @param request - Next.js request
 * @param tenantId - Tenant ID
 * @param limitType - Type of limit to check
 * @returns NextResponse if limit exceeded, null otherwise
 */
export async function checkLimit(
  request: NextRequest,
  tenantId: string,
  limitType: LimitType
): Promise<NextResponse | null> {
  switch (limitType) {
    case 'order':
      return checkOrderLimit(request, tenantId);
    case 'user':
      return checkUserLimit(request, tenantId);
    case 'branch':
      return checkBranchLimit(request, tenantId);
    default:
      return null;
  }
}

// ========================
// HOF for API Route Protection
// ========================

/**
 * Higher-order function to wrap API route with limit checking
 * Usage example:
 *
 * export const POST = withLimitCheck('order', async (request, { tenantId }) => {
 *   // Your order creation logic here
 *   return NextResponse.json({ success: true });
 * });
 */
export function withLimitCheck(
  limitType: LimitType,
  handler: (request: NextRequest, context: { tenantId: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: any }) => {
    // Extract tenant ID from request
    const tenantId = await getTenantIdFromRequest(request);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    // Check limit
    const limitResponse = await checkLimit(request, tenantId, limitType);
    if (limitResponse) {
      return limitResponse; // Return 402 if limit exceeded
    }

    // Proceed with handler
    return handler(request, { tenantId });
  };
}

// ========================
// Example Usage in API Routes
// ========================

/**
 * Example: Order creation API route
 *
 * // app/api/v1/orders/route.ts
 * import { withLimitCheck } from '@/lib/middleware/plan-limits.middleware';
 * import { incrementOrderCount } from '@/lib/services/usage-tracking.service';
 *
 * export const POST = withLimitCheck('order', async (request, { tenantId }) => {
 *   const orderData = await request.json();
 *
 *   // Create order
 *   const order = await createOrder(tenantId, orderData);
 *
 *   // Increment usage counter
 *   await incrementOrderCount(tenantId);
 *
 *   return NextResponse.json({ order }, { status: 201 });
 * });
 */

/**
 * Example: User creation API route
 *
 * // app/api/v1/users/route.ts
 * import { withLimitCheck } from '@/lib/middleware/plan-limits.middleware';
 *
 * export const POST = withLimitCheck('user', async (request, { tenantId }) => {
 *   const userData = await request.json();
 *
 *   // Create user
 *   const user = await createUser(tenantId, userData);
 *
 *   return NextResponse.json({ user }, { status: 201 });
 * });
 */

/**
 * Example: Manual limit check in API route
 *
 * // app/api/v1/orders/route.ts
 * export async function POST(request: NextRequest) {
 *   const tenantId = await getTenantIdFromRequest(request);
 *
 *   if (!tenantId) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   // Check limit manually
 *   const limitResponse = await checkOrderLimit(request, tenantId);
 *   if (limitResponse) {
 *     return limitResponse; // Return 402 if limit exceeded
 *   }
 *
 *   // Proceed with order creation
 *   // ...
 * }
 */
