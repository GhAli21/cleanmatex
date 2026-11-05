/**
 * HFC P4: labels print from a hidden iframe rendered by React (no pop-up, no HTML strings):
 * dir/lang/CSS are set, text stays text, print() is called and the frame is removed afterwards.
 */
import * as React from 'react';
import { printReactInIframe } from '@/lib/utils/print/print-react-in-iframe';

describe('printReactInIframe', () => {
  let printSpy: jest.Mock;
  let frame: HTMLIFrameElement | null;
  const origAppend = document.body.appendChild.bind(document.body);

  beforeEach(() => {
    jest.useFakeTimers();
    frame = null;
    printSpy = jest.fn();
    jest.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      const r = origAppend(node);
      if (node instanceof HTMLIFrameElement) {
        frame = node;
        (node.contentWindow as Window).print = printSpy;
        (node.contentWindow as Window).focus = jest.fn();
      }
      return r;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the element, sets dir/lang/css, prints and cleans up', async () => {
    const p = printReactInIframe(<p className="x">{'<b>ORD-1</b>'}</p>, { css: '@page { size: 4in 6in; }', dir: 'rtl', lang: 'ar', title: 'ORD-1' });
    const doc = frame!.contentDocument!;
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
    expect(doc.querySelector('style')!.textContent).toContain('size: 4in 6in');
    expect(doc.querySelector('p.x')!.textContent).toBe('<b>ORD-1</b>');
    expect(doc.querySelector('b')).toBeNull();
    await jest.advanceTimersByTimeAsync(60);
    await p;
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.contains(frame)).toBe(true);
    frame!.contentWindow!.dispatchEvent(new Event('afterprint'));
    await jest.advanceTimersByTimeAsync(1);
    expect(document.body.contains(frame)).toBe(false);
  });

  it('removes the frame and rethrows when print fails', async () => {
    printSpy.mockImplementation(() => {
      throw new Error('blocked');
    });
    const p = printReactInIframe(<p>x</p>, { css: '', dir: 'ltr', lang: 'en' });
    const settled = p.catch((e: Error) => e.message);
    await jest.advanceTimersByTimeAsync(60);
    expect(await settled).toBe('blocked');
    expect(document.body.contains(frame)).toBe(false);
  });
});
