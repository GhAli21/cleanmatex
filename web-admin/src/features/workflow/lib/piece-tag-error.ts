/**
 * Message for a piece tag error returned by POST /api/v1/orders/[id]/batch-update (Human-Friendly Codes P3).
 * 400 PIECE_TAG_INVALID (bad format) / PIECE_TAG_LOOKS_LIKE_CODE (shaped like one of our codes).
 * 409 PIECE_TAG_IN_USE (on another live piece) / PIECE_TAG_DUPLICATE_IN_BATCH (on two pieces of this save).
 * When the full check fails nothing is saved and `issues` lists every problem; a same-instant DB race may leave
 * `piecesUpdated` > 0 (A-38).
 */

type Translate = (key: string, values?: Record<string, string>) => string;

interface PieceTagErrorBody {
  code?: string;
  tag?: string;
  heldByPieceCode?: string | null;
  issues?: unknown[];
  piecesUpdated?: number;
}

const KEY_BY_CODE: Record<string, string> = {
  PIECE_TAG_INVALID: 'error.tagInvalid',
  PIECE_TAG_LOOKS_LIKE_CODE: 'error.tagLooksLikeCode',
  PIECE_TAG_DUPLICATE_IN_BATCH: 'error.tagDuplicateInBatch',
};

/**
 * @param body parsed error response
 * @param t translator scoped to `processing.modal`
 * @returns the translated message, or null when the body is not a tag error
 */
export function pieceTagErrorMessage(body: unknown, t: Translate): string | null {
  if (!body || typeof body !== 'object') return null;
  const { code, tag, heldByPieceCode, issues, piecesUpdated } = body as PieceTagErrorBody;
  const tagText = typeof tag === 'string' ? tag : '';
  let message: string | null = null;
  if (code === 'PIECE_TAG_IN_USE') {
    message = heldByPieceCode
      ? t('error.tagInUseBy', { tag: tagText, pieceCode: heldByPieceCode })
      : t('error.tagInUse', { tag: tagText });
  } else if (code && KEY_BY_CODE[code]) {
    message = t(KEY_BY_CODE[code], { tag: tagText });
  }
  if (message === null) return null;

  const others = Array.isArray(issues) ? issues.length - 1 : 0;
  if (others > 0) return `${message} ${t('error.tagMoreIssues', { count: String(others) })}`;
  if (typeof piecesUpdated === 'number' && piecesUpdated > 0) {
    return `${message} ${t('error.tagPartialSaved', { count: String(piecesUpdated) })}`;
  }
  return message;
}
