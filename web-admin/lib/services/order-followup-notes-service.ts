/**
 * OrderFollowupNotesService
 * Unified follow-up notes service across ORDER, ITEM, PIECE, and PREFERENCE levels.
 * Appends atomically via DB RPC `org_ord_append_notes_followup` and enforces explicit
 * tenant_org_id filtering on every org_* query.
 */

import { createClient } from '@/lib/supabase/server';
import {
  NOTES_FOLLOWUP_TARGET_LEVELS,
  PRC_TRX_DTL_TYPES,
  PRC_TRX_SOURCE_SCREENS,
  PRC_TRX_TARGET_LEVELS,
  PRC_TRX_TYPES,
  type NotesFollowupTargetLevel,
  type PrcTrxTargetLevel,
} from '@/lib/constants/processing-trx';
import type {
  AppendFollowupNoteInput,
  OrderFollowupNotesBundle,
} from '@/lib/types/processing-trx';
import {
  parseNotesFollowup,
  validateFollowupNoteText,
  type PrefsFollowupNote,
} from '@/lib/utils/notes-followup';
import { ProcessingTrxService } from '@/lib/services/processing-trx-service';
import { log } from '@/lib/utils/logger';

export interface AppendFollowupNoteResult {
  success: boolean;
  notes?: PrefsFollowupNote[];
  trxId?: string;
  trxCode?: string;
  error?: string;
}

export interface ListOrderFollowupNotesResult {
  success: boolean;
  data?: OrderFollowupNotesBundle;
  error?: string;
}

export class OrderFollowupNotesService {
  /**
   * Append a follow-up note to ORDER, ITEM, PIECE, or PREFERENCE via atomic DB RPC.
   * Optionally records a companion NOTE_ADD processing transaction row so the
   * resulting note carries `trx_code`.
   */
  static async appendNote(
    input: AppendFollowupNoteInput
  ): Promise<AppendFollowupNoteResult> {
    const validated = validateFollowupNoteText(input.noteText);
    if (validated.ok === false) {
      return { success: false, error: validated.error };
    }

    try {
      const supabase = await createClient();
      let resolvedBranchId: string | null | undefined = input.branchId;
      let resolvedItemId: string | null = input.orderItemId ?? null;
      let resolvedPieceId: string | null = input.orderItemPieceId ?? null;
      let resolvedPrefId: string | null = null;

      // Verify ownership under tenant_org_id + order_id before appending or writing audit trx.
      if (input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.ORDER) {
        if (input.targetId !== input.orderId) {
          return { success: false, error: 'Order target mismatch' };
        }
        const { data: orderRow, error } = await supabase
          .from('org_orders_mst')
          .select('id, branch_id')
          .eq('id', input.orderId)
          .eq('tenant_org_id', input.tenantId)
          .maybeSingle();
        if (error || !orderRow) {
          return { success: false, error: 'Order not found' };
        }
        resolvedBranchId = resolvedBranchId ?? (orderRow.branch_id as string | null) ?? null;
      } else if (input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.ITEM) {
        const { data: itemRow, error } = await supabase
          .from('org_order_items_dtl')
          .select('id, branch_id, order_id')
          .eq('id', input.targetId)
          .eq('order_id', input.orderId)
          .eq('tenant_org_id', input.tenantId)
          .maybeSingle();
        if (error || !itemRow) {
          return { success: false, error: 'Order item not found' };
        }
        resolvedItemId = itemRow.id as string;
        resolvedBranchId = resolvedBranchId ?? (itemRow.branch_id as string | null) ?? null;
      } else if (input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.PIECE) {
        const { data: pieceRow, error } = await supabase
          .from('org_order_item_pieces_dtl')
          .select('id, order_item_id, order_id')
          .eq('id', input.targetId)
          .eq('order_id', input.orderId)
          .eq('tenant_org_id', input.tenantId)
          .maybeSingle();
        if (error || !pieceRow) {
          return { success: false, error: 'Order piece not found' };
        }
        resolvedItemId = pieceRow.order_item_id as string;
        resolvedPieceId = pieceRow.id as string;
      } else if (input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.PREFERENCE) {
        const { data: prefRow, error } = await supabase
          .from('org_order_preferences_dtl')
          .select('id, branch_id, order_id, order_item_id, order_item_piece_id')
          .eq('id', input.targetId)
          .eq('order_id', input.orderId)
          .eq('tenant_org_id', input.tenantId)
          .maybeSingle();
        if (error || !prefRow) {
          return { success: false, error: 'Order preference not found' };
        }
        resolvedPrefId = prefRow.id as string;
        resolvedItemId = (prefRow.order_item_id as string | null) ?? resolvedItemId;
        resolvedPieceId = (prefRow.order_item_piece_id as string | null) ?? resolvedPieceId;
        resolvedBranchId = resolvedBranchId ?? (prefRow.branch_id as string | null) ?? null;
      } else {
        return { success: false, error: `Unsupported targetLevel: ${input.targetLevel}` };
      }

      let trxId: string | undefined;
      let trxCode: string | undefined;

      if (input.recordPrcTrx !== false) {
        const trxTargetLevel: PrcTrxTargetLevel =
          input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.ORDER
            ? PRC_TRX_TARGET_LEVELS.ORDER
            : input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.ITEM
              ? PRC_TRX_TARGET_LEVELS.ITEM
              : input.targetLevel === NOTES_FOLLOWUP_TARGET_LEVELS.PIECE
                ? PRC_TRX_TARGET_LEVELS.PIECE
                : PRC_TRX_TARGET_LEVELS.PREFERENCE;

        const trxResult = await ProcessingTrxService.recordTransaction({
          tenantId: input.tenantId,
          orderId: input.orderId,
          branchId: resolvedBranchId,
          transType: PRC_TRX_TYPES.NOTE_ADD,
          trxDescription: `Added ${input.targetLevel.toLowerCase()} note`,
          sourceScreen: input.sourceScreen ?? PRC_TRX_SOURCE_SCREENS.PROCESSING_DETAIL,
          actorUserId: input.userId,
          actorName: input.userName ?? null,
          notes: validated.text,
          appendOrderFollowupNote: false,
          lines: [
            {
              targetLevel: trxTargetLevel,
              orderItemId:
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.ITEM ||
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.PIECE ||
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.PREFERENCE
                  ? resolvedItemId
                  : null,
              orderItemPieceId:
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.PIECE ||
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.PREFERENCE
                  ? resolvedPieceId
                  : null,
              orderPreferenceId:
                trxTargetLevel === PRC_TRX_TARGET_LEVELS.PREFERENCE
                  ? resolvedPrefId
                  : null,
              branchId: resolvedBranchId ?? null,
              transDtlType: PRC_TRX_DTL_TYPES.NOTE_ADD,
              transDtlDescription: `Follow-up note added on ${input.targetLevel.toLowerCase()}`,
              notes: validated.text,
              metadata: {
                note_source: input.noteSource,
              },
            },
          ],
        });

        if (trxResult.success) {
          trxId = trxResult.trxId;
          trxCode = trxResult.trxCode;
        }
      }

      const { data, error: rpcError } = await supabase.rpc(
        'org_ord_append_notes_followup',
        {
          p_tenant_org_id: input.tenantId,
          p_target_level: input.targetLevel,
          p_target_id: input.targetId,
          p_note_user_id: input.userId,
          p_note_source: input.noteSource,
          p_note_text: validated.text,
          p_note_user_name: input.userName ?? null,
          p_trx_code: trxCode ?? null,
          p_updated_by: input.userId,
        }
      );

      if (rpcError) {
        log.error(
          '[OrderFollowupNotesService] org_ord_append_notes_followup failed',
          new Error(rpcError.message),
          {
            tenantId: input.tenantId,
            orderId: input.orderId,
            targetLevel: input.targetLevel,
            targetId: input.targetId,
          }
        );
        return { success: false, error: rpcError.message };
      }

      return {
        success: true,
        notes: parseNotesFollowup(data),
        ...(trxId ? { trxId } : {}),
        ...(trxCode ? { trxCode } : {}),
      };
    } catch (error) {
      log.error(
        '[OrderFollowupNotesService] Exception in appendNote',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: input.tenantId,
          orderId: input.orderId,
          targetLevel: input.targetLevel,
          targetId: input.targetId,
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append follow-up note',
      };
    }
  }

