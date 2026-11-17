/**
 * CmxSelectDropdown - single-choice dropdown on Radix Select.
 * Radix handles positioning (flips when there is no room), keyboard, typeahead
 * and focus return; this wrapper keeps the existing compound API, theme tokens,
 * loading/empty states and the empty-string "none" option callers rely on.
 * @module ui/forms
 */

'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { cmxFieldChrome } from '@ui/foundations';
import { useRTL } from '@/lib/hooks/useRTL';

/** Radix forbids '' as an item value; callers use '' for "none", so it travels under this key. */
const EMPTY_VALUE = '__cmx_empty__';
const toRadix = (value: string) => (value === '' ? EMPTY_VALUE : value);
const fromRadix = (value: string) => (value === EMPTY_VALUE ? '' : value);

interface SelectContextValue {
  value: string;
  isLoading: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

function useSelectContext(part: string): SelectContextValue {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error(`${part} must be used within CmxSelectDropdown`);
  return context;
}

/** Props of {@link CmxSelectDropdown}. */
export interface CmxSelectDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  /** Shown when there are no items; defaults to `common.noData`. */
  emptyLabel?: string;
  /** Shown while loading; defaults to `common.loading`. */
  loadingLabel?: string;
  /** Called when the list opens or closes, for options that load on demand. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Root of the dropdown.
 * @param props - {@link CmxSelectDropdownProps}
 * @returns The select root
 */
export function CmxSelectDropdown({
  value = '',
  onValueChange,
  children,
  disabled = false,
  isLoading = false,
  emptyLabel,
  loadingLabel,
  onOpenChange,
}: CmxSelectDropdownProps) {
  const isRTL = useRTL();
  return (
    <SelectContext.Provider value={{ value, isLoading, emptyLabel, loadingLabel }}>
      <SelectPrimitive.Root
        value={toRadix(value)}
        onValueChange={(next) => onValueChange(fromRadix(next))}
        onOpenChange={onOpenChange}
        disabled={disabled}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="relative" data-disabled={disabled ? '' : undefined}>
          {children}
        </div>
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );
}

/** Props of {@link CmxSelectDropdownTrigger}. */
export interface CmxSelectDropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * Field-styled button that opens the list.
 * @param props - {@link CmxSelectDropdownTriggerProps}
 * @returns The trigger button
 */
export function CmxSelectDropdownTrigger({ children, className, ...props }: CmxSelectDropdownTriggerProps) {
  useSelectContext('CmxSelectDropdownTrigger');
  return (
    <SelectPrimitive.Trigger
      data-cmx-select-trigger
      className={cn(
        'group flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[var(--cmx-radius-md)] px-3 py-2 text-sm md:min-h-10',
        cmxFieldChrome({ legacyFocus: true }),
        'hover:bg-[rgb(var(--cmx-field-hover-rgb))] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** Props of {@link CmxSelectDropdownValue}. */
export interface CmxSelectDropdownValueProps {
  placeholder?: string;
  /** Label of the selected option; the raw value is shown when absent. */
  displayValue?: string;
}

/**
 * Text shown in the trigger.
 * @param props - {@link CmxSelectDropdownValueProps}
 * @returns The value text
 */
export function CmxSelectDropdownValue({ placeholder, displayValue }: CmxSelectDropdownValueProps) {
  const { value } = useSelectContext('CmxSelectDropdownValue');
  return (
    <SelectPrimitive.Value>
      <span className={cn('block truncate text-start', !value && !displayValue && 'text-muted-foreground')}>
        {displayValue || value || placeholder}
      </span>
    </SelectPrimitive.Value>
  );
}

/** Props of {@link CmxSelectDropdownContent}. */
export interface CmxSelectDropdownContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The list, portalled above every dialog and positioned by Radix.
 * @param props - {@link CmxSelectDropdownContentProps}
 * @returns The list
 */
export function CmxSelectDropdownContent({ children, className }: CmxSelectDropdownContentProps) {
  const { isLoading, emptyLabel, loadingLabel } = useSelectContext('CmxSelectDropdownContent');
  const t = useTranslations('common');
  const itemCount = React.Children.toArray(children).filter(Boolean).length;
  const status = isLoading ? loadingLabel ?? t('loading') : itemCount === 0 ? emptyLabel ?? t('noData') : null;

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        // Lets dialog focus traps and Escape handlers recognise the list as part of the open control.
        data-cmx-select-root
        // React events bubble out of the portal; keep a pick from also clicking a row or card around the select.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        position="popper"
        sideOffset={4}
        className={cn(
          'z-[var(--cmx-z-popover)] max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'rounded-[var(--cmx-radius-lg)] border border-border bg-popover text-popover-foreground shadow-[var(--cmx-shadow-lg)]',
          className
        )}
      >
        <SelectPrimitive.Viewport className="p-1.5">
          {status ? <div className="px-3 py-3 text-sm text-muted-foreground">{status}</div> : children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/** Props of {@link CmxSelectDropdownItem}. */
export interface CmxSelectDropdownItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  /** When true, item is non-interactive and visually muted */
  disabled?: boolean;
}

/**
 * One option; a check marks the selected one.
 * @param props - {@link CmxSelectDropdownItemProps}
 * @returns The option
 */
export function CmxSelectDropdownItem({ value, children, className, disabled = false }: CmxSelectDropdownItemProps) {
  useSelectContext('CmxSelectDropdownItem');
  return (
    <SelectPrimitive.Item
      value={toRadix(value)}
      disabled={disabled}
      className={cn(
        'relative flex min-h-[44px] w-full cursor-pointer select-none items-center rounded-[var(--cmx-radius-md)] py-2.5 ps-9 pe-3 text-sm text-foreground outline-none md:min-h-10',
        'data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      <SelectPrimitive.ItemIndicator className="absolute start-2 flex h-4 w-4 items-center justify-center text-primary-text">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
