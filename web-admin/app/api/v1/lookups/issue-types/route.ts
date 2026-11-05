/**
 * GET /api/v1/lookups/issue-types
 * Active sys_issue_type_cd rows (auth-only, read-only HQ catalog).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { listActiveIssueTypes } from '@/lib/services/lookups';

/**
 * List active issue types for report pickers.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const result = await listActiveIssueTypes(auth.supabase);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, data: result.data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
