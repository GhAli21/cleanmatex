import 'server-only';
import { ORDER_CHANGE_LIMITS } from '@/lib/constants/order-change';

/** Typed transport failures allow future Change routes to preserve the V3 error envelope. */
export class OrderChangeBodyError extends Error {
  constructor(
    readonly code: 'REQUEST_BODY_TOO_LARGE' | 'MALFORMED_JSON',
    readonly status: 400 | 413,
  ) {
    super(code === 'REQUEST_BODY_TOO_LARGE' ? 'Change request body exceeds the allowed size.' : 'Change request body must be valid JSON.');
    this.name = 'OrderChangeBodyError';
  }
}

/**
 * Reads a Change mutation body with a byte limit before JSON parsing.
 * Content-Length is only an early rejection: streamed byte counting protects
 * against absent or deceptive headers before an unbounded allocation occurs.
 */
export async function readBoundedOrderChangeJson(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES) {
    throw new OrderChangeBodyError('REQUEST_BODY_TOO_LARGE', 413);
  }

  if (!request.body) {
    throw new OrderChangeBodyError('MALFORMED_JSON', 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new OrderChangeBodyError('REQUEST_BODY_TOO_LARGE', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new OrderChangeBodyError('MALFORMED_JSON', 400);
  }
}
