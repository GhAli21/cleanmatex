/**
 * CmxKeypadPopover
 *
 * A floating, **non-modal**, draggable keypad surface that wraps {@link CmxKeypad}.
 * Launched from a trigger button next to a numeric field, it lets POS operators
 * move the pad out of the way of the content they need to see, and it remembers
 * where they left it (per-device, via `storageKey`).
 *
 * Design contract:
 * - **Non-modal**: it never locks scroll; drag/dock stay available.
 * - **Keyboard mode** (default on): Enter on the trigger focuses a safe home
 *   key (7 → 1); arrows move the grid; ArrowUp from the top row reaches Close
 *   (ArrowLeft → Dock); Enter/Space activate; hardware digits / numpad /
 *   Backspace map to `onKeyPress`; Escape closes and restores focus to
 *   `anchorRef` (capture phase so parent dialogs do not dismiss first).
 * - **Dismiss outside** (default on): pointer down or focus outside the pad,
 *   trigger, and optional linked amount field closes the pad (focus stays).
 *   Hardware digits are NOT double-applied while the linked field is focused.
 * - **Bounded**: drag positions are always clamped inside the viewport and snap
 *   flush to nearby edges, so it can never be lost off-screen.
 * - **Persistent**: the last position is saved and restored on next open; a dock
 *   action returns it to a known bottom-center spot.
 * - **RTL-aware**: the first-open placement mirrors for right-to-left layouts.
 * - **i18n-agnostic**: all labels arrive as props (like {@link CmxKeypad}), so
 *   this primitive stays locale-neutral.
 *
 * Geometry math lives in `cmx-keypad-popover.geometry.ts` and is unit-tested.
 * @module ui/overlays
 */

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, PanelBottom, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CmxKeypad, type CmxKeypadKey, type CmxKeypadProps } from '@ui/utilities';
import {
  clampToViewport,
  defaultAnchorPosition,
  dockPosition,
  snapToEdges,
  type CmxKeypadPoint,
  type CmxKeypadSize,
} from './cmx-keypad-popover.geometry';

/** Props for {@link CmxKeypadPopover}. */
export interface CmxKeypadPopoverProps<T extends CmxKeypadKey = CmxKeypadKey> {
  /** Whether the popover is shown. */
  open: boolean;
  /** Called when the operator closes the popover (button or Escape). */
  onClose: () => void;
  /** The field/button the pad opens next to (used for first-open placement). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** localStorage key for remembering position. Omit to disable persistence. */
  storageKey?: string;
  /** Whether the surrounding UI is right-to-left. */
  isRTL?: boolean;

  // ---- handle chrome ----
  /** Title shown in the drag handle (e.g. "Keypad"). */
  title: string;
  /** Optional live echo shown at the end of the handle (e.g. the amount). */
  echo?: React.ReactNode;
  /** Accessible label for the dock button. */
  dockLabel: string;
  /** Accessible label for the close button. */
  closeLabel: string;
  /** Optional footer hint under the keys (e.g. "Drag to move · stays where you leave it"). */
  hint?: React.ReactNode;
  /** Announced politely when a saved position is restored on open. */
  restoredAnnouncement?: string;
  /**
   * Enables arrow-grid focus, home-key autofocus, hardware digit mapping, and
   * Escape → close + restore focus to the anchor. Defaults to true.
   */
  keyboardMode?: boolean;
  /** When true (default), Escape restores focus to `anchorRef` after close. */
  restoreFocusOnClose?: boolean;
  /**
   * When true (default), pointer-down or focus outside the pad (and outside
   * the trigger / linked fields) dismisses the keypad. Focus stays where the
   * user moved.
   */
  dismissOnOutside?: boolean;
  /**
   * Amount inputs that belong to this pad session. Focus/click here keeps the
   * pad open; hardware digits go to the input (not also via onKeyPress).
   */
  linkedFieldRefs?: ReadonlyArray<React.RefObject<HTMLElement | null>>;

