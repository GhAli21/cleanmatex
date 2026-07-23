/**
 * GET /api/v1/lookups/issue-types
 * Active sys_issue_type_cd rows (auth-only, read-only HQ catalog).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listActiveIssueTypes } from '@/lib/services/lookups';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return supabase;
}

/**
 * List active issue types for report pickers.
 */
export async function GET() {
  try {
    const supabase = await requireUser();
    const result = await listActiveIssueTypes(supabase);
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
