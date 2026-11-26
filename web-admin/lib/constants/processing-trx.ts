/**
 * Processing Batch & Operator Transaction Constants (DB-mirror codes)
 * Must stay aligned with CHECK constraints in migration 0827_prc_batch_trx.sql.
 */

export const PRC_TRX_DOC_TYPE = 'PROCESSING_TRX' as const;
export const PRC_TRX_TYPE_PREFIX = 'PRCT' as const;

export const PRC_TRX_TYPES = {
  PROCESSING_BATCH: 'PROCESSING_BATCH',
  SIMPLE_PROCESSING: 'SIMPLE_PROCESSING',
  STEP_RECORD: 'STEP_RECORD',
  ITEM_COMPLETE: 'ITEM_COMPLETE',
  RACK_ASSIGN: 'RACK_ASSIGN',
  TAG_LINK: 'TAG_LINK',
  NOTE_ADD: 'NOTE_ADD',
  OTHERS: 'OTHERS',
} as const;

export type PrcTrxType = (typeof PRC_TRX_TYPES)[keyof typeof PRC_TRX_TYPES];

export const PRC_TRX_SOURCE_SCREENS = {
  PROCESSING_MODAL: 'processing_modal',
  SIMPLE_PROCESSING: 'simple_processing',
  PROCESSING_DETAIL: 'processing_detail',
  RACK_BAGS_MODAL: 'rack_bags_modal',
  PACKING_DETAIL: 'packing_detail',
  SCAN_STATION: 'scan_station',
  ORDER_DETAIL: 'order_detail',
  API: 'api',
} as const;

export type PrcTrxSourceScreen =
  (typeof PRC_TRX_SOURCE_SCREENS)[keyof typeof PRC_TRX_SOURCE_SCREENS];

export const PRC_TRX_TARGET_LEVELS = {
  ORDER: 'ORDER',
  ITEM: 'ITEM',
  PIECE: 'PIECE',
  PREFERENCE: 'PREFERENCE',
  OTHERS: 'OTHERS',
} as const;

export type PrcTrxTargetLevel =
  (typeof PRC_TRX_TARGET_LEVELS)[keyof typeof PRC_TRX_TARGET_LEVELS];

export const NOTES_FOLLOWUP_TARGET_LEVELS = {
  ORDER: 'ORDER',
  ITEM: 'ITEM',
  PIECE: 'PIECE',
  PREFERENCE: 'PREFERENCE',
} as const;

export type NotesFollowupTargetLevel =
  (typeof NOTES_FOLLOWUP_TARGET_LEVELS)[keyof typeof NOTES_FOLLOWUP_TARGET_LEVELS];

export const PRC_TRX_DTL_TYPES = {
  STEP_CHANGE: 'STEP_CHANGE',
  STAGE_CHANGE: 'STAGE_CHANGE',
  MARK_READY: 'MARK_READY',
  UNMARK_READY: 'UNMARK_READY',
  REJECT: 'REJECT',
  UNREJECT: 'UNREJECT',
  RACK_ASSIGN: 'RACK_ASSIGN',
  ORDER_RACK_ASSIGN: 'ORDER_RACK_ASSIGN',
  LOCKER_ASSIGN: 'LOCKER_ASSIGN',
  BAG_COUNT_CHANGE: 'BAG_COUNT_CHANGE',
  HANGING_COUNT_CHANGE: 'HANGING_COUNT_CHANGE',
  BARCODE_SCAN: 'BARCODE_SCAN',
  TAG_LINK: 'TAG_LINK',
  ITEM_COMPLETE: 'ITEM_COMPLETE',
  PREF_CONFIRM: 'PREF_CONFIRM',
  NOTE_ADD: 'NOTE_ADD',
  OTHERS: 'OTHERS',
} as const;

export type PrcTrxDtlType =
  (typeof PRC_TRX_DTL_TYPES)[keyof typeof PRC_TRX_DTL_TYPES];
