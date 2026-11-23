'use client'

/**
 * CmxPhoneInput - Reusable 3-part international phone input for CleanMateX.
 *
 * Part 1: Searchable country code selector (all ~240 countries, EN/AR names, defaults to current tenant country)
 * Part 2: National/local phone input (LTR, supports Arabic-Indic digits & full E.164 paste)
 * Part 3: Canonical E.164 normalized value (emitted via onChange for DB persistence + optional live preview)
 *
 * @module ui/forms
 */

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, CheckCircle2, ChevronDown, AlertCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CmxInput } from '@ui/primitives'
import { CmxCountryFlag } from '@ui/data-display/cmx-country-flag'
import { useTenantDefaultCountry } from '@/lib/hooks/use-tenant-default-country'
import {
  getPhoneCountryOptions,
  normalizePhoneInput,
  splitPhoneValue,
  type CountryCode,
  type NormalizedPhoneResult,
} from '@/lib/phone/phone-utils'

export interface CmxPhoneInputProps {
  /** Input element id (links with external <Label htmlFor>) */
  id?: string
  /** Optional form field name */
  name?: string
  /** Canonical E.164 DB value (e.g. "+96896662624") */
  value?: string
  /** Emits canonical E.164 DB value + full parsed metadata */
  onChange?: (e164: string, meta: NormalizedPhoneResult) => void
  onBlur?: () => void
  /** Explicit ISO-2 default country override; falls back to active tenant country */
  defaultCountry?: CountryCode
  /** Optional tenantId override when resolving tenant default country */
  tenantId?: string
  /** Show Part 3 live read-only normalized E.164 preview below input (default true) */
  showNormalizedPreview?: boolean
  /** Optional custom placeholder for the local phone input */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  /** External error string (e.g. from form validation) */
  error?: string
  /** Accessibility aria-describedby */
  ariaDescribedBy?: string
  /** Show inline invalid-number hint after blur when number is non-empty (default true) */
  validateOnBlur?: boolean
  className?: string
}

