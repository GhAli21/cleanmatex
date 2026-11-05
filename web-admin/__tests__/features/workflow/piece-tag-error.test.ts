/**
 * HFC P3: batch-update tag error messages (EN/AR keys under processing.modal.error).
 */
import { pieceTagErrorMessage } from '@/src/features/workflow/lib/piece-tag-error';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read the locale files from disk (the app must not import locale JSON directly).
const readLocale = (locale: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'messages', locale, 'processing.json'), 'utf8')) as {
    modal: { error: Record<string, string> };
  };
const en = readLocale('en');
const ar = readLocale('ar');

const t = (key: string, values?: Record<string, string>) => `${key}${values ? JSON.stringify(values) : ''}`;

describe('pieceTagErrorMessage', () => {
  it('maps every tag error code', () => {
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_IN_USE', tag: 'A', heldByPieceCode: 'P-1' }, t)).toBe('error.tagInUseBy{"tag":"A","pieceCode":"P-1"}');
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_IN_USE', tag: 'A' }, t)).toBe('error.tagInUse{"tag":"A"}');
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_INVALID', tag: 'A' }, t)).toBe('error.tagInvalid{"tag":"A"}');
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_LOOKS_LIKE_CODE', tag: 'A' }, t)).toBe('error.tagLooksLikeCode{"tag":"A"}');
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_DUPLICATE_IN_BATCH', tag: 'A' }, t)).toBe('error.tagDuplicateInBatch{"tag":"A"}');
    expect(pieceTagErrorMessage({ code: 'OTHER' }, t)).toBeNull();
    expect(pieceTagErrorMessage(null, t)).toBeNull();
  });

  it('adds the count of other problems, or of pieces saved before a race', () => {
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_INVALID', tag: 'A', issues: [{}, {}, {}] }, t)).toBe('error.tagInvalid{"tag":"A"} error.tagMoreIssues{"count":"2"}');
    expect(pieceTagErrorMessage({ code: 'PIECE_TAG_IN_USE', piecesUpdated: 3 }, t)).toBe('error.tagInUse{"tag":""} error.tagPartialSaved{"count":"3"}');
  });

  it('has every message in English and Arabic', () => {
    const keys = ['tagInUse', 'tagInUseBy', 'tagInvalid', 'tagLooksLikeCode', 'tagDuplicateInBatch', 'tagMoreIssues', 'tagPartialSaved'];
    const enErr = en.modal.error;
    const arErr = ar.modal.error;
    for (const k of keys) {
      expect(enErr[k]).toBeTruthy();
      expect(arErr[k]).toBeTruthy();
      expect(arErr[k]).not.toBe(enErr[k]);
    }
  });
});
