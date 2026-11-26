/**
 * Helpers for org_order_preferences_dtl.notes_followup JSONB entries.
 * Server append should use cmx_ord_pref_append_notes_followup; this builds/parses client + unit-test shapes.
 */

import {
  PREFS_FOLLOWUP_NOTE_MAX_LEN,
  type PrefsNoteSource,
} from '@/lib/constants/order-preferences';

export interface PrefsFollowupNote {
  note_seq: number;
  note_user_id: string;
  note_user_name?: string;
  note_datetime: string;
  note_source: PrefsNoteSource | string;
  note_text: string;
  trx_code?: string;
  trx_id?: string;
}

/**
 * Parse unknown JSON into a follow-up notes array (invalid entries skipped).
 */
export function parseNotesFollowup(raw: unknown): PrefsFollowupNote[] {
  if (!Array.isArray(raw)) return [];
  const out: PrefsFollowupNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const note_seq = Number(row.note_seq);
    const note_text = typeof row.note_text === 'string' ? row.note_text : '';
    const note_user_id =
      typeof row.note_user_id === 'string' ? row.note_user_id : '';
    const note_user_name =
      typeof row.note_user_name === 'string' && row.note_user_name.trim()
        ? row.note_user_name.trim()
        : undefined;
    const note_datetime =
      typeof row.note_datetime === 'string' ? row.note_datetime : '';
    const note_source =
      typeof row.note_source === 'string' ? row.note_source : '';
    const trx_code =
      typeof row.trx_code === 'string' && row.trx_code.trim()
        ? row.trx_code.trim()
        : undefined;
    const trx_id =
      typeof row.trx_id === 'string' && row.trx_id.trim()
        ? row.trx_id.trim()
        : undefined;
    if (!Number.isFinite(note_seq) || !note_text.trim()) continue;
    out.push({
      note_seq,
      note_user_id,
      ...(note_user_name ? { note_user_name } : {}),
      note_datetime,
      note_source,
      note_text,
      ...(trx_code ? { trx_code } : {}),
      ...(trx_id ? { trx_id } : {}),
    });
  }
  return out.sort((a, b) => a.note_seq - b.note_seq);
}

/**
 * Validate note_text for append (client + service pre-check).
 */
export function validateFollowupNoteText(
  text: string
): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'note_text is required' };
  }
  if (trimmed.length > PREFS_FOLLOWUP_NOTE_MAX_LEN) {
    return {
      ok: false,
      error: `note_text exceeds ${PREFS_FOLLOWUP_NOTE_MAX_LEN} characters`,
    };
  }
  return { ok: true, text: trimmed };
}

/**
 * Pure append for unit tests / offline preview. Production writes use SQL RPC.
 */
export function appendNotesFollowup(
  existing: unknown,
  input: {
    note_text: string;
    note_source: PrefsNoteSource | string;
    note_user_id: string;
    note_user_name?: string;
    note_datetime?: string;
    trx_code?: string;
    trx_id?: string;
  }
): PrefsFollowupNote[] {
  const validated = validateFollowupNoteText(input.note_text);
  if (validated.ok === false) {
    throw new Error(validated.error);
  }
  const current = parseNotesFollowup(existing);
  const nextSeq =
    current.reduce((max, n) => Math.max(max, n.note_seq), 0) + 1;
  return [
    ...current,
    {
      note_seq: nextSeq,
      note_user_id: input.note_user_id,
      ...(input.note_user_name ? { note_user_name: input.note_user_name } : {}),
      note_datetime: input.note_datetime ?? new Date().toISOString(),
      note_source: input.note_source,
      note_text: validated.text,
      ...(input.trx_code ? { trx_code: input.trx_code } : {}),
      ...(input.trx_id ? { trx_id: input.trx_id } : {}),
    },
  ];
}

/**
 * Whether current user may delete a processing-created preference row.
 */
export function canDeleteProcessingPref(row: {
  prefs_source?: string | null;
  created_by?: string | null;
  processing_confirmed?: boolean | null;
}, currentUserId: string): boolean {
  if (!currentUserId?.trim()) return false;
  if (row.prefs_source !== 'ORDER_PROCESSING') return false;
  if (!row.created_by?.trim()) return false;
  if (row.created_by.trim() !== currentUserId.trim()) return false;
  if (row.processing_confirmed === true) return false;
  return true;
}
