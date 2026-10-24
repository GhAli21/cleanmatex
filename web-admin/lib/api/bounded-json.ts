import 'server-only';

/** Distinguishes invalid transport from a valid JSON document that fails domain validation. */
export class BoundedJsonError extends Error {
  /**
   * Preserves a safe transport classification for route-level error handling.
   * @param status HTTP client-error status for invalid or oversized input.
   * @param code Stable error code; raw request content is never included.
   */
  constructor(readonly status: 400 | 413, readonly code: 'MALFORMED_JSON' | 'REQUEST_BODY_TOO_LARGE') {
    super(code);
    this.name = 'BoundedJsonError';
  }
}

/**
 * Counts streamed bytes rather than trusting Content-Length before allocating parsed input.
 * @param request Incoming HTTP body.
 * @param maxBytes Maximum accepted UTF-8 body size.
 * @returns Untrusted parsed JSON for subsequent domain validation.
 * @throws BoundedJsonError for malformed or oversized bodies.
 */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new BoundedJsonError(413, 'REQUEST_BODY_TOO_LARGE');
  }
  if (!request.body) throw new BoundedJsonError(400, 'MALFORMED_JSON');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BoundedJsonError(413, 'REQUEST_BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BoundedJsonError(400, 'MALFORMED_JSON');
  }
}
