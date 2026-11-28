/**
 * CmxCombobox - pick one option from a list you can search: grouped options, an optional badge,
 * full keyboard use (arrows, Home / End, Enter, Escape) and the ARIA combobox pattern.
 * For short fixed lists use CmxSelect; use this when people need to type to find an option.
 * @module ui/forms
 */
'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { cmxFieldChrome } from '@ui/foundations';

/** One choice of {@link CmxCombobox}. */
export interface CmxComboboxOption {
  value: string;
  label: string;
  /** Heading the option is listed under; options of one group must be next to each other. */
  group?: string;
  /** Short tag after the label, e.g. "Custom". */
  badge?: string;
  /** Extra words the search also matches (the other language, a code). */
  keywords?: string;
  disabled?: boolean;
}

/** Props of {@link CmxCombobox}. */
export interface CmxComboboxProps {
  options: readonly CmxComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helpText?: string;
  /** Shown when nothing matches; defaults to `common.noData`. */
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const matches = (option: CmxComboboxOption, query: string) =>
  `${option.label} ${option.keywords ?? ''} ${option.group ?? ''}`.toLocaleLowerCase().includes(query);

/**
 * @param props - {@link CmxComboboxProps}
 * @returns the field and, while open, the filtered list
 * @example <CmxCombobox label="Unit" options={options} value={code} onChange={setCode} />
 */
export function CmxCombobox({
  options, value, onChange, label, placeholder, error, helpText, emptyLabel, required, disabled, id,
  'aria-label': ariaLabel, 'aria-describedby': describedByProp, 'aria-invalid': invalidProp,
}: CmxComboboxProps) {
  const tCommon = useTranslations('common');
  const autoId = React.useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const needle = query.trim().toLocaleLowerCase();
  const shown = needle ? options.filter((o) => matches(o, needle)) : options;
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    setActive(Math.max(options.findIndex((o) => o.value === value), 0));
    setOpen(true);
  };
  const close = () => { setOpen(false); setQuery(''); };
  const pick = (option: CmxComboboxOption | undefined) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  React.useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const move = (to: number) => { event.preventDefault(); setActive(Math.max(0, Math.min(to, shown.length - 1))); };
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!open) { event.preventDefault(); openList(); return; }
      move(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (open && event.key === 'Home') move(0);
    else if (open && event.key === 'End') move(shown.length - 1);
    else if (open && event.key === 'Enter') { event.preventDefault(); pick(shown[activeIndex]); }
    else if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  };

  const describedBy = [describedByProp, error ? `${inputId}-error` : helpText ? `${inputId}-help` : null]
    .filter(Boolean).join(' ') || undefined;

  return (
    <div
      className="w-full"
      // While open, a surrounding dialog leaves Escape to the list.
      data-cmx-select-root={open ? '' : undefined}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
    >
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ms-1 text-destructive">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && shown.length ? optionId(activeIndex) : undefined}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={invalidProp ?? !!error}
          aria-required={required}
          disabled={disabled}
          placeholder={open ? selected?.label ?? placeholder : placeholder}
          value={open ? query : selected?.label ?? ''}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onClick={openList}
          onKeyDown={onKeyDown}
          className={cn(
            'h-10 w-full truncate rounded-[var(--cmx-radius-md)] ps-3 pe-9 text-sm text-start pointer-coarse:min-h-11',
            cmxFieldChrome({ error: !!error }),
            'disabled:cursor-not-allowed disabled:bg-muted'
          )}
        />
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        {open && (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label ?? ariaLabel}
            className="absolute inset-x-0 z-[var(--cmx-z-popover)] mt-1 max-h-72 overflow-y-auto rounded-[var(--cmx-radius-lg)] border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--cmx-shadow-lg)]"
          >
            {shown.length === 0 && <p role="status" className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel ?? tCommon('noData')}</p>}
            {shown.map((option, index) => (
              <React.Fragment key={option.value}>
                {option.group && option.group !== shown[index - 1]?.group && (
                  <p role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{option.group}</p>
                )}
                <div
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  // Keep focus in the field, otherwise the list closes before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--cmx-radius-md)] px-2 py-2 text-sm md:min-h-10',
                    index === activeIndex && 'bg-muted',
                    option.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0 text-primary-text', option.value !== value && 'invisible')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-start">{option.label}</span>
                  {option.badge && (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{option.badge}</span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-destructive">{error}</p>}
      {helpText && !error && <p id={`${inputId}-help`} className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
