/**
 * Print a React element from a hidden iframe (HFC P4, T4.4).
 *
 * Replaces window.open + document.write of HTML strings: the iframe shell is a fixed string, the CSS is
 * set as textContent, and the label is rendered by React (text is escaped), so order or customer text can
 * never become markup. No pop-up permission is needed. The iframe is removed after printing.
 */
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export interface PrintInIframeOptions {
  css: string;
  dir: 'ltr' | 'rtl';
  lang: string;
  title?: string;
  /** Remove the iframe this long after print() returns if afterprint never fires (ms). Default 60000. */
  cleanupAfterMs?: number;
}

/** Renders `element` into a new hidden iframe and opens the print dialog. Resolves once print() was called. */
export async function printReactInIframe(element: ReactElement, options: PrintInIframeOptions): Promise<void> {
  const { css, dir, lang, title = '', cleanupAfterMs = 60000 } = options;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Print frame is not available');
  }
  doc.open();
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="cmx-print-root"></div></body></html>');
  doc.close();
  doc.documentElement.setAttribute('dir', dir);
  doc.documentElement.setAttribute('lang', lang);
  doc.title = title;
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);

  const container = doc.getElementById('cmx-print-root') as HTMLElement;
  const root = createRoot(container);
  flushSync(() => root.render(element));

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.unmount();
    iframe.remove();
  };
  win.addEventListener('afterprint', () => setTimeout(cleanup, 0));
  // Let the browser lay out the SVGs before the dialog takes the snapshot.
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  try {
    win.focus();
    win.print();
  } catch (e) {
    cleanup();
    throw e;
  }
  setTimeout(cleanup, cleanupAfterMs);
}
