/**
 * CmxSwitch - Toggle switch with theme tokens
 * Compatible with the legacy Switch from components/ui
 * @module ui/primitives
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CmxSwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const CmxSwitch = React.forwardRef<HTMLButtonElement, CmxSwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      disabled,
      id,
      name,
      ...props
    },
    ref
  ) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        ref={ref}
        id={id}
        name={name}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-[rgb(var(--cmx-primary-rgb,14_165_233))]'
            : 'bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
          className
        )}
        onClick={() => {
          if (!disabled && onCheckedChange) {
            onCheckedChange(!checked);
          }
        }}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
            checked ? 'translate-x-5 rtl:translate-x-[-1.25rem]' : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);

CmxSwitch.displayName = 'CmxSwitch';
