/**
 * Merge Confirm / Notes API deltas into cached Processing piece pref rows.
 */

import type {
  ProcessingPiecePrefRow,
  ProcessingPrefConfirmDelta,
  ProcessingPrefNotesDelta,
} from '@/lib/services/order-piece-processing-preference.service';

/**
 * Apply Confirm PATCH delta onto a cached pref row.
 */
export function applyConfirmDelta(
  row: ProcessingPiecePrefRow,
  delta: ProcessingPrefConfirmDelta
): ProcessingPiecePrefRow {
  if (row.id !== delta.id) return row;
  return {
    ...row,
    processing_confirmed: delta.processing_confirmed,
    confirmed_by: delta.confirmed_by,
    confirmed_at: delta.confirmed_at,
    updated_at: delta.updated_at,
    updated_by: delta.updated_by,
    can_delete: delta.can_delete,
  };
}

/**
 * Apply Notes POST delta onto a cached pref row.
 */
export function applyNotesDelta(
  row: ProcessingPiecePrefRow,
  delta: ProcessingPrefNotesDelta
): ProcessingPiecePrefRow {
  if (row.id !== delta.id) return row;
  return {
    ...row,
    notes_followup: delta.notes_followup,
  };
}
