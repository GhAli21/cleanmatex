/**
 * GET /api/v1/tenants/me - Get current tenant details
 * PATCH /api/v1/tenants/me - Update tenant profile
 * Protected endpoints (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenant, updateTenant } from '@/lib/services/tenants.service';
import { getCurrentSubscription } from '@/lib/services/subscriptions.service';
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';
import type { TenantUpdateRequest } from '@/lib/types/tenant';

/**
 * GET /api/v1/tenants/me
 * Returns current tenant details with subscription and usage info
 */
export async function GET(_request: NextRequest) {
  try {
    // Get tenant data first (simplified approach)
    const tenant = await getCurrentTenant();

    // Try to get subscription data (with error handling)
    let subscription = null;
    let usage = null;
    
    try {
      subscription = await getCurrentSubscription();
    } catch (subError) {
      console.warn('Subscription data not available:', subError instanceof Error ? subError.message : 'Unknown error');
    }

    try {
      usage = await getUsageMetrics(tenant.id);
    } catch (usageError) {
      console.warn('Usage data not available:', usageError instanceof Error ? usageError.message : 'Unknown error');
    }

    // Combine into response
    const response = {
      ...tenant,
      ...(subscription && {
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          trialEnds: subscription.trial_ends,
          ordersLimit: subscription.orders_limit,
          ordersUsed: subscription.orders_used,
          usagePercentage: Math.round(
            (subscription.orders_used / subscription.orders_limit) * 100
          ),
        },
      }),
      ...(usage && { usage }),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Error fetching tenant:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch tenant details' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/tenants/me
 * Updates tenant profile (name, contact, branding, business hours)
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    const updates: TenantUpdateRequest = await request.json();

    // Validate color format if provided
    if (updates.brand_color_primary || updates.brand_color_secondary) {
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;

      if (updates.brand_color_primary && !colorRegex.test(updates.brand_color_primary)) {
        return NextResponse.json(
          { error: 'Invalid brand_color_primary format. Use #RRGGBB' },
          { status: 400 }
        );
      }

      if (updates.brand_color_secondary && !colorRegex.test(updates.brand_color_secondary)) {
        return NextResponse.json(
          { error: 'Invalid brand_color_secondary format. Use #RRGGBB' },
          { status: 400 }
        );
      }
    }

    // Validate business hours format if provided
    if (updates.business_hours) {
      const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      for (const [day, hours] of Object.entries(updates.business_hours)) {
        if (!validDays.includes(day)) {
          return NextResponse.json(
            { error: `Invalid day: ${day}` },
            { status: 400 }
          );
        }

        if (hours && (typeof hours !== 'object' || !hours.open || !hours.close)) {
          return NextResponse.json(
            { error: `Invalid hours format for ${day}. Must have 'open' and 'close'` },
            { status: 400 }
          );
        }

        if (hours && (!timeRegex.test(hours.open) || !timeRegex.test(hours.close))) {
          return NextResponse.json(
            { error: `Invalid time format for ${day}. Use HH:mm (e.g., 08:00)` },
            { status: 400 }
          );
        }
      }
    }

    // Update tenant
    const updatedTenant = await updateTenant(tenant.id, updates);

    return NextResponse.json({
      success: true,
      data: updatedTenant,
      message: 'Tenant profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating tenant:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to update tenant profile' },
      { status: 500 }
    );
  }
}
