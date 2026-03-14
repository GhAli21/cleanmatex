/**
 * B2B Overdue Statements API
 * GET /api/v1/b2b/overdue-statements
 * Returns statements past due with balance > 0 (for Dunning UI).
 * Includes dunning level (from B2B_DUNNING_LEVELS) when applicable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService, SETTING_CODES } from '@/lib/services/tenant-settings.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getOverdueStatements,
  evaluateDunningLevels,
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

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('b2b_statements:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { tenantId } = authCheck;
    const statements = await getOverdueStatements();

    let dunningLevels: DunningLevel[] = [];
    try {
      const supabase = await createClient();
      const settingsService = createTenantSettingsService(supabase);
      const raw = await settingsService.getSettingValueJson(
        tenantId,
        SETTING_CODES.B2B_DUNNING_LEVELS
      );
      dunningLevels = parseDunningLevels(raw);
      if (dunningLevels.length === 0) {
        dunningLevels = [
          { days: 7, action: 'email' },
          { days: 14, action: 'sms' },
          { days: 30, action: 'hold_orders' },
        ];
      }
    } catch {
      dunningLevels = [
        { days: 7, action: 'email' },
        { days: 14, action: 'sms' },
        { days: 30, action: 'hold_orders' },
      ];
    }

    const data = statements.map((s) => {
      const level = evaluateDunningLevels(s, dunningLevels);
      return {
        ...s,
        dunningLevel: level
          ? { days: level.days, action: level.action }
          : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch overdue statements';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
