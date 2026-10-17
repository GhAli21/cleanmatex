/**
 * Reads the Apply error envelope so the screen can explain it and copy it.
 * The route returns `{ ok: false, error: { code, message, details, requestId } }`.
 */
export interface ApplyFailureFacts {
  code: string;
  requestId: string | null;
  serverMessage: string | null;
}

/** Text shown in the review dialog and copied by the operator. */
export interface ApplyFailureNotice {
  title: string;
  lines: string[];
  copyText: string;
}

export function readApplyFailure(body: unknown): ApplyFailureFacts {
  const error = body && typeof body === 'object'
    ? (body as { error?: { code?: unknown; message?: unknown; requestId?: unknown } }).error
    : undefined;
  const code = typeof error?.code === 'string' && error.code.trim() !== '' ? error.code : 'UNKNOWN';
  const requestId = typeof error?.requestId === 'string' && error.requestId.trim() !== '' ? error.requestId : null;
  const serverMessage = typeof error?.message === 'string' && error.message.trim() !== '' ? error.message : null;
  return { code, requestId, serverMessage };
}
