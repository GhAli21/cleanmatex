/**
 * useKeyboardWedge - catch a barcode scanner that types like a keyboard (HFC P3b, T3.7).
 *
 * A scanner "types" a burst of keys very fast and ends with Enter (or Tab). This hook listens on the window
 * (capture phase) while no editable field has focus, and calls `onScan` with the normalised value.
 *
 * - Characters come from `KeyboardEvent.code` (physical key), not `key`, so an Arabic keyboard layout still
 *   gives `ORD-...`, never Arabic letters. Letters are always upper case.
 * - Typing by hand is too slow to count as a scan (`maxIntervalMs` between keys).
 * - IME composition is ignored. The same value inside `dedupeMs` is reported once.
 * - Inside a text field, use CmxScanInput instead (it reads the field value on Enter).
 */
'use client';

import { useEffect, useRef } from 'react';
import { normalizeScanInput } from '@/lib/validations/code-format-schemas';

export interface KeyboardWedgeOptions {
  /** Called once per scan with the normalised value. */
  onScan: (value: string) => void;
  /** Listen only while true (default true). */
  enabled?: boolean;
  /** Shortest value that counts as a scan (default 4). */
  minLength?: number;
  /** Longest gap between two keys of one scan, in ms (default 50). */
  maxIntervalMs?: number;
  /** Keys that end a scan (default Enter and Tab). */
  terminators?: string[];
  /** Same value again inside this time is ignored, in ms (default 800). */
  dedupeMs?: number;
}

/** Minimal shape read from a KeyboardEvent; exported for tests. */
export interface WedgeKey {
  code: string;
  key?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
}

/**
 * Character for a physical key, or null when the key is not part of a code.
 * Covers what our codes and tags use: A-Z, 0-9, - _ . / :
 */
export function wedgeKeyToChar(e: WedgeKey): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.key === 'Process') return null;
  const { code } = e;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return e.shiftKey ? null : code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  switch (code) {
    case 'Minus':
    case 'NumpadSubtract':
      return e.shiftKey ? '_' : '-';
    case 'Period':
    case 'NumpadDecimal':
      return e.shiftKey ? null : '.';
    case 'Slash':
    case 'NumpadDivide':
      return e.shiftKey ? null : '/';
    case 'Semicolon':
      return e.shiftKey ? ':' : null;
    default:
      return null;
  }
}

/** True when focus is in a field where the user types (the hook stays out of the way there). */
export function isEditableTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type);
  }
  return false;
}

/** Pure burst tracker, so the timing rules can be tested without a DOM. */
export function createWedgeBuffer(opts: Required<Omit<KeyboardWedgeOptions, 'onScan' | 'enabled'>>) {
  let chars = '';
  let lastAt = 0;
  let lastValue = '';
  let lastValueAt = -Infinity;

  return {
    /** Feed one key. Returns the value when the key ends a valid scan, otherwise null. */
    push(e: WedgeKey, now: number): string | null {
      if (opts.terminators.includes(e.code) || (e.key !== undefined && opts.terminators.includes(e.key))) {
        const value = normalizeScanInput(chars);
        // The end key must follow the burst at scanner speed too.
        const valid = value.length >= opts.minLength && now - lastAt <= opts.maxIntervalMs;
        chars = '';
        if (!valid) return null;
        if (value === lastValue && now - lastValueAt < opts.dedupeMs) return null;
        lastValue = value;
        lastValueAt = now;
        return value;
      }
      const ch = wedgeKeyToChar(e);
      if (ch === null) {
        if (!/^(Shift|Control|Alt|Meta)(Left|Right)?$/.test(e.code)) {
          chars = '';
        }
        return null;
      }
      if (chars === '' || now - lastAt > opts.maxIntervalMs) {
        // A long gap starts a new burst; anything typed before it was by hand.
        chars = ch;
      } else {
        chars += ch;
      }
      lastAt = now;
      return null;
    },
    /** True while a burst is in progress (used to stop Enter/Tab from leaking to the page). */
    get active() {
      return chars.length > 0;
    },
  };
}

export function useKeyboardWedge({
  onScan,
  enabled = true,
  minLength = 4,
  maxIntervalMs = 50,
  terminators = ['Enter', 'Tab'],
  dedupeMs = 800,
}: KeyboardWedgeOptions): void {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const terminatorKey = terminators.join('|');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const buffer = createWedgeBuffer({ minLength, maxIntervalMs, terminators: terminatorKey.split('|'), dedupeMs });

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(document.activeElement)) return;
      const wasActive = buffer.active;
      const value = buffer.push(event, event.timeStamp || Date.now());
      if (value !== null) {
        event.preventDefault();
        onScanRef.current(value);
      } else if (wasActive && terminatorKey.split('|').includes(event.code)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, minLength, maxIntervalMs, terminatorKey, dedupeMs]);
}
