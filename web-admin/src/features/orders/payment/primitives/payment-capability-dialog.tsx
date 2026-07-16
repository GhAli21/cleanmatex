'use client';

/**
 * PaymentCapabilityDialog — the shared shell every capability dialog renders
 * inside (L4 primitive of the composable payment program).
 *
 * One capability = one small dialog: title, optional required badge, body,
 * Done footer (header X / Esc also dismiss). Cancel is optional and omitted
 * for self-committing payment dialogs where it duplicates dismiss. The shell
 * owns the chrome, the error boundary (hardening #11), and open/dismiss
 * observability (safe metadata only — hardening #12). Bodies read
 * engine-derived state and call typed engine actions; the shell itself holds
 * NO finance logic (locked program decision).
 *
 * `Esc`-to-close and `aria-modal` come from `CmxDialog`. Initial focus on open
 * is handled here (CmxDialog does not auto-move focus).
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
  /** Marks a REQUIRED gate (e.g. B2B missing fields): shows the badge.
   * Dismiss remains via header X / Esc / Done; submit stays registry-guarded. */
  required?: boolean;
  /** Resolved label for the required badge (rendered only when `required`). */
  requiredLabel?: string;
  /**
   * Optional cancel path. Prefer omit for self-committing payment capability
   * dialogs (Done + header X are enough). Pass both `cancelLabel` and
   * `onCancel` only when cancel must differ from dismiss.
   */
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
  const dialogTestId = `payment-capability-dialog-${capabilityKey}`;

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

  // CmxDialog is not Radix — it does not move focus on open. Land keyboard
  // focus inside the capability surface so cashiers are not stuck on the
  // background "More ways to pay" tile that opened this dialog.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>(
        `[data-testid="${dialogTestId}"]`,
      );
      if (!root) return;
      const preferred = root.querySelector<HTMLElement>(
        '[data-capability-initial-focus="true"]',
      );
      if (preferred && !preferred.hasAttribute('disabled')) {
        preferred.focus();
        return;
      }
      const candidates = root.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled]):not([data-cmx-dialog-close]):not([tabindex="-1"])',
          'input:not([disabled]):not([tabindex="-1"])',
          'select:not([disabled]):not([tabindex="-1"])',
          'textarea:not([disabled]):not([tabindex="-1"])',
          '[role="combobox"]:not([disabled]):not([tabindex="-1"])',
          '[tabindex="0"]',
        ].join(','),
      );
      candidates[0]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, dialogTestId]);

  const close = () => onOpenChange(false);

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange} autoFocus={false}>
      <CmxDialogContent
        className={maxWidthClassName}
        scrollBody
        draggable
        data-testid={dialogTestId}
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
