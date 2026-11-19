/**
 * PR-04 Task 2: the pure POS hotkey resolver (rulings 1–5, Review Focus 1–3).
 */
import { POS_HOTKEYS, resolvePosHotkey, type PosHotkeyGuard } from '@features/orders/hooks/use-pos-hotkeys';

const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});
const free: PosHotkeyGuard = { anyModalOpen: false, editableTarget: false, isWorkspace: false, isEditMode: false };

describe('resolvePosHotkey', () => {
  it.each([
    ['/', k('/'), 'focusSearch'],
    ['?', k('?', { shiftKey: true }), 'showHelp'],
    ['F2', k('F2'), 'pickCustomer'],
    ['F9', k('F9'), 'pay'],
    ['Ctrl+Enter', k('Enter', { ctrlKey: true }), 'save'],
    ['⌘+Enter', k('Enter', { metaKey: true }), 'save'],
    ['Ctrl+S', k('s', { ctrlKey: true }), 'save'],
    ['Ctrl+S with Caps Lock', k('S', { ctrlKey: true }), 'save'],
    ['Arabic ؟ (Shift+/ on the Arabic layout)', k('؟', { shiftKey: true }), 'showHelp'],
    ['Alt+1', k('1', { altKey: true }), 'tab'],
    ['Alt+2', k('2', { altKey: true }), 'tab'],
    ['Alt+3', k('3', { altKey: true }), 'tab'],
    ['Alt+5', k('5', { altKey: true }), 'tab'],
  ])('%s resolves', (_n, ev, action) => {
    expect(resolvePosHotkey(ev, free)).toBe(action);
  });

  it('any open modal turns every key off (Review Focus 1)', () => {
    const g = { ...free, anyModalOpen: true };
    for (const ev of [k('/'), k('?'), k('F2'), k('F9'), k('Enter', { ctrlKey: true }), k('1', { altKey: true })]) {
      expect(resolvePosHotkey(ev, g)).toBeNull();
    }
  });

  it('Ctrl+S with a modal open is swallowed, so the browser Save Page does not open', () => {
    const g = { ...free, anyModalOpen: true };
    expect(resolvePosHotkey(k('s', { ctrlKey: true }), g)).toBe('block');
    expect(resolvePosHotkey(k('s', { metaKey: true }), g)).toBe('block');
  });

  it('in an editable field / and ? are typed, command keys still work (Review Focus 2)', () => {
    const g = { ...free, editableTarget: true };
    expect(resolvePosHotkey(k('/'), g)).toBeNull();
    expect(resolvePosHotkey(k('?'), g)).toBeNull();
    expect(resolvePosHotkey(k('؟'), g)).toBeNull();
    expect(resolvePosHotkey(k('F2'), g)).toBe('pickCustomer');
    expect(resolvePosHotkey(k('F9'), g)).toBe('pay');
    expect(resolvePosHotkey(k('Enter', { ctrlKey: true }), g)).toBe('save');
    expect(resolvePosHotkey(k('s', { ctrlKey: true }), g)).toBe('save');
  });

  it('the workspace has no customer picker', () => {
    expect(resolvePosHotkey(k('F2'), { ...free, isWorkspace: true })).toBeNull();
  });

  it('edit mode has no pay step', () => {
    expect(resolvePosHotkey(k('F9'), { ...free, isEditMode: true })).toBeNull();
    expect(resolvePosHotkey(k('Enter', { ctrlKey: true }), { ...free, isEditMode: true })).toBe('save');
  });

  it('modified / or plain keys do nothing', () => {
    expect(resolvePosHotkey(k('/', { altKey: true }), free)).toBeNull();
    expect(resolvePosHotkey(k('/', { ctrlKey: true }), free)).toBeNull();
    expect(resolvePosHotkey(k('Enter'), free)).toBeNull();
    expect(resolvePosHotkey(k('s'), free)).toBeNull();
    expect(resolvePosHotkey(k('1'), free)).toBeNull();
    expect(resolvePosHotkey(k('F9', { altKey: true }), free)).toBeNull();
  });

  it('every cheat sheet row names a shortcuts key', () => {
    expect(POS_HOTKEYS.length).toBeGreaterThan(0);
    for (const row of POS_HOTKEYS) expect(row.labelKey).toMatch(/^[a-zA-Z]+$/);
  });
});
