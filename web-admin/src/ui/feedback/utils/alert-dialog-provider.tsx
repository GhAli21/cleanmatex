/**
 * Alert Dialog Provider - React component for custom alert dialogs
 * Must be rendered at app root. Imports CmxAlertDialog here to avoid circular deps.
 * @module ui/feedback/utils
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CmxAlertDialog } from '../components/cmx-alert-dialog';
import { alertDialogManager } from './alert-dialog-manager';
import type { ConfirmDialogOptions as ConfirmOptions } from '../types';

interface AlertDialogState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

interface AlertDialogContextValue {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

/**
 * Alert Dialog Provider Component
 * Must be rendered at the app root to enable programmatic dialogs
 */
export function AlertDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<AlertDialogState>({
    open: false,
    options: null,
    resolve: null,
  });

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  // Register provider with global manager
  React.useEffect(() => {
    alertDialogManager.setProvider({ showConfirm });
    return () => {
      alertDialogManager.setProvider(null);
    };
  }, [showConfirm]);

  const handleConfirm = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState({ open: false, options: null, resolve: null });
  }, [dialogState]);

  const handleCancel = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState({ open: false, options: null, resolve: null });
  }, [dialogState]);

  return (
    <AlertDialogContext.Provider value={{ showConfirm }}>
      {children}
      {dialogState.open && dialogState.options && typeof window !== 'undefined' && (
        <>
          {createPortal(
            <CmxAlertDialog
              title={dialogState.options.title}
              message={dialogState.options.message}
              description={dialogState.options.description}
              variant={dialogState.options.variant}
              confirmLabel={dialogState.options.confirmLabel}
              cancelLabel={dialogState.options.cancelLabel}
              icon={dialogState.options.icon}
              iconComponent={dialogState.options.iconComponent}
              showCancel={dialogState.options.showCancel ?? true}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              open={dialogState.open}
            />,
            document.body
          )}
        </>
      )}
    </AlertDialogContext.Provider>
  );
}

/**
 * Hook to access alert dialog manager
 */
export function useAlertDialog() {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlertDialog must be used within AlertDialogProvider');
  }
  return context;
}
