/**
 * GET /api/v1/tenant-settings/default-guest-customer
 * Returns default guest customer details when TENANT_DEFAULT_GUEST_CUSTOMER_ID is configured.
 * Used by customer picker modal for walk-in / anonymous orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { SETTING_CODES } from '@/lib/services/tenant-settings.service';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/middleware/require-permission';

export async function GET(_request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:read')(_request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { tenantId } = authCheck;

    const supabase = await createClient();
    const tenantSettings = createTenantSettingsService(supabase);

    const customerIdRaw = await tenantSettings.getSettingValue(
      tenantId,
      SETTING_CODES.TENANT_DEFAULT_GUEST_CUSTOMER_ID
    );

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

    const customer = await prisma.org_customers_mst.findFirst({
      where: {
        id: customerId,
        tenant_org_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        name2: true,
        display_name: true,
        first_name: true,
        last_name: true,
        phone: true,
        email: true,
      },
    });

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
    return NextResponse.json(
      { success: false, error: 'Failed to fetch default guest customer' },
      { status: 500 }
    );
  }
}
