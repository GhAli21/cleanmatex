'use client';

/**
 * PaymentCapabilityDialog — the shared shell every capability dialog renders
 * inside (L4 primitive of the composable payment program).
 *
 * One capability = one small dialog: title, optional required badge, body,
 * cancel/confirm footer. The shell owns the chrome, the error boundary
 * (hardening #11), and open/dismiss observability (safe metadata only —
 * hardening #12). Bodies read engine-derived state and call typed engine
 * actions; the shell itself holds NO finance logic (locked program decision).
 *
 * Focus trap, `Esc`-to-close, `aria-modal`, and focus-return come from
 * `CmxDialog` (Radix-based) — not re-implemented here.
 *
 * i18n stays in the caller: all labels arrive resolved (same convention as
 * `payment-mode-toggle.tsx`).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { CmxButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { logger } from '@/lib/utils/logger';
import type { PaymentCapabilityKey } from '../capabilities/capability-keys';
import { PaymentDialogErrorBoundary } from './payment-dialog-error-boundary';

/**
 * Props for {@link PaymentCapabilityDialog}.
 */
export interface PaymentCapabilityDialogProps {
  /** Capability rendered inside — drives testids + safe log metadata. */
  capabilityKey: PaymentCapabilityKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolved dialog title. */
  title: string;
  /** Optional resolved one-line description under the title. */
  description?: string;
  /** Marks a REQUIRED gate (e.g. B2B missing fields): shows the badge and
   * hides the cancel path is NOT implied — required gates still allow cancel;
   * submit stays guarded by the registry. */
  required?: boolean;
  /** Resolved label for the required badge (rendered only when `required`). */
  requiredLabel?: string;
  /** Resolved cancel label; omit `onCancel` to hide the cancel button. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** Resolved confirm label; omit `onConfirm` to hide the confirm button
   * (e.g. read-only or self-committing bodies). */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /** Resolved error-fallback message + close label for the boundary. */
  errorFallbackMessage: string;
  errorCloseLabel: string;
  isRTL?: boolean;
  /** Width class for the dialog content (defaults to a small focused dialog). */
  maxWidthClassName?: string;
  children: ReactNode;
}

/**
 * Renders one focused capability dialog inside the shared chrome.
 *
 * @param props - {@link PaymentCapabilityDialogProps}.
 * @returns The dialog element.
 */
export function PaymentCapabilityDialog({
  capabilityKey,
  open,
  onOpenChange,
  title,
  description,
  required = false,
  requiredLabel,
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  errorFallbackMessage,
  errorCloseLabel,
  isRTL = false,
  maxWidthClassName = 'max-w-md',
  children,
}: PaymentCapabilityDialogProps) {
  // Observability (hardening #12): capability key + event only — never
  // amounts, instruments, PINs, references, or payloads.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      logger.info('[payment] capability dialog opened', {
        feature: 'payment-modal',
        action: 'capability-dialog-open',
        capability: capabilityKey,
      });
    }
    wasOpenRef.current = open;
  }, [open, capabilityKey]);

  const close = () => onOpenChange(false);

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent
        className={maxWidthClassName}
        scrollBody
        draggable
        data-testid={`payment-capability-dialog-${capabilityKey}`}
      >
        <PaymentDialogErrorBoundary
          capabilityKey={capabilityKey}
          fallbackMessage={errorFallbackMessage}
          closeLabel={errorCloseLabel}
          onClose={close}
        >
          <CmxDialogHeader>
            <CmxDialogTitle
              className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
            >
              <span className="min-w-0">{title}</span>
              {required && requiredLabel ? (
                <span
                  data-testid="payment-capability-required-badge"
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                >
                  {requiredLabel}
                </span>
              ) : null}
            </CmxDialogTitle>
            {description ? (
              <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                {description}
              </p>
            ) : null}
          </CmxDialogHeader>

          <div className="min-w-0 py-1">{children}</div>

          {onCancel || onConfirm ? (
            <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
              {onCancel && cancelLabel ? (
                <CmxButton type="button" variant="outline" size="sm" onClick={onCancel}>
                  {cancelLabel}
                </CmxButton>
              ) : null}
              {onConfirm && confirmLabel ? (
                <CmxButton
                  type="button"
                  size="sm"
                  disabled={confirmDisabled}
                  onClick={onConfirm}
                  data-testid="payment-capability-confirm"
                >
                  {confirmLabel}
                </CmxButton>
              ) : null}
            </CmxDialogFooter>
          ) : null}
        </PaymentDialogErrorBoundary>
      </CmxDialogContent>
    </CmxDialog>
  );
}
