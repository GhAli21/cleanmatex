/**
 * EN/AR bilingual coverage for every blocked-reason builder in the workflow
 * engine (T18). Each builder must return an English primary message with an
 * Arabic secondary by default, and swap to an Arabic primary with an English
 * secondary when the caller's locale is Arabic — the UI always reads
 * `message`/`message2` without knowing which is which.
 *
 * @jest-environment node
 */

import {
  unsupportedGateModeBlockedReason,
  evidenceRuntimeBlockedReason,
  openReleaseBlockedReason,
  warningAckBlockedReason,
} from '@/lib/services/workflow/workflow-engine.service';

const ARABIC_RANGE = /[؀-ۿ]/;

const BUILDERS = [
  { name: 'unsupportedGateModeBlockedReason', build: unsupportedGateModeBlockedReason, code: 'GATE_DECISION_MODE_UNAVAILABLE' },
  { name: 'evidenceRuntimeBlockedReason', build: evidenceRuntimeBlockedReason, code: 'EVIDENCE_RUNTIME_UNAVAILABLE' },
  { name: 'openReleaseBlockedReason', build: openReleaseBlockedReason, code: 'GATE_RELEASE_ALREADY_OPEN' },
  { name: 'warningAckBlockedReason', build: warningAckBlockedReason, code: 'WF_GATE_ACK_REQUIRED' },
] as const;

describe('workflow engine blocked-reason builders — EN/AR', () => {
  for (const { name, build, code } of BUILDERS) {
    describe(name, () => {
      it('defaults to English primary / Arabic secondary with no locale', () => {
        const reason = build();
        expect(reason.code).toBe(code);
        expect(ARABIC_RANGE.test(reason.message)).toBe(false);
        expect(reason.message2).toBeDefined();
        expect(ARABIC_RANGE.test(reason.message2!)).toBe(true);
      });

      it('defaults to English primary for a non-Arabic locale (en)', () => {
        const reason = build('en');
        expect(ARABIC_RANGE.test(reason.message)).toBe(false);
        expect(ARABIC_RANGE.test(reason.message2!)).toBe(true);
      });

      it('swaps to Arabic primary / English secondary for locale=ar', () => {
        const reason = build('ar');
        expect(reason.code).toBe(code);
        expect(ARABIC_RANGE.test(reason.message)).toBe(true);
        expect(reason.message2).toBeDefined();
        expect(ARABIC_RANGE.test(reason.message2!)).toBe(false);
      });

      it('matches an Arabic locale case-insensitively and with region variants', () => {
        expect(ARABIC_RANGE.test(build('AR').message)).toBe(true);
        expect(ARABIC_RANGE.test(build('ar-SA').message)).toBe(true);
        expect(ARABIC_RANGE.test(build('ar-EG').message)).toBe(true);
      });

      it('primary and secondary are never the same string', () => {
        const en = build('en');
        const ar = build('ar');
        expect(en.message).not.toBe(en.message2);
        expect(ar.message).not.toBe(ar.message2);
        // The EN-locale primary equals the AR-locale secondary and vice versa —
        // both languages exist in every response regardless of locale.
        expect(en.message).toBe(ar.message2);
        expect(ar.message).toBe(en.message2);
      });
    });
  }
});
