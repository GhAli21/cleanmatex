'use client';

/**
 * Error boundary for payment capability dialogs (hardening #11 of the
 * composable payment program). A crash inside one dialog must surface a
 * recoverable message — never lose payment state or take down the modal.
 *
 * Logs SAFE METADATA ONLY (capability key + event); never amounts, card or
 * gift-card numbers, PINs, references, or payloads.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { logger } from '@/lib/utils/logger';
import type { PaymentCapabilityKey } from '../capabilities/capability-keys';

/**
 * Props for {@link PaymentDialogErrorBoundary}.
 */
export interface PaymentDialogErrorBoundaryProps {
  /** Capability whose dialog is wrapped — used only as safe log metadata. */
  capabilityKey: PaymentCapabilityKey;
  /** Resolved fallback message (i18n stays in the caller). */
  fallbackMessage: string;
  /** Resolved label for the recover (close) button. */
  closeLabel: string;
  /** Closes the dialog so the cashier continues from intact engine state. */
  onClose: () => void;
  children: ReactNode;
}

interface PaymentDialogErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class boundary (React requires a class for `componentDidCatch`). Recovery is
 * simply closing the dialog — engine state lives outside the dialog tree, so
 * nothing is lost.
 */
export class PaymentDialogErrorBoundary extends Component<
  PaymentDialogErrorBoundaryProps,
  PaymentDialogErrorBoundaryState
> {
  state: PaymentDialogErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PaymentDialogErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('[payment] capability dialog crashed', error, {
      feature: 'payment-modal',
      action: 'capability-dialog-error',
      capability: this.props.capabilityKey,
      componentStack: info.componentStack ?? undefined,
    });
  }

  private handleClose = (): void => {
    this.setState({ hasError: false });
    this.props.onClose();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        data-testid="payment-dialog-error-fallback"
        className="flex flex-col items-center gap-3 p-6 text-center"
      >
        <CircleAlert className="h-8 w-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm text-slate-600">{this.props.fallbackMessage}</p>
        <CmxButton type="button" variant="outline" size="sm" onClick={this.handleClose}>
          {this.props.closeLabel}
        </CmxButton>
      </div>
    );
  }
}
