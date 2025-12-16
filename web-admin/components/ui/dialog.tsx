/**
 * Dialog Component
 * Modal dialog component for forms and confirmations
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Prevent body scroll when dialog is open
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
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        
        {/* Dialog content wrapper - width controlled by DialogContent */}
        {/*className="relative z-50 w-full max-w-full px-4 flex justify-center">*/}
        <div className="relative z-50 w-full flex justify-center">
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogContent({ children, className = '', ...props }: DialogContentProps) {
  const context = React.useContext(DialogContext);
  
  return (
    <div
      className={`bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto ${className}`}
      {...props}
    >
      {context && (
        <button
          onClick={() => context.onOpenChange(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {children}
    </div>
  );
}

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogHeader({ children, className = '', ...props }: DialogHeaderProps) {
  return (
    <div className={`px-6 pt-6 pb-4 border-b border-gray-200 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function DialogTitle({ children, className = '', ...props }: DialogTitleProps) {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 ${className}`} {...props}>
      {children}
    </h2>
  );
}

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function DialogDescription({ children, className = '', ...props }: DialogDescriptionProps) {
  return (
    <p className={`mt-1 text-sm text-gray-500 ${className}`} {...props}>
      {children}
    </p>
  );
}

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogFooter({ children, className = '', ...props }: DialogFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 flex justify-end gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface DialogCloseProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogClose({ children, asChild }: DialogCloseProps) {
  const context = React.useContext(DialogContext);
  
  if (!context) {
    return <>{children}</>;
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        context.onOpenChange(false);
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      },
    } as any);
  }

  return (
    <button
      onClick={() => context.onOpenChange(false)}
      className="text-gray-400 hover:text-gray-600 focus:outline-none"
    >
      {children}
    </button>
  );
}

