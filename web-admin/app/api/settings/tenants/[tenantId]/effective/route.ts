/**
 * GET /api/settings/tenants/[tenantId]/effective
 * Get effective settings with 7-layer resolution
 *
 * Query params:
 * - branchId: Optional branch ID for branch-scoped settings
 * - userId: Optional user ID for user-scoped settings (can be 'me' for current user)
 *
 * Protected endpoint (requires authentication)
 *
 * This endpoint proxies requests to Platform HQ API (cleanmatexsaas/platform-api)
 * to centralize settings resolution logic.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/services/tenants.service";
import { hqApiClient } from "@/lib/api/hq-api-client";
import {
  getSessionAuthorizationHeader,
  requireAuth,
} from "@/lib/auth/require-auth";

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const authHeader = await getSessionAuthorizationHeader(auth.supabase);
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { tenantId: paramTenantId } = await params;

    // Tenant is resolved server-side from the authenticated session; a URL must never select another tenant.
    const tenant = await getCurrentTenant();
    if (paramTenantId !== "me" && paramTenantId !== tenant.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const tenantId = tenant.id;

    // Resolve userId ('me' -> actual user ID)
    let userId: string | undefined = searchParams.get("userId") || undefined;
    if (userId === "me") {
      userId = auth.user.id;
    }

    // Get branchId from query params
    const branchId: string | undefined =
      searchParams.get("branchId") || undefined;

    // Call Platform HQ API to resolve settings
    const resolvedSettings = await hqApiClient.getEffectiveSettings(tenantId, {
      branchId,
      userId,
      authHeader,
    });

    return NextResponse.json({ data: resolvedSettings });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("Error in effective settings endpoint:", error);

    // Handle authentication errors (missing token in web-admin)
    if (
      error instanceof Error &&
      error.message.includes("No authentication token")
    ) {
      return NextResponse.json(
        {
          error: "Authentication required",
          details:
            "Set HQ_SERVICE_TOKEN in web-admin/.env.local or ensure the request forwards an Authorization header. See docs/HQ_SERVICE_TOKEN_GUIDE.md.",
        },
        { status: 401 },
      );
    }

    // Handle 401 / "Authentication required" from HQ API (invalid or missing token)
    if (
      error instanceof Error &&
      (details.toLowerCase().includes("authentication required") ||
        details.includes("Unauthorized") ||
        details.includes("401"))
    ) {
      return NextResponse.json(
        {
          error: "HQ API authentication failed",
          details:
            'Platform HQ API rejected the request. Set a valid HQ_SERVICE_TOKEN in web-admin/.env.local (run "npm run generate-service-token" in cleanmatexsaas/platform-api and paste the token).',
        },
        { status: 401 },
      );
    }

    // Handle forbidden errors
    if (
      error instanceof Error &&
      (error.message.includes("Forbidden") || error.message.includes("403"))
    ) {
      return NextResponse.json(
        { error: "Access denied", details },
        { status: 403 },
      );
    }

    // Handle not found errors
    if (
      error instanceof Error &&
      (error.message.includes("Not found") || error.message.includes("404"))
    ) {
      return NextResponse.json(
        { error: "Tenant or settings not found", details },
        { status: 404 },
      );
    }

    // Handle tenant access errors
    if (error instanceof Error && error.message.includes("No tenant access")) {
      return NextResponse.json(
        { error: "No tenant access found", details },
        { status: 403 },
      );
    }

    // Generic error handling
    return NextResponse.json(
      {
        error: "Failed to fetch effective settings",
        details,
      },
      { status: 500 },
    );
  }
}
