# UI Design System — Resume Here

**Written:** 2026-11-19, for the next session or assistant.
**Authority:** `THEMING_ARCHITECTURE_DESIGN.md` (design) → `STATUS.md` (package states) → `PLAN_PR-08.md` (current convergence & extra-config plan, its Progress table and Rulings). If this file disagrees with them, they win.

## Where things stand

- **DS-RULES (DONE 2026-11-19):** `PLAN_DESIGN_SYSTEM_RULES.md`. It covers:
  - the rules: `docs/dev/rules/cmx-design-system.md`;
  - the checker: `npm run check:ui` in web-admin;
  - the review skill `cmx-ui-design-review`, the same in `.claude/skills`, `.codex/skills`, `.agents/skills` and `.cursor/skills`, plus `.cursor/commands`.

  Antigravity skills were synced from Claude. The old grandfathered registry is archived in `docs/_archive/2026-11/grandfathered-objects/`. If you change the skill, change all four copies.

  Left: owner QA, commit, HQ copy (not started).

- **PR-08 (T1–T8 Done 2026-11-20 across both repos):** Following `PLAN_PR-08.md` (`T1–T8`) + `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-08-HQ.md` (`H1–H2`).
  - **T1–T5 Done (2026-11-19 / 2026-11-20):** Cmx component & page convergence, modal migrations (`FIXED_INSET0_COUNT=4`), and raw HTML burn-down (`CustomItemModal`, `OrderSummaryPanel`, settings/order labels, Waves 1–3C: `NON_FORM_COUNT=40` in production `app/` + `src/features/`, excluding `jhtestui`, `-rprt.tsx`, `/print/`, `payment-full-view.tsx`, `hidden`/`file`, `cmx-ds-ignore`).
  - **T6 Done (2026-11-20):** Migrations `0775_sys_tenant_extra_config_cf.sql` & `0776_org_tenant_extra_config_cf.sql` applied; Prisma synced; constants, Zod, pure resolver, cached server service, `/api/v1/settings/extra-config*` routes, formatter/table/`cmx-pos-touch-target` wiring, `/dashboard/settings/extra-config` UI, EN/AR i18n, access contract & navigation complete.
  - **T7 Done (2026-11-20):** BiDi `<bdi dir="ltr">` sweep across receipts/B2B/ERP/refunds/pickers/dashboard; `QA_TEST_GUIDE.md` (`P1`–`P10`) updated. `web-admin` checks: `tsc --noEmit` (0), `eslint . --quiet` (0), `check:i18n` (PASS), `check:ui` (189 files, 0 errors, 185 warnings), `check:platform-info-inventories` (PASS, drift 0, 2/2 suites, 10/10 tests), scoped Jest (92/92 suites, 770/770 tests), `npm run build` (exit 0, 0 warnings, 343/343 pages).
  - **T8 Done (2026-11-20, `cleanmatexsaas`):** `H1` (`platform-api` `ExtraConfigController`/`ExtraConfigService` — Jest 8/8, Nest build PASS) + `H2` (`platform-web` `/products-items-config/extra-config` + `PicHubScreen` card + EN/AR i18n — `check:i18n` PASS, `tsc --noEmit --incremental false` exit 0, scoped ESLint 0, Jest 2/2, `next build` 191/191 PASS). Left: owner manual QA (`P1`–`P10`) and commits across both repos.

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

