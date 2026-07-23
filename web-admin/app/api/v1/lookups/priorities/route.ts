/**
 * GET /api/v1/lookups/priorities
 * Active sys_lkp_priority_cd rows (auth-only).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return supabase;
}

/**
 *
 */
export async function GET() {
  try {
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from('sys_lkp_priority_cd')
      .select('code, name, name2, display_order, color, icon, is_default')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
