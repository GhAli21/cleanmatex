/**
 * CmxSelectDropdown - Dropdown select with theme tokens
 * Portal-based for use inside modals. Compatible with legacy select-dropdown API.
 * @module ui/forms
 */

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(
  undefined
);

export interface CmxSelectDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function CmxSelectDropdown({
  value = '',
  onValueChange,
  children,
  disabled,
}: CmxSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-cmx-select-root]')) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: (v) => {
          onValueChange(v);
          setOpen(false);
        },
        open,
        onOpenChange: setOpen,
        triggerRef,
      }}
    >
      <div className="relative" data-cmx-select-root>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface CmxSelectDropdownTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function CmxSelectDropdownTrigger({
  children,
  className,
  ...props
}: CmxSelectDropdownTriggerProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('CmxSelectDropdownTrigger must be used within CmxSelectDropdown');

  const { open, onOpenChange, triggerRef } = context;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => onOpenChange(!open)}
      data-cmx-select-trigger
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
        'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))]',
        'ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))] placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
        'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
}

export interface CmxSelectDropdownValueProps {
  placeholder?: string;
  displayValue?: string;
}

export function CmxSelectDropdownValue({
  placeholder,
  displayValue,
}: CmxSelectDropdownValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('CmxSelectDropdownValue must be used within CmxSelectDropdown');

  const { value } = context;
  const displayText = displayValue || value || placeholder;

  return (
    <span
      className={cn(
        'block truncate',
        !value && 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
      )}
    >
      {displayText}
    </span>
  );
}

export interface CmxSelectDropdownContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CmxSelectDropdownContent({
  children,
  className,
}: CmxSelectDropdownContentProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('CmxSelectDropdownContent must be used within CmxSelectDropdown');

  const { open, triggerRef } = context;
  const [position, setPosition] = React.useState({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false,
  });
  const rafIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const dropdownHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      const offset = 4;

      setPosition({
        top: shouldOpenUpward ? rect.top - dropdownHeight - offset : rect.bottom + offset,
        left: rect.left,
        width: rect.width,
        openUpward: shouldOpenUpward,
      });
    };

    const scheduleUpdate = () => {
      rafIdRef.current = requestAnimationFrame(() => {
        updatePosition();
        rafIdRef.current = requestAnimationFrame(updatePosition);
      });
    };
    scheduleUpdate();

    const findScrollableParents = (element: HTMLElement | null): HTMLElement[] => {
      const parents: HTMLElement[] = [];
      let current = element?.parentElement;
      while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY || style.overflow;
        const overflowX = style.overflowX || style.overflow;
        if (
          (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') &&
          (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth)
        ) {
          parents.push(current);
        }
        current = current.parentElement;
      }
      return parents;
    };

    const scrollableParents = findScrollableParents(triggerRef.current);
    const handleScroll = () => updatePosition();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    scrollableParents.forEach((p) => p.addEventListener('scroll', handleScroll, true));

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
      scrollableParents.forEach((p) => p.removeEventListener('scroll', handleScroll, true));
    };
  }, [open, triggerRef]);

  if (!open) return null;

  const portalContent = (
    <div
      data-cmx-select-root
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        zIndex: 10000,
      }}
      className={cn(
        position.openUpward ? 'mb-1' : 'mt-1',
        'max-h-60 overflow-auto rounded-md border p-1 shadow-lg',
        'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))]',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null;
}

export interface CmxSelectDropdownItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function CmxSelectDropdownItem({
  value,
  children,
  className,
}: CmxSelectDropdownItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('CmxSelectDropdownItem must be used within CmxSelectDropdown');

  const { value: selectedValue, onValueChange } = context;
  const isSelected = selectedValue === value;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onValueChange(value);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
        'focus:bg-[rgb(var(--cmx-muted-rgb,241_245_249))] hover:bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
          <Check className="h-4 w-4" />
        </span>
      )}
      {children}
    </div>
  );
}
