/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxDialog - Composable modal dialog with theme tokens and a11y
 *
 * Renders in a portal, traps keyboard focus inside the dialog while open
 * (Tab cycles; Esc / explicit close dismiss), and restores focus on close.
 * @module ui/overlays
 */

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CmxButton } from '@ui/primitives/cmx-button';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';

const DialogContext = React.createContext<
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }
  | undefined
>(undefined);

export interface CmxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * When false, skip autofocusing the first control on open (callers that set
   * their own initial focus, e.g. capability dialogs). Default true.
   */
  autoFocus?: boolean;
  /**
   * When true, clicking the dimmed backdrop closes the dialog.
   * Default false — dismiss via Esc, header close, Cancel, or a successful Done.
   */
  closeOnOverlayClick?: boolean;
}

export function CmxDialog({
  open,
  onOpenChange,
  children,
  autoFocus = true,
  closeOnOverlayClick = false,
}: CmxDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  // Trap only after portal mount — otherwise the first open effect sees a null
  // ref and never attaches listeners when `mounted` flips to true.
  const trapRef = useFocusTrap(open && mounted, { returnFocus: true, autoFocus });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Esc closes the topmost dialog (capture so nested pads can stop it first).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const root = trapRef.current;
      if (!root) return;
      // Let an inner handler (e.g. keypad) consume Escape first.
      if (event.defaultPrevented) return;
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (dialogs[dialogs.length - 1] !== root) return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onOpenChange, trapRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div
        ref={trapRef}
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        data-cmx-dialog-root="true"
      >
        <div
          className="fixed inset-0 bg-black/50"
          data-cmx-dialog-backdrop="true"
          onClick={closeOnOverlayClick ? () => onOpenChange(false) : undefined}
          aria-hidden="true"
        />
        <div className="relative z-50 flex w-full justify-center">{children}</div>
      </div>
    </DialogContext.Provider>,
    document.body,
  );
}

export interface CmxDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  bodyPadding?: 'default' | 'compact' | 'none';
  /**
   * Pin the dialog header and footer and scroll ONLY the body children.
   * Without this, tall dialogs scroll the whole content — the footer
   * (Cancel/Confirm) can sit below the fold and look missing.
   */
  scrollBody?: boolean;
  /**
   * Let the user move the dialog by dragging its header
   * (`CmxDialogHeader`). Buttons/inputs inside the header still work.
   * Position resets when the dialog closes (content unmounts).
   */
  draggable?: boolean;
}

export function CmxDialogContent({
  children,
  bodyPadding = 'default',
  scrollBody = false,
  draggable = false,
  className = '',
  style,
  ...props
}: CmxDialogContentProps) {
  const context = React.useContext(DialogContext);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const dragStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-cmx-dialog-header]')) return;
    // Keep interactive header elements (close button, toggles) fully usable.
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOffset({
      x: drag.baseX + (event.clientX - drag.startX),
      y: drag.baseY + (event.clientY - drag.startY),
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
  };

  const hasDragOffset = dragOffset.x !== 0 || dragOffset.y !== 0;

  return (
    <div
      className={cn(
        'relative rounded-lg shadow-xl max-h-[90vh]',
        scrollBody
          ? 'flex flex-col overflow-hidden [&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:min-h-0 [&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:flex-1 [&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:overflow-y-auto [&>[data-cmx-dialog-header]]:shrink-0 [&>[data-cmx-dialog-footer]]:shrink-0'
          : 'overflow-y-auto',
        draggable &&
          '[&_[data-cmx-dialog-header]]:cursor-move [&_[data-cmx-dialog-header]]:select-none',
        'bg-[rgb(var(--cmx-background-rgb,255_255_255))]',
        'ring-1 ring-[rgb(var(--cmx-border-rgb,226_232_240))]',
        bodyPadding === 'default' &&
          '[&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:px-4 sm:[&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:px-6 [&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:py-4',
        bodyPadding === 'compact' &&
          '[&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:px-4 [&>*:not([data-cmx-dialog-header]):not([data-cmx-dialog-footer]):not([data-cmx-dialog-close])]:py-3',
        className,
      )}
      style={
        hasDragOffset
          ? { ...style, transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
          : style
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      {...props}
    >
      {context && (
        <button
          data-cmx-dialog-close=""
          onClick={() => context.onOpenChange(false)}
          className={cn(
            'absolute top-4 right-4 rtl:right-auto rtl:left-4',
            'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
            'hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
            'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] rounded',
          )}
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {children}
    </div>
  );
}

export interface CmxDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CmxDialogHeader({
  children,
  className = '',
  ...props
}: CmxDialogHeaderProps) {
  return (
    <div
      data-cmx-dialog-header=""
      className={cn(
        'px-6 pt-6 pb-4 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CmxDialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CmxDialogTitle({
  children,
  className = '',
  ...props
}: CmxDialogTitleProps) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export interface CmxDialogDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function CmxDialogDescription({
  children,
  className = '',
  ...props
}: CmxDialogDescriptionProps) {
  return (
    <p
      className={cn(
        'mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export interface CmxDialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CmxDialogFooter({
  children,
  className = '',
  ...props
}: CmxDialogFooterProps) {
  return (
    <div
      data-cmx-dialog-footer=""
      className={cn(
        'px-6 py-4 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] flex justify-end gap-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CmxDialogCloseProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function CmxDialogClose({ children, asChild }: CmxDialogCloseProps) {
  const context = React.useContext(DialogContext);

  if (!context) {
    return <>{children}</>;
  }

  if (asChild && React.isValidElement(children)) {
    const originalOnClick = (children.props as Record<string, unknown>)
      ?.onClick as ((e: React.MouseEvent) => void) | undefined;
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        context.onOpenChange(false);
        if (originalOnClick && typeof originalOnClick === 'function') {
          originalOnClick(e);
        }
      },
    } as Record<string, unknown>);
  }

  return (
    <CmxButton variant="ghost" onClick={() => context.onOpenChange(false)}>
      {children}
    </CmxButton>
  );
}
