# Cmx Message Developer Guide

This file is a short developer-facing companion to `README.md` in the same folder.

## Current Authority

Use these in order:

1. `README.md`
2. `../README.md`
3. current exported code in the feedback domain

## Recommended Usage

```ts
import { cmxMessage, useMessage, CmxSummaryMessage } from '@ui/feedback'
```

## Practical Rules

- use `cmxMessage` for global success, error, warning, and info feedback
- use `useMessage()` when you need i18n-aware helpers inside React components
- use `CmxSummaryMessage` for inline rendering, not older `SummaryMessage` references
- keep local React state for field-level validation and form-specific UI state
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
