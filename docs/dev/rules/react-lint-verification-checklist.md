# react-lint-verification-checklist.md — Agent pre-submit gate

**Portable checklist** — copy to any React 19 + Next.js + ESLint project.  
**Details:** `react-effects-patterns.md` · `react-rhf-and-table-lint.md`

---

## Before marking UI / hooks work complete

```bash
cd <frontend-app>
npx eslint . --quiet
npx tsc --noEmit
```

Both must pass. CI typically runs `npm run lint` (fails on **errors**, not warnings).

---

## Code-generation checklist

- [ ] No `setState` in `useEffect` for prop-driven resets → render-time `prevX` pattern
- [ ] No `form.watch()` → `useWatch({ control, name })`
- [ ] Internal routes use `next/link`, not `<a href>`
- [ ] `useReactTable` has `eslint-disable-next-line react-hooks/incompatible-library` with comment
- [ ] No anonymous `export default { ... }`
- [ ] Combobox inputs: `role="combobox"` + `aria-controls` + listbox `id`
- [ ] `useCallback` deps include any `setState` setters the callback uses
- [ ] `useMemo` / `useCallback` deps are array **literals** (no `[a, ...spread]`)

---

## After `npm run lint:fix`

- [ ] Re-run `npx eslint . --quiet`
- [ ] Confirm no required `eslint-disable` comments were removed by mistake

---

## Copy to other projects

| File | Purpose |
|------|---------|
| `docs/dev/rules/react-effects-patterns.md` | Effects, Link, memoization |
| `docs/dev/rules/react-rhf-and-table-lint.md` | RHF, TanStack, a11y, exports |
| `docs/dev/rules/react-lint-verification-checklist.md` | This checklist |
| `.cursor/rules/react-effects-patterns.mdc` | Cursor — effects |
| `.cursor/rules/react-rhf-and-table-lint.mdc` | Cursor — RHF / table / a11y |

Update `globs` in `.mdc` files to match your app directory.