0a. **Vercel build fix (2026-11-17, DONE; local build passed, 338 pages):** `app/layout.tsx` now uses `next/font/local` with the committed `app/fonts/noto-sans-arabic-arabic-wght.woff2` instead of `next/font/google`. A Google download failed the Vercel build. Record the local build result in `STATUS.md`, then go back to step 0.
0. **`PLAN_PR-07.md` (tasks 1–5) was APPROVED by the owner on 2026-11-17. Task 1 is done. Task 2 is done (0752 applied, Prisma pulled). Task 3 is done (0753 applied and verified on remote). Task 4 is done (0754 applied). Task 5 is done (0757 applied, constants synced, inventory rebuilt). Task 6 is done (resolver + loader; tests pass). Tasks 7–8 are done. Tasks 9–10 are done (branding screen; user appearance page). Tasks 1–11 are done. Task 12: HQ plan written at `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`, waiting for owner approval (code in the HQ repo only after approval). NOW at Task 13. Done: QA guide PR-07; typecheck (only 4 known errors); full jest (581/592; failures all pre-existing or known, plus 2 PR-02 test regressions fixed). ESLint (0 errors) and build (passed) DONE 2026-11-18. Review DONE and fix pass DONE 2026-11-18 (C1, I1, I2; details and deferred minors in PLAN_PR-07 row 13). Typecheck after fixes: only the 4 known errors. Task 13 DONE; PR-07 tasks 1–11 implemented. HQ plan APPROVED 2026-11-18 (rulings 1–7). HQ A1 + A2 DONE 2026-11-19 (after the engine move was committed in HQ `b454f0e`): appearance catalogs in HQ Products & Items Config. Details, rulings 8–11 and the check results are in the HQ plan's Progress table. Owner QA: `QA_TEST_GUIDE.md` → PR-07 HQ. Another session's uncommitted `file-util-config` module and `app.module.ts` edit in HQ are not ours. PR-04 plan APPROVED 2026-11-19 (owner delegated the open decisions; rulings 1–10 stand). OWNER FOLLOW-UP 2026-11-19 (do these BEFORE PR-04, in order): (1) HQ A3 DONE 2026-11-19 (API and web; results in the HQ plan → "Owner follow-up — A3"). HQ `platform-web` build after A3 PASSED (2026-11-19). (2) DONE 2026-11-19: `fonts_to_be_predefine.md` written (outline plan only, not approved, not started). Its brief was: pick well-known OFL fonts with Arabic coverage (for example IBM Plex Sans Arabic, Cairo, Tajawal, Almarai; Latin: Inter, Roboto, Noto Sans), bundle them with `next/font/local` like `app/fonts/noto-sans-arabic-arabic-wght.woff2`, add `html[data-font=<CODE>]` CSS (today `<html data-font>` is written but no CSS reads it), seed `sys_ui_font_pair_cd` with a migration, test in the tenant app (EN/AR, print, performance), and as the last step build a skill that runs the whole font process (define, add, update, deactivate). (3) PR-04 IN PROGRESS: ALL 5 TASKS DONE 2026-11-19 (PLAN_PR-04 rows 1–5; STATUS "PR-04 result"). Left: owner QA (QA_TEST_GUIDE → PR-04) and commit; build blocker FIXED (option B: 4 type errors fixed, `experimental` merged, `ignoreBuildErrors` stays false); typecheck 0 errors, build PASSED 2026-11-19. PR-05 IMPLEMENTED 2026-11-19 (owner amendment: "decide everything"; `PLAN_PR-05.md` rows 1–12 done, row 13 in progress). Fresh review done 2026-11-19 and its findings fixed (STATUS → PR-05 result → Fresh review); build: passed (`npm run build`, Next 16 webpack, 2026-11-19). Left: owner QA `QA_TEST_GUIDE.md` → PR-05 (D1–D17), commit. PR-07 task 6 must first fix print colours in forced dark mode (STATUS → PR-05 result). Then PR-07 task 6 (dark mode for users) is unblocked. **PR-07 task 6: `PLAN_PR-07-T6.md` APPROVED 2026-11-19 (ruling 6 = A, dark logo column). Task 6 waits until the File Util session has committed. Tasks 1–5 and 7 DONE 2026-11-19 (see the plan's Progress table); Task 1 fixed the print colours above. Tasks 6 and 8 DONE 2026-11-19 (0773 applied; review fixes in; STATUS → "PR-07 task 6 result"). PR-07 task 6 is COMPLETE in code; owner QA M1–M14 + commit. Follow-ups DONE 2026-11-19: reject badge contrast, User Preferences duplicate theme/density removed, toasts follow the mode, Appearance title translated. i18n sweep: `PLAN_I18N_SWEEP.md` WRITTEN 2026-11-19 (about 800 strings, 8 batches, lint guard folder by folder), WAITING for owner approval; then run it batch by batch (load `/i18n` + `/frontend`). After it: PR-07 M1–M5, then the owner decides PR-03/PR-06. Old next step was Task 8 (fresh reviewer, STATUS result section, `PR-07_FEATURE_REFERENCE.md`). Owner QA: `QA_TEST_GUIDE.md` → "PR-07 task 6" (M1–M12).** Follow-ups: i18n sweep of ~20 hardcoded English strings (STATUS → PR-05 result); a breadcrumb component if wanted. Execute `PLAN_PR-04.md` inline, loading `/frontend`, `/i18n` and `/order-fin` (read-only money display) first. Next: owner QA PR-07 + commit; then write `PLAN_PR-04.md` and get it approved (program order PR-04 → PR-05 → PR-07 task 6). Feature reference doc written: `PR-07_FEATURE_REFERENCE.md`. Left after that: the reviewer findings, i.e. ONE fresh reviewer (most capable model, read-only, scope = PR-07 files per the plan task rows, using the plan Review Focus), fix Critical/Important with a failing test first, then STATUS PR-07 result section + feature docs.**

1. **Task 10:** Run every check (ESLint, typecheck in the background, `check:i18n`, jest `__tests__/ui __tests__/lib __tests__/scripts __tests__/features/orders`, build), then stories (including the Task 7 visual check in light/dark × EN/AR: `CmxSidebar`, `CmxTopBar`, data grid and table, dialogs, checkbox, processing timeline), then one fresh whole-change review on the most capable model. Then the docs: `STATUS.md` result section, `QA_TEST_GUIDE.md` → PR-02, `.clauderc`, `docs/dev/ui-migration-guide.md`, `web-admin/src/ui/feedback/README.md`.
2. After each task, update its row in the `PLAN_PR-02.md` Progress table, and the `STATUS.md` PR-02 row.

After PR-02, the recommended order is PR-07 tasks 1–5 → PR-04 → PR-05 → PR-07 task 6. Write `PLAN_PR-0N.md` just before each package and get owner approval first.

## Rules for this program (owner's, still in force)

- UI work follows `docs/dev/rules/cmx-design-system.md`. Before done: `npm run check:ui` and `/cmx-ui-design-review`.

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

- Design system rules (2026-11-19): the `CmxFormActions` / `CmxFormSection` colour fixes were not seen in a browser (light or dark). The checker's UI008 English-text heuristic can flag TypeScript generics on one line; when a reason is real, mark the line with `cmx-ds-ignore UI008: <reason>`.

- 2026-11-19 "Mine, smaller" items (PR-07 M1–M5, sign-in dark logo, legend rule, contrast, 3 dialog suites) are done; details in `STATUS.md` → "Mine, smaller". Not built again after them. Remaining for me: the i18n sweep (plan waiting for approval), the breadcrumb (optional), font pairs (owner decision). QA rows M19–M21 added.
- No screen has been checked in a real browser. The select inside dialogs, the top-bar menu and badge colours are proven only by jsdom tests. These are owner QA items.
