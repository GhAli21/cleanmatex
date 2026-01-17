/**
 * CmxAlertDialog - Custom styled alert/confirm dialog component
 * Provides accessible, customizable dialogs with proper ARIA attributes and keyboard navigation
 * @module ui/feedback/components
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { CmxButton } from '../../primitives/cmx-button';
import { zIndex } from '../../foundations/zindex';

export interface CmxAlertDialogProps {
  /**
   * Dialog title
   */
  title: string;

  /**
   * Main message content
   */
  message?: string | React.ReactNode;

  /**
   * Additional description/details
   */
  description?: string;

  /**
   * Dialog variant determines styling and default icon
   */
  variant?: 'default' | 'destructive' | 'success' | 'warning';

  /**
   * Confirm button label
   */
  confirmLabel?: string;

  /**
   * Cancel button label
   */
  cancelLabel?: string;

  /**
   * Custom icon name (Lucide icon)
   */
  icon?: string;

  /**
   * Custom icon component (overrides icon prop)
   */
  iconComponent?: React.ReactNode;

  /**
   * Whether to show cancel button
   */
  showCancel?: boolean;

  /**
   * Callback when confirmed
   */
  onConfirm: () => void;

  /**
   * Callback when cancelled
   */
  onCancel: () => void;

  /**
   * Whether dialog is open
   */
  open: boolean;
}

/**
 * Icon mapping for variants
 */
const variantIcons = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
};

/**
 * Variant color classes
 */
const variantStyles = {
  default: {
    icon: 'text-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    confirmButton: 'primary' as const,
  },
  destructive: {
    icon: 'text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
    confirmButton: 'destructive' as const,
  },
  success: {
    icon: 'text-[rgb(var(--cmx-success-rgb,34_197_94))]',
    confirmButton: 'primary' as const,
  },
  warning: {
    icon: 'text-[rgb(var(--cmx-warning-rgb,234_179_8))]',
    confirmButton: 'primary' as const,
  },
};

/**
 * Custom Alert Dialog Component
 */
export function CmxAlertDialog({
  title,
  message,
  description,
  variant = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  iconComponent,
  showCancel = true,
  onConfirm,
  onCancel,
  open,
}: CmxAlertDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle visibility animation
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Focus management and keyboard handling
  useEffect(() => {
    if (!open) return;

    // Focus confirm button on mount
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 0);

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    // Handle Enter key
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleEnter);

    // Trap focus within dialog
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleEnter);
      document.removeEventListener('keydown', handleTab);

      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, showCancel, onConfirm, onCancel]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open && !isVisible) return null;

  // Handle iconComponent - it can be a React element, component function, or null
  // If it's already a React element, render it directly; if it's a function, use it as a component
  const renderIcon = () => {
    if (iconComponent) {
      // If it's a valid React element, render it directly
      if (React.isValidElement(iconComponent)) {
        return iconComponent;
      }
      // If it's a function component, render it
      if (typeof iconComponent === 'function') {
        const IconComp = iconComponent as React.ComponentType<{ className?: string; 'aria-hidden'?: string }>;
        return <IconComp className="h-6 w-6" aria-hidden="true" />;
      }
      // Otherwise, try to render it as-is (fallback)
      return <>{iconComponent}</>;
    }
    // Default to variant icon
    const VariantIcon = variantIcons[variant];
    return <VariantIcon className="h-6 w-6" aria-hidden="true" />;
  };

  const iconColorClass = variantStyles[variant].icon;
  const confirmButtonVariant = variantStyles[variant].confirmButton;

  const dialogId = `cmx-alert-dialog-${React.useId()}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  return (
    <div
      className="fixed inset-0 z-[var(--cmx-z-modal,1050)] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={showCancel ? onCancel : undefined}
        aria-hidden="true"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 150ms ease-out',
        }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm mx-4 bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] rounded-xl shadow-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] transition-all"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${iconColorClass}`}>
              {renderIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h2
                id={titleId}
                className="text-lg font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
              >
                {title}
              </h2>

              {message && (
                <div className="mt-2 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  {typeof message === 'string' ? <p>{message}</p> : message}
                </div>
              )}

              {description && (
                <p
                  id={descriptionId}
                  className="mt-2 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            {showCancel && (
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={onCancel}
                aria-label={cancelLabel}
              >
                {cancelLabel}
              </CmxButton>
            )}
            <CmxButton
              ref={confirmButtonRef}
              variant={confirmButtonVariant}
              size="sm"
              onClick={onConfirm}
              aria-label={confirmLabel}
            >
              {confirmLabel}
            </CmxButton>
          </div>
        </div>
      </div>
    </div>
  );
}

