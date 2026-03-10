# Cmx UI Usage Examples

This file is a lightweight example reference for the current UI system.

## Current Rule

Prefer domain imports, not legacy umbrella imports.

## Examples

### Button

```tsx
import { CmxButton } from '@ui/primitives'
```

### Input

```tsx
import { CmxInput } from '@ui/primitives'
```

### Form

```tsx
import { CmxForm, CmxFormField } from '@ui/forms'
import { CmxButton, CmxInput } from '@ui/primitives'
```

### Data Table

```tsx
import { CmxDataTable } from '@ui/data-display'
```

### Feedback Messages

```tsx
import { cmxMessage, useMessage } from '@ui/feedback'
```

## Notes

- do not use this file as authority for `@ui` barrel imports
- do not use legacy `@ui/components/*` examples from older docs
- prefer `cmxMessage` over older toast helper patterns
- use `README.md` in this folder for current import policy