  // ---- keypad passthrough ----
  keys: readonly T[];
  onKeyPress: (key: T) => void;
  onKeyLongPress?: (key: T) => void;
  columns?: CmxKeypadProps<T>['columns'];
  disabled?: boolean;
  getKeyVariant?: CmxKeypadProps<T>['getKeyVariant'];
  getKeyClassName?: CmxKeypadProps<T>['getKeyClassName'];
  renderKeyLabel?: CmxKeypadProps<T>['renderKeyLabel'];
  getKeyAriaLabel?: CmxKeypadProps<T>['getKeyAriaLabel'];
}

/**
 * Maps a hardware keyboard event to a keypad key present in `keys`, or null.
 *
 * @param event - Window keydown event.
 * @param keys - Active keypad key list.
 * @returns Matching key value, or null when unmapped.
 */
export function mapHardwareKeyToKeypadKey<T extends CmxKeypadKey>(
  event: KeyboardEvent,
  keys: readonly T[]
): T | null {
  const keySet = new Set(keys.map(String));
  const { key, code } = event;

  if (/^[0-9]$/.test(key) && keySet.has(key)) return key as T;
  // Numpad digits often report key=0-9 already; also accept Numpad* codes.
  if (/^Numpad[0-9]$/.test(code)) {
    const digit = code.slice('Numpad'.length);
    if (keySet.has(digit)) return digit as T;
  }
  if ((key === '.' || code === 'NumpadDecimal') && keySet.has('.')) {
    return '.' as T;
  }
  if (key === 'Backspace' && keySet.has('backspace')) return 'backspace' as T;
  if ((key === 'Delete' || key === 'Clear') && keySet.has('clear')) return 'clear' as T;
  return null;
}

const PANEL_WIDTH_CLASS = 'w-72'; // 18rem / 288px — matches measured geometry

function loadPosition(storageKey?: string): CmxKeypadPoint | null {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CmxKeypadPoint>;
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') {
      return { left: parsed.left, top: parsed.top };
    }
  } catch {
    /* ignore malformed / unavailable storage */
  }
  return null;
}

