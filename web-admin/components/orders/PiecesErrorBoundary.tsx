/**
 * Error Boundary for Order Pieces Manager
 * Catches and displays errors gracefully
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PiecesErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PiecesErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PiecesErrorBoundary extends React.Component<
  PiecesErrorBoundaryProps,
  PiecesErrorBoundaryState
> {
  constructor(props: PiecesErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PiecesErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PiecesErrorBoundary] Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Failed to load pieces
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
