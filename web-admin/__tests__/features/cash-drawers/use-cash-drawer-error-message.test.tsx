import { renderHook } from '@testing-library/react';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message';

/** Reads the real catalog from disk (app code must never import locale JSON directly). */
const ledgerErrors = (loc: string): Record<string, string> =>
  JSON.parse(readFileSync(join(process.cwd(), 'messages', loc, 'cashControl.json'), 'utf8')).ledgerErrors;

const messages: Record<string, Record<string, string>> = { en: ledgerErrors('en'), ar: ledgerErrors('ar') };
let locale = 'en';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => messages[locale][key];
    t.has = (key: string) => key in messages[locale];
    return t;
  },
}));

describe('useCashDrawerErrorMessage', () => {
  beforeEach(() => {
    locale = 'en';
  });

  it('resolves a stable API code to its translated sentence, never the code itself', () => {
    const { result } = renderHook(() => useCashDrawerErrorMessage());
    const text = result.current(new Error('CASH_COUNT_REQUIRED'), 'Close failed');
    expect(text).toBe('Count the cash before continuing.');
    expect(text).not.toContain('CASH_COUNT_REQUIRED');
  });

  it('resolves in Arabic too, with the glossary term for the cash drawer', () => {
    locale = 'ar';
    const { result } = renderHook(() => useCashDrawerErrorMessage());
    expect(result.current(new Error('DRAWER_SESSION_ALREADY_OPEN'), 'x')).toContain('درج النقد');
  });

  it('falls back to the caller\'s translated message for an unknown or non-code error — raw server text is never shown', () => {
    const { result } = renderHook(() => useCashDrawerErrorMessage());
    expect(result.current(new Error('Request failed: 500'), 'Close failed')).toBe('Close failed');
    expect(result.current(new Error('Invalid `prisma.x.findMany()` invocation'), 'Close failed')).toBe('Close failed');
    expect(result.current(undefined, 'Close failed')).toBe('Close failed');
    expect(result.current({ weird: true }, 'Close failed')).toBe('Close failed');
  });

  it('accepts a bare code string (server-action results carry the code as a string)', () => {
    const { result } = renderHook(() => useCashDrawerErrorMessage());
    expect(result.current('CASH_DRAWER_SESSION_NOT_OPEN', 'x')).toMatch(/Open a session/);
  });

  it('has an English and Arabic sentence for every ledger error code plus the session codes the API can return', () => {
    const codes = [...Object.values(CASH_LEDGER_ERRORS), 'DRAWER_SESSION_ALREADY_OPEN', 'OPENING_COUNT_ALREADY_RECORDED', 'SESSION_USER_NOT_FOUND'];
    for (const code of codes) {
      expect({ code, en: Boolean(messages.en[code]) }).toEqual({ code, en: true });
      expect({ code, ar: Boolean(messages.ar[code]) }).toEqual({ code, ar: true });
    }
  });
});
