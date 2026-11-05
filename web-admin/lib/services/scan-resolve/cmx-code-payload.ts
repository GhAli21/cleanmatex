/**
 * Staff QR payload `CMX<version>:<TYPE>:<code>` (Human-Friendly Codes, plan section 6.4).
 * Pure: no imports, so cmx-api and the mobile apps can copy it 1:1 (A-15).
 * TYPE is the doc type's type_prefix from sys_doc_seq_type_cd (3..5 capital letters): ORD, ITM, PEC, ...
 */

export const CMX_PAYLOAD_VERSION = 1;

export type CmxPayloadDecodeError = 'NOT_CMX' | 'UNSUPPORTED_VERSION' | 'BAD_TYPE' | 'EMPTY_CODE';

export interface CmxPayload {
  version: number;
  type: string;
  code: string;
}

const PAYLOAD_RE = /^CMX(\d+):([^:]*):(.*)$/i;
const TYPE_RE = /^[A-Z]{3,5}$/;

/** Build `CMX1:<TYPE>:<code>`. */
export function encodeCmxPayload(type: string, code: string): string {
  const t = type.trim().toUpperCase();
  if (!TYPE_RE.test(t)) throw new Error('CMX payload type must be 3..5 capital letters');
  if (code.trim() === '') throw new Error('CMX payload code must not be empty');
  return `CMX${CMX_PAYLOAD_VERSION}:${t}:${code.trim()}`;
}

/**
 * Read a payload. Returns the parts, or the reason it is not a usable payload.
 * The code is upper-cased (our codes are upper case).
 */
export function decodeCmxPayload(raw: string): { ok: true; payload: CmxPayload } | { ok: false; reason: CmxPayloadDecodeError } {
  const m = PAYLOAD_RE.exec(raw.trim());
  if (!m) return { ok: false, reason: 'NOT_CMX' };
  const version = Number(m[1]);
  if (version !== CMX_PAYLOAD_VERSION) return { ok: false, reason: 'UNSUPPORTED_VERSION' };
  const type = m[2].trim().toUpperCase();
  if (!TYPE_RE.test(type)) return { ok: false, reason: 'BAD_TYPE' };
  const code = m[3].trim().toUpperCase();
  if (code === '') return { ok: false, reason: 'EMPTY_CODE' };
  return { ok: true, payload: { version, type, code } };
}
