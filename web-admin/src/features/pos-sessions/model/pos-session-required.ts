/**
 * Reads the stable `POS_SESSION_REQUIRED` refusal a finance write returns (B1 / D62) so any screen
 * can offer to open a session inline instead of showing a dead-end error.
 */

export const POS_SESSION_REQUIRED_CODE = 'POS_SESSION_REQUIRED';

export interface PosSessionRequiredInfo {
  /** Branch to open the session in (the write's branch, else the user's home branch); null if unknown. */
  branchId: string | null;
  /** Which finance screen refused (`POS_SESSION_SURFACE`). */
  surface: string | null;
  /** `NONE` = no session; `PAUSED` = the user has a paused session (resume instead of opening). */
  reason: 'NONE' | 'PAUSED';
}

/**
 * @param payload a parsed API error body (`{ errorCode | code, details }`)
 * @returns the refusal details, or `null` when the payload is any other error
 * @example
 * const info = readPosSessionRequired(await res.json().catch(() => null));
 * if (info) setPosSessionRequired(info);
 */
export function readPosSessionRequired(payload: unknown): PosSessionRequiredInfo | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { errorCode?: unknown; code?: unknown; details?: unknown };
  if (body.errorCode !== POS_SESSION_REQUIRED_CODE && body.code !== POS_SESSION_REQUIRED_CODE) return null;
  const details = (body.details && typeof body.details === 'object' ? body.details : {}) as {
    branchId?: unknown;
    surface?: unknown;
    reason?: unknown;
  };
  return {
    branchId: typeof details.branchId === 'string' ? details.branchId : null,
    surface: typeof details.surface === 'string' ? details.surface : null,
    reason: details.reason === 'PAUSED' ? 'PAUSED' : 'NONE',
  };
}
