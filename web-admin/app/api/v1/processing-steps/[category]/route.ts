/**
 * GET /api/v1/processing-steps/[category]
 * Get processing steps configuration for a service category
 * Returns tenant overrides if available, otherwise system defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProcessingStepsService } from '@/lib/services/processing-steps-service';

async function getAuthContext() {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { tenantId } = await getAuthContext();
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

