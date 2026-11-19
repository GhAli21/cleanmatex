/**
 * POS screen hotkeys for New Order and the Order Workspace (PR-04 Task 2).
 * Pure: the screen's existing keydown listener calls `resolvePosHotkey` and acts on the result,
 * so there is one listener and the rules are unit-testable.
 */

/** What a keydown on the order screen should do. `tab` keeps the screen's own Alt+digit rules; `block` only prevents the browser default. */
export type PosHotkeyAction = 'focusSearch' | 'pickCustomer' | 'pay' | 'save' | 'showHelp' | 'tab' | 'block' | null;

/** Screen state read at event time. */
export interface PosHotkeyGuard {
  /** A dialog (payment, picker, cheat sheet, …) is open: it owns the keyboard. */
  anyModalOpen: boolean;
  /** Focus is in an input, textarea, select or contenteditable. */
  editableTarget: boolean;
  /** Order Workspace: the customer is fixed and the primary action is Review. */
  isWorkspace: boolean;
  /** Edit mode has no payment step. */
  isEditMode: boolean;
}

/** Minimal key facts from a keydown event. */
export interface PosHotkeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Decides the action for a keydown. Matches on `event.key` (the typed character), so `/` and `?`
 * work on an Arabic layout too.
 *
 * @param event Key facts.
 * @param guard Screen state.
 * @returns The action, or null when the key is not a screen shortcut here.
 */
export function resolvePosHotkey(event: PosHotkeyEvent, guard: PosHotkeyGuard): PosHotkeyAction {
  const { key, altKey, shiftKey } = event;
  const mod = event.ctrlKey || event.metaKey;
  // Under a dialog Ctrl+S does nothing, but must not open the browser's Save Page either.
  if (guard.anyModalOpen) return mod && !altKey && key.toLowerCase() === 's' ? 'block' : null;

  // shortcut: Ctrl+S misses on an Arabic layout (key is 'س'); pass event.code too if counters ask for it.
  if (mod && !altKey && (key === 'Enter' || key.toLowerCase() === 's')) return 'save';
  if (mod) return null;

  if (altKey) return !shiftKey && /^[1-5]$/.test(key) ? 'tab' : null;

  if (key === 'F2') return guard.isWorkspace ? null : 'pickCustomer';
  if (key === 'F9') return guard.isEditMode ? null : 'pay';

  // Typing keys: inside a field they are characters, not commands.
  if (guard.editableTarget) return null;
  if (key === '/') return 'focusSearch';
  // '؟' is Shift+/ on the Arabic layout.
  if (key === '?' || key === '؟') return 'showHelp';
  return null;
}

/** Cheat sheet rows; `labelKey` is under `newOrder.shortcuts`. */
export const POS_HOTKEYS: ReadonlyArray<{ keys: string; labelKey: string }> = [
  { keys: '/', labelKey: 'focusSearch' },
  { keys: 'F2', labelKey: 'pickCustomer' },
  { keys: 'F9', labelKey: 'pay' },
  { keys: 'Ctrl+Enter / Ctrl+S', labelKey: 'save' },
  { keys: 'Alt+1 … Alt+5', labelKey: 'tabs' },
  { keys: '?', labelKey: 'showHelp' },
];
