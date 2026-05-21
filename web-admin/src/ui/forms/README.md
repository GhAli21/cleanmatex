# Cmx Forms

The `@ui/forms` layer is the shared form shell for `web-admin`. It is intended to keep field semantics, validation treatment, action layout, and responsive behavior consistent without forcing feature screens to rebuild the same structure repeatedly.

## Components

- `CmxForm`: wraps a React Hook Form instance, handles invalid-submit focus, and can show a form-level error summary.
- `CmxFormField`: connects one RHF field to a reusable semantic shell with label, helper text, error text, and layout variants.
- `CmxFieldShell`: lower-level field chrome for custom controls that do not need RHF wiring.
- `CmxFormSection`: groups related fields into premium section cards with `single`, `twoColumn`, and `autoFit` layouts.
- `CmxFormActions`: responsive action footer with dirty-state messaging and sticky support.
- `CmxSelectDropdown`: accessible custom select for workflows that need richer option presentation than the native select.
- `CmxCheckboxGroup`: semantic multi-select group with optional bulk actions and responsive columns.
- `CmxHexColorField`: color picker plus LTR hex input with preset swatches.
- `CmxFormStatusBanner`: shared inline banner for save, warning, and validation summaries.
- `CmxFormSkeleton`: loading placeholder for page, drawer, and modal forms.

## Usage Notes

- Prefer `CmxForm` + `CmxFormField` for RHF-managed forms.
- Use `CmxFieldShell` directly for custom controls that manage their own value state.
- Keep field labels and helper copy passed in from the consuming screen so i18n stays at the feature layer.
- Use `layout="inline"` only for short labels and compact boolean or metadata controls.
- Pass `showErrorSummary` on long or operationally critical forms where fast recovery matters.
- Use `sticky` actions sparingly and primarily for mobile or long modal flows.

## Storybook

Story files live next to each component in this folder. Use them as the review surface for:

- default states
- invalid or warning states
- loading states
- RTL layout
- dense or sticky action patterns
