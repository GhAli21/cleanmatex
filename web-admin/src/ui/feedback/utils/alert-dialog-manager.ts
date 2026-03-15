/**
 * Alert Dialog Manager - Singleton for programmatic alert/confirm dialogs
 * Split from provider to avoid circular imports (cmx-message -> manager -> cmx-alert-dialog)
 * @module ui/feedback/utils
 */

import type { ConfirmDialogOptions } from '../types';

export interface AlertDialogContextValue {
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

/**
 * Global alert dialog manager instance
 * Uses a singleton pattern for programmatic access outside React components
 */
class AlertDialogManager {
  private providerRef: AlertDialogContextValue | null = null;

  setProvider(provider: AlertDialogContextValue | null) {
    this.providerRef = provider;
  }

  async showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (!this.providerRef) {
      // Developer warning in development mode
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(
          '⚠️ AlertDialogProvider not found. Add <AlertDialogProvider> to your AppProviders.tsx\n' +
          'This is required for custom alert dialogs. Falling back to native confirm dialog.'
        );
      }

      // Fallback to native confirm if provider not available
      if (typeof window !== 'undefined') {
        return window.confirm(options.title + (options.message ? `\n\n${options.message}` : ''));
      }
      return false;
    }
    return this.providerRef.showConfirm(options);
  }
}

export const alertDialogManager = new AlertDialogManager();
