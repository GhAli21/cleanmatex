# react-effects-patterns.md — React 19 / Next.js ESLint patterns

**Portable rule doc** — copy to other React 19 / Next.js projects.  
**Companion:** `docs/dev/rules/react-rhf-and-table-lint.md` (RHF, TanStack, a11y, exports)  
**Checklist:** `docs/dev/rules/react-lint-verification-checklist.md`  
**In this repo:** applies to `web-admin` hooks and client components.

**React references (read before adding `useEffect` + `setState`):**

- [React Learn](https://react.dev/learn)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

**Lint gate:** CI fails on **errors** only. Find blockers with:

```bash
cd web-admin
npx eslint . --quiet
```

Auto-fix formatting and other fixable warnings:

```bash
npm run lint:fix
```

---

## 1. `@next/next/no-html-link-for-pages` (error)

**Rule:** Do not use `<a href="...">` for internal App Router navigation.

**Fix:** Use `Link` from `next/link` with the same `href` and `className`.

```tsx
import Link from 'next/link';

<Link href="/dashboard/marketing/campaigns" className="...">
  {label}
</Link>
```

**Reference fix:** `web-admin/src/features/notifications/ui/campaign-detail-page.tsx`

**Audit:** Search for `<a href="/dashboard` in feature UI — replace internal links the same way.

---

## 2. `react-hooks/set-state-in-effect` (error)

**Rule:** Do not call `setState` synchronously inside `useEffect` to reset or derive UI state from props. This triggers cascading renders and fails ESLint (React Compiler).

**Prefer:** [Adjust state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes) — compare previous vs current value **during render**, skip reset on first mount.

### Pattern A — single prop transition (e.g. modal `open`)

```ts
const [state, setState] = useState(() => initialState());
const [prevOpen, setPrevOpen] = useState(open);

if (open !== prevOpen) {
  setPrevOpen(open);
  if (open) {
    setState(initialState());
  }
}
```

**Reference:** `web-admin/src/features/orders/ui/use-payment-workbench-section-state.ts`

### Pattern B — multiple reset dependencies (`resetDeps` array)

Build a stable signature (do **not** use `useMemo` with a spread dep list — see §3):

```ts
const resetSignature = JSON.stringify([payExtraIntent, ...resetDeps]);
const [prevResetSignature, setPrevResetSignature] = useState<string | undefined>(undefined);

if (prevResetSignature !== resetSignature) {
  if (prevResetSignature !== undefined) {
    setValidationPhase('editing');
    setExtraReceiptDialogOpen(false);
  }
  setPrevResetSignature(resetSignature);
}
```

**Reference:** `web-admin/src/features/orders/hooks/use-pay-extra-checkout.ts`

### Pattern C — reset state owned by a child hook

Pass a `stateResetKey` into the child hook; child resets its own state during render when the key changes:

```ts
// Parent
const allocation = useOverpaymentAllocation({
  ...params,
  stateResetKey: resetSignature,
});

// Child hook (use-overpayment-allocation.ts)
if (stateResetKey !== undefined && prevStateResetKey !== stateResetKey) {
  if (prevStateResetKey !== undefined) {
    setExtraReceiptMode('adjust_legs');
    setAllocationPreviewId(null);
    setAllocationPreview(null);
  }
  setPrevStateResetKey(stateResetKey);
}
```

**Reference:** `web-admin/src/features/orders/hooks/use-overpayment-allocation.ts`

### Last resort — file-level disable

~30 web-admin files use:

```ts
/* eslint-disable react-hooks/set-state-in-effect */
```

Use only when render-time reset is impractical. Prefer Patterns A–C for new code.

---

## 3. `react-hooks/use-memo` — dependency array must be literal (error)

**Rule:** `useMemo` / `useCallback` dependency arrays must be **array literals**. You cannot write `[payExtraIntent, ...resetDeps]`.

**Fix:** Compute the value during render without `useMemo`, or list explicit primitive deps:

```ts
// OK — cheap stringify on each render; compared via prev-signature pattern
const resetSignature = JSON.stringify([payExtraIntent, ...resetDeps]);

// Avoid
const resetSignature = useMemo(
  () => JSON.stringify([payExtraIntent, ...resetDeps]),
  [payExtraIntent, ...resetDeps] // error: not an array literal
);
```

---

## 4. `react-hooks/preserve-manual-memoization` (error)

**Rule:** React Compiler checks that `useCallback` / `useMemo` dependency arrays match inferred dependencies. If the callback calls `setValidationPhase`, `setExtraReceiptDialogOpen`, etc., include those setters in the deps array (they are stable).

```ts
const runValidatePayment = useCallback(() => {
  if (!payExtraIntent) return;
  setValidationPhase('ready');
  setExtraReceiptDialogOpen(false);
}, [
  payExtraIntent,
  checkoutMetrics.unresolvedExcessAmount,
  moneyEpsilon,
  setValidationPhase,
  setExtraReceiptDialogOpen,
]);
```

**Reference:** `web-admin/src/features/orders/hooks/use-pay-extra-checkout.ts`

Alternatively, omit `useCallback` when memoization is unnecessary (Compiler may inline).

---

## 5. When `useEffect` **is** appropriate

Use effects for **external systems**, not for syncing React state to React state:

- Subscriptions (WebSocket, `addEventListener`)
- Imperative DOM / third-party widgets
- Logging / analytics side effects
- Fetch triggered by user action (prefer React Query / server components where possible)

See [Connecting to external systems](https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store).

---

## 6. AI / tooling pointers

| Tool | Where this doc is referenced |
|------|------------------------------|
| Cursor | `.cursor/rules/react-effects-patterns.mdc`, `.cursor/rules/react-rhf-and-table-lint.mdc` |
| Claude Code | `/frontend` skill → `SKILL.md`, `standards.md` |
| Codex | `AGENTS.md`, `.codex/skills/feature-implementation/SKILL.md` |
| Claude (repo) | `CLAUDE.md` UI Quick Rules |
| Checklist | `docs/dev/rules/react-lint-verification-checklist.md` |
| App AI hints | `web-admin/.clauderc` → `react_hooks` |

**Copy to other projects:** see §7 in `react-rhf-and-table-lint.md`.

---

## 7. Verification

After editing hooks or client components:

```bash
cd web-admin
npx eslint . --quiet
npx tsc --noEmit
```

Fix all `--quiet` errors before opening a PR; CI runs `npm run lint --workspace=web-admin`.
