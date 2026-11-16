# UI Design System — Resume Here

**Written:** 2026-11-17, for the next session or assistant.
**Authority:** `THEMING_ARCHITECTURE_DESIGN.md` (design) → `STATUS.md` (package states) → `PLAN_PR-02.md` (current plan, its Progress table and Rulings). If this file disagrees with them, they win.

## Where things stand

- **PR-01:** implemented 2026-11-16, all 7 tasks. Waiting for owner QA (`QA_TEST_GUIDE.md` → PR-01) and commit.
- **PR-02:** running inline from `PLAN_PR-02.md`, approved 2026-11-16.
  - Tasks 1–5 are done (status tokens, `CmxStatusBadge`, badge migration, Radix select, top bar and permissions inspector moved out of `src/ui`).
  - Task 6 is done (legacy `Button`/`Card`/`Input`/`LoadingButton`/`FormInput`, `src/ui/components/` and `foundations/tokens.ts` deleted). Typecheck, ESLint and build pass.
  - Task 7 code and tests are done (`scripts/ui/codemod-classes.js` applied to `src/ui`, plus the guard test `__tests__/ui/foundations/no-raw-classes.test.ts`). **Typecheck and build were not run:** the owner interrupted the typecheck. Details and rulings are in `PLAN_PR-02.md` → Progress row 7 and "Rulings made while executing".
  - Tasks 8–10 are not started.
- Nothing is committed. The owner commits; never commit or push.

## Next steps, in order

1. **Finish Task 7.**
   - In `web-admin`, run the typecheck: `npx tsc --noEmit -p .` with `NODE_OPTIONS=--max-old-space-size=8192`. Expected: only the 2 known errors.
   - Then `npm run build`, with the same heap.
   - Check in Storybook, in light/dark × EN/AR: `CmxSidebar`, `CmxTopBar`, the data grid and table, dialogs, the checkbox, the processing timeline.
   - Then mark row 7 Done.
2. **Task 8:** ESLint guardrails, with a test. A file-scoped `no-restricted-imports` block must repeat the global patterns.
3. **Task 9:** Pagination English literals → `common.*`. `order-issues-list-dialog.tsx` white on aqua → `text-primary-foreground` (the plan's `text-primary-fg` does not exist). Run `check:i18n`. (The touch-token comment is already fixed.)
4. **Task 10:** Run every check, then stories, then one fresh whole-change review on the most capable model. Then the docs: `STATUS.md` result section, `QA_TEST_GUIDE.md` → PR-02, `.clauderc`, `docs/dev/ui-migration-guide.md`, `web-admin/src/ui/feedback/README.md`.
5. After each task, update its row in the `PLAN_PR-02.md` Progress table, and the `STATUS.md` PR-02 row.

After PR-02, the recommended order is PR-07 tasks 1–5 → PR-04 → PR-05 → PR-07 task 6. Write `PLAN_PR-0N.md` just before each package and get owner approval first.

## Rules for this program (owner's, still in force)

- Plan first, then wait for approval. The PR-02 plan is already approved.
- Every plan has progress and status update tasks.
- QA steps go only in `QA_TEST_GUIDE.md`, never in `STATUS.md`.
- Migrations: write the SQL file only, then stop for review.
  - Never apply a migration.
  - Never edit an existing migration.
  - Never run `supabase db reset`.
- Every `org_*` query filters `tenant_org_id`.
- Never query `sys_stng_*` or `sys_feature_flags_*` directly.
- Use shared Cmx components from `@ui/*`. Feedback goes through `cmxMessage`.
- EN/AR and RTL are mandatory; keep `messages/en` and `messages/ar` aligned.
- Load the project skills before writing (`/frontend`, `/i18n`, `/storybook`, …), as `CLAUDE.md` says.

## Gotchas found in this program

- **Typecheck and build** need an 8 GB heap: `--max-old-space-size=8192`. Two type errors existed before this program and are not ours:
  - `app/(auth)/login/page.tsx:162`
  - `src/features/users/ui/membership-lock-action.tsx:84`
- **Prisma:** if `@prisma/client` types go missing (another session adds models), run `npx prisma generate` in `web-admin`.
- **Line endings:** shell `sed`/`perl -0` can turn CRLF files into LF. Files that were fully CRLF in HEAD must stay CRLF; fix them with `perl -pi -e 's/\r?\n/\r\n/'`.
- **Jest:**
  - Tests live only under `web-admin/__tests__`.
  - Add `import '@testing-library/jest-dom'`.
  - The `@ui/feedback` barrel pulls ESM next-intl and breaks tests. Mock it with `jest.mock('next-intl', () => ({ useTranslations: () => (k) => k }))`, or import the specific file instead of the barrel.
- **Radix in jsdom** needs stubs for `hasPointerCapture`, `releasePointerCapture`, `scrollIntoView` and `ResizeObserver`. Open menus with `keyDown Enter`. Radix returns focus asynchronously, so assert it with `waitFor`.
- **Z-index:** popovers, selects and menus use `--cmx-z-popover` (1100, above dialogs). `CmxDialog` ignores an Escape that comes from inside `[data-cmx-select-root]`.
- **Badge API:** `CmxStatusBadge`.
  - `tone`: `neutral | info | success | warning | danger | brand`
  - `appearance`: `soft | outline | solid`; `solid` exists only for `brand` and `danger`.
  - The old `variant` and `showIcon` props are gone.
  - Order statuses map through `orderStatusTone()`.
- **Migration scripts** (`migrate-badge*.js`, `migrate-legacy.js`) were one-off scratchpad files and are gone. Their results are in the working tree.
- **Reading `node_modules`** is blocked by a deny rule. Don't work around it.
- **Inside `src/ui`, never import from the `@ui/feedback` barrel.** It loads next-intl, which jest cannot parse, so every test that touches `@ui/primitives` breaks. Import the file directly (`@ui/feedback/cmx-status-badge`).
- **Seven jest suites fail for reasons unrelated to this program.** All seven were already failing at PR-01:
  - 3 `cmx-dialog-*`
  - 3 `orders/payment/*`, which go through `cmx-dialog`
  - `order-financial-view.ui` (`common.close` missing in its fixture)

  Any other failure is new.
- **Codemod on a new folder (PR-05):** run without `--write` first and read the "by hand" lines. Classes in `isRTL` ternaries are reported, not rewritten: collapse each ternary to the non-RTL branch's logical class.
- **Editing files:** the Bash tool's heredocs eat backslashes in regexes and `\n`. Use the Edit/Write tools for code that contains backslashes.

## Not verified yet

- No screen has been checked in a real browser. The select inside dialogs, the top-bar menu and badge colours are proven only by jsdom tests. These are owner QA items.
