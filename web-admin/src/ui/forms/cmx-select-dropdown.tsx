/* eslint-disable jsdoc/require-jsdoc */
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
  listboxId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
  disabled: boolean;
  isLoading: boolean;
  emptyLabel: string;
  loadingLabel: string;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(
  undefined
);

export interface CmxSelectDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
}

export function CmxSelectDropdown({
  value = '',
  onValueChange,
  children,
  disabled = false,
  isLoading = false,
  emptyLabel = 'No options available',
  loadingLabel = 'Loading options...',
}: CmxSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(value || null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

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
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setHighlightedValue(value || null);
  }, [open, value]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: (v) => {
          onValueChange(v);
          setOpen(false);
          triggerRef.current?.focus();
        },
        open,
        onOpenChange: setOpen,
        triggerRef,
        listboxId,
        contentRef,
        highlightedValue,
        setHighlightedValue,
        disabled,
        isLoading,
        emptyLabel,
        loadingLabel,
      }}
    >
      <div className="relative" data-cmx-select-root data-disabled={disabled ? '' : undefined}>
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

  const { open, onOpenChange, triggerRef, listboxId, disabled } = context;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => {
        if (!disabled) {
          onOpenChange(!open)
        }
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenChange(true);
        }
      }}
      data-cmx-select-trigger
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      disabled={disabled || props.disabled}
      className={cn(
        'flex min-h-[44px] w-full items-center justify-between rounded-[var(--cmx-radius-md,0.875rem)] border px-3 py-2 text-sm shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))] transition',
        'md:min-h-10 border-[rgb(var(--cmx-border-rgb,203_213_225))] bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))]',
        'ring-offset-[rgb(var(--cmx-background-rgb,244_247_251))] placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
        'hover:border-[rgb(var(--cmx-border-strong-rgb,148_163_184))] hover:bg-[rgb(var(--cmx-field-hover-rgb,248_251_255))]',
        'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-focus-ring-rgb,59_130_246))]/25 focus:ring-offset-2 focus:border-[rgb(var(--cmx-primary-rgb,37_99_235))]',
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

  const {
    open,
    triggerRef,
    listboxId,
    contentRef,
    highlightedValue,
    setHighlightedValue,
    onValueChange,
    isLoading,
    emptyLabel,
    loadingLabel,
  } = context;
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

  React.useEffect(() => {
    if (!open || !contentRef.current) {
      return;
    }

    contentRef.current.focus();
  }, [contentRef, open]);

  const itemCount = React.Children.toArray(children).filter(Boolean).length;

  const moveHighlight = (direction: 1 | -1) => {
    const options = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])') ?? []
    );

    if (options.length === 0) {
      return;
    }

    const currentIndex = options.findIndex((option) => option.dataset.value === highlightedValue);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + options.length) % options.length;
    const nextOption = options[nextIndex];
    setHighlightedValue(nextOption.dataset.value ?? null);
    nextOption.scrollIntoView({ block: 'nearest' });
  };

  const focusBoundaryOption = (type: 'first' | 'last') => {
    const options = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])') ?? []
    );

    const target = type === 'first' ? options[0] : options[options.length - 1];
    if (!target) {
      return;
    }

    setHighlightedValue(target.dataset.value ?? null);
    target.scrollIntoView({ block: 'nearest' });
  };

  const typeaheadRef = React.useRef('');
  const typeaheadTimerRef = React.useRef<number | null>(null);

  if (!open) return null;

  const portalContent = (
    <div
      id={listboxId}
      data-cmx-select-root
      ref={contentRef}
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={highlightedValue ? `${listboxId}-${highlightedValue}` : undefined}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        zIndex: 10000,
      }}
      className={cn(
        position.openUpward ? 'mb-1' : 'mt-1',
        'max-h-72 overflow-auto rounded-[var(--cmx-radius-lg,1.125rem)] border p-1.5 shadow-[var(--cmx-shadow-lg,0_28px_70px_rgba(15,23,42,0.14))] outline-none',
        'border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-elevated-rgb,255_255_255))]',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveHighlight(1);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveHighlight(-1);
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          focusBoundaryOption('first');
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          focusBoundaryOption('last');
          return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (highlightedValue) {
            onValueChange(highlightedValue);
          }
          return;
        }

        if (event.key === 'Tab') {
          context.onOpenChange(false);
          return;
        }

        if (event.key.length === 1) {
          typeaheadRef.current = `${typeaheadRef.current}${event.key}`.toLowerCase();
          if (typeaheadTimerRef.current !== null) {
            window.clearTimeout(typeaheadTimerRef.current);
          }
          typeaheadTimerRef.current = window.setTimeout(() => {
            typeaheadRef.current = '';
          }, 300);

          const options = Array.from(
            contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])') ?? []
          );
          const match = options.find((option) =>
            (option.dataset.label ?? option.textContent ?? '')
              .trim()
              .toLowerCase()
              .startsWith(typeaheadRef.current)
          );

          if (match) {
            setHighlightedValue(match.dataset.value ?? null);
            match.scrollIntoView({ block: 'nearest' });
          }
        }
      }}
    >
      {isLoading ? (
        <div className="px-3 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {loadingLabel}
        </div>
      ) : itemCount === 0 ? (
        <div className="px-3 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {emptyLabel}
        </div>
      ) : (
        children
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null;
}

export interface CmxSelectDropdownItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  /** When true, item is non-interactive and visually muted */
  disabled?: boolean;
}

export function CmxSelectDropdownItem({
  value,
  children,
  className,
  disabled = false,
}: CmxSelectDropdownItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('CmxSelectDropdownItem must be used within CmxSelectDropdown');

  const { value: selectedValue, onValueChange, highlightedValue, setHighlightedValue, listboxId } = context;
  const isSelected = selectedValue === value;
  const isHighlighted = highlightedValue === value;
  const textValue = typeof children === 'string' ? children : undefined;

  return (
    <button
      id={`${listboxId}-${value}`}
      type="button"
      role="option"
      aria-selected={isSelected}
      data-value={value}
      data-label={textValue ?? value}
      data-disabled={disabled ? '' : undefined}
      onMouseEnter={() => {
        if (!disabled) {
          setHighlightedValue(value);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (disabled) return;
        onValueChange(value);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'relative flex min-h-[44px] w-full cursor-pointer select-none items-center rounded-[var(--cmx-radius-md,0.875rem)] py-2.5 pl-9 pr-3 text-sm outline-none transition md:min-h-10',
        isHighlighted
          ? 'bg-[rgb(var(--cmx-secondary-bg-rgb,239_246_255))] text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]'
          : 'hover:bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))]',
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
    </button>
  );
}
