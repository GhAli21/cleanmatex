/**
 * useFocusTrap - Focus trap and return focus for modals
 * When open: saves previous activeElement, focuses first focusable in container, traps Tab
 * When closed: restores focus to previous activeElement
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

export function useFocusTrap(open: boolean, options?: { returnFocus?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const returnFocus = options?.returnFocus !== false;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const focusable = getFocusableElements(container);
    const first = focusable[0];
    if (first) {
      requestAnimationFrame(() => first.focus());
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus && previousActiveRef.current?.focus) {
        requestAnimationFrame(() => previousActiveRef.current?.focus());
      }
    };
  }, [open, returnFocus, handleKeyDown]);

  return containerRef;
}
