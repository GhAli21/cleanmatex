/**
 * CmxDialog - Composable modal dialog with theme tokens and a11y
 * Compatible with the legacy Dialog from components/ui
 * @module ui/overlays
 */

'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CmxButton } from '@ui/primitives/cmx-button';

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
} | undefined>(undefined);

export interface CmxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CmxDialog({ open, onOpenChange, children }: CmxDialogProps) {
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

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => onOpenChange(false)}
          onKeyDown={(e) => e.key === 'Escape' && onOpenChange(false)}
          aria-hidden="true"
        />
        <div className="relative z-50 w-full flex justify-center">{children}</div>
      </div>
    </DialogContext.Provider>
  );
}

export interface CmxDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CmxDialogContent({
  children,
  className = '',
  ...props
}: CmxDialogContentProps) {
  const context = React.useContext(DialogContext);

  return (
    <div
      className={cn(
        'relative rounded-lg shadow-xl max-h-[90vh] overflow-y-auto',
        'bg-[rgb(var(--cmx-background-rgb,255_255_255))]',
        'ring-1 ring-[rgb(var(--cmx-border-rgb,226_232_240))]',
        className
      )}
      {...props}
    >
      {context && (
        <button
          onClick={() => context.onOpenChange(false)}
          className={cn(
            'absolute top-4 right-4 rtl:right-auto rtl:left-4',
            'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
            'hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
            'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] rounded'
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
      className={cn(
        'px-6 pt-6 pb-4 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CmxDialogTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
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
        className
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
        className
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
      className={cn(
        'px-6 py-4 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] flex justify-end gap-3',
        className
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
    <CmxButton
      variant="ghost"
      onClick={() => context.onOpenChange(false)}
    >
      {children}
    </CmxButton>
  );
}
