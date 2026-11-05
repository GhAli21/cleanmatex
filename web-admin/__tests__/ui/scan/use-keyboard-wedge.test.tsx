/**
 * HFC P3b T3.7: useKeyboardWedge (scanner bursts, layout-proof characters, editable fields skipped).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import {
  createWedgeBuffer,
  isEditableTarget,
  useKeyboardWedge,
  wedgeKeyToChar,
  type WedgeKey,
} from '@/lib/hooks/use-keyboard-wedge';

const OPTS = { minLength: 4, maxIntervalMs: 50, terminators: ['Enter', 'Tab'], dedupeMs: 800 };

function keysFor(text: string): WedgeKey[] {
  return [...text].map((c) => {
    if (/[A-Z]/.test(c)) return { code: `Key${c}`, key: c };
    if (/[0-9]/.test(c)) return { code: `Digit${c}`, key: c };
    if (c === '-') return { code: 'Minus', key: '-' };
    if (c === ':') return { code: 'Semicolon', key: ':', shiftKey: true };
    throw new Error(c);
  });
}

function feed(buffer: ReturnType<typeof createWedgeBuffer>, keys: WedgeKey[], start: number, step: number) {
  let t = start;
  for (const k of keys) {
    buffer.push(k, t);
    t += step;
  }
  return buffer.push({ code: 'Enter', key: 'Enter' }, t);
}

describe('wedgeKeyToChar', () => {
  it('uses the physical key, so an Arabic layout still gives Latin codes', () => {
    expect(wedgeKeyToChar({ code: 'KeyA', key: 'ش' })).toBe('A');
    expect(wedgeKeyToChar({ code: 'Digit7', key: '٧' })).toBe('7');
    expect(wedgeKeyToChar({ code: 'Numpad3', key: '3' })).toBe('3');
    expect(wedgeKeyToChar({ code: 'Minus', key: '-' })).toBe('-');
    expect(wedgeKeyToChar({ code: 'Minus', key: '_', shiftKey: true })).toBe('_');
    expect(wedgeKeyToChar({ code: 'Semicolon', key: ':', shiftKey: true })).toBe(':');
    expect(wedgeKeyToChar({ code: 'Slash', key: '/' })).toBe('/');
  });
  it('ignores shortcuts, IME composition and other keys', () => {
    expect(wedgeKeyToChar({ code: 'KeyF', ctrlKey: true })).toBeNull();
    expect(wedgeKeyToChar({ code: 'KeyA', isComposing: true })).toBeNull();
    expect(wedgeKeyToChar({ code: 'KeyA', key: 'Process' })).toBeNull();
    expect(wedgeKeyToChar({ code: 'Space', key: ' ' })).toBeNull();
  });
});

describe('createWedgeBuffer', () => {
  it('reports a fast burst ended by Enter', () => {
    const b = createWedgeBuffer(OPTS);
    expect(feed(b, keysFor('ORD-20261031-0001'), 1000, 10)).toBe('ORD-20261031-0001');
  });
  it('ignores typing by hand (slow keys) and too-short bursts', () => {
    const b = createWedgeBuffer(OPTS);
    expect(feed(b, keysFor('ORD-1'), 1000, 200)).toBeNull();
    expect(feed(b, keysFor('AB'), 5000, 5)).toBeNull();
  });
  it('ignores an Enter that comes long after the burst', () => {
    const b = createWedgeBuffer(OPTS);
    keysFor('TAG-77').forEach((k, i) => b.push(k, 1000 + i * 5));
    expect(b.push({ code: 'Enter' }, 3000)).toBeNull();
  });
  it('reports a repeat once inside dedupeMs, again after it', () => {
    const b = createWedgeBuffer(OPTS);
    expect(feed(b, keysFor('TAG-77'), 1000, 5)).toBe('TAG-77');
    expect(feed(b, keysFor('TAG-77'), 1200, 5)).toBeNull();
    expect(feed(b, keysFor('TAG-77'), 3000, 5)).toBe('TAG-77');
  });
});

describe('isEditableTarget', () => {
  it('is true for text fields and false for buttons', () => {
    const input = document.createElement('input');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

function Probe({ onScan, enabled = true }: { onScan: (v: string) => void; enabled?: boolean }) {
  useKeyboardWedge({ onScan, enabled });
  return <input aria-label="note" />;
}

describe('useKeyboardWedge', () => {
  function burst(text: string) {
    let t = 10_000;
    const fire = (init: KeyboardEventInit) => {
      const ev = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'timeStamp', { value: t });
      t += 5;
      window.dispatchEvent(ev);
      return ev;
    };
    keysFor(text).forEach((k) => fire({ code: k.code, key: k.key, shiftKey: k.shiftKey }));
    return fire({ code: 'Enter', key: 'Enter' });
  }

  it('calls onScan for a burst on the page and stops the Enter', () => {
    const onScan = jest.fn();
    render(<Probe onScan={onScan} />);
    const enter = burst('CMX1:PEC:X1');
    expect(onScan).toHaveBeenCalledWith('CMX1:PEC:X1');
    expect(enter.defaultPrevented).toBe(true);
  });
  it('stays out of the way while a text field has focus, and when disabled', () => {
    const onScan = jest.fn();
    const { getByLabelText, rerender } = render(<Probe onScan={onScan} />);
    getByLabelText('note').focus();
    burst('TAG-99');
    expect(onScan).not.toHaveBeenCalled();
    (document.activeElement as HTMLElement).blur();
    rerender(<Probe onScan={onScan} enabled={false} />);
    burst('TAG-98');
    expect(onScan).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: 'Enter' });
  });
});
