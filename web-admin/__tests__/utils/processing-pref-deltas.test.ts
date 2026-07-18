/**
 * Unit tests: Confirm / Notes delta merge helpers
 */

import type { ProcessingPiecePrefRow } from '@/lib/services/order-piece-processing-preference.service';
import {
  applyConfirmDelta,
  applyNotesDelta,
} from '@/lib/utils/processing-pref-deltas';

function baseRow(
  overrides: Partial<ProcessingPiecePrefRow> = {}
): ProcessingPiecePrefRow {
  return {
    id: 'pref-1',
    tenant_org_id: 't1',
    order_id: 'o1',
    branch_id: null,
    prefs_no: 1,
    prefs_level: 'PIECE',
    order_item_id: 'i1',
    order_item_piece_id: 'p1',
    preference_id: null,
    preference_code: 'steam_press',
    preference_content: null,
    preference_sys_kind: 'service_prefs',
    preference_category: null,
    prefs_owner_type: 'USER',
    prefs_source: 'ORDER_PROCESSING',
    extra_price: 0.2,
    processing_confirmed: false,
    confirmed_by: null,
    confirmed_at: null,
    notes_followup: [],
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'user-1',
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'user-1',
    can_delete: true,
    ...overrides,
  };
}

describe('processing-pref-deltas', () => {
  it('applyConfirmDelta merges confirm fields and can_delete', () => {
    const row = baseRow();
    const next = applyConfirmDelta(row, {
      id: 'pref-1',
      processing_confirmed: true,
      confirmed_by: 'user-1',
      confirmed_at: '2026-07-18T10:00:00.000Z',
      updated_at: '2026-07-18T10:00:00.000Z',
      updated_by: 'user-1',
      can_delete: false,
    });

    expect(next.processing_confirmed).toBe(true);
    expect(next.confirmed_by).toBe('user-1');
    expect(next.confirmed_at).toBe('2026-07-18T10:00:00.000Z');
    expect(next.can_delete).toBe(false);
    expect(next.preference_code).toBe('steam_press');
    expect(next.notes_followup).toEqual([]);
  });

  it('applyConfirmDelta ignores mismatched id', () => {
    const row = baseRow();
    const next = applyConfirmDelta(row, {
      id: 'other',
      processing_confirmed: true,
      confirmed_by: 'user-1',
      confirmed_at: '2026-07-18T10:00:00.000Z',
      updated_at: '2026-07-18T10:00:00.000Z',
      updated_by: 'user-1',
      can_delete: false,
    });
    expect(next).toBe(row);
  });

  it('applyNotesDelta replaces notes_followup only', () => {
    const row = baseRow({
      notes_followup: [
        {
          note_seq: 1,
          note_user_id: 'user-1',
          note_datetime: '2026-07-18T09:00:00.000Z',
          note_source: 'ORDER_PROCESSING',
          note_text: 'old',
        },
      ],
    });
    const notes = [
      {
        note_seq: 1,
        note_user_id: 'user-1',
        note_datetime: '2026-07-18T09:00:00.000Z',
        note_source: 'ORDER_PROCESSING',
        note_text: 'old',
      },
      {
        note_seq: 2,
        note_user_id: 'user-1',
        note_datetime: '2026-07-18T10:00:00.000Z',
        note_source: 'ORDER_PROCESSING',
        note_text: 'new note',
      },
    ];
    const next = applyNotesDelta(row, { id: 'pref-1', notes_followup: notes });
    expect(next.notes_followup).toEqual(notes);
    expect(next.processing_confirmed).toBe(false);
    expect(next.preference_code).toBe('steam_press');
  });
});
