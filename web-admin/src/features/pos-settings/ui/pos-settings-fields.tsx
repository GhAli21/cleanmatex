'use client'

import { CmxInput, CmxSwitch } from '@ui/primitives'
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms'

// Field wrappers shared by the POS settings tabs. Kept local to this feature — promote to
// src/ui as Cmx* only if another screen needs the same label + control + hint shape.

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <CmxSwitch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

/**
 * Deliberately typed over plain `string`, not a generic literal union: the DB-mirrored enum catalogs
 * in `lib/constants/cash-control.ts` are `Record<string, string>` objects, so `Object.values(...)`
 * widens to `string[]` at the call sites. Every call site casts through
 * `form.setValue(field, v as never, ...)`, so the runtime value is exactly one of the enum's members
 * regardless of this wrapper's static type.
 */
export function SelectField({
  label,
  description,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: readonly string[]
  optionLabel: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <CmxSelectDropdown value={value} onValueChange={onChange}>
        <CmxSelectDropdownTrigger>
          <CmxSelectDropdownValue />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {options.map((option) => (
            <CmxSelectDropdownItem key={option} value={option}>
              {optionLabel(option)}
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function NumberField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <CmxInput
        type="number"
        step="0.001"
        min="0"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
