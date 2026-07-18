/**
 * Processing-screen piece preference mutations.
 * Enforces ORDER_PROCESSING provenance, delete triple-guard, follow-up notes, per-row confirm.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PREF_DELETE_NOT_ALLOWED,
  PREF_DELETE_REASON,
  PREFS_OWNER_TYPE,
  PREFS_SOURCE_STAGE,
  type PrefDeleteReason,
} from '@/lib/constants/order-preferences';
import { recalculateOrderFinancialSnapshot } from '@/lib/services/order-financial-write.service';
import { OrderItemPreferenceService } from '@/lib/services/order-item-preference.service';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import {
  canDeleteProcessingPref,
  parseNotesFollowup,
  validateFollowupNoteText,
  type PrefsFollowupNote,
} from '@/lib/utils/notes-followup';
import { getConditionPrefKind } from '@/lib/utils/condition-codes';
import { fetchOrgServicePreferenceCfIdsByCodesSupabase } from '@/lib/utils/org-service-preference-cf-lookup';
import { logger } from '@/lib/utils/logger';

const FULL_SELECT = [
  'id',
  'tenant_org_id',
  'order_id',
  'branch_id',
  'prefs_no',
  'prefs_level',
  'order_item_id',
  'order_item_piece_id',
  'preference_id',
  'preference_code',
  'preference_content',
  'preference_sys_kind',
  'preference_category',
  'prefs_owner_type',
  'prefs_source',
  'extra_price',
  'processing_confirmed',
  'confirmed_by',
  'confirmed_at',
  'notes_followup',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
].join(', ');

export interface ProcessingPiecePrefRow {
  id: string;
  tenant_org_id: string;
  order_id: string;
  branch_id: string | null;
  prefs_no: number;
  prefs_level: string;
  order_item_id: string | null;
  order_item_piece_id: string | null;
  preference_id: string | null;
  preference_code: string;
  preference_content: string | null;
  preference_sys_kind: string | null;
  preference_category: string | null;
  prefs_owner_type: string;
  prefs_source: string;
  extra_price: number;
  processing_confirmed: boolean | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes_followup: PrefsFollowupNote[];
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  can_delete: boolean;
}

export type AddProcessingPrefKind =
  | 'service_prefs'
  | 'packing_prefs'
  | 'condition_stain'
  | 'condition_damag'
  | 'condition_special'
  | 'color'
  | 'note';

export interface AddProcessingPrefInput {
  preference_sys_kind: AddProcessingPrefKind;
  preference_code: string;
  extra_price?: number;
  preference_id?: string | null;
  preference_content?: string | null;
  branch_id?: string | null;
}

type MutateResult = {
  success: boolean;
  error?: string;
  code?: string;
  reason?: PrefDeleteReason;
  data?: ProcessingPiecePrefRow | ProcessingPiecePrefRow[];
  financial?: { outstanding_amount?: number; total_amount?: number } | null;
};

function mapRow(
  r: Record<string, unknown>,
  currentUserId: string
): ProcessingPiecePrefRow {
  return {
    id: String(r.id),
    tenant_org_id: String(r.tenant_org_id),
    order_id: String(r.order_id),
    branch_id: (r.branch_id as string | null) ?? null,
    prefs_no: Number(r.prefs_no),
    prefs_level: String(r.prefs_level),
    order_item_id: (r.order_item_id as string | null) ?? null,
    order_item_piece_id: (r.order_item_piece_id as string | null) ?? null,
    preference_id: (r.preference_id as string | null) ?? null,
    preference_code: String(r.preference_code),
    preference_content: (r.preference_content as string | null) ?? null,
    preference_sys_kind: (r.preference_sys_kind as string | null) ?? null,
    preference_category: (r.preference_category as string | null) ?? null,
    prefs_owner_type: String(r.prefs_owner_type ?? PREFS_OWNER_TYPE.SYSTEM),
    prefs_source: String(r.prefs_source ?? PREFS_SOURCE_STAGE.ORDER_CREATE),
    extra_price: Number(r.extra_price ?? 0),
    processing_confirmed: (r.processing_confirmed as boolean | null) ?? false,
    confirmed_by: (r.confirmed_by as string | null) ?? null,
    confirmed_at: r.confirmed_at
      ? String(r.confirmed_at)
      : null,
    notes_followup: parseNotesFollowup(r.notes_followup),
    created_at: r.created_at ? String(r.created_at) : null,
    created_by: (r.created_by as string | null) ?? null,
    updated_at: r.updated_at ? String(r.updated_at) : null,
    updated_by: (r.updated_by as string | null) ?? null,
    can_delete: canDeleteProcessingPref(
      {
        prefs_source: String(r.prefs_source ?? ''),
        created_by: (r.created_by as string | null) ?? null,
        processing_confirmed: (r.processing_confirmed as boolean | null) ?? false,
      },
      currentUserId
    ),
  };
}

async function refreshFinancial(
  tenantId: string,
  orderId: string,
  options?: { force?: boolean; chargeDelta?: number }
): Promise<{ outstanding_amount?: number; total_amount?: number } | null> {
  const chargeDelta = options?.chargeDelta ?? 0;
  if (!options?.force && chargeDelta === 0) return null;
  try {
    const snap = await recalculateOrderFinancialSnapshot(tenantId, orderId);
    return {
      outstanding_amount: snap?.outstandingAmount,
      total_amount: snap?.baseCurTotalAmount,
    };
  } catch (err) {
    logger.error(
      'Processing prefs financial recompute failed',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, orderId, feature: 'order_piece_processing_preference' }
    );
    throw err;
  }
}

export class OrderPieceProcessingPreferenceService {
  /**
   * List all PIECE-level preference rows for a piece (enriched for Processing dialog).
   */
  static async listPiecePrefs(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    currentUserId: string
  ): Promise<ProcessingPiecePrefRow[]> {
    const { data, error } = await supabase
      .from('org_order_preferences_dtl')
      .select(FULL_SELECT)
      .eq('tenant_org_id', tenantId)
      .eq('order_item_piece_id', pieceId)
      .eq('prefs_level', 'PIECE')
      .order('prefs_no', { ascending: true });

    if (error) {
      logger.error('listPiecePrefs failed', new Error(error.message), {
        tenantId,
        pieceId,
        feature: 'order_piece_processing_preference',
      });
      return [];
    }

    return (data || []).map((r) =>
      mapRow(r as unknown as Record<string, unknown>, currentUserId)
    );
  }

  /**
   * Add a preference from Processing: stamps ORDER_PROCESSING + USER + created_by.
   * Packing uses replace-one semantics.
   */
  static async addPref(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    pieceId: string,
    input: AddProcessingPrefInput,
    userId: string
  ): Promise<MutateResult> {
    try {
      const code = input.preference_code?.trim();
      if (!code) {
        return { success: false, error: 'preference_code is required' };
      }

      const kind = input.preference_sys_kind;

      if (kind === 'packing_prefs') {
        const packResult = await OrderPiecePreferenceService.replacePiecePacking(
          supabase,
          tenantId,
          orderId,
          orderItemId,
          pieceId,
          code,
          userId,
          input.preference_id
        );
        if (!packResult.success) {
          return { success: false, error: packResult.error };
        }
        // Stamp provenance on the packing row just written
        await supabase
          .from('org_order_preferences_dtl')
          .update({
            prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
            prefs_owner_type: PREFS_OWNER_TYPE.USER,
            created_by: userId,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_org_id', tenantId)
          .eq('order_item_piece_id', pieceId)
          .eq('prefs_level', 'PIECE')
          .eq('preference_sys_kind', 'packing_prefs')
          .eq('preference_code', code);

        const financial = await refreshFinancial(tenantId, orderId, {
          force: true,
        });
        const rows = await this.listPiecePrefs(supabase, tenantId, pieceId, userId);
        return { success: true, data: rows, financial };
      }

      // Duplicate guard for non-packing catalog kinds
      if (kind !== 'note') {
        const { data: existing } = await supabase
          .from('org_order_preferences_dtl')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .eq('order_item_piece_id', pieceId)
          .eq('prefs_level', 'PIECE')
          .eq('preference_sys_kind', kind)
          .eq('preference_code', code)
          .maybeSingle();
        if (existing) {
          return { success: false, error: 'Preference already exists on this piece' };
        }
      }

      let preferenceCode = code;
      let preferenceSysKind: string = kind;
      let preferenceId = input.preference_id ?? null;
      let extraPrice = Number(input.extra_price ?? 0);

      if (
        kind === 'condition_stain' ||
        kind === 'condition_damag' ||
        kind === 'condition_special'
      ) {
        // Allow UI condition codes (e.g. coffee) — normalize via helper
        const mapped = getConditionPrefKind(code);
        preferenceCode = mapped.preference_code;
        preferenceSysKind = mapped.preference_sys_kind;
        extraPrice = 0;
        if (!preferenceId) {
          const map = await fetchOrgServicePreferenceCfIdsByCodesSupabase(
            supabase,
            tenantId,
            [preferenceCode]
          );
          preferenceId = map.get(preferenceCode) ?? null;
        }
      } else if (kind === 'service_prefs' || kind === 'color') {
        if (!preferenceId) {
          const map = await fetchOrgServicePreferenceCfIdsByCodesSupabase(
            supabase,
            tenantId,
            [preferenceCode]
          );
          preferenceId = map.get(preferenceCode) ?? null;
        }
      } else if (kind === 'note') {
        extraPrice = 0;
        preferenceSysKind = 'note';
      }

      const { data: maxNo } = await supabase
        .from('org_order_preferences_dtl')
        .select('prefs_no')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .order('prefs_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prefsNo = (maxNo?.prefs_no ?? 0) + 1;
      const content =
        input.preference_content?.trim() ||
        (kind === 'note' ? preferenceCode : preferenceCode);

      const { data: inserted, error: insertError } = await supabase
        .from('org_order_preferences_dtl')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          prefs_no: prefsNo,
          prefs_level: 'PIECE',
          order_item_id: orderItemId,
          order_item_piece_id: pieceId,
          preference_code: preferenceCode,
          preference_content: content,
          preference_sys_kind: preferenceSysKind,
          prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          prefs_owner_type: PREFS_OWNER_TYPE.USER,
          extra_price: extraPrice,
          branch_id: input.branch_id ?? null,
          created_by: userId,
          notes_followup: [],
          ...(preferenceId ? { preference_id: preferenceId } : {}),
        })
        .select(FULL_SELECT)
        .single();

      if (insertError || !inserted) {
        logger.error(
          'addPref insert failed',
          new Error(insertError?.message || 'insert failed'),
          { tenantId, pieceId, feature: 'order_piece_processing_preference' }
        );
        return { success: false, error: insertError?.message || 'Failed to add preference' };
      }

      await OrderPiecePreferenceService.recalcPieceServicePrefCharge(
        supabase,
        tenantId,
        pieceId
      );
      await OrderItemPreferenceService.recalcItemServicePrefCharge(
        supabase,
        tenantId,
        orderItemId
      );

      let financial = null;
      try {
        financial = await refreshFinancial(tenantId, orderId, {
          chargeDelta: extraPrice,
        });
      } catch {
        // Pref already committed — fail when charged prefs cannot recompute
        if (extraPrice !== 0) {
          return {
            success: false,
            error: 'Preference saved but financial recompute failed; contact support',
          };
        }
      }

      return {
        success: true,
        data: mapRow(inserted as unknown as Record<string, unknown>, userId),
        financial,
      };
    } catch (err) {
      logger.error(
        'addPref failed',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId, pieceId, feature: 'order_piece_processing_preference' }
      );
      return { success: false, error: 'Failed to add preference' };
    }
  }

  /**
   * Delete only when ORDER_PROCESSING + created_by=current user + not confirmed.
   */
  static async deletePref(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    pieceId: string,
    prefId: string,
    userId: string
  ): Promise<MutateResult> {
    try {
      const { data: pref, error: fetchErr } = await supabase
        .from('org_order_preferences_dtl')
        .select(
          'id, order_item_id, prefs_source, created_by, processing_confirmed, extra_price, preference_sys_kind'
        )
        .eq('id', prefId)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .maybeSingle();

      if (fetchErr || !pref) {
        return {
          success: false,
          code: PREF_DELETE_NOT_ALLOWED,
          reason: PREF_DELETE_REASON.NOT_FOUND,
          error: 'Preference not found',
        };
      }

      if (pref.prefs_source !== PREFS_SOURCE_STAGE.ORDER_PROCESSING) {
        return {
          success: false,
          code: PREF_DELETE_NOT_ALLOWED,
          reason: PREF_DELETE_REASON.WRONG_SOURCE,
          error: 'Only preferences added in Processing can be deleted',
        };
      }
      if (!pref.created_by || pref.created_by.trim() !== userId.trim()) {
        return {
          success: false,
          code: PREF_DELETE_NOT_ALLOWED,
          reason: PREF_DELETE_REASON.NOT_OWNER,
          error: 'Only the creator can delete this preference',
        };
      }
      if (pref.processing_confirmed === true) {
        return {
          success: false,
          code: PREF_DELETE_NOT_ALLOWED,
          reason: PREF_DELETE_REASON.STILL_CONFIRMED,
          error: 'Unconfirm the preference before deleting',
        };
      }

      const extraPrice = Number(pref.extra_price ?? 0);
      const orderItemId = pref.order_item_id as string;

      const { data: deleted, error } = await supabase
        .from('org_order_preferences_dtl')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .eq('id', prefId)
        .eq('prefs_source', PREFS_SOURCE_STAGE.ORDER_PROCESSING)
        .eq('created_by', userId)
        .or('processing_confirmed.is.null,processing_confirmed.eq.false')
        .select('id');

      if (error) {
        return { success: false, error: error.message };
      }
      if (!deleted?.length) {
        return {
          success: false,
          code: PREF_DELETE_NOT_ALLOWED,
          reason: PREF_DELETE_REASON.STILL_CONFIRMED,
          error: 'Delete not allowed',
        };
      }

      await OrderPiecePreferenceService.recalcPieceServicePrefCharge(
        supabase,
        tenantId,
        pieceId
      );
      await OrderItemPreferenceService.recalcItemServicePrefCharge(
        supabase,
        tenantId,
        orderItemId
      );

      let financial = null;
      try {
        financial = await refreshFinancial(tenantId, orderId, {
          chargeDelta: extraPrice,
        });
      } catch {
        if (extraPrice !== 0) {
          return {
            success: false,
            error: 'Preference deleted but financial recompute failed; contact support',
          };
        }
      }

      return { success: true, financial };
    } catch (err) {
      logger.error(
        'deletePref failed',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId, pieceId, feature: 'order_piece_processing_preference' }
      );
      return { success: false, error: 'Failed to delete preference' };
    }
  }

  /**
   * Per-row processing_confirmed toggle.
   */
  static async setConfirmed(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    prefId: string,
    confirmed: boolean,
    userId: string
  ): Promise<MutateResult> {
    try {
      const patch = confirmed
        ? {
            processing_confirmed: true,
            confirmed_by: userId,
            confirmed_at: new Date().toISOString(),
            updated_by: userId,
            updated_at: new Date().toISOString(),
          }
        : {
            processing_confirmed: false,
            confirmed_by: null,
            confirmed_at: null,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          };

      const { data, error } = await supabase
        .from('org_order_preferences_dtl')
        .update(patch)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .eq('id', prefId)
        .select(FULL_SELECT)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: error?.message || 'Preference not found' };
      }

      return {
        success: true,
        data: mapRow(data as unknown as Record<string, unknown>, userId),
      };
    } catch (err) {
      logger.error(
        'setConfirmed failed',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId, pieceId, feature: 'order_piece_processing_preference' }
      );
      return { success: false, error: 'Failed to update confirmation' };
    }
  }

  /**
   * Append follow-up note via atomic SQL function.
   */
  static async appendFollowupNote(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    prefId: string,
    noteText: string,
    userId: string
  ): Promise<MutateResult> {
    const validated = validateFollowupNoteText(noteText);
    if (validated.ok === false) {
      return { success: false, error: validated.error };
    }

    try {
      const { data: pref } = await supabase
        .from('org_order_preferences_dtl')
        .select('id')
        .eq('id', prefId)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .maybeSingle();

      if (!pref) {
        return { success: false, error: 'Preference not found' };
      }

      const { data: notes, error } = await supabase.rpc(
        'cmx_ord_pref_append_notes_followup',
        {
          p_tenant_org_id: tenantId,
          p_pref_id: prefId,
          p_note_user_id: userId,
          p_note_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          p_note_text: validated.text,
          p_updated_by: userId,
        }
      );

      if (error) {
        logger.error('appendFollowupNote rpc failed', new Error(error.message), {
          tenantId,
          prefId,
          feature: 'order_piece_processing_preference',
        });
        return { success: false, error: error.message };
      }

      const { data: row } = await supabase
        .from('org_order_preferences_dtl')
        .select(FULL_SELECT)
        .eq('id', prefId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (!row) {
        return {
          success: true,
          data: undefined,
        };
      }

      const mapped = mapRow(row as unknown as Record<string, unknown>, userId);
      mapped.notes_followup = parseNotesFollowup(notes ?? mapped.notes_followup);
      return { success: true, data: mapped };
    } catch (err) {
      logger.error(
        'appendFollowupNote failed',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId, pieceId, feature: 'order_piece_processing_preference' }
      );
      return { success: false, error: 'Failed to append note' };
    }
  }
}
