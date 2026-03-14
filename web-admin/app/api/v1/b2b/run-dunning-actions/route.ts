/**
 * B2B Run Dunning Actions API
 * POST /api/v1/b2b/run-dunning-actions
 * Executes dunning actions (email, sms, hold_orders) for overdue statements.
 * Call manually (admin) or via cron with CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService, SETTING_CODES } from '@/lib/services/tenant-settings.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  executeDunningActions,
  type DunningLevel,
} from '@/lib/services/dunning.service';

function parseDunningLevels(value: unknown): DunningLevel[] {
  if (!value || !Array.isArray(value)) return [];
  return (value as unknown[]).filter((item): item is DunningLevel => {
    if (!item || typeof item !== 'object') return false;
    const o = item as Record<string, unknown>;
    return (
      typeof o.days === 'number' &&
      typeof o.action === 'string' &&
      ['email', 'sms', 'hold_orders'].includes(o.action)
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    // Allow cron with CRON_SECRET + x-tenant-id, or require b2b_statements:create (session)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    const isCronAuth = !!expectedSecret && cronSecret === expectedSecret;

    let resolvedTenantId: string;
    if (isCronAuth) {
      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: 'x-tenant-id header required for cron' },
          { status: 400 }
        );
      }
      resolvedTenantId = tenantId;
    } else {
      const authCheck = await requirePermission('b2b_statements:create')(request);
      if (authCheck instanceof NextResponse) return authCheck;
      resolvedTenantId = authCheck.tenantId;
    }

    const supabase = await createClient();
    const settingsService = createTenantSettingsService(supabase);
    const raw = await settingsService.getSettingValueJson(
      resolvedTenantId,
      SETTING_CODES.B2B_DUNNING_LEVELS
    );
    let dunningLevels = parseDunningLevels(raw);
    if (dunningLevels.length === 0) {
      dunningLevels = [
        { days: 7, action: 'email' },
        { days: 14, action: 'sms' },
        { days: 30, action: 'hold_orders' },
      ];
    }

    const results = await executeDunningActions(resolvedTenantId, dunningLevels);

    return NextResponse.json({
      success: true,
      data: { executed: results.length, results },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run dunning actions';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
