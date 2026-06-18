# react-rhf-and-table-lint.md — React Hook Form, TanStack Table, a11y, exports

**Portable rule doc** — copy to other React 19 / Next.js projects.  
**Companion:** `docs/dev/rules/react-effects-patterns.md` (effects, `Link`, memoization)  
**This file:** `docs/dev/rules/react-rhf-and-table-lint.md`

---

## 1. `react-hooks/incompatible-library` — React Hook Form

**Rule:** Do not use `form.watch()` (or `profileForm.watch()`, etc.). React Compiler cannot safely memoize the `watch()` function from `useForm()`.

**Fix:** Use `useWatch` from `react-hook-form`.

```tsx
import { useForm, useWatch } from 'react-hook-form';

const form = useForm<FormValues>({ ... });

// ✅ One field
const taxType = useWatch({ control: form.control, name: 'tax_type' });

// ✅ All fields (dialogs with many toggles)
const watched = useWatch({ control: form.control });
const feeType = watched?.fee_type;

// ✅ Dynamic field in a small sub-component
function BoolSwitch({ field }: { field: keyof FormValues }) {
  const val = useWatch({ control: form.control, name: field });
  return <CmxSwitch checked={val === true} onCheckedChange={...} />;
}

// ❌ In JSX or at component top level
value={form.watch('tax_type')}
const x = form.watch('amount');
```

**In JSX:** hoist `useWatch` results to variables; never call `form.watch()` inline in `value={...}` or `checked={...}`.

---

## 2. `react-hooks/incompatible-library` — TanStack Table

**Rule:** `useReactTable()` from `@tanstack/react-table` is not React Compiler–compatible.

**Fix:** One-line suppress with a comment immediately above the call (do not disable the rule file-wide).

```tsx
// TanStack Table is not React Compiler memoizable
// eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-table useReactTable
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
});
```

Apply in every file that calls `useReactTable`.

---

## 3. `import/no-anonymous-default-export`

**Rule:** Do not `export default { ... }` or `export default function() {}` without a name.

```ts
// ❌
export default {
  captureException: () => {},
};

// ✅
const sentryStub = {
  captureException: () => {},
};
export default sentryStub;
```

Named function exports are also fine: `export default function sentryStub() { ... }`.

---

## 4. `jsx-a11y/role-supports-aria-props` — combobox / autocomplete

**Rule:** `aria-expanded` is not valid on a plain `<input>` (implicit role `textbox`).

**Fix:** Use the combobox pattern when the input drives a suggestion list:

```tsx
<input
  role="combobox"
  aria-controls="customer-listbox"
  aria-expanded={dropdownOpen}
  aria-autocomplete="list"
  ...
/>
<ul id="customer-listbox" role="listbox">
  {items.map(...)}
</ul>
```

Match `aria-controls` / `id`. For simple navigation links, use `next/link` instead of `<a href>` (see `react-effects-patterns.md`).

---

## 5. Pre-submit verification (mandatory for agents)

After editing client components, hooks, or forms:

```bash
cd <frontend-app>   # e.g. web-admin
npx eslint . --quiet    # MUST be 0 errors — this is the CI gate
npx tsc --noEmit        # when types touched
```

| Command | Purpose |
|---------|---------|
| `npx eslint . --quiet` | Errors only — **CI fails on this** |
| `npm run lint` | Full report (warnings may remain) |
| `npm run lint:fix` | Auto-fix; re-run `--quiet` after (may remove stale `eslint-disable`) |

**Do not** consider a UI/hooks task done until `eslint . --quiet` exits 0.

---

## 6. `lint:fix` caution

- Removes **unused** `eslint-disable` comments — good.
- Does **not** fix JSDoc, `form.watch`, or effect patterns — fix those in code.
- After `lint:fix`, always run `npx eslint . --quiet` again.

---

## 7. AI / tooling pointers (copy with docs)

| Tool | Cursor rule file | When it applies |
|------|------------------|-----------------|
| Cursor | `.cursor/rules/react-rhf-and-table-lint.mdc` | `**/*.{ts,tsx}` — adjust `globs` per project |
| Cursor | `.cursor/rules/react-effects-patterns.mdc` | Effects + Next `Link` |
| Claude Code | `/frontend` skill | Before any client UI / hooks |
| Codex / agents | `AGENTS.md` → React lint section | Every session |
| App AI hints | `<app>/.clauderc` → `react_hooks` | Per-app snippets |

When copying to a new repo:

1. Copy `docs/dev/rules/react-effects-patterns.md` and `react-rhf-and-table-lint.md`
2. Copy `.cursor/rules/react-effects-patterns.mdc` and `react-rhf-and-table-lint.mdc`
3. Update `globs` in `.mdc` files to match the app folder (e.g. `web-admin/**`, `src/**`)
4. Add one bullet + doc link in `AGENTS.md` / `CLAUDE.md` / frontend skill

---

## 8. Quick “don’t” list for code generation

| Don’t | Do instead |
|-------|------------|
| `form.watch('x')` in JSX | `useWatch({ control, name: 'x' })` |
| `useEffect(() => setState(...), [prop])` | Render-time prev-prop transition (see effects doc) |
| `<a href="/app/...">` | `<Link href="...">` from `next/link` |
| `export default { ... }` | `const x = { ... }; export default x` |
| `aria-expanded` on plain `<input>` | `role="combobox"` + `aria-controls` + listbox |
| `useMemo(..., [a, ...spread])` | Literal deps only, or compute during render |
| `useCallback` without setters in deps | Include `setX` used inside the callback |
