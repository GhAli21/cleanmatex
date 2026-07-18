# Cmx Message Developer Guide

This file is a short developer-facing companion to `README.md` in the same folder.

## Current Authority

Use these in order:

1. Project rule: `docs/dev/rules/cmx-message.md` (mandatory when applicable)
2. `README.md` (this folder)
3. `../README.md`
4. current exported code in the feedback domain

## Recommended Usage

```ts
import { cmxMessage, useMessage, CmxSummaryMessage } from '@ui/feedback'
```

## Practical Rules

- **Mandatory when applicable:** use `cmxMessage` for global success, error, warning, info, loading, and imperative confirm feedback
- use `useMessage()` when you need i18n-aware helpers inside React components
- pass i18n-resolved strings into `cmxMessage` / `useMessage` (resolve with `useTranslations` first)
- use `CmxSummaryMessage` for inline rendering, not older `SummaryMessage` references
- keep local React state for field-level validation and form-specific UI state
- do not add new legacy `showSuccessToast` / raw `toast()` / `alert()` call sites
- add global notifications on top of local state when the user benefits from both

## Inline Example

```tsx
import { useMessage, CmxSummaryMessage } from '@ui/feedback'

function Example() {
  const { showSuccess } = useMessage()
  const result = showSuccess('Saved!', { method: 'inline' })

  return result.message ? (
    <CmxSummaryMessage
      type={result.message.type}
      title={result.message.title}
      items={result.message.items}
      onDismiss={result.dismiss}
    />
  ) : null
}
```

## Notes

- older migration links in prior versions of this file were stale
- older `SummaryMessage` examples were incorrect for current usage
- if guidance here conflicts with `README.md`, `README.md` wins

## Related Documentation

- `README.md`
- `../README.md`
