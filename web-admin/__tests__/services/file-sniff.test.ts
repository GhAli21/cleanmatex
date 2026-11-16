/** @jest-environment node */
import { contentMatchesMime, canVerifyMime, fileExtension } from '@/lib/services/file-util/file-sniff';

const b = (...x: number[]) => Buffer.from(x);
const ftyp = (major: string, ...compat: string[]) => {
  const brands = [major, '\0\0\0\0', ...compat].join('');
  const size = 8 + brands.length;
  const head = Buffer.alloc(4);
  head.writeUInt32BE(size);
  return Buffer.concat([head, Buffer.from('ftyp' + brands, 'latin1'), Buffer.alloc(16)]);
};
const zip = (...names: string[]) => Buffer.concat([b(0x50, 0x4b, 0x03, 0x04), Buffer.from(names.join('|'), 'latin1')]);

describe('contentMatchesMime', () => {
  it.each([
    ['image/jpeg', b(0xff, 0xd8, 0xff, 0xe0)],
    ['image/png', b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')],
    ['image/gif', Buffer.from('GIF89a....', 'latin1')],
    ['image/heic', ftyp('mif1', 'heic')],
    ['image/heif', ftyp('heif')],
    ['application/pdf', Buffer.from('%PDF-1.7\n', 'latin1')],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip('[Content_Types].xml', 'word/document.xml')],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip('[Content_Types].xml', 'xl/workbook.xml')],
    ['text/csv', Buffer.from('a,b\n1,2\n', 'utf8')],
    ['text/plain', Buffer.from('مرحبا hello', 'utf8')],
    ['video/mp4', ftyp('isom', 'mp41')],
    ['video/webm', b(0x1a, 0x45, 0xdf, 0xa3, 0x01)],
  ])('accepts real %s', (mime, buf) => {
    expect(contentMatchesMime(mime, buf)).toBe(true);
  });

  it.each([
    ['HTML renamed to jpeg', 'image/jpeg', Buffer.from('<html><script>', 'latin1')],
    ['Windows exe as pdf', 'application/pdf', Buffer.from('MZ\x90\0', 'latin1')],
    ['plain zip as docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip('[Content_Types].xml', 'xl/workbook.xml')],
    ['binary as text', 'text/plain', b(0x00, 0x01, 0x02)],
    ['HEIC as mp4', 'video/mp4', ftyp('mif1', 'heic')],
    ['mp4 as heic', 'image/heic', ftyp('isom', 'mp41')],
    ['empty file', 'image/png', Buffer.alloc(0)],
    ['unknown type', 'application/zip', zip('a')],
  ])('rejects %s', (_label, mime, buf) => {
    expect(contentMatchesMime(mime, buf)).toBe(false);
  });

  it('only verifies known types and reads extensions', () => {
    expect(canVerifyMime('image/svg+xml')).toBe(false);
    expect(canVerifyMime('image/jpeg')).toBe(true);
    expect(fileExtension('Photo.JPG')).toBe('jpg');
    expect(fileExtension('noext')).toBe('');
    expect(fileExtension('.hidden')).toBe('');
  });
});
