/**
 * GET /api/v1/processing-steps/[category]
 * Get processing steps configuration for a service category
 * Returns tenant overrides if available, otherwise system defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';
import { ProcessingStepsService } from '@/lib/services/processing-steps-service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const auth = await validateJWTWithTenant(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { tenantId } = auth;
    const { category } = await params;

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Service category code is required' },
        { status: 400 }
      );
    }

    // Decode category if URL encoded
    const serviceCategoryCode = decodeURIComponent(category).toUpperCase();

    // Get processing steps (tenant override → system default)
    const result = await ProcessingStepsService.getProcessingStepsForCategory({
      tenantId,
      serviceCategoryCode,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch processing steps' },
        { status: result.error?.includes('not found') ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.steps || [],
      serviceCategoryCode,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

