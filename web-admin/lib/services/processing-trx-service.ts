/**
 * ProcessingTrxService
 * Records batch/operator processing transactions into `org_prc_trx_mst` and
 * `org_prc_trx_dtl`, generates human-readable descriptions, and synchronizes
 * operational follow-up notes with the DB-assigned immutable `trx_code`.
 */

import { createClient } from '@/lib/supabase/server';
import {
  NOTES_FOLLOWUP_TARGET_LEVELS,
  PRC_TRX_DTL_TYPES,
  PRC_TRX_TARGET_LEVELS,
  type PrcTrxDtlType,
  type PrcTrxTargetLevel,
} from '@/lib/constants/processing-trx';
import { PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import type {
  ProcessingTrxDetail,
  ProcessingTrxHeader,
  ProcessingTrxLineInput,
  RecordProcessingTrxInput,
  RecordProcessingTrxResult,
} from '@/lib/types/processing-trx';
import { log } from '@/lib/utils/logger';

type SupabaseJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SupabaseJson | undefined }
  | SupabaseJson[];

function toSupabaseJson(value: Record<string, unknown> | undefined): SupabaseJson {
  if (!value) return {};
  return JSON.parse(JSON.stringify(value)) as SupabaseJson;
}

export interface PieceDeltaSnapshot {
  pieceId: string;
  orderItemId: string;
  pieceCode?: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  processingNote?: string | null;
}

export interface OrderFieldSnapshot {
  rack_location?: string | null;
  locker_location?: string | null;
  locker_code?: string | null;
  bag_count?: number | null;
  hanging_count?: number | null;
}

function asStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function sanitizeLineForConstraint(line: ProcessingTrxLineInput) {
  const level = line.targetLevel;
  if (level === PRC_TRX_TARGET_LEVELS.ORDER) {
    return {
      target_level: level,
      target_level_text: null,
      order_item_id: null,
      order_item_piece_id: null,
      order_preference_id: null,
    };
  }
  if (level === PRC_TRX_TARGET_LEVELS.ITEM) {
    return {
      target_level: level,
      target_level_text: null,
      order_item_id: line.orderItemId ?? null,
      order_item_piece_id: null,
      order_preference_id: null,
    };
  }
  if (level === PRC_TRX_TARGET_LEVELS.PIECE) {
    return {
      target_level: level,
      target_level_text: null,
      order_item_id: line.orderItemId ?? null,
      order_item_piece_id: line.orderItemPieceId ?? null,
      order_preference_id: null,
    };
  }
  if (level === PRC_TRX_TARGET_LEVELS.PREFERENCE) {
    return {
      target_level: level,
      target_level_text: null,
      order_item_id: line.orderItemId ?? null,
      order_item_piece_id: line.orderItemPieceId ?? null,
      order_preference_id: line.orderPreferenceId ?? null,
    };
  }
  const targetText = line.targetLevelText?.trim() || 'GENERAL';
  return {
    target_level: PRC_TRX_TARGET_LEVELS.OTHERS,
    target_level_text: targetText,
    order_item_id: line.orderItemId ?? null,
    order_item_piece_id: line.orderItemPieceId ?? null,
    order_preference_id: line.orderPreferenceId ?? null,
  };
}

