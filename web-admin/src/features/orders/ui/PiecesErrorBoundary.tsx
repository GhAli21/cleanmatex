/**
 * Error Boundary for Order Pieces Manager
 * Catches and displays errors gracefully
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { CmxButton } from '@ui/primitives';

interface PiecesErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PiecesErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 *
 */
export class PiecesErrorBoundary extends React.Component<
  PiecesErrorBoundaryProps,
  PiecesErrorBoundaryState
> {
  /**
   *
   * @param props
   */
  constructor(props: PiecesErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   *
   * @param error
   */
  static getDerivedStateFromError(error: Error): PiecesErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   *
   * @param error
   * @param errorInfo
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PiecesErrorBoundary] Error caught:', error, errorInfo);
  }

  /**
   *
   */
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-danger-text mb-1">
                Failed to load pieces
              </h3>
              <p className="text-sm text-danger-text mb-3">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <CmxButton
                variant="outline"
                size="sm"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-danger-text border-danger-border hover:bg-danger-border/50"
              >
                Try Again
              </CmxButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
