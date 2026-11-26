/**
 * Types for Processing Batch Transactions (org_prc_trx_mst & org_prc_trx_dtl)
 */

import type {
  NotesFollowupTargetLevel,
  PrcTrxDtlType,
  PrcTrxSourceScreen,
  PrcTrxTargetLevel,
  PrcTrxType,
} from '@/lib/constants/processing-trx';
import type { PrefsFollowupNote } from '@/lib/utils/notes-followup';

export interface ProcessingTrxDetail {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  order_id: string;
  trx_id: string;
  line_seq: number;
  target_level: PrcTrxTargetLevel;
  target_level_text: string | null;
  order_item_id: string | null;
  order_item_piece_id: string | null;
  order_preference_id: string | null;
  trans_dtl_type: PrcTrxDtlType;
  trans_dtl_description: string | null;
  step_code: string | null;
  from_value: string | null;
  to_value: string | null;
  before_values: Record<string, unknown>;
  after_values: Record<string, unknown>;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProcessingTrxHeader {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  order_id: string;
  trx_code: string;
  trans_type: PrcTrxType;
  trx_description: string | null;
  source_screen: PrcTrxSourceScreen | string;
  actor_user_id: string | null;
  actor_name: string | null;
  occurred_at: string;
  idempotency_key: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  details: ProcessingTrxDetail[];
}

export interface ProcessingTrxLineInput {
  targetLevel: PrcTrxTargetLevel;
  targetLevelText?: string | null;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  orderPreferenceId?: string | null;
  branchId?: string | null;
  transDtlType: PrcTrxDtlType;
  transDtlDescription?: string | null;
  stepCode?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  beforeValues?: Record<string, unknown>;
  afterValues?: Record<string, unknown>;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordProcessingTrxInput {
  tenantId: string;
  orderId: string;
  branchId?: string | null;
  transType: PrcTrxType;
  trxDescription?: string | null;
  sourceScreen: PrcTrxSourceScreen | string;
  actorUserId?: string | null;
  actorName?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  /** Also append a note to org_orders_mst.notes_followup when `notes` is set */
  appendOrderFollowupNote?: boolean;
  noteSource?: string;
  lines: ProcessingTrxLineInput[];
}

export interface RecordProcessingTrxResult {
  success: boolean;
  trxId?: string;
  trxCode?: string;
  lineCount?: number;
  error?: string;
}

export interface OrderFollowupNotesBundle {
  orderNotes: PrefsFollowupNote[];
  byItem: Record<string, PrefsFollowupNote[]>;
  byPiece: Record<string, PrefsFollowupNote[]>;
  byPreference: Record<string, PrefsFollowupNote[]>;
}

export interface AppendFollowupNoteInput {
  tenantId: string;
  orderId: string;
  branchId?: string | null;
  targetLevel: NotesFollowupTargetLevel;
  targetId: string;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  noteText: string;
  noteSource: string;
  userId: string;
  userName?: string | null;
  sourceScreen?: PrcTrxSourceScreen | string;
  recordPrcTrx?: boolean;
}
