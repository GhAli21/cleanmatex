# UI Migration Guide: Legacy @/components/ui → @ui APIs

This guide supports the migration from `@/components/ui` (legacy, **removed**) to the new `@ui` design system.

**Status:** Phase 5 complete. Legacy `components/` folder removed. All imports use `@ui/*` or `@features/*`.

---

## Current Architecture

### Architecture (Post–Phase 5)

```
@ui/*  ──►  src/ui/*  (design system + compat)
@features/*  ──►  src/features/*/ui/*  (feature modules)
```

- `**src/ui/compat/**` – Legacy component implementations (Button, Input, Card, etc.) – use `@ui/compat`
- `**@ui** barrel** – Exports compat plus Cmx components (`CmxButton`, `CmxDialog`, etc.)
- **Legacy `components/`** – Removed in Phase 5

### Import Paths


| Import Path        | Resolves To             | Notes                      |
| ------------------ | ----------------------- | -------------------------- |
| `@ui`              | `src/ui/index.ts`       | Design system + compat     |
| `@ui/compat`       | `src/ui/compat/index.ts`| Button, Input, Card, etc.  |
| `@ui/primitives`   | `src/ui/primitives/`    | CmxButton, CmxInput, etc.  |
| `@ui/forms`        | `src/ui/forms/`         | CmxSelectDropdown, etc.     |
| `@ui/feedback`     | `src/ui/feedback/`      | CmxSummaryMessage, etc.    |


---

## Component Mapping: Legacy → Cmx

### Buttons


| Legacy (compat)                                           | Cmx Replacement                                                | Variant Mapping                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Button` from `@/components/ui`                           | `CmxButton` from `@ui/primitives`                              | `variant="primary"` → `variant="primary"`; `variant="danger"` → `variant="destructive"` |
| `variant`: primary, secondary, outline, ghost, **danger** | `variant`: primary, secondary, outline, ghost, **destructive** | Map `danger` → `destructive`                                                            |
| `size`: sm, md, lg                                        | `size`: xs, sm, md, lg                                         |                                                                                         |
| `isLoading`                                               | `loading`                                                      |                                                                                         |


**Migration example:**

```tsx
// Before (compat)
import { Button } from "@/components/ui/Button";
<Button variant="danger" isLoading={saving}>
  Delete
</Button>;

// After (@ui Cmx)
import { CmxButton } from "@ui/primitives";
<CmxButton variant="destructive" loading={saving}>
  Delete
</CmxButton>;
```

### Forms


