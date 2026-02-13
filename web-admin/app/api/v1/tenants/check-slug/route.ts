/**
 * GET /api/v1/tenants/check-slug?slug=xxx
 * Public endpoint - checks if tenant slug is available (used during registration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug')?.trim().toLowerCase();

    if (!slug || slug.length < 3) {
      return NextResponse.json(
        { available: false, error: 'Slug must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Slug format: lowercase, alphanumeric and hyphens only
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { available: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('org_tenants_mst')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Slug check error:', error);
      return NextResponse.json(
        { available: false, error: 'Failed to check slug availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      available: !data,
      slug,
    });
  } catch (err) {
    console.error('Check slug error:', err);
    return NextResponse.json(
      { available: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
