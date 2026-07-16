/**
 * useFocusTrap - Focus trap and return focus for modals
 *
 * When open: saves previous activeElement, optionally focuses the first
 * focusable in the container, traps Tab inside the container, and pulls focus
 * back if it escapes (except into allowed surfaces like the keypad popover or
 * a nested aria-modal dialog).
 *
 * When closed: restores focus to the previous activeElement (optional).
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Whether an element should participate in Tab order for the trap.
 *
 * @param el - Candidate focusable element.
 * @returns True when enabled and not explicitly hidden.
 */
function isTrapFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  // Buttons with tabindex=-1 still match `button:not([disabled])`.
  if (el.getAttribute('tabindex') === '-1') {
    return false;
  }
  if ('disabled' in el && (el as HTMLButtonElement).disabled) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  // Prefer real layout boxes; jsdom often reports empty client rects for
  // connected nodes, so fall back to isConnected when styles allow.
  if (el.getClientRects().length > 0) return true;
  if (el.offsetWidth > 0 || el.offsetHeight > 0) return true;
  return el.isConnected;
}

/**
 * Returns visible, enabled focusable elements inside a container.
 *
 * @param container - Trap root element.
 * @returns Focusable HTMLElements in DOM order.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isTrapFocusable);
}

/**
 * Visible check for dialog roots used by topmost-trap selection.
 *
 * @param el - Dialog element.
 * @returns True when the dialog should be considered open/visible.
 */
function isDialogVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.getClientRects().length > 0) return true;
  return el.isConnected;
}

/**
 * True when focus may leave `container` without being pulled back.
 * Allows the floating keypad popover and nested aria-modal dialogs.
 *
 * @param container - Trap root.
 * @param target - Element receiving focus.
 * @returns Whether the outside focus target is allowed.
 */
export function isAllowedFocusOutside(
  container: HTMLElement,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false;
  if (container.contains(target)) return true;
  if (target.closest('[data-cmx-keypad-popover="true"]')) return true;
  const nestedDialog = target.closest('[role="dialog"][aria-modal="true"]');
  if (
    nestedDialog instanceof HTMLElement &&
    nestedDialog !== container &&
    !container.contains(nestedDialog)
  ) {
    return true;
  }
  return false;
}

/**
 * True when this container is the topmost open aria-modal dialog that should
 * own Tab trapping (nested dialogs win over their parents).
 *
 * @param container - Candidate trap root (usually the dialog element).
 * @returns Whether this trap should handle Tab / focusin.
 */
export function isTopmostModalTrap(container: HTMLElement): boolean {
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
  ).filter(isDialogVisible);

  if (dialogs.length === 0) return true;

  const active = document.activeElement;
  if (active instanceof Element) {
    for (let i = dialogs.length - 1; i >= 0; i -= 1) {
      const dialog = dialogs[i];
      if (dialog.contains(active) || dialog === active) {
        return dialog === container || container.contains(dialog);
      }
    }
  }

  return dialogs[dialogs.length - 1] === container;
}

export type UseFocusTrapOptions = {
  /** Restore focus to the previously focused element on close. Default true. */
  returnFocus?: boolean;
  /** Focus the first focusable on open. Default true. */
  autoFocus?: boolean;
};

/**
 * Attaches a focus trap to a container ref while `open` is true.
 *
 * @param open - Whether the trap is active.
 * @param options - Autofocus / return-focus options.
 * @returns Ref to attach to the trap container element.
 */
export function useFocusTrap(open: boolean, options?: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const returnFocus = options?.returnFocus !== false;
  const autoFocus = options?.autoFocus !== false;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;
    if (!isTopmostModalTrap(container)) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    // Focus is in an allowed outside surface (keypad) — do not steal Tab.
    if (active && !container.contains(active) && isAllowedFocusOutside(container, active)) {
      return;
    }

    // Own the full Tab cycle so focus cannot leave the dialog (also reliable
    // in environments where Tab does not move focus natively).
    e.preventDefault();

    if (active == null || !container.contains(active)) {
      (e.shiftKey ? last : first)?.focus();
      return;
    }

    const index = focusable.indexOf(active);
    if (e.shiftKey) {
      const prev = index <= 0 ? last : focusable[index - 1];
      prev?.focus();
      return;
    }
    const next = index < 0 || index >= focusable.length - 1 ? first : focusable[index + 1];
    next?.focus();
  }, []);

  const handleFocusIn = useCallback((e: FocusEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (!isTopmostModalTrap(container)) return;
    if (isAllowedFocusOutside(container, e.target)) return;

    const focusable = getFocusableElements(container);
    const first = focusable[0];
    first?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    let autoFocusTimer: number | undefined;
    if (autoFocus) {
      const focusable = getFocusableElements(container);
      const first = focusable[0];
      if (first) {
        // setTimeout so portal/layout commit is visible to focus in jsdom + browsers.
        autoFocusTimer = window.setTimeout(() => first.focus(), 0);
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      if (autoFocusTimer != null) window.clearTimeout(autoFocusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      if (returnFocus && previousActiveRef.current?.focus) {
        requestAnimationFrame(() => previousActiveRef.current?.focus());
      }
    };
  }, [open, returnFocus, autoFocus, handleKeyDown, handleFocusIn]);

  return containerRef;
}