| Legacy                                                                                             | Cmx Replacement                                                                                                                    | Notes                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Input`                                                                                            | `CmxInput`                                                                                                                         | `@ui/primitives`                                                      |
| `Textarea`                                                                                         | `CmxTextarea` or use `CmxInput` as textarea                                                                                        | `@ui/primitives`                                                      |
| `Label`                                                                                            | `CmxLabel`                                                                                                                         | `@ui/primitives`                                                      |
| `Checkbox`                                                                                         | `CmxCheckbox`                                                                                                                      | `@ui/primitives`                                                      |
| `Switch`                                                                                           | `CmxSwitch`                                                                                                                        | `@ui/primitives`                                                      |
| `Select` (simple)                                                                                  | `CmxSelect` or native select                                                                                                       | `@ui/forms`                                                           |
| `Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem` (from select-dropdown) | `CmxSelectDropdown` + `CmxSelectDropdownTrigger` + `CmxSelectDropdownValue` + `CmxSelectDropdownContent` + `CmxSelectDropdownItem` | `@ui/forms`; API is similar, names prefixed with `CmxSelectDropdown*` |


### Data Display


| Legacy                             | Cmx Replacement  | Notes                                                         |
| ---------------------------------- | ---------------- | ------------------------------------------------------------- |
| `Card`, `CardHeader`, `CardFooter` | `CmxCard` family | `@ui/data-display`                                            |
| `Badge`                            | `CmxBadge`       | `@ui/data-display`                                            |
| `Tabs`                             | `CmxTabsPanel`   | `@ui/navigation`; different API (tabs array, value, onChange) |


### Feedback


| Legacy                      | Cmx Replacement     | Notes                          |
| --------------------------- | ------------------- | ------------------------------ |
| `Alert`, `AlertDescription` | `CmxAlert`          | `@ui/feedback`                 |
| `ProgressBar`               | `CmxProgressBar`    | `@ui/feedback`; API compatible |
| `SummaryMessage`            | `CmxSummaryMessage` | `@ui/feedback`; API compatible |


### Overlays


| Legacy                                                                                                       | Cmx Replacement    | Notes          |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | -------------- |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `CmxDialog` family | `@ui/overlays` |


---

## Step-by-Step Migration for Call Sites

### Option A: Keep Legacy Import (No Change)

Continue using `@/components/ui/*`. No code changes needed; imports resolve to the compat layer.

### Option B: Switch to @ui/compat (Intermediate)

Same API, new path. Useful for preparing a later switch to Cmx.

```tsx
// Before
import { Button, Card } from "@/components/ui";

// After (intermediate)
import { Button, Card } from "@ui/compat";
// or specific paths:
import { Button } from "@ui/compat/Button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@ui/compat/select-dropdown";
```

### Option C: Migrate to Cmx Components (Target)

Use the Cmx design system components with theme tokens and updated APIs.

1. **Identify the component** – See mapping table above.
2. **Check API differences** – Variant names, prop names (e.g. `danger` → `destructive`, `isLoading` → `loading`).
3. **Update import** – From `@/components/ui` or `@ui/compat` to `@ui/<layer>` (e.g. `@ui/primitives`, `@ui/forms`).
4. **Adjust JSX** – Apply any prop renames or structural changes.
5. **Verify styling** – Cmx uses theme tokens; visual changes should be minimal but worth a quick check.

---

## Migration Examples by Component

### Button

```tsx
// Legacy
import { Button } from '@/components/ui/Button';
<Button variant="primary" size="md" isLoading={loading}>Save</Button>
<Button variant="danger">Delete</Button>

// Cmx
import { CmxButton } from '@ui/primitives';
<CmxButton variant="primary" size="md" loading={loading}>Save</CmxButton>
<CmxButton variant="destructive">Delete</CmxButton>
```

### Select Dropdown (Composable)

```tsx
// Legacy
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select-dropdown";

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
    <SelectItem value="b">Option B</SelectItem>
  </SelectContent>
</Select>;

// Cmx (same structure, different component names)
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from "@ui/forms";

<CmxSelectDropdown value={value} onValueChange={setValue}>
  <CmxSelectDropdownTrigger>
    <CmxSelectDropdownValue placeholder="Choose..." />
  </CmxSelectDropdownTrigger>
  <CmxSelectDropdownContent>
    <CmxSelectDropdownItem value="a">Option A</CmxSelectDropdownItem>
    <CmxSelectDropdownItem value="b">Option B</CmxSelectDropdownItem>
  </CmxSelectDropdownContent>
</CmxSelectDropdown>;
```

### SummaryMessage

```tsx
// Legacy
import { SummaryMessage } from "@/components/ui/summary-message";
<SummaryMessage
  type="success"
  title="Done"
  items={["Item 1"]}
  onDismiss={() => {}}
/>;

// Cmx (API compatible)
import { CmxSummaryMessage } from "@ui/feedback";
<CmxSummaryMessage
  type="success"
  title="Done"
  items={["Item 1"]}
  onDismiss={() => {}}
/>;
```

### ProgressBar

```tsx
// Legacy
import { ProgressBar } from "@/components/ui/ProgressBar";
<ProgressBar value={75} max={100} />;

// Cmx (API compatible)
import { CmxProgressBar } from "@ui/feedback";
<CmxProgressBar value={75} max={100} />;
```

### Dialog

```tsx
// Legacy
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm</DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>;

// Cmx
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from "@ui/overlays";
import { CmxButton } from "@ui/primitives";

<CmxDialog open={open} onOpenChange={setOpen}>
  <CmxDialogContent>
    <CmxDialogHeader>
      <CmxDialogTitle>Confirm</CmxDialogTitle>
    </CmxDialogHeader>
    <CmxDialogFooter>
      <CmxButton onClick={() => setOpen(false)}>Cancel</CmxButton>
      <CmxButton variant="primary">Confirm</CmxButton>
    </CmxDialogFooter>
  </CmxDialogContent>
</CmxDialog>;
```

---

## Gradual Migration Checklist

- Prefer `@ui/compat` over `@/components/ui` for new code (intermediate step).
- Migrate high-traffic or frequently changed screens first.
- One component type per PR (e.g. all Buttons in one file, or all Selects).
- Run `npm run build` after changes.
- Run `npm run check:i18n` if translations are affected.
- Test RTL and dark mode where applicable.

---

## Call Site Inventory

To find remaining legacy imports:

```bash
# All @/components/ui usages
rg "from ['\"]@/components/ui" web-admin --type ts --type tsx -l

# Specific component
rg "SummaryMessage|SelectTrigger|SelectContent" web-admin --type ts --type tsx -l
```

As of the Phase 4 completion, main consumers include:

- `src/features/workflow/ui/` (SummaryMessage, select-dropdown)
- `src/features/orders/ui/` (select-dropdown, Button, Card, Badge, etc.)
- `src/features/catalog/ui/`
- `src/features/settings/ui/`
- `src/features/inventory/ui/`

---

## Phase 5/6 Verification (Completed)

- Build passes (`npm run build`)
- i18n parity check passes (`npm run check:i18n`)
- tsconfig paths: `@ui/*`, `@features/*`, `@/*` (lib via `@/lib`)
- Circular dependency check: `npx madge --circular src` (run when needed)
- Optional ESLint rule to warn on `@/components/ui` in new code (Phase 6)

### Optional ESLint Rule (Phase 6)

To encourage migration, add to `eslint.config.js`:

```js
// Warn when importing from legacy @/components/ui in new files
{
  files: ['**/*.tsx', '**/*.ts'],
  rules: {
    'no-restricted-imports': ['warn', {
      patterns: [{
        group: ['@/components/ui', '@/components/ui/*'],
        message: 'Prefer @ui/compat or @ui Cmx components. See docs/dev/ui-migration-guide.md',
      }],
    }],
  },
}
```

Apply only after team agrees; can start as `warn` then upgrade to `error` when ready.

---

## References

- **Plan:** `.cursor/plans/ui_architecture_migration_6ad78d7c.plan.md`
- **Cmx usage examples:** `web-admin/src/ui/USAGE_EXAMPLES.md`
- **CmxSummaryMessage guide:** `web-admin/src/ui/feedback/cmxMessage_developer_guide.md`