function savePosition(pos: CmxKeypadPoint, storageKey?: string): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pos));
  } catch {
    /* storage full / disabled — position simply won't persist */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function measure(el: HTMLElement): CmxKeypadSize {
  return { width: el.offsetWidth, height: el.offsetHeight };
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Renders a draggable, position-remembering keypad popover.
 *
 * @param props - See {@link CmxKeypadPopoverProps}.
 * @returns The portalled popover, or `null` when closed / pre-mount.
 */
export function CmxKeypadPopover<T extends CmxKeypadKey = CmxKeypadKey>({
  open,
  onClose,
  anchorRef,
  storageKey,
  isRTL = false,
  title,
  echo,
  dockLabel,
  closeLabel,
  hint,
  restoredAnnouncement,
  keyboardMode = true,
  restoreFocusOnClose = true,
  dismissOnOutside = true,
  linkedFieldRefs,
  keys,
  onKeyPress,
  onKeyLongPress,
  columns = 4,
  disabled = false,
  getKeyVariant,
  getKeyClassName,
  renderKeyLabel,
  getKeyAriaLabel,
}: CmxKeypadPopoverProps<T>) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const dockBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const dragRef = React.useRef<{ dx: number; dy: number } | null>(null);
  const onKeyPressRef = React.useRef(onKeyPress);
  const onCloseRef = React.useRef(onClose);
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<CmxKeypadPoint | null>(null);
  const [animate, setAnimate] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

  const focusHomeKey = React.useCallback(() => {
    const home = panelRef.current?.querySelector<HTMLButtonElement>(
      '[data-keypad-home="true"]'
    );
    home?.focus();
  }, []);

  /** ArrowUp from the top key row lands on Close (Dock is ArrowLeft from Close). */
  const handleArrowBoundary = React.useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!keyboardMode || disabled) return false;
      if (direction === 'up') {
        closeBtnRef.current?.focus();
        return true;
      }
      return false;
    },
    [disabled, keyboardMode]
  );

  const handleChromeKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    which: 'dock' | 'close'
  ) => {
    if (!keyboardMode) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusHomeKey();
      return;
    }
    if (event.key === 'ArrowLeft' && which === 'close') {
      event.preventDefault();
      dockBtnRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && which === 'dock') {
      event.preventDefault();
      closeBtnRef.current?.focus();
    }
  };

  const chromeBtnClass =
    'grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-cyan-500';

  React.useEffect(() => {
    onKeyPressRef.current = onKeyPress;
  }, [onKeyPress]);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const closeAndRestoreFocus = React.useCallback(() => {
    onCloseRef.current();
    if (!restoreFocusOnClose) return;
    window.setTimeout(() => {
      anchorRef.current?.focus();
    }, 0);
  }, [anchorRef, restoreFocusOnClose]);

  const isInsidePadSession = React.useCallback(
    (node: EventTarget | null) => {
      if (!(node instanceof Node)) return false;
      if (panelRef.current?.contains(node)) return true;
      if (anchorRef.current?.contains(node)) return true;
      if (linkedFieldRefs) {
        for (const ref of linkedFieldRefs) {
          if (ref.current?.contains(node)) return true;
        }
      }
      return false;
    },
    [anchorRef, linkedFieldRefs]
  );

  const isInsideLinkedField = React.useCallback(
    (node: EventTarget | null) => {
      if (!(node instanceof Node) || !linkedFieldRefs) return false;
      for (const ref of linkedFieldRefs) {
        if (ref.current?.contains(node)) return true;
      }
      return false;
    },
    [linkedFieldRefs]
  );

  // Click / Tab outside the pad session dismisses — leave focus where the
  // cashier moved (do not yank back to the keypad button).
  React.useEffect(() => {
    if (!open || !dismissOnOutside) return;
    const dismissIfOutside = (target: EventTarget | null) => {
      if (isInsidePadSession(target)) return;
      onCloseRef.current();
    };
    const onPointerDown = (event: PointerEvent) => {
      dismissIfOutside(event.target);
    };
    const onFocusIn = (event: FocusEvent) => {
      dismissIfOutside(event.target);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [open, dismissOnOutside, isInsidePadSession]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Compute the open position from a saved spot (clamped to the current
  // viewport) or, first time, from the anchor. Needs the rendered panel size,
  // so this is a genuine post-layout measurement.
  React.useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      setRestored(false);
      dragRef.current = null;
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const size = measure(panel);
    const vp = viewport();
    const saved = loadPosition(storageKey);
    if (saved) {
      setPos(clampToViewport(saved, size, vp));
      setRestored(true);
    } else if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos(defaultAnchorPosition(rect, size, vp, isRTL));
      setRestored(false);
    } else {
      setPos(dockPosition(size, vp));
      setRestored(false);
    }
    // `mounted` is a dep because the panel only exists in the DOM (so it can be
    // measured) on the render after mount flips true; without it the position
    // would never be computed and the popover would stay visibility:hidden.
  }, [open, mounted, storageKey, isRTL, anchorRef]);

  // Keep it inside the viewport when the window resizes.
  React.useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      setPos((prev) => (prev ? clampToViewport(prev, measure(panel), viewport()) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // Escape closes (capture) + optional hardware digit / numpad → onKeyPress.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeAndRestoreFocus();
        return;
      }
      if (!keyboardMode || disabled) return;
      // Let arrow / Enter / Space reach the focused grid cell.
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.key === 'Tab'
      ) {
        return;
      }
      const mapped = mapHardwareKeyToKeypadKey(e, keys);
      if (!mapped) return;
      // Linked amount field owns typing — avoid double-applying digits.
      if (isInsideLinkedField(e.target) || isInsideLinkedField(document.activeElement)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onKeyPressRef.current(mapped);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    open,
    keyboardMode,
    disabled,
    keys,
    closeAndRestoreFocus,
    isInsideLinkedField,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags that start on the handle's action buttons.
    if ((e.target as HTMLElement).closest('[data-kp-btn]')) return;
    const panel = panelRef.current;
    if (!panel) return;
    setAnimate(false);
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const next = clampToViewport(
      { left: e.clientX - drag.dx, top: e.clientY - drag.dy },
      measure(panel),
      viewport()
    );
    setPos(next);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    const shouldAnimate = !prefersReducedMotion();
    setPos((prev) => {
      if (!prev) return prev;
      const snapped = snapToEdges(prev, measure(panel), viewport());
      if (shouldAnimate && (snapped.left !== prev.left || snapped.top !== prev.top)) {
        setAnimate(true);
        window.setTimeout(() => setAnimate(false), 240);
      }
      savePosition(snapped, storageKey);
      return snapped;
    });
  };

  const handleDock = () => {
    const panel = panelRef.current;
    if (!panel) return;
    setAnimate(!prefersReducedMotion());
    const docked = dockPosition(measure(panel), viewport());
    setPos(docked);
    savePosition(docked, storageKey);
    if (!prefersReducedMotion()) window.setTimeout(() => setAnimate(false), 240);
  };

  if (!mounted || !open) return null;

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, visibility: 'visible' }
    : { left: 0, top: 0, visibility: 'hidden' };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={style}
      className={cn(
        'fixed z-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl',
        PANEL_WIDTH_CLASS,
        animate &&
          'transition-[left,top] duration-200 ease-out motion-reduce:transition-none'
      )}
    >
      {/* Drag handle */}
      <div
        data-testid="cmx-keypad-popover-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex h-12 cursor-grab touch-none select-none items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="text-sm font-bold text-slate-600">{title}</span>
        {echo != null ? (
          <span className="ms-auto tabular-nums text-sm font-bold text-slate-900">{echo}</span>
        ) : null}
        <button
          ref={dockBtnRef}
          type="button"
          data-kp-btn
          data-testid="cmx-keypad-popover-dock"
          // Keep out of Tab cycle (amount → keypad → Exact); arrows reach via Close.
          tabIndex={-1}
          onClick={handleDock}
          onKeyDown={(event) => handleChromeKeyDown(event, 'dock')}
          aria-label={dockLabel}
          className={cn(chromeBtnClass, echo == null && 'ms-auto')}
        >
          <PanelBottom className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref={closeBtnRef}
          type="button"
          data-kp-btn
          data-testid="cmx-keypad-popover-close"
          tabIndex={-1}
          onClick={closeAndRestoreFocus}
          onKeyDown={(event) => handleChromeKeyDown(event, 'close')}
          aria-label={closeLabel}
          className={chromeBtnClass}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Keys */}
      <div className="p-3">
        <CmxKeypad
          keys={keys}
          columns={columns}
          disabled={disabled}
          onKeyPress={onKeyPress}
          onKeyLongPress={onKeyLongPress}
          getKeyVariant={getKeyVariant}
          getKeyClassName={getKeyClassName}
          renderKeyLabel={renderKeyLabel}
          getKeyAriaLabel={getKeyAriaLabel}
          keyHeight="lg"
          keyboardNavigation={keyboardMode}
          autoFocusHomeKey={keyboardMode}
          isRTL={isRTL}
          onArrowBoundary={handleArrowBoundary}
          // Keyboard mode owns focus inside the pad; touch still works.
          preserveInputFocus={!keyboardMode}
        />
      </div>

      {hint != null ? (
        <p className="px-3 pb-3 text-[11px] text-slate-400">{hint}</p>
      ) : null}

      {restored && restoredAnnouncement ? (
        <p role="status" aria-live="polite" className="sr-only">
          {restoredAnnouncement}
        </p>
      ) : null}
    </div>,
    document.body
  );
}
