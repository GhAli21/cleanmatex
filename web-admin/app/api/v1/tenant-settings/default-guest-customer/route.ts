/**
 * GET /api/v1/tenant-settings/default-guest-customer
 * Returns default guest customer details when TENANT_DEFAULT_GUEST_CUSTOMER_ID is configured.
 * Used by customer picker modal for walk-in / anonymous orders.
 * Uses Supabase for consistency with customers service (avoids Prisma serverless issues).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { SETTING_CODES } from '@/lib/services/tenant-settings.service';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';

/**
 *
 * @param _request
 */
export async function GET(_request: NextRequest) {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      // Default guest lookup runs on every picker open, so it should surface an error
      // instead of leaving the modal in a pending state.
      setTimeout(() => reject(new Error('Request timeout')), 8000);
    });

    const authContext = await Promise.race([getAuthContext(), timeoutPromise]);
    const hasAccess = await Promise.race([
      hasPermissionServer('customers:read'),
      timeoutPromise,
    ]);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: customers:read' },
        { status: 403 }
      );
    }
    const { tenantId } = authContext;

    const supabase = await createClient();
    const tenantSettings = createTenantSettingsService(supabase);

    const customerIdRaw = await Promise.race([
      tenantSettings.getSettingValue(
        tenantId,
        SETTING_CODES.TENANT_DEFAULT_GUEST_CUSTOMER_ID
      ),
      timeoutPromise,
    ]);
    const customerId =
      typeof customerIdRaw === 'string' && customerIdRaw.trim().length > 0
        ? customerIdRaw.trim()
        : null;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Default guest customer not configured' },
        { status: 404 }
      );
    }

    const { data: customer, error } = await supabase
      .from('org_customers_mst')
      .select('id, name, name2, display_name, first_name, last_name, phone, email')
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[default-guest-customer] Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch default guest customer' },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Default guest customer not found or inactive' },
        { status: 404 }
      );
    }

    const displayName =
      customer.display_name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
      customer.name ||
      customer.name2 ||
      '';

    return NextResponse.json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        name2: customer.name2,
        displayName: displayName.trim() || null,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error('[default-guest-customer] Error:', error);
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { success: false, error: 'Request timeout - please try again' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch default guest customer' },
      { status: 500 }
    );
  }
}