  /**
   * Fetch all follow-up notes across ORDER, ITEM, PIECE, and PREFERENCE for an order.
   */
  static async listOrderNotes(
    tenantId: string,
    orderId: string
  ): Promise<ListOrderFollowupNotesResult> {
    try {
      const supabase = await createClient();

      const [orderRes, itemsRes, piecesRes, prefsRes] = await Promise.all([
        supabase
          .from('org_orders_mst')
          .select('id, notes_followup')
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId)
          .maybeSingle(),
        supabase
          .from('org_order_items_dtl')
          .select('id, notes_followup')
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .eq('rec_status', 1),
        supabase
          .from('org_order_item_pieces_dtl')
          .select('id, notes_followup')
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId),
        supabase
          .from('org_order_preferences_dtl')
          .select('id, notes_followup')
          .eq('order_id', orderId)
          .eq('tenant_org_id', tenantId)
          .eq('rec_status', 1),
      ]);

      if (orderRes.error || !orderRes.data) {
        return { success: false, error: 'Order not found' };
      }

      const byItem: Record<string, PrefsFollowupNote[]> = {};
      for (const row of itemsRes.data ?? []) {
        byItem[row.id as string] = parseNotesFollowup(row.notes_followup);
      }

      const byPiece: Record<string, PrefsFollowupNote[]> = {};
      for (const row of piecesRes.data ?? []) {
        byPiece[row.id as string] = parseNotesFollowup(row.notes_followup);
      }

      const byPreference: Record<string, PrefsFollowupNote[]> = {};
      for (const row of prefsRes.data ?? []) {
        byPreference[row.id as string] = parseNotesFollowup(row.notes_followup);
      }

      return {
        success: true,
        data: {
          orderNotes: parseNotesFollowup(orderRes.data.notes_followup),
          byItem,
          byPiece,
          byPreference,
        },
      };
    } catch (error) {
      log.error(
        '[OrderFollowupNotesService] Exception in listOrderNotes',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, orderId }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list follow-up notes',
      };
    }
  }
}

export function isValidNotesFollowupTargetLevel(
  value: string
): value is NotesFollowupTargetLevel {
  return (
    value === NOTES_FOLLOWUP_TARGET_LEVELS.ORDER ||
    value === NOTES_FOLLOWUP_TARGET_LEVELS.ITEM ||
    value === NOTES_FOLLOWUP_TARGET_LEVELS.PIECE ||
    value === NOTES_FOLLOWUP_TARGET_LEVELS.PREFERENCE
  );
}
