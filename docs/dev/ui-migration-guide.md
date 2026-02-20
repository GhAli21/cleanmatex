# UI Migration Guide: Legacy @/components/ui → @ui APIs

This guide supports the migration from `@/components/ui` (legacy, **removed**) to the new `@ui` design system.

**Status:** Phase 7 complete. Legacy `components/` and compat layer removed. All imports use @ui Cmx components (`@ui/primitives`, `@ui/feedback`, `@ui/overlays`, etc.) or `@features/*`.

**Implementation notes:** See [compat-to-cmx-migration-notes.md](compat-to-cmx-migration-notes.md) for gotchas, Cmx upgrades (CmxInput/CmxSelect/Alert), barrel conflict fix (CmxDataTable), and suggestions for future work.

---

## Current Architecture

### Architecture (Post–Phase 7)

```
@ui/*  ──►  src/ui/*  (design system: primitives, feedback, overlays, forms, etc.)
@features/*  ──►  src/features/*/ui/*  (feature modules)
```

- **Compat layer** – Removed in Phase 7. Use Cmx components from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, etc.
- **Legacy `components/`** – Removed in Phase 5

### Architecture: features vs app/dashboard

Feature UI lives in `src/features/<name>/ui/` and is imported via `@features/*`. The `app/dashboard` directory holds only:

- **Route pages** (`page.tsx`, `layout.tsx`) – thin shells that compose feature screens
- **Route-specific client wrappers** – when a page needs a client component that is not part of a feature (e.g. `record-payment-client.tsx`)
- **Dev tools** – e.g. `jhtestui/components/` for JWT/viewer utilities

**Rule:** Components that duplicate `src/features/*/ui/*` must not exist under `app/dashboard/**/components/`. All feature UI is the single source of truth in `src/features/*`.

| Location | Purpose |
|----------|---------|
| `src/features/<name>/ui/*` | Canonical feature components – import via `@features/<name>/ui/*` |
| `app/dashboard/<area>/page.tsx` | Route shell – imports from `@features/*` |
| `app/dashboard/<area>/components/*` | Avoid – use feature modules instead |

### Import Paths


| Import Path        | Resolves To             | Notes                      |
| ------------------ | ----------------------- | -------------------------- |
| `@ui`              | `src/ui/index.ts`       | Design system barrel (primitives, forms, feedback, overlays, etc.). Does **not** re-export `./components`. |
| `@ui/primitives`   | `src/ui/primitives/`    | CmxButton, CmxInput, Alert, CmxCard, Badge, etc. |
| `@ui/forms`        | `src/ui/forms/`         | CmxForm, CmxSelectDropdown, etc. |
| `@ui/feedback`     | `src/ui/feedback/`      | CmxToast, CmxSummaryMessage, CmxProgressBar, etc. |
| `@ui/overlays`     | `src/ui/overlays/`      | CmxDialog, etc. |
| `@ui/components`  | `src/ui/components/`    | Legacy wrappers (e.g. CmxChart). Prefer primitives/forms/feedback; use only when needed. |


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
| `Card`, `CardHeader`, `CardFooter` | `CmxCard` family | `@ui/primitives` or `@ui/primitives/cmx-card`                 |
| `Badge`                            | `Badge`          | `@ui/primitives` or `@ui/primitives/badge`                    |
| `Tabs`                             | `CmxTabsPanel`   | `@ui/navigation`; different API (tabs array, value, onChange) |


### Feedback


| Legacy                      | Cmx Replacement     | Notes                                              |
| --------------------------- | ------------------- | -------------------------------------------------- |
| `Alert`, `AlertDescription` | `Alert`, `AlertDescription` | `@ui/primitives`; supports `message`, `destructive` variant |
| `ProgressBar`               | `CmxProgressBar`    | `@ui/feedback`; API compatible                     |
| `SummaryMessage`            | `CmxSummaryMessage` | `@ui/feedback`; API compatible                     |


### Overlays


| Legacy                                                                                                       | Cmx Replacement    | Notes          |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | -------------- |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `CmxDialog` family | `@ui/overlays` |


---

## Step-by-Step Migration for Call Sites

**Note:** The compat layer (`@ui/compat`) has been removed (Phase 7). Use Cmx components only.

### Migrate to Cmx Components

Use the Cmx design system components with theme tokens and updated APIs.

1. **Identify the component** – See mapping table above.
2. **Check API differences** – Variant names, prop names (e.g. `danger` → `destructive`, `isLoading` → `loading`).
3. **Update import** – Use `@ui/<layer>` (e.g. `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`).
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

## Migration Checklist

- Use Cmx components from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms` only; `@ui/compat` has been removed.
- One component type per PR (e.g. all Buttons in one file, or all Selects).
- Run `npm run build` after changes.
- Run `npm run check:i18n` if translations are affected.
- Test RTL and dark mode where applicable.

---

## Call Site Inventory

To find legacy or invalid imports:

```bash
# @/components/ui (legacy - should be empty or minimal)
rg "from ['\"]@/components/ui" web-admin --type ts --type tsx -l

# @ui/compat (removed - should be empty in app code; only eslint rule references it)
rg "@ui/compat" web-admin --glob "*.{tsx,ts}" -l
```

---

## Phase 7 Verification (Completed)

- Build passes (`npm run build`)
- i18n parity check passes (`npm run check:i18n`)
- tsconfig paths: `@ui/*`, `@features/*`, `@/*` (lib via `@/lib`)
- No `@ui/compat` imports in app/feature code (compat layer removed)
- ESLint: `@/components/ui` and `@ui/compat` are restricted; message directs to Cmx components

---

## References

- **Migration plan:** `.cursor/plans/compat_to_cmx_migration_plan_2644833f.plan.md`
- **Implementation notes:** [compat-to-cmx-migration-notes.md](compat-to-cmx-migration-notes.md)
- **Cmx usage examples:** `web-admin/src/ui/USAGE_EXAMPLES.md`
- **CmxSummaryMessage guide:** `web-admin/src/ui/feedback/cmxMessage_developer_guide.md`

