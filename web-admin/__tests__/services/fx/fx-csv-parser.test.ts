import { parseCsvText } from '@/lib/services/fx/fx-csv-parser';

describe('fx-csv-parser — parseCsvText', () => {
  it('parses a simple header + rows (LF line endings)', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6\n';
    const result = parseCsvText(text);
    expect(result.header).toEqual(['a', 'b', 'c']);
    expect(result.rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4\r\n';
    const result = parseCsvText(text);
    expect(result.header).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles a file with no trailing newline', () => {
    const text = 'a,b\n1,2';
    const result = parseCsvText(text);
    expect(result.rows).toEqual([['1', '2']]);
  });

  it('handles quoted fields containing commas', () => {
    const text = 'a,b\n"has, a comma",2\n';
    const result = parseCsvText(text);
    expect(result.rows).toEqual([['has, a comma', '2']]);
  });

  it('handles escaped double-quotes inside a quoted field', () => {
    const text = 'a,b\n"she said ""hi""",2\n';
    const result = parseCsvText(text);
    expect(result.rows).toEqual([['she said "hi"', '2']]);
  });

  it('skips blank lines between data rows', () => {
    const text = 'a,b\n1,2\n\n3,4\n';
    const result = parseCsvText(text);
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('preserves empty trailing cells (e.g. an optional last column left blank)', () => {
    const text = 'a,b,c\n1,2,\n';
    const result = parseCsvText(text);
    expect(result.rows).toEqual([['1', '2', '']]);
  });

  it('returns an empty header and no rows for an empty string', () => {
    const result = parseCsvText('');
    expect(result.header).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('treats a header-only file as having zero data rows', () => {
    const result = parseCsvText('a,b,c\n');
    expect(result.header).toEqual(['a', 'b', 'c']);
    expect(result.rows).toEqual([]);
  });
});
