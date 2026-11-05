'use client'

import { useId } from 'react'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms'

import { INHERIT } from '@features/settings/labels/model/label-printing-form'

export interface InheritableSelectFieldProps {
  label: string
  description?: string
  /** INHERIT or one of `options`. */
  value: string
  options: readonly string[]
  optionLabel: (value: string) => string
  /** Text of the INHERIT option, e.g. "Use default (4 × 6 in)". */
  inheritLabel: string
  /** Effective value line under the control, e.g. "In use: Show (all branches)". */
  hint?: string
  disabled?: boolean
  onChange: (value: string) => void
}

/**
 * Select with a first "Use default (…)" option that clears the override (INHERIT). Generic: any settings screen with
 * branch -> tenant -> system inheritance can use it.
 */
export function InheritableSelectField({
  label,
  description,
  value,
  options,
  optionLabel,
  inheritLabel,
  hint,
  disabled,
  onChange,
}: InheritableSelectFieldProps) {
  const labelId = useId()
  return (
    <div className="space-y-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <CmxSelectDropdown value={value} onValueChange={onChange} disabled={disabled}>
        <CmxSelectDropdownTrigger aria-labelledby={labelId}>
          <CmxSelectDropdownValue displayValue={value === INHERIT ? inheritLabel : optionLabel(value)} />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          <CmxSelectDropdownItem value={INHERIT}>{inheritLabel}</CmxSelectDropdownItem>
          {options.map((option) => (
            <CmxSelectDropdownItem key={option} value={option}>
              {optionLabel(option)}
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {hint ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
