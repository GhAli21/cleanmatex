/**
 * CmxFormField - Form field with label, description, and error handling
 * @module ui/forms
 */

'use client'

import { Controller, get, type ControllerRenderProps, type FieldValues, type Path, useFormContext } from 'react-hook-form'
import { useId, type ReactNode } from 'react'
import { CmxFieldShell, type CmxFieldLayout, type CmxFieldTone } from './cmx-field-shell'

interface CmxFormFieldRenderProps extends ControllerRenderProps<FieldValues, string> {
  id: string
  invalid: boolean
  describedBy?: string
  error?: string
}

interface CmxFormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  name: Path<TFieldValues>
  label?: ReactNode
  description?: ReactNode
  hint?: ReactNode
  required?: boolean
  optionalLabel?: ReactNode
  labelAction?: ReactNode
  counter?: ReactNode
  layout?: CmxFieldLayout
  tone?: CmxFieldTone
  className?: string
  children: (fieldProps: CmxFormFieldRenderProps) => ReactNode
}

/**
 * Field wrapper owns semantics and recovery messaging so custom controls can
 * stay focused on input behavior while forms keep one consistent hierarchy.
 *
 * @param root0 Field props.
 * @param root0.name React Hook Form field path.
 * @param root0.label Visible field label.
 * @param root0.description Optional explanatory copy under the label.
 * @param root0.hint Optional helper text shown below the control.
 * @param root0.required Whether the field is required.
 * @param root0.optionalLabel Optional text for non-required fields.
 * @param root0.labelAction Optional inline action rendered beside the label.
 * @param root0.counter Optional trailing counter or meta text.
 * @param root0.layout Field layout variant.
 * @param root0.tone Visual emphasis variant.
 * @param root0.className Optional wrapper className.
 * @param root0.children Render prop that receives the connected field bindings.
 * @returns RHF-aware field wrapper.
 */
export function CmxFormField<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  hint,
  required,
  optionalLabel,
  labelAction,
  counter,
  layout = 'stacked',
  tone = 'default',
  className,
  children,
}: CmxFormFieldProps<TFieldValues>) {
  const generatedId = useId()
  const fieldId = `${String(name).replace(/[.\[\]]+/g, '-')}-${generatedId}`
  const { control, formState } = useFormContext<TFieldValues>()
  const fallbackError = get(formState.errors, name)?.message
  const error = typeof fallbackError === 'string' ? fallbackError : undefined
  const describedBy = [description ? `${fieldId}-desc` : '', (hint || error) ? `${fieldId}-${error ? 'error' : 'hint'}` : '']
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <CmxFieldShell
      id={fieldId}
      name={String(name)}
      label={label}
      description={description}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      labelAction={labelAction}
      counter={counter}
      layout={layout}
      tone={tone}
      className={className}
    >
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) =>
          children({
            ...field,
            id: fieldId,
            invalid: !!fieldState.error,
            describedBy,
            error: fieldState.error?.message,
          })
        }
      />
    </CmxFieldShell>
  )
}
