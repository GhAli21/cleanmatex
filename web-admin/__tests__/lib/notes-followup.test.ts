/**
 * @jest-environment node
 */

import {
  appendNotesFollowup,
  canDeleteProcessingPref,
  parseNotesFollowup,
  validateFollowupNoteText,
} from '@/lib/utils/notes-followup';
import { PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';

describe('notes-followup helpers', () => {
  it('parses and sorts follow-up notes', () => {
    const parsed = parseNotesFollowup([
      {
        note_seq: 2,
        note_user_id: 'u2',
        note_datetime: '2026-01-02T00:00:00.000Z',
        note_source: 'ORDER_PROCESSING',
        note_text: 'second',
      },
      {
        note_seq: 1,
        note_user_id: 'u1',
        note_datetime: '2026-01-01T00:00:00.000Z',
        note_source: 'ORDER_CREATE',
        note_text: 'first',
      },
    ]);
    expect(parsed.map((n) => n.note_seq)).toEqual([1, 2]);
  });

  it('appends with next note_seq', () => {
    const next = appendNotesFollowup(
      [
        {
          note_seq: 1,
          note_user_id: 'u',
          note_datetime: 'x',
          note_source: 'ORDER_CREATE',
          note_text: 'a',
        },
      ],
      {
        note_text: '  hello  ',
        note_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
        note_user_id: 'user-1',
        note_datetime: '2026-07-18T00:00:00.000Z',
      }
    );
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      note_seq: 2,
      note_text: 'hello',
      note_source: 'ORDER_PROCESSING',
      note_user_id: 'user-1',
    });
  });

  it('rejects empty note text', () => {
    expect(validateFollowupNoteText('   ').ok).toBe(false);
  });
});

describe('canDeleteProcessingPref', () => {
  const user = 'user-abc';

  it('allows delete only for ORDER_PROCESSING + owner + not confirmed', () => {
    expect(
      canDeleteProcessingPref(
        {
          prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          created_by: user,
          processing_confirmed: false,
        },
        user
      )
    ).toBe(true);
  });

  it('blocks wrong source', () => {
    expect(
      canDeleteProcessingPref(
        {
          prefs_source: PREFS_SOURCE_STAGE.ORDER_CREATE,
          created_by: user,
          processing_confirmed: false,
        },
        user
      )
    ).toBe(false);
  });

  it('blocks other owner', () => {
    expect(
      canDeleteProcessingPref(
        {
          prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          created_by: 'other',
          processing_confirmed: false,
        },
        user
      )
    ).toBe(false);
  });

  it('blocks when confirmed', () => {
    expect(
      canDeleteProcessingPref(
        {
          prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          created_by: user,
          processing_confirmed: true,
        },
        user
      )
    ).toBe(false);
  });

  it('blocks null created_by', () => {
    expect(
      canDeleteProcessingPref(
        {
          prefs_source: PREFS_SOURCE_STAGE.ORDER_PROCESSING,
          created_by: null,
          processing_confirmed: false,
        },
        user
      )
    ).toBe(false);
  });
});
