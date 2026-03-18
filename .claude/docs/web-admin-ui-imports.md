# web-admin UI Imports (Mandatory — Always Apply)

When writing or suggesting **UI code in web-admin**:

1. **Use Cmx design system only.** Import from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`. Do **not** use `@ui/compat` (removed).
2. **Use the exact import snippets below** for buttons, inputs, cards, dialogs, alerts, selects, tabs, etc.
3. **Run `npm run build`** in web-admin after UI changes; ESLint and TypeScript will fail on invalid or restricted imports.

## Exact Import Snippets (from web-admin/.clauderc)

```typescript
// Button
import { CmxButton } from '@ui/primitives'

// Input / Textarea / Select / Checkbox / Switch / Label
import { CmxInput } from '@ui/primitives'
import { CmxTextarea } from '@ui/primitives'
import { CmxSelect } from '@ui/primitives'
import { CmxCheckbox } from '@ui/primitives'
import { CmxSwitch } from '@ui/primitives'
import { Label } from '@ui/primitives'

// Card
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent, CmxCardFooter } from '@ui/primitives/cmx-card'

// Badge
import { Badge } from '@ui/primitives/badge'

// Alert
import { Alert, AlertDescription } from '@ui/primitives'

// Dialog
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'

// Tabs
import { CmxTabsPanel } from '@ui/navigation'

// Progress / Summary
import { CmxProgressBar } from '@ui/feedback'
import { CmxSummaryMessage } from '@ui/feedback'

// Select Dropdown
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'

// Data Table
import { CmxDataTable } from '@ui/data-display'
```

## Restricted Imports (will fail build/lint)

- ❌ `@ui/compat` — removed
- ❌ `@/components/ui` — does not exist
- ❌ `@/components/ui/*` — does not exist
- ❌ Any direct shadcn/ui imports in features — wrap as Cmx in `src/ui/` first

## ESLint Enforcement

These restrictions are enforced at build time via `no-restricted-imports` ESLint rule. If you suggest a restricted import, `npm run build` **will fail**.

**See also:** `.claude/skills/frontend/standards.md`, `docs/dev/ui-migration-guide.md`.
