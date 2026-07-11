/**
 * CmxKeypadPopover
 *
 * A floating, **non-modal**, draggable keypad surface that wraps {@link CmxKeypad}.
 * Launched from a trigger button next to a numeric field, it lets POS operators
 * move the pad out of the way of the content they need to see, and it remembers
 * where they left it (per-device, via `storageKey`).
 *
 * Design contract:
 * - **Non-modal**: it never traps focus or locks scroll, so the linked input
 *   keeps focus and physical-keyboard entry continues while it is open.
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
  const dragRef = React.useRef<{ dx: number; dy: number } | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<CmxKeypadPoint | null>(null);
  const [animate, setAnimate] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

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

  // Escape closes.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
          type="button"
          data-kp-btn
          onClick={handleDock}
          aria-label={dockLabel}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800',
            echo == null && 'ms-auto'
          )}
        >
          <PanelBottom className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-kp-btn
          onClick={onClose}
          aria-label={closeLabel}
          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
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