export class ProcessingTrxService {
  /**
   * Build line-level `org_prc_trx_dtl` entries from piece before/after snapshots
   * plus any per-piece floor notes (`processingNote`).
   */
  static buildPieceDeltaLines(deltas: PieceDeltaSnapshot[]): ProcessingTrxLineInput[] {
    const lines: ProcessingTrxLineInput[] = [];

    for (const delta of deltas) {
      const { pieceId, orderItemId, pieceCode, before, after, processingNote } = delta;
      const codePrefix = pieceCode ? `[${pieceCode}] ` : '';

      const prevStep = asStr(before.last_step);
      const nextStep = asStr(after.last_step);
      if (prevStep !== nextStep) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.STEP_CHANGE,
          transDtlDescription: `${codePrefix}Step: ${prevStep ?? 'none'} -> ${nextStep ?? 'none'}`,
          stepCode: nextStep,
          fromValue: prevStep,
          toValue: nextStep,
          beforeValues: { last_step: prevStep },
          afterValues: { last_step: nextStep },
        });
      }

      const prevReady = Boolean(before.is_ready);
      const nextReady = Boolean(after.is_ready);
      if (prevReady !== nextReady) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: nextReady
            ? PRC_TRX_DTL_TYPES.MARK_READY
            : PRC_TRX_DTL_TYPES.UNMARK_READY,
          transDtlDescription: `${codePrefix}${nextReady ? 'Marked piece ready' : 'Unmarked piece ready'}`,
          fromValue: String(prevReady),
          toValue: String(nextReady),
          beforeValues: {
            is_ready: prevReady,
            piece_status: before.piece_status ?? null,
          },
          afterValues: {
            is_ready: nextReady,
            piece_status: after.piece_status ?? null,
          },
        });
      }

      const prevRej = Boolean(before.is_rejected);
      const nextRej = Boolean(after.is_rejected);
      if (prevRej !== nextRej) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: nextRej ? PRC_TRX_DTL_TYPES.REJECT : PRC_TRX_DTL_TYPES.UNREJECT,
          transDtlDescription: `${codePrefix}${nextRej ? 'Rejected piece' : 'Cleared rejection'}`,
          fromValue: String(prevRej),
          toValue: String(nextRej),
          beforeValues: { is_rejected: prevRej },
          afterValues: { is_rejected: nextRej },
        });
      }

      const prevStage = asStr(before.piece_stage);
      const nextStage = asStr(after.piece_stage);
      if (prevStage !== nextStage) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.STAGE_CHANGE,
          transDtlDescription: `${codePrefix}Stage: ${prevStage ?? 'none'} -> ${nextStage ?? 'none'}`,
          fromValue: prevStage,
          toValue: nextStage,
          beforeValues: { piece_stage: prevStage },
          afterValues: { piece_stage: nextStage },
        });
      }

      const prevRack = asStr(before.rack_location);
      const nextRack = asStr(after.rack_location);
      if (prevRack !== nextRack) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.RACK_ASSIGN,
          transDtlDescription: `${codePrefix}Piece rack: ${prevRack ?? 'none'} -> ${nextRack ?? 'none'}`,
          fromValue: prevRack,
          toValue: nextRack,
          beforeValues: { rack_location: prevRack },
          afterValues: { rack_location: nextRack },
        });
      }

      const prevScan = asStr(before.scan_state);
      const nextScan = asStr(after.scan_state);
      if (prevScan !== nextScan) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.BARCODE_SCAN,
          transDtlDescription: `${codePrefix}Scan state: ${prevScan ?? 'none'} -> ${nextScan ?? 'none'}`,
          fromValue: prevScan,
          toValue: nextScan,
          beforeValues: { scan_state: prevScan },
          afterValues: { scan_state: nextScan },
        });
      }

      const prevTag = asStr(before.barcode);
      const nextTag = asStr(after.barcode);
      if (prevTag !== nextTag) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.TAG_LINK,
          transDtlDescription: `${codePrefix}Tag: ${prevTag ?? 'none'} -> ${nextTag ?? 'removed'}`,
          fromValue: prevTag,
          toValue: nextTag,
          beforeValues: { barcode: prevTag },
          afterValues: { barcode: nextTag },
        });
      }

      const cleanNote = processingNote?.trim();
      if (cleanNote) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.PIECE,
          orderItemId,
          orderItemPieceId: pieceId,
          transDtlType: PRC_TRX_DTL_TYPES.NOTE_ADD,
          transDtlDescription: `${codePrefix}Floor note added`,
          notes: cleanNote,
        });
      }
    }

    return lines;
  }

  /**
   * Build ORDER-level detail lines from rack/locker/bag/hanging diffs + batch note.
   */
  static buildOrderLevelDeltaLines(
    beforeOrder: OrderFieldSnapshot,
    nextOrder: OrderFieldSnapshot,
    batchNote?: string | null
  ): ProcessingTrxLineInput[] {
    const lines: ProcessingTrxLineInput[] = [];

    if (nextOrder.rack_location !== undefined) {
      const prev = asStr(beforeOrder.rack_location);
      const next = asStr(nextOrder.rack_location);
      if (prev !== next) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.ORDER,
          transDtlType: PRC_TRX_DTL_TYPES.ORDER_RACK_ASSIGN,
          transDtlDescription: `Order rack: ${prev ?? 'none'} -> ${next ?? 'cleared'}`,
          fromValue: prev,
          toValue: next,
          beforeValues: { rack_location: prev },
          afterValues: { rack_location: next },
        });
      }
    }

    if (nextOrder.locker_location !== undefined || nextOrder.locker_code !== undefined) {
      const prevLoc = asStr(beforeOrder.locker_location);
      const nextLoc =
        nextOrder.locker_location !== undefined
          ? asStr(nextOrder.locker_location)
          : prevLoc;
      const prevCode = asStr(beforeOrder.locker_code);
      const nextCode =
        nextOrder.locker_code !== undefined ? asStr(nextOrder.locker_code) : prevCode;
      if (prevLoc !== nextLoc || prevCode !== nextCode) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.ORDER,
          transDtlType: PRC_TRX_DTL_TYPES.LOCKER_ASSIGN,
          transDtlDescription: `Locker assignment updated`,
          fromValue: [prevLoc, prevCode].filter(Boolean).join(' / ') || null,
          toValue: [nextLoc, nextCode].filter(Boolean).join(' / ') || null,
          beforeValues: { locker_location: prevLoc, locker_code: prevCode },
          afterValues: { locker_location: nextLoc, locker_code: nextCode },
        });
      }
    }

    if (nextOrder.bag_count !== undefined) {
      const prev = beforeOrder.bag_count ?? null;
      const next = nextOrder.bag_count ?? null;
      if (prev !== next) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.ORDER,
          transDtlType: PRC_TRX_DTL_TYPES.BAG_COUNT_CHANGE,
          transDtlDescription: `Bag count: ${prev ?? 0} -> ${next ?? 0}`,
          fromValue: prev === null ? null : String(prev),
          toValue: next === null ? null : String(next),
          beforeValues: { bag_count: prev },
          afterValues: { bag_count: next },
        });
      }
    }

    if (nextOrder.hanging_count !== undefined) {
      const prev = beforeOrder.hanging_count ?? null;
      const next = nextOrder.hanging_count ?? null;
      if (prev !== next) {
        lines.push({
          targetLevel: PRC_TRX_TARGET_LEVELS.ORDER,
          transDtlType: PRC_TRX_DTL_TYPES.HANGING_COUNT_CHANGE,
          transDtlDescription: `Hanging count: ${prev ?? 0} -> ${next ?? 0}`,
          fromValue: prev === null ? null : String(prev),
          toValue: next === null ? null : String(next),
          beforeValues: { hanging_count: prev },
          afterValues: { hanging_count: next },
        });
      }
    }

    const cleanNote = batchNote?.trim();
    if (cleanNote) {
      lines.push({
        targetLevel: PRC_TRX_TARGET_LEVELS.ORDER,
        transDtlType: PRC_TRX_DTL_TYPES.NOTE_ADD,
        transDtlDescription: 'Batch processing note added',
        notes: cleanNote,
      });
    }

    return lines;
  }

  /**
   * Build a concise default summary when caller omits `trxDescription`.
   */
  static summarizeLines(lines: ProcessingTrxLineInput[], transType: string): string {
    if (lines.length === 0) return transType;
    const typeCounts = new Map<PrcTrxDtlType, number>();
    for (const line of lines) {
      typeCounts.set(line.transDtlType, (typeCounts.get(line.transDtlType) ?? 0) + 1);
    }
    const parts = Array.from(typeCounts.entries()).map(([t, n]) => `${n}x ${t}`);
    return parts.join(', ');
  }

  /**
   * Persist one header (`org_prc_trx_mst`) and N detail lines (`org_prc_trx_dtl`),
   * returning DB-assigned `trx_code`. Optionally appends linked `notes_followup`.
   */
  static async recordTransaction(
    input: RecordProcessingTrxInput & {
      pieceNotesToAppend?: Array<{
        pieceId: string;
        noteText: string;
        noteSource?: string;
      }>;
    }
  ): Promise<RecordProcessingTrxResult> {
    if (input.lines.length === 0 && !input.notes?.trim()) {
      return { success: true, lineCount: 0 };
    }

    try {
      const supabase = await createClient();

      if (input.idempotencyKey?.trim()) {
        const { data: existing } = await supabase
          .from('org_prc_trx_mst')
          .select('id, trx_code')
          .eq('tenant_org_id', input.tenantId)
          .eq('order_id', input.orderId)
          .eq('idempotency_key', input.idempotencyKey.trim())
          .maybeSingle();

        if (existing) {
          return {
            success: true,
            trxId: existing.id as string,
            trxCode: existing.trx_code as string,
            lineCount: input.lines.length,
          };
        }
      }

      let branchId = input.branchId;
      if (branchId === undefined) {
        const { data: ord } = await supabase
          .from('org_orders_mst')
          .select('branch_id')
          .eq('id', input.orderId)
          .eq('tenant_org_id', input.tenantId)
          .maybeSingle();
        branchId = (ord?.branch_id as string | null | undefined) ?? null;
      }

      const description =
        input.trxDescription?.trim() ||
        this.summarizeLines(input.lines, input.transType);

      const { data: headerRow, error: headerError } = await supabase
        .from('org_prc_trx_mst')
        .insert({
          tenant_org_id: input.tenantId,
          branch_id: branchId ?? null,
          order_id: input.orderId,
          // Trigger `trg_prc_trx_code_assign` always assigns `<order_no>-PRC-000x` BEFORE INSERT.
          trx_code: '',
          trans_type: input.transType,
          trx_description: description,
          source_screen: input.sourceScreen,
          actor_user_id: input.actorUserId ?? null,
          actor_name: input.actorName ?? null,
          idempotency_key: input.idempotencyKey?.trim() || null,
          notes: input.notes?.trim() || null,
          metadata: toSupabaseJson({
            line_count: input.lines.length,
            ...(input.metadata ?? {}),
          }),
          created_by: input.actorUserId ?? input.actorName ?? 'system',
          created_info: input.sourceScreen,
        })
        .select('id, trx_code, branch_id')
        .single();

      if (headerError || !headerRow) {
        log.error(
          '[ProcessingTrxService] Header insert failed',
          new Error(headerError?.message ?? 'Missing header row'),
          { tenantId: input.tenantId, orderId: input.orderId, transType: input.transType }
        );
        return {
          success: false,
          error: headerError?.message ?? 'Failed to create processing transaction',
        };
      }

      const trxId = headerRow.id as string;
      const trxCode = headerRow.trx_code as string;
      const effectiveBranchId =
        (headerRow.branch_id as string | null | undefined) ?? branchId ?? null;

      if (input.lines.length > 0) {
        const detailRows = input.lines.map((line, index) => {
          const target = sanitizeLineForConstraint(line);
          return {
            tenant_org_id: input.tenantId,
            branch_id: line.branchId ?? effectiveBranchId,
            order_id: input.orderId,
            trx_id: trxId,
            line_seq: index + 1,
            ...target,
            trans_dtl_type: line.transDtlType,
            trans_dtl_description: line.transDtlDescription?.trim() || null,
            step_code: line.stepCode?.trim() || null,
            from_value: line.fromValue ?? null,
            to_value: line.toValue ?? null,
            before_values: toSupabaseJson(line.beforeValues),
            after_values: toSupabaseJson(line.afterValues),
            notes: line.notes?.trim() || null,
            metadata: toSupabaseJson(line.metadata),
            created_by: input.actorUserId ?? input.actorName ?? 'system',
            created_info: input.sourceScreen,
          };
        });

        const { error: detailError } = await supabase
          .from('org_prc_trx_dtl')
          .insert(detailRows);

        if (detailError) {
          log.error(
            '[ProcessingTrxService] Detail insert failed',
            new Error(detailError.message),
            { tenantId: input.tenantId, orderId: input.orderId, trxId, trxCode }
          );
          return {
            success: false,
            trxId,
            trxCode,
            error: detailError.message,
          };
        }
      }

      const noteSource = input.noteSource || PREFS_SOURCE_STAGE.ORDER_PROCESSING;
      const actorId = input.actorUserId ?? '';

      if (input.appendOrderFollowupNote && input.notes?.trim()) {
        await supabase.rpc('org_ord_append_notes_followup', {
          p_tenant_org_id: input.tenantId,
          p_target_level: NOTES_FOLLOWUP_TARGET_LEVELS.ORDER,
          p_target_id: input.orderId,
          p_note_user_id: actorId,
          p_note_source: noteSource,
          p_note_text: input.notes.trim(),
          p_note_user_name: input.actorName ?? null,
          p_trx_code: trxCode,
          p_updated_by: input.actorUserId ?? null,
        });
      }

      if (input.pieceNotesToAppend?.length) {
        for (const pNote of input.pieceNotesToAppend) {
          const clean = pNote.noteText.trim();
          if (!clean) continue;
          await supabase.rpc('org_ord_append_notes_followup', {
            p_tenant_org_id: input.tenantId,
            p_target_level: NOTES_FOLLOWUP_TARGET_LEVELS.PIECE,
            p_target_id: pNote.pieceId,
            p_note_user_id: actorId,
            p_note_source: pNote.noteSource || noteSource,
            p_note_text: clean,
            p_note_user_name: input.actorName ?? null,
            p_trx_code: trxCode,
            p_updated_by: input.actorUserId ?? null,
          });
        }
      }

      return {
        success: true,
        trxId,
        trxCode,
        lineCount: input.lines.length,
      };
    } catch (error) {
      log.error(
        '[ProcessingTrxService] Exception in recordTransaction',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId: input.tenantId, orderId: input.orderId, transType: input.transType }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record transaction',
      };
    }
  }

  /**
   * Fetch chronological processing transaction batches + detail lines for an order.
   */
  static async listOrderTransactions(
    tenantId: string,
    orderId: string,
    options?: {
      limit?: number;
      targetLevel?: PrcTrxTargetLevel;
      transType?: string;
    }
  ): Promise<{
    success: boolean;
    transactions?: ProcessingTrxHeader[];
    error?: string;
  }> {
    try {
      const supabase = await createClient();
      const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

      let headerQuery = supabase
        .from('org_prc_trx_mst')
        .select(
          'id, tenant_org_id, branch_id, order_id, trx_code, trans_type, trx_description, source_screen, actor_user_id, actor_name, occurred_at, idempotency_key, notes, metadata, created_at'
        )
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .eq('rec_status', 1)
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (options?.transType) {
        headerQuery = headerQuery.eq('trans_type', options.transType);
      }

      const { data: headers, error: headerError } = await headerQuery;
      if (headerError) {
        return { success: false, error: headerError.message };
      }

      const headerList = headers ?? [];
      if (headerList.length === 0) {
        return { success: true, transactions: [] };
      }

      const trxIds = headerList.map((h) => h.id as string);
      let detailQuery = supabase
        .from('org_prc_trx_dtl')
        .select(
          'id, tenant_org_id, branch_id, order_id, trx_id, line_seq, target_level, target_level_text, order_item_id, order_item_piece_id, order_preference_id, trans_dtl_type, trans_dtl_description, step_code, from_value, to_value, before_values, after_values, notes, metadata, created_at'
        )
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .eq('rec_status', 1)
        .in('trx_id', trxIds)
        .order('line_seq', { ascending: true });

      if (options?.targetLevel) {
        detailQuery = detailQuery.eq('target_level', options.targetLevel);
      }

      const { data: details, error: detailError } = await detailQuery;
      if (detailError) {
        return { success: false, error: detailError.message };
      }

      const detailsByTrx = new Map<string, ProcessingTrxDetail[]>();
      for (const row of details ?? []) {
        const trxId = row.trx_id as string;
        const arr = detailsByTrx.get(trxId) ?? [];
        arr.push(row as unknown as ProcessingTrxDetail);
        detailsByTrx.set(trxId, arr);
      }

      const combined: ProcessingTrxHeader[] = headerList
        .map((h) => ({
          ...(h as unknown as Omit<ProcessingTrxHeader, 'details'>),
          details: detailsByTrx.get(h.id as string) ?? [],
        }))
        .filter((h) => !options?.targetLevel || h.details.length > 0);

      return { success: true, transactions: combined };
    } catch (error) {
      log.error(
        '[ProcessingTrxService] Exception in listOrderTransactions',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId, orderId }
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list processing transactions',
      };
    }
  }
}
