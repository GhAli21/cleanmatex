/** @jest-environment node */

import { isInvalidDbInputError } from '@/lib/utils/db-input-error';

describe('isInvalidDbInputError', () => {
  it('matches a Supabase error carrying SQLSTATE 22P02', () => {
    expect(
      isInvalidDbInputError({
        code: '22P02',
        message: 'invalid input syntax for type uuid: "MAIN-BRANCH"',
      })
    ).toBe(true);
  });

  it('matches a Prisma raw-query error carrying the SQLSTATE under meta', () => {
    expect(isInvalidDbInputError({ meta: { code: '22P02' }, message: 'Raw query failed' })).toBe(
      true
    );
  });

  it('falls back to the message when the SQLSTATE is dropped by a wrapper', () => {
    expect(
      isInvalidDbInputError(new Error('invalid input syntax for type uuid: "not-a-uuid"'))
    ).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isInvalidDbInputError(new Error('Product not found: abc'))).toBe(false);
    expect(isInvalidDbInputError({ code: '23503', message: 'foreign key violation' })).toBe(false);
  });

  it('is safe on non-object inputs', () => {
    expect(isInvalidDbInputError(null)).toBe(false);
    expect(isInvalidDbInputError(undefined)).toBe(false);
    expect(isInvalidDbInputError('invalid input syntax for type uuid')).toBe(false);
  });
});
