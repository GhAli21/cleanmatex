/**
 * POST /api/v1/tenants/me/logo
 * Upload tenant logo (max 2MB, PNG/JPG/SVG)
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadLogo } from '@/lib/services/tenants.service';

/**
 * Get tenant ID from authenticated session
 */
async function getTenantIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.user_metadata?.tenant_org_id) {
    throw new Error('Unauthorized');
  }

  return user.user_metadata.tenant_org_id;
}

/**
 * POST /api/v1/tenants/me/logo
 * Upload logo file
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Send file in form data with key "file"' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only PNG, JPG, and SVG are allowed',
          allowedTypes,
        },
        { status: 400 }
      );
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: 'File size exceeds 2MB limit',
          maxSize: '2MB',
          actualSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    // Upload logo
    const logoUrl = await uploadLogo(tenantId, file);

    return NextResponse.json({
      success: true,
      data: {
        logoUrl,
        uploadedAt: new Date().toISOString(),
      },
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading logo:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to upload logo';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/tenants/me/logo
 * Remove tenant logo
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    const supabase = await createClient();

    // Remove logo URL from tenant record
    const { error } = await supabase
      .from('org_tenants_mst')
      .update({
        logo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) {
      throw new Error('Failed to remove logo');
    }

    return NextResponse.json({
      success: true,
      message: 'Logo removed successfully',
    });
  } catch (error) {
    console.error('Error removing logo:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to remove logo' },
      { status: 500 }
    );
  }
}