export function CmxPhoneInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  defaultCountry,
  tenantId,
  showNormalizedPreview = true,
  placeholder,
  disabled = false,
  required = false,
  error,
  ariaDescribedBy,
  validateOnBlur = true,
  className,
}: CmxPhoneInputProps) {
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const { country: tenantCountry } = useTenantDefaultCountry(tenantId)

  const fallbackCountry: CountryCode = defaultCountry ?? tenantCountry ?? 'OM'
  const countryOptions = React.useMemo(() => getPhoneCountryOptions(locale), [locale])

  // Track user's in-progress typing draft without useEffect/setState sync loops
  const [draftState, setDraftState] = React.useState<{
    syncedValue: string
    nationalText: string
    countryOverride: CountryCode | null
  }>({
    syncedValue: value,
    nationalText: '',
    countryOverride: null,
  })

  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [touched, setTouched] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const phoneInputRef = React.useRef<HTMLInputElement>(null)
  const listboxId = React.useId()

  // Derive active Part 1 (country) & Part 2 (local number) cleanly from either
  // active user draft (when value matches what we last emitted) or external value.
  const isSyncedWithProp = draftState.syncedValue === value
  const externalSplit = React.useMemo(
    () => splitPhoneValue(value, fallbackCountry),
    [value, fallbackCountry],
  )

  const activeCountry: CountryCode = isSyncedWithProp
    ? (draftState.countryOverride ?? externalSplit.country ?? fallbackCountry)
    : externalSplit.country

  const nationalText: string = isSyncedWithProp
    ? (draftState.nationalText || externalSplit.nationalNumber)
    : externalSplit.nationalNumber

  const normalized = React.useMemo(
    () => normalizePhoneInput(nationalText, activeCountry),
    [nationalText, activeCountry],
  )

  const selectedOption = React.useMemo(
    () => countryOptions.find((opt) => opt.iso === activeCountry) ?? countryOptions[0],
    [countryOptions, activeCountry],
  )

  const filteredCountries = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return countryOptions
    return countryOptions.filter((opt) => opt.searchText.includes(q))
  }, [countryOptions, searchQuery])

  // Close popover on outside click
  React.useEffect(() => {
    if (!isOpen) return undefined
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  const openDropdown = () => {
    if (disabled) return
    setIsOpen(true)
    setSearchQuery('')
    setHighlightedIndex(0)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const selectCountry = (nextCountry: CountryCode) => {
    const nextResult = normalizePhoneInput(nationalText, nextCountry)
    setDraftState({
      syncedValue: nextResult.e164,
      nationalText,
      countryOverride: nextCountry,
    })
    setIsOpen(false)
    setSearchQuery('')
    onChange?.(nextResult.e164, nextResult)
    phoneInputRef.current?.focus()
  }

  const handleNationalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    const nextResult = normalizePhoneInput(raw, activeCountry)

    // If user pasted a full E.164 with a different country, switch Part 1 automatically
    const switchedCountry =
      (raw.trim().startsWith('+') || raw.trim().startsWith('00')) &&
      nextResult.country !== activeCountry
        ? nextResult.country
        : activeCountry

    const nextLocalText =
      switchedCountry !== activeCountry ? nextResult.nationalNumber : raw

    setDraftState({
      syncedValue: nextResult.e164,
      nationalText: nextLocalText,
      countryOverride: switchedCountry,
    })
    onChange?.(nextResult.e164, nextResult)
  }

  const handleBlur = () => {
    setTouched(true)
    onBlur?.()
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      setSearchQuery('')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((prev) =>
        filteredCountries.length > 0 ? Math.min(prev + 1, filteredCountries.length - 1) : 0,
      )
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Enter' && filteredCountries[highlightedIndex]) {
      event.preventDefault()
      selectCountry(filteredCountries[highlightedIndex].iso)
    }
  }

  const showInlineInvalid =
    validateOnBlur && touched && Boolean(normalized.e164) && !normalized.isValid
  const hasError = Boolean(error) || showInlineInvalid

  return (
    <div ref={containerRef} className={cn('space-y-1.5', className)}>
      {/* Part 1 (Country Code) + Part 2 (Local Phone Input) — always LTR for phone ergonomics */}
      <div className="relative flex items-stretch gap-2" dir="ltr">
        {/* Part 1: Searchable Country Code Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={tCommon('phone.countryCode')}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm text-foreground transition-colors',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError ? 'border-destructive' : 'border-input',
          )}
        >
          <CmxCountryFlag iso={selectedOption?.iso} />
          <span className="font-medium tabular-nums">
            {selectedOption?.dialCode}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>

        {/* Part 2: Local Phone Number Input */}
        <div className="min-w-0 flex-1">
          <CmxInput
            ref={phoneInputRef}
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            dir="ltr"
            value={nationalText}
            onChange={handleNationalChange}
            onBlur={handleBlur}
            disabled={disabled}
            required={required}
            placeholder={placeholder || tCommon('phone.placeholder')}
            aria-invalid={hasError || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'tabular-nums',
              hasError ? 'border-destructive focus-visible:ring-destructive' : undefined,
            )}
          />
        </div>

        {/* Searchable All-Countries Popover */}
        {isOpen ? (
          <div
            className="absolute start-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="border-b border-border p-2">
              <CmxInput
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={tCommon('phone.searchCountry')}
                aria-label={tCommon('phone.searchCountry')}
                leftIcon={<Search className="h-3.5 w-3.5" aria-hidden />}
                className="h-8 text-xs"
              />
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label={tCommon('phone.countryCode')}
              className="max-h-56 overflow-y-auto py-1 text-sm"
            >
              {filteredCountries.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground text-center">
                  {tCommon('phone.noCountriesFound')}
                </li>
              ) : (
                filteredCountries.map((option, idx) => {
                  const isSelected = option.iso === activeCountry
                  const isHighlighted = idx === highlightedIndex
                  return (
                    <li
                      key={option.iso}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        selectCountry(option.iso)
                      }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors',
                        isHighlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                        isSelected ? 'font-semibold' : undefined,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CmxCountryFlag iso={option.iso} />
                        <span className="truncate">{option.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <bdi dir="ltr" className="text-muted-foreground tabular-nums">
                          {option.dialCode}
                        </bdi>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-primary-text" aria-hidden />
                        ) : null}
                      </span>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Part 3: Canonical E.164 DB Value Preview */}
      {showNormalizedPreview && normalized.e164 ? (
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-muted px-2.5 py-1 text-xs">
          <span className="text-muted-foreground">{tCommon('phone.normalizedLabel')}</span>
          <span className="inline-flex items-center gap-1.5">
            <bdi dir="ltr" className="font-mono font-medium text-foreground tabular-nums">
              {normalized.e164}
            </bdi>
            {normalized.isValid ? (
              <CheckCircle2
                className="h-3.5 w-3.5 text-success-text"
                aria-label={tCommon('phone.valid')}
              />
            ) : touched ? (
              <AlertCircle
                className="h-3.5 w-3.5 text-warning-text"
                aria-label={tCommon('phone.invalid')}
              />
            ) : null}
          </span>
        </div>
      ) : null}

      {/* Validation / Error Message */}
      {error ? (
        <p role="alert" className="text-xs text-danger-text text-start">
          {error}
        </p>
      ) : showInlineInvalid ? (
        <p role="alert" className="text-xs text-warning-text text-start">
          {tCommon('phone.invalid')}
        </p>
      ) : null}
    </div>
  )
}
