/**
 * Reusable Select Component
 * Dropdown select with label and error support
 */

import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helpText,
      options = [],
      placeholder,
      fullWidth = true,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = !!error;

    const baseClasses = 'block px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors bg-white';
    const stateClasses = hasError
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          className={`${baseClasses} ${stateClasses} ${widthClass} ${className}`}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined
          }
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {error && (
          <p className="mt-1 text-sm text-red-600" id={`${selectId}-error`}>
            {error}
          </p>
        )}

        {helpText && !error && (
          <p className="mt-1 text-sm text-gray-500" id={`${selectId}-help`}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
