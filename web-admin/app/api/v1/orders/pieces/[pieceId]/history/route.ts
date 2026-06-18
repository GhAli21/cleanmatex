/**
 * GET /api/v1/orders/pieces/:pieceId/history
 * Piece audit trail (org_order_piece_hist_tr). Requires orders:read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

/** Row shape for org_order_piece_hist_tr (add to generated DB types after migration apply). */
type PieceHistRow = {
  id: string;
  action_code: string | null;
  from_value: string | null;
  to_value: string | null;
  done_by: string | null;
  done_at: string | null;
  notes: string | null;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { pieceId } = await params;
    const supabase = await createClient();

    const { data: piece, error: pieceErr } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id')
      .eq('id', pieceId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (pieceErr || !piece) {
      return NextResponse.json(
        { success: false, error: 'Piece not found' },
        { status: 404 }
      );
    }

     
    const { data: hist, error: histErr } = await (supabase as any)
      .from('org_order_piece_hist_tr')
      .select('id, action_code, from_value, to_value, done_by, done_at, notes')
      .eq('order_piece_id', pieceId)
      .eq('tenant_org_id', tenantId)
      .order('done_at', { ascending: false });

    if (histErr) {
      log.error(
        '[API] GET /orders/pieces/.../history query error',
        new Error(histErr.message),
        { tenantId, pieceId }
      );
      return NextResponse.json(
        { success: false, error: 'Failed to load history' },
        { status: 500 }
      );
    }

    const rows = (hist || []) as PieceHistRow[];
    const doneByIds = [
      ...new Set(
        rows
          .map((r) => r.done_by)
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
      ),
    ];

    const nameByKey: Record<string, string> = {};
    if (doneByIds.length > 0) {
      const { data: byRowId } = await supabase
        .from('org_users_mst')
        .select('id, user_id, display_name, email')
        .eq('tenant_org_id', tenantId)
        .in('id', doneByIds);

      (byRowId || []).forEach((u) => {
        const label =
          (u.display_name && u.display_name.trim()) || u.email || u.id;
        nameByKey[u.id] = label;
        if (u.user_id) nameByKey[u.user_id] = label;
      });

      const unresolved = doneByIds.filter((id) => !nameByKey[id]);
      if (unresolved.length > 0) {
        const { data: byAuth } = await supabase
          .from('org_users_mst')
          .select('id, user_id, display_name, email')
          .eq('tenant_org_id', tenantId)
          .in('user_id', unresolved);
        (byAuth || []).forEach((u) => {
          const label =
            (u.display_name && u.display_name.trim()) || u.email || u.id;
          nameByKey[u.id] = label;
          if (u.user_id) nameByKey[u.user_id] = label;
        });
      }
    }

    const history = rows.map((row) => ({
      id: row.id,
      action: row.action_code,
      fromValue: row.from_value,
      toValue: row.to_value,
      doneBy:
        (row.done_by && (nameByKey[row.done_by] || row.done_by)) || '—',
      doneAt: row.done_at,
      notes: row.notes ?? undefined,
    }));

    return NextResponse.json({ success: true, history });
  } catch (error) {
    log.error(
      '[API] GET /orders/pieces/.../history error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_pieces', action: 'piece_history_get' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load piece history' },
      { status: 500 }
    );
  }
}
