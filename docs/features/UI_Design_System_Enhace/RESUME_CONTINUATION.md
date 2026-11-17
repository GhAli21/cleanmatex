# UI Design System — Resume Here

**Written:** 2026-11-17, for the next session or assistant.
**Authority:** `THEMING_ARCHITECTURE_DESIGN.md` (design) → `STATUS.md` (package states) → `PLAN_PR-02.md` (current plan, its Progress table and Rulings). If this file disagrees with them, they win.

## Where things stand

- **PR-01:** implemented 2026-11-16, all 7 tasks. Waiting for owner QA (`QA_TEST_GUIDE.md` → PR-01) and commit.
- **PR-02:** running inline from `PLAN_PR-02.md`, approved 2026-11-16.
  - Tasks 1–5 are done (status tokens, `CmxStatusBadge`, badge migration, Radix select, top bar and permissions inspector moved out of `src/ui`).
  - Task 6 is done (legacy `Button`/`Card`/`Input`/`LoadingButton`/`FormInput`, `src/ui/components/` and `foundations/tokens.ts` deleted). Typecheck, ESLint and build pass.
  - Task 7 is done: `scripts/ui/codemod-classes.js` was applied to `src/ui`, and the guard test `__tests__/ui/foundations/no-raw-classes.test.ts` was added. Build passes. Details and rulings are in `PLAN_PR-02.md` → Progress row 7 and "Rulings made while executing".
  - Task 8 is done. `eslint.config.mjs` now bans raw colour and physical-direction classes: errors in `src/ui`, warnings in `src/features` and `app`. Full ESLint shows 0 errors. The warnings are PR-05's starting count; see plan row 8.
  - Task 9 is done (pagination text from `common.*`; the issues-dialog pill uses `text-primary-foreground`).
  - Task 10 is done (2026-11-17). PR-02 is complete; next package below.
    - Done: jest (143 suites pass, only the known 7 fail), ESLint, `check:i18n`, `QA_TEST_GUIDE.md` → PR-02, the migration guide and the feedback README.
    - Build attempt 1 (2026-11-17) failed outside PR-02: `ENOENT app/api/v1/products/[id]/image/route.ts`. Another session (File_Util) deleted that route while the build ran, and no source references it. Rerun the build; if it fails the same way, `.next` holds a stale route list, so run `node scripts/clear-next-cache.mjs` or delete `.next` when no build is running.
    - Build attempt 2 also failed outside PR-02 (`Cannot find module app/api/v1/tenants/me/logo/route.ts`, also deleted by the File_Util session). Results are written to `PLAN_PR-02.md` → Final review and to the `STATUS.md` PR-02 result. After the fixes: jest 143 pass / 7 known; ESLint 0 on changed files.
    - Build attempt 3 PASSED (exit 0, 338 pages). Task 10 DONE. PR-02 is implemented; owner QA (`QA_TEST_GUIDE.md` → PR-02) and commit are left.
    - (History) Left was: build (rerun), the fresh whole-change review (fix Critical/Important with a failing test first), and the `STATUS.md` result section.
    - Review DONE (2026-11-17). Fix pass in progress; each fix gets a test that fails first. Findings:
      - F1 FIXED: codemod test "rtl: or ltr:" and guard "no logical class under rtl:/ltr:" both went RED→GREEN. The codemod rewrote physical classes inside `rtl:`/`ltr:` variants (double flip). Affected: `cmx-datatable.tsx:761,765-766,831-832`, `cmx-dialog.tsx:395` (close X), `cmx-money-keypad.tsx:138`. Fix: plain logical classes plus `mapToken` reports these cases.
      - F2 FIXED: top-bar test "in Arabic the user menu is laid out right to left" went RED→GREEN. `cmx-top-bar.tsx` Radix `DropdownMenu` has no `dir`, so the menu is LTR in Arabic. Fix: `dir={isRTL?'rtl':'ltr'}` plus an RTL test.
      - F3 FIXED: status-tokens test "every colour class the badge uses is registered" went RED→GREEN. `bg-primary-bg` is not in `globals.css @theme`, so brand soft badges have no fill. Fix: register `--color-primary-bg` plus a test.
      - F4 FIXED: select test "picking an option does not click the row or card" went RED→GREEN. Clicks inside the open select bubble to a clickable parent row or card. Fix: stopPropagation on `SelectPrimitive.Content` plus a test.
      - Minors (deferred): select `itemCount` with a Fragment; language switcher uses info colours for selection; top bar menu icons have `me-2` on top of `gap-2`.
    - (Done) A fresh reviewer (most capable model) is reviewing all of PR-02, using the plan's Review Focus. If the session expires before its findings are recorded here, run the review again: one reviewer, read-only, scope = PR-02 files (the plan's task Files lists), ignoring other sessions' work in commits `488727a3`/`b77d9be7`.
- The owner committed the work through Task 7 in `488727a3` and `b77d9be7`. The owner commits; never commit or push.
- Typecheck shows 4 errors:
  - the 2 known ones
  - 2 from the owner's commit `b77d9be7`, in `app/api/navigation/route.ts:78` and `lib/services/fx/tenant-currency-profile.service.ts:137`

  None of the 4 come from this program. A full typecheck takes over 10 minutes; run it in the background.
- Other sessions run `next build` too. If a build says "Another next build process is already running", wait for that process (`Wait-Process -Id <pid>`). Don't kill it.

## Next steps, in order

1. **Task 10:** Run every check (ESLint, typecheck in the background, `check:i18n`, jest `__tests__/ui __tests__/lib __tests__/scripts __tests__/features/orders`, build), then stories (including the Task 7 visual check in light/dark × EN/AR: `CmxSidebar`, `CmxTopBar`, data grid and table, dialogs, checkbox, processing timeline), then one fresh whole-change review on the most capable model. Then the docs: `STATUS.md` result section, `QA_TEST_GUIDE.md` → PR-02, `.clauderc`, `docs/dev/ui-migration-guide.md`, `web-admin/src/ui/feedback/README.md`.
2. After each task, update its row in the `PLAN_PR-02.md` Progress table, and the `STATUS.md` PR-02 row.

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
