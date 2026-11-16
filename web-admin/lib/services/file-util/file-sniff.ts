/**
 * File Util — content checks. Confirms that stored bytes really are the declared MIME type, so a
 * renamed `.exe` or HTML page cannot pass as an image or PDF. Pure functions; no I/O.
 */

const ISO_BMFF_IMAGE_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'heif', 'avif', 'avis']);
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'heif']);

/** Major + compatible brands of an ISO-BMFF `ftyp` box (MP4, HEIC/HEIF), or null when absent. */
function isoBrands(buf: Buffer): Set<string> | null {
  if (buf.length < 16 || buf.toString('latin1', 4, 8) !== 'ftyp') return null;
  const boxSize = Math.min(buf.readUInt32BE(0), buf.length, 256);
  const brands = new Set([buf.toString('latin1', 8, 12)]);
  for (let i = 16; i + 4 <= boxSize; i += 4) brands.add(buf.toString('latin1', i, i + 4));
  return brands;
}

function startsWith(buf: Buffer, bytes: number[]): boolean {
  return buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
}

/** Zip-based Office file: zip header plus the part folder of the expected application. */
function isOoxml(buf: Buffer, partFolder: string): boolean {
  if (!startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return false;
  const text = buf.toString('latin1');
  return text.includes('[Content_Types].xml') && text.includes(partFolder);
}

/** Plain text: valid UTF-8 without NUL bytes (binary files nearly always contain NUL). */
function isUtf8Text(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

const CHECKS: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (b) => b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.toString('latin1', 0, 6)),
  'image/heic': (b) => [...(isoBrands(b) ?? [])].some((x) => HEIF_BRANDS.has(x)),
  'image/heif': (b) => [...(isoBrands(b) ?? [])].some((x) => HEIF_BRANDS.has(x)),
  // PDF allows bytes before the header; readers accept it within the first 1024 bytes.
  'application/pdf': (b) => b.toString('latin1', 0, Math.min(b.length, 1024)).includes('%PDF-'),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => isOoxml(b, 'word/'),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => isOoxml(b, 'xl/'),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (b) => isOoxml(b, 'ppt/'),
  'text/plain': isUtf8Text,
  'text/csv': isUtf8Text,
  'video/mp4': (b) => {
    const brands = isoBrands(b);
    return brands !== null && ![...brands].some((x) => ISO_BMFF_IMAGE_BRANDS.has(x));
  },
  'video/webm': (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
};

/**
 * True when the File Util service knows how to verify this MIME type.
 * shortcut: only the 14 types active in 0743 have checks; a type HQ activates later is refused
 * until a check is added here.
 * @param mimeType lowercase MIME type
 */
export function canVerifyMime(mimeType: string): boolean {
  return mimeType in CHECKS;
}

/**
 * True when `buf` really is `mimeType`. Unknown types return false (refuse, never trust).
 * @param mimeType lowercase declared MIME type
 * @param buf stored file bytes
 */
export function contentMatchesMime(mimeType: string, buf: Buffer): boolean {
  const check = CHECKS[mimeType];
  return buf.length > 0 && check !== undefined && check(buf);
}

/**
 * Lowercase extension of a file name without the dot, or '' when there is none.
 * @param fileName user file name
 */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toLowerCase() : '';
}
