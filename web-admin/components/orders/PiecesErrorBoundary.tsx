/**
 * Pieces Error Boundary Component
 * Catches errors in order pieces components and displays user-friendly messages
 */

'use client';

import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Button } from '@/components/ui/Button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { log } from '@/lib/utils/logger';

interface PiecesErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function PiecesErrorFallback({
  error,
  resetErrorBoundary,
}: PiecesErrorFallbackProps) {
  const t = useTranslations('orders.pieces.errors');
  const isRTL = useRTL();

  React.useEffect(() => {
    // Log error with context
    log.error('Pieces error boundary caught error', error, {
      feature: 'order_pieces',
      component: 'PiecesErrorBoundary',
    });
  }, [error]);

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50 ${
        isRTL ? 'text-right' : 'text-left'
      }`}
      role="alert"
    >
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className={`text-lg font-semibold text-red-800 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('loadFailed')}
      </h3>
      <p className={`text-sm text-red-600 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
        {error.message || t('loadFailed')}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={resetErrorBoundary}
        className={isRTL ? 'flex-row-reverse' : ''}
      >
        <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
        {t('retry')}
      </Button>
    </div>
  );
}

interface PiecesErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<PiecesErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function PiecesErrorBoundary({
  children,
  fallback,
  onError,
}: PiecesErrorBoundaryProps) {
  const handleError = React.useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      log.error('Pieces error boundary error handler', error, {
        feature: 'order_pieces',
        component: 'PiecesErrorBoundary',
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
      });

      if (onError) {
        onError(error, errorInfo);
      }
    },
    [onError]
  );

  return (
    <ErrorBoundary
      FallbackComponent={fallback || PiecesErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset any error state if needed
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

