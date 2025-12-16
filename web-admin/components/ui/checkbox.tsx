/**
 * Checkbox Component
 *
 * A controlled checkbox component following shadcn/ui patterns.
 * Supports labels, disabled state, and proper accessibility.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      onCheckedChange,
      label,
      disabled = false,
      className,
      id,
      name,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const checkboxId = id || React.useId();

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onCheckedChange(event.target.checked);
      }
    };

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={cn(
            'h-4 w-4 rounded border border-gray-300 text-primary',
            'focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors cursor-pointer'
          )}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className={cn(
              'text-sm font-medium leading-none select-none',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
