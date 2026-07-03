// Phase 5 — guardrailed payment shortcuts. Covers the pure resolver matrix
// (submit keys × locked disable conditions); the hook itself is a thin
// document-listener wrapper covered by typecheck + build per the program
// test strategy for effect hooks.
import {
  resolvePaymentShortcutAction,
} from '@features/orders/hooks/use-payment-shortcuts';
import type {
  PaymentShortcutGuardState,
  PaymentShortcutKeyEvent,
} from '@features/orders/hooks/use-payment-shortcuts';

const key = (
  partial: Partial<PaymentShortcutKeyEvent> & { key: string }
): PaymentShortcutKeyEvent => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...partial,
});

const openState = (
  partial: Partial<PaymentShortcutGuardState> = {}
): PaymentShortcutGuardState => ({
  enabled: true,
  submitBusy: false,
  blocked: false,
  dialogOpen: false,
  editableTarget: false,
  interactiveTarget: false,
  ...partial,
});

describe('resolvePaymentShortcutAction', () => {
  it('submits on plain Enter, Ctrl+Enter, Cmd+Enter, and F2', () => {
    expect(resolvePaymentShortcutAction(key({ key: 'Enter' }), openState())).toBe('submit');
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter', ctrlKey: true }), openState())
    ).toBe('submit');
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter', metaKey: true }), openState())
    ).toBe('submit');
    expect(resolvePaymentShortcutAction(key({ key: 'F2' }), openState())).toBe('submit');
  });

  it('ignores non-shortcut keys and Alt combinations', () => {
    expect(resolvePaymentShortcutAction(key({ key: 'a' }), openState())).toBeNull();
    expect(resolvePaymentShortcutAction(key({ key: 'Escape' }), openState())).toBeNull();
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter', altKey: true }), openState())
    ).toBeNull();
    expect(
      resolvePaymentShortcutAction(key({ key: 'F2', altKey: true }), openState())
    ).toBeNull();
  });

  it('is disabled while the modal is closed or submit is busy', () => {
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter' }), openState({ enabled: false }))
    ).toBeNull();
    expect(
      resolvePaymentShortcutAction(key({ key: 'F2' }), openState({ submitBusy: true }))
    ).toBeNull();
  });

  it('is disabled while validation blocks submit or a nested dialog is open', () => {
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter' }), openState({ blocked: true }))
    ).toBeNull();
    expect(
      resolvePaymentShortcutAction(
        key({ key: 'Enter', ctrlKey: true }),
        openState({ dialogOpen: true })
      )
    ).toBeNull();
  });

  it('is disabled while focus is inside an editable control — for every combo', () => {
    const editable = openState({ editableTarget: true });
    expect(resolvePaymentShortcutAction(key({ key: 'Enter' }), editable)).toBeNull();
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter', ctrlKey: true }), editable)
    ).toBeNull();
    expect(resolvePaymentShortcutAction(key({ key: 'F2' }), editable)).toBeNull();
  });

  it('plain Enter defers to focused buttons/links; F2 and Ctrl+Enter still fire', () => {
    const onButton = openState({ interactiveTarget: true });
    expect(resolvePaymentShortcutAction(key({ key: 'Enter' }), onButton)).toBeNull();
    expect(
      resolvePaymentShortcutAction(key({ key: 'Enter', ctrlKey: true }), onButton)
    ).toBe('submit');
    expect(resolvePaymentShortcutAction(key({ key: 'F2' }), onButton)).toBe('submit');
  });
});
