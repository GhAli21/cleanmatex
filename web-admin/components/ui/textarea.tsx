/**
 * Textarea Component
 * Reusable textarea input component
 */

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    const hasError = !!error;

    const baseClasses = 'block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors resize-vertical';
    const stateClasses = hasError
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

    return (
      <>
        <textarea
          ref={ref}
          className={`${baseClasses} ${stateClasses} ${className}`}
          aria-invalid={hasError}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </>
    );
  }
);

Textarea.displayName = 'Textarea';

