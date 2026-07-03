'use client';

/**
 * Payment Modal v4 — guardrailed keyboard shortcuts (Phase 5).
 *
 * Enter / F2 / Ctrl(⌘)+Enter submit the payment through the SAME gate as the
 * footer CTA — the hook only invokes the caller-provided `onSubmit`, never a
 * second submit path, so shortcuts can never bypass validation, the confirm
 * dialog, or the payload contract. The guard matrix is pure
 * ({@link resolvePaymentShortcutAction}) so it is jest-testable without DOM
 * plumbing; the hook itself only owns the document keydown listener (mirrors
 * `ready-date-picker-modal.tsx`'s Escape pattern).
 *
 * Locked disable conditions (program plan Phase 5): submit busy · any nested
 * or confirm dialog open · validation blocking · focus inside an editable
 * control (input/textarea/select/contenteditable). Additionally, plain Enter
 * is ignored while an interactive element (button/link) has focus — Enter
 * there already activates that element and must not double-fire a submit.
 */

import { useEffect } from 'react';

/**
 * Minimal keyboard-event shape the pure guard needs (jest-friendly).
 */
export interface PaymentShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * Pure guard state resolved by the caller (view) at event time.
 */
export interface PaymentShortcutGuardState {
  /** Modal open and shortcuts armed. */
  enabled: boolean;
  /** Submit already in flight. */
  submitBusy: boolean;
  /** Validation currently blocks submit (CTA disabled). */
  blocked: boolean;
  /** Any nested/confirm dialog or drawer is open above the modal. */
  dialogOpen: boolean;
  /** Focus is inside input/textarea/select/contenteditable. */
  editableTarget: boolean;
  /** Focus is on an interactive element (button/link) — plain Enter defers to it. */
  interactiveTarget: boolean;
}

/**
 * True when the event target is an editable control the shortcuts must not
 * hijack (locked disable condition).
 *
 * @param target Keydown event target.
 * @returns Whether the target is input/textarea/select/contenteditable.
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * True when the event target is an interactive element that owns its own
 * Enter behavior (button, link, or ARIA button) — plain Enter must not
 * double-fire a submit on top of that activation.
 *
 * @param target Keydown event target.
 * @returns Whether plain Enter should defer to the focused element.
 */
export function isInteractiveEventTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'BUTTON' || tag === 'A') return true;
  return target.getAttribute('role') === 'button';
}

/**
 * Pure shortcut resolver: decides whether a keydown should submit the payment.
 *
 * Submit keys: `F2`, `Enter`, `Ctrl/⌘+Enter` (Alt combinations never match).
 * Every locked disable condition wins over the key match; plain Enter is
 * additionally refused on interactive targets.
 *
 * @param event Minimal key facts from the keydown event.
 * @param state Guard state resolved by the view at event time.
 * @returns `'submit'` when the shortcut should fire, otherwise `null`.
 */
export function resolvePaymentShortcutAction(
  event: PaymentShortcutKeyEvent,
  state: PaymentShortcutGuardState
): 'submit' | null {
  if (!state.enabled || state.submitBusy || state.blocked || state.dialogOpen) {
    return null;
  }
  if (state.editableTarget) return null;
  if (event.altKey) return null;

  if (event.key === 'F2') return 'submit';
  if (event.key === 'Enter') {
    if (event.ctrlKey || event.metaKey) return 'submit';
    // Plain Enter defers to focused buttons/links (they handle Enter as click).
    return state.interactiveTarget ? null : 'submit';
  }
  return null;
}

/**
 * Params for {@link usePaymentShortcuts}.
 */
export interface UsePaymentShortcutsParams {
  /** Modal open — the listener detaches entirely when false. */
  enabled: boolean;
  submitBusy: boolean;
  /** Validation currently blocks submit. */
  blocked: boolean;
  /** Any nested/confirm dialog or drawer open above the modal. */
  dialogOpen: boolean;
  /** The existing CTA submit gate (e.g. `handleSubmit(onSubmitForm, onInvalidForm)`). */
  onSubmit: () => void;
}

/**
 * Attaches the guardrailed document-level keydown listener for the payment
 * modal. View-scope only — no tenant data involved; all finance gating lives
 * in the `onSubmit` callback the view supplies.
 *
 * @param params - {@link UsePaymentShortcutsParams}.
 * @example
 * usePaymentShortcuts({
 *   enabled: open,
 *   submitBusy,
 *   blocked: submitHasBlockingIssues,
 *   dialogOpen: submitConfirmOpen || cashDrawerDialogOpen,
 *   onSubmit: () => handleSubmit(onSubmitForm, onInvalidForm)(),
 * });
 */
export function usePaymentShortcuts({
  enabled,
  submitBusy,
  blocked,
  dialogOpen,
  onSubmit,
}: UsePaymentShortcutsParams): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKeydown = (event: KeyboardEvent) => {
      const action = resolvePaymentShortcutAction(event, {
        enabled,
        submitBusy,
        blocked,
        dialogOpen,
        editableTarget: isEditableEventTarget(event.target),
        interactiveTarget: isInteractiveEventTarget(event.target),
      });
      if (action === 'submit') {
        // Stop the browser/form default so the gate fires exactly once.
        event.preventDefault();
        onSubmit();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [enabled, submitBusy, blocked, dialogOpen, onSubmit]);
}
