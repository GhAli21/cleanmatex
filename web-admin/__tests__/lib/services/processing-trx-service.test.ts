/**
 * Unit tests for ProcessingTrxService delta builders & target constraints,
 * plus notes-followup helper utilities.
 */

import { ProcessingTrxService } from '@/lib/services/processing-trx-service';
import {
  PRC_TRX_DTL_TYPES,
  PRC_TRX_TARGET_LEVELS,
} from '@/lib/constants/processing-trx';
import { appendNotesFollowup, parseNotesFollowup } from '@/lib/utils/notes-followup';

describe('ProcessingTrxService delta builders', () => {
  it('builds STEP_CHANGE, MARK_READY, RACK_ASSIGN, TAG_LINK, and NOTE_ADD piece lines', () => {
    const lines = ProcessingTrxService.buildPieceDeltaLines([
      {
        pieceId: 'pc-1',
        orderItemId: 'itm-1',
        pieceCode: 'ORD-001-01-01',
        before: {
          last_step: 'sorting',
          is_ready: false,
          is_rejected: false,
          piece_stage: 'washing',
          rack_location: null,
          scan_state: 'expected',
          barcode: null,
        },
        after: {
          last_step: 'finishing',
          is_ready: true,
          is_rejected: false,
          piece_stage: 'ready',
          rack_location: 'RACK-A1',
          scan_state: 'scanned',
          barcode: 'TAG-901',
        },
        processingNote: 'Pressed with steam',
      },
    ]);

    expect(lines.map((l) => l.transDtlType)).toEqual([
      PRC_TRX_DTL_TYPES.STEP_CHANGE,
      PRC_TRX_DTL_TYPES.MARK_READY,
      PRC_TRX_DTL_TYPES.STAGE_CHANGE,
      PRC_TRX_DTL_TYPES.RACK_ASSIGN,
      PRC_TRX_DTL_TYPES.BARCODE_SCAN,
      PRC_TRX_DTL_TYPES.TAG_LINK,
      PRC_TRX_DTL_TYPES.NOTE_ADD,
    ]);
    expect(lines.every((l) => l.targetLevel === PRC_TRX_TARGET_LEVELS.PIECE)).toBe(true);
    expect(lines[6].notes).toBe('Pressed with steam');
  });

  it('builds ORDER-level rack/locker/bag/note lines only when changed', () => {
    const lines = ProcessingTrxService.buildOrderLevelDeltaLines(
      {
        rack_location: 'A1',
        locker_location: null,
        locker_code: null,
        bag_count: 1,
        hanging_count: 2,
      },
      {
        rack_location: 'B2',
        locker_location: 'L1',
        locker_code: '04',
        bag_count: 1,
        hanging_count: 3,
      },
      'Batch note for order'
    );

    expect(lines.map((l) => l.transDtlType)).toEqual([
      PRC_TRX_DTL_TYPES.ORDER_RACK_ASSIGN,
      PRC_TRX_DTL_TYPES.LOCKER_ASSIGN,
      PRC_TRX_DTL_TYPES.HANGING_COUNT_CHANGE,
      PRC_TRX_DTL_TYPES.NOTE_ADD,
    ]);
    expect(lines.every((l) => l.targetLevel === PRC_TRX_TARGET_LEVELS.ORDER)).toBe(true);
  });
});

describe('notes-followup helpers with actor snapshot & trx_code', () => {
  it('appends and parses notes_followup entries preserving trx_code and note_user_name', () => {
    const appended = appendNotesFollowup([], {
      note_text: 'Handle cuff carefully',
      note_source: 'ORDER_PROCESSING',
      note_user_id: 'u-1',
      note_user_name: 'Ali',
      note_datetime: '2026-11-25T10:00:00.000Z',
      trx_code: 'ORD-001-PRC-0003',
    });

    const parsed = parseNotesFollowup(appended);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      note_seq: 1,
      note_user_id: 'u-1',
      note_user_name: 'Ali',
      note_source: 'ORDER_PROCESSING',
      note_text: 'Handle cuff carefully',
      trx_code: 'ORD-001-PRC-0003',
    });
  });
});
