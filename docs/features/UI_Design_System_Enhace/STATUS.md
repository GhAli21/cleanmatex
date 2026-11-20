# UI Design System and Theming — Status

**Last update:** 2026-11-19
**Current document:** `THEMING_ARCHITECTURE_DESIGN.md` (approved by owner 2026-11-16). It wins over any PR file on conflict.
**Plans:** one per package, written just before that package starts. `PLAN_PR-01.md` is executed (see its Progress table and Rulings).
**Code written so far:** PR-01 and all of PR-02 (the owner committed through PR-02 Task 7; the rest is uncommitted). No migration written.
**Resume here:** `RESUME_CONTINUATION.md` (handoff for the next session or assistant).

## Packages

| Package | What | Depends on | State |
|---|---|---|---|
| PR-01 | Tokens, fonts, `cn()` merge, RTL and accessibility fixes in shared components | — | **Implemented 2026-11-16 (all 7 tasks), owner QA pending** |
| PR-02 | Badges, select, remove duplicate components, lint rules | PR-01 | **Implemented 2026-11-17 (all 10 tasks), owner QA pending** (`PLAN_PR-02.md`) |
| PR-07 | Theme tables, resolver, branding and appearance screens, HQ catalogs | PR-02 (dark mode also PR-05) | **In progress** (`PLAN_PR-07.md`, approved 2026-11-17). Tasks 1–4 done (0752–0754 applied); Tasks 1–5 done (migrations 0752, 0753, 0754, 0757 applied); Tasks 6–9 done (resolver; layout and login brand; public readers; branding screen with saved themes); Task 10 done (user appearance page); Tasks 1–11 done (migrations 0752, 0753, 0754, 0757, 0759 applied); Task 12 HQ plan approved 2026-11-18; **HQ A1 + A2 implemented 2026-11-19** (appearance catalogs in HQ Products & Items Config; `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`); Task 13 (verification, review, docs) done 2026-11-18; owner QA and commit left in both repos (HQ package B is separate). **Task 6 (dark mode): `PLAN_PR-07-T6.md` approved 2026-11-19 (ruling 6 = A). Tasks 1–5 and 7 done 2026-11-19 (print stays light, mode follows the person, Appearance choice, charts, paper previews, sweep); Tasks 6 and 8 done 2026-11-19 (0773 applied; fresh review done and fixed). Owner: QA M1–M14 and commit. PR-03 and PR-06: owner decides after everything else is done (2026-11-19)** |
| PR-05 | Page shell; colour and direction class migration, folder by folder | PR-02 (orders after PR-04) | **Implemented 2026-11-19** (`PLAN_PR-05.md`, approved with the owner amendment "decide everything"). Codemod v2 decides every case (0 left for a person); 573 files migrated; global RTL hacks and old aliases deleted; `Alert` removed; lint rules at `error` everywhere; ESLint 0 errors, typecheck clean, jest only the 7 known failures. Fresh review done and its 5 real findings fixed; build: passed (`npm run build`, Next 16 webpack, 2026-11-19). Left: owner QA (`QA_TEST_GUIDE.md` → PR-05), commit |
| PR-04 | POS touch targets and keyboard shortcuts | PR-01 | **Implemented 2026-11-19 (all 5 tasks), owner QA pending**; build PASSED 2026-11-19 after the `next.config.ts` fix (option B), see the PR-04 result (`PLAN_PR-04.md`). Tasks 1–4: (orders list on `CmxPagination` with tabular numbers; customer picker on `CmxDialog`; summary panel: Cmx buttons and switch, touch size, logical layout; POS hotkeys `/ F2 F9 Ctrl+Enter ?` and a cheat sheet, all off while a dialog is open) |
| PR-08 | Feature convergence, table density, modal hygiene, extra tenant config (`sys_tenant_extra_config_cf` / `org_tenant_extra_config_cf`), BiDi, HQ catalog | PR-04, PR-05, PR-07 | **In progress** (`PLAN_PR-08.md`). **T1 Done**, **T2 Done**, **T3 Done**, **T4 Done (2026-11-19):** all hand-rolled feature modals migrated onto `CmxDialog` / `CmxConfirmDialog` and drawers (`ExplainDrawer`, `GlJournalDetailPanel`, `OrderSummaryBottomSheet`) hardened with `useFocusTrap`+`Escape`+scroll-lock; ESLint 0, `check:ui` 0 errors, Jest `__tests__/ui/` 41/41 suites (291/291 tests). **T5 In progress** (5.1 `order-summary-panel.tsx` done & verified). |
| DS-RULES | Design system rules file, `npm run check:ui`, `cmx-ui-design-review` skill in Claude, Codex, Cursor and Antigravity; old grandfathered registry archived | — | **Done 2026-11-19** (`PLAN_DESIGN_SYSTEM_RULES.md`; result section below). Left: owner QA (`QA_TEST_GUIDE.md` → "Design system rules" + M22), commit |
| PR-03 | Zod validation at boundaries | — (independent track) | Not started |
| PR-06 | Server-component boundaries; cache only if measured | — (independent track) | Not started |

**Recommended order:** PR-01 → PR-02 → PR-07 tasks 1–5 → PR-04 → PR-05 → PR-07 task 6 (dark mode). PR-03 and PR-06: the owner decides whether they stay in this program after all other work is done (2026-11-19).

## Decisions (2026-11-16)

- Server-resolved CSS tokens; brand colours computed on the server, so theming needs no newer browser than the app already does.
- HQ publishes themes in `sys_ui_theme_cd`; `STANDARD` is the default and every Organization uses it until it chooses another.
- Organization themes in `org_tenant_ui_theme_dtl`; user preferences on `sys_users_mst`.
- UPPERCASE codes and values everywhere.
- Logo and brand colours move off `org_tenants_mst`; `brand_color_accent` is dropped.
- Splitting `payment-full-view.tsx` is removed from PR-04 and belongs to its own Order Fin package.

- Default table page size becomes 10 (was 5); tables keep their existing per-call size options.
- `app/dashboard/jhtestui` is kept and migrated last.
- `@radix-ui/react-select` approved for the Cmx select wrapper.

- `@mdi/font` stays: catalog icons are stored in the database as MDI class names.
- The colour function moves from PR-07 into PR-01, so the static `STANDARD` values and the per-Organization values come from one source.
- `STANDARD` buttons are aqua with dark text (white on aqua is not readable).

## PR-01 result (2026-11-16)

- Every `--cmx-*` variable the code uses is now defined, in `web-admin/src/ui/foundations/tokens.css`, generated from `web-admin/lib/theme/brand-palette.ts` (the same function PR-07 will run per Organization). Light, dark and system-dark blocks; density and font-scale blocks; print forces light.
- Arabic font self-hosted via `next/font`; no request to Google Fonts at runtime.
  - **Changed 2026-11-17:** the Vercel build failed inside `next/font/google` (`TypeError: Cannot read properties of null (reading '1')`): a font download from Google at build time came back in a form Next could not parse. The font is now committed (`web-admin/app/fonts/noto-sans-arabic-arabic-wght.woff2`, the arabic subset, variable weight 400–700, with its OFL licence) and loaded with `next/font/local`. The build no longer needs Google Fonts at all. Local `npm run build` with the local font passed (compiled, 338/338 pages, exit 0).
- Shared components: logical spacing, RTL chevrons and pagination arrows, translated pagination labels, confirm dialog with focus trap and Escape, wizard confirm without `window.confirm`, badge role removed, input ids from `useId`, default page size 10.
- Brand colour used as text now reads `--cmx-primary-text-rgb` (readable on white); focus rings read `--cmx-focus-ring-rgb`. Primary buttons have dark text on aqua.
- Final review by a fresh reviewer: 4 Important findings fixed (unreadable info banners, `text-primary` low contrast, Escape cancelling a running confirm, closed confirm unlocking page scroll); 5 Minor deferred, listed in `PLAN_PR-01.md` → Final review.
- Checks: brand-palette 61 tests, token guard 5, confirm dialog 8, input id 2 — all pass. ESLint clean on changed files, `check:i18n` passes, `npm run build` passes. Full jest: 9 suites fail, all judged unrelated (detail in `PLAN_PR-01.md` → Rulings).
- `cn()` now merges with `tailwind-merge`, so a `className` passed to a Cmx component overrides that component's conflicting default (for example `px-4` beats `px-2`). The owner repaired the npm install on 2026-11-16. Test `cn` 4/4; build passes.

- Owner QA steps: `QA_TEST_GUIDE.md` → PR-01.

## PR-02 result (2026-11-17)

- **One badge:** `CmxStatusBadge` with 6 locked tones (`neutral info success warning danger brand`). About 127 callers were moved. Order statuses map to 5 tones through `orderStatusTone()`. The legacy `Badge` is deleted.
- **Select:** `CmxSelectDropdown` is built on Radix Select. Its list is portalled above dialogs, and Escape closes only the list. The empty value works. It supports keyboard and RTL.
- **Removed duplicates:** legacy `Button`, `Card`, `Input`, `LoadingButton`, `FormInput`, `src/ui/components/` and `foundations/tokens.ts`. The top bar and permissions inspector moved out of feature imports. The top bar's dead search box is removed, and its user menu is a real menu.
- **Classes:** `src/ui` uses theme tokens and logical (RTL-safe) classes only. A guard test and ESLint (errors in `src/ui`, warnings in `src/features` and `app`) keep it that way. `scripts/ui/codemod-classes.js` is ready for PR-05. PR-05 starts from 5,974 colour warnings, 1,796 direction warnings and 50 `Alert` imports.
- **Pagination text** comes from `common.*` in both languages.
- **Final review by a fresh reviewer:** 4 Important findings fixed, each with a test that failed first: Arabic double-mirroring from the codemod, the top bar menu LTR in Arabic, brand badges without a tint, and a select pick clicking the row behind it. 3 Minor deferred. Details are in `PLAN_PR-02.md` → Final review.
- **Checks:**
  - jest (`ui lib scripts features/orders`): 143 suites pass. 7 fail, all on PR-01's known list.
  - Full ESLint shows 0 errors; `check:i18n` passes.
  - Build: passed after Task 7. Passed again after the review fixes (third attempt; the first two failed because another session deleted routes during the build).
- Owner QA steps: `QA_TEST_GUIDE.md` → PR-02.

## PR-04 result (2026-11-19)

- **Summary panel:** the steppers, customer buttons, ready-by buttons and Submit are now `CmxButton`; Submit follows the theme colour. Targets are 44px on touch screens only. Notes use `CmxSwitch`. The layout is logical, with no Arabic double flip. Numbers use `<bdi class="tabular-nums">`.
- **Shortcuts:** `/` search, F2 customer, F9 pay, Ctrl/⌘+Enter or Ctrl+S submit (Review in the workspace), Alt+1…5 tabs, `?` (or Arabic `؟`) shows the list. All of them go through the existing submit gate, and they are off while any dialog is open. There is one listener, plus a pure resolver.
- **Customer picker** is on `CmxDialog`. Escape now works with no results, skeleton rows show while it searches, and focus returns to the opener.
- **Orders list** pages with `CmxPagination` (no page-size box) and shows tabular numbers.
- **Final review (fresh reviewer):** 3 Important findings fixed, each with a test that failed first:
  - F9 or Ctrl+Enter could open payment with no ready-by; one rule (`readyByBlockReason`) now serves the button and the gate;
  - Ctrl+S under a dialog opened the browser's Save Page;
  - `?` failed on the Arabic layout.
  
  4 Minor findings are deferred (`PLAN_PR-04.md` row 5).
- **Checks:**
  - ESLint: 0 errors.
  - `check:i18n`: passes.
  - jest orders + ui: only the 7 known suites fail.
  - typecheck: the 4 known errors, plus `next.config.ts` from another session.
  - build: compiled, then the type-check gate failed on those same errors, because another session's uncommitted `next.config.ts` edit turned `ignoreBuildErrors` off. Rerun once that edit is settled.
  - **Build blocker FIXED 2026-11-19 (owner option B):** kept `ignoreBuildErrors: false`; fixed the 4 known type errors (`types/auth.ts` signIn returns `| undefined`; flat `CurrencyMinorUnitResult` + `rows ?? []` guard; `new Set<string>` in `api/navigation/route.ts`; `membership-lock-action.tsx` confirm returns void) and merged the two `experimental` blocks in `next.config.ts`. Typecheck: 0 errors. `npm run build`: PASSED.
- Owner QA: `QA_TEST_GUIDE.md` → PR-04. Shortcut reference: `PR-07_FEATURE_REFERENCE.md` → POS keyboard shortcuts.

## PR-05 result (2026-11-19)

- **One pass, every folder.** The owner asked for every decision to be made by rule, not left to a person. `scripts/ui/codemod-classes.js` v2 applies rulings 15 (colour) and 16 (direction) of `PLAN_PR-05.md` and leaves nothing to decide by hand; v1 reported 2,373 cases and 1,290 ternaries. It changed 517 feature and page files, 53 `src/ui` files and 3 `lib` files, and a second run changes nothing.
- **Real Arabic bugs fixed on the way:**
  - The global `[dir="rtl"]` rules were unlayered, so they beat Tailwind. `isRTL ? 'text-right' : 'text-left'` (520 places) therefore aligned left in Arabic.
  - `CmxCopyableCell` `align` ternaries mirrored twice (27 places + 3 files).
  - Inputs were forced to `direction: rtl`, overriding `dir="ltr"` on money fields.
  - `text-center` was ignored on buttons.
  - Every `p`/`div` got `line-height: 1.8`, which beat `leading-*`.
  - `${isRTL && …}` printed "false" into class lists.
  - Modal backdrops were solid gray, because `bg-opacity-*` does not exist in Tailwind v4.
  - The sidebar forced `dir="ltr"` and mirrored itself by hand.
- **Shared parts:**
  - `CmxCrudPageShell` is the workspace frame, used by orders, GL and customers.
  - `CmxListWithFilters` and `Alert` were deleted.
  - `CmxSummaryMessage` takes free content and uses the locked status tones.
  - `DropdownMenu` and `CmxTabs` follow the page direction.
  - The new token `on-solid` is for white text or lines on saturated fills.
- **Guards:**
  - ESLint class rules are errors in `src/ui`, `src/features`, `app` and `lib`.
  - `no-raw-classes.test.ts` covers the same folders.
  - `globals-css.test.ts` keeps the direction hacks and aliases out.
- **Fresh review (2026-11-19):** Fresh read-only review (Review Focus 1–5) done 2026-11-19; its findings, each checked against the code: (1) delivery manifest header title and eyebrow were white/muted on `bg-foreground` (unreadable in dark mode) → `text-background`, `text-background/70`; (2) white text or icons on solid amber (about 3.2:1 light, 1.7:1 dark) → new token `--color-warning-foreground` (near-black) and a codemod rule (`text-white` on a yellow/amber/orange 400+ fill), 6 places + the customer stats icons fixed; (3) `DropdownMenuSubTrigger` chevron now `rtl:rotate-180`; (4) 20 files had hand-written `rtl:flex-row-reverse` / `rtl:space-x-reverse` from before PR-05, which put rows back in English order in Arabic → codemod rule drops them, plus 4 `dir === 'rtl' && 'flex-row-reverse'` in `CmxDataGrid` (its root already sets `dir`); (5) language switcher rows each take their own language direction (`dir="ltr"` / `dir="rtl"`) instead of a hard-coded reverse; (6) print in forced dark mode keeps brand and status tints, which was already the case before PR-05, so it is handed to PR-07 task 6. Codemod tests 82/82 with the new rules red first. The review found no broken code from the codemod, no physical classes left, and the `CmxSummaryMessage` and `CmxCrudPageShell` changes clean. 
- **Hotfix after release (2026-11-19, uncommitted):** on desktop the sidebar was invisible (its space stayed empty) on cmx.cleanmatex.com. Cause: the codemod turned the mobile slide-off into `ltr:-translate-x-full rtl:translate-x-full`; Tailwind writes `ltr:`/`rtl:` rules after `lg:` rules with the same weight, so `lg:translate-x-0` lost and the sidebar stayed slid off. Same bug in the payment view receipt rail (`xl:`). Fix: the slide sits under `max-lg:` / `max-xl:` and the breakpoint reset is gone (`cmx-sidebar.tsx`, `payment-full-view.tsx`). Guard `__tests__/ui/foundations/off-canvas-direction.test.ts` (red on the old sidebar, green now). Build passed 2026-11-19. Owner: commit and redeploy.
- **For PR-07 task 6 (dark mode for users):** the `@media print` block in `globals.css` resets only the neutral tokens with `:root, [data-mode]`. Brand tokens from `theme-style.ts` and the status `-bg`/`-text` tokens keep their dark values on paper when the screen is dark. Give print its own light values for those before dark mode is offered.
- **Not in this package:** about 20 hardcoded English strings found during the `Alert` move (for example "Error", "Verified", the register trial messages). That needs a separate i18n sweep. There is also no `src/ui` breadcrumb component yet.

## PR-07 tasks 1–11 result (2026-11-18, final review pending)

- **Themes from the database:** HQ catalogs (0752), Organization saved themes with one in use (0753), user appearance (0754), plan flags `custom_branding` / `white_label` (0757), old brand-colour columns dropped (0759). All applied by the owner.
- **One theme per request:** the server picks the theme once, before the page renders (HQ theme, then Organization overrides if the plan allows them, then user preferences), so there is no flash of the wrong colours. A plain `STANDARD` Organization gets no extra CSS.
- **Screens:**
  - Settings → Branding: logos plus saved themes (new, edit, use, delete), with a live preview and a notice when a colour is darkened to stay readable.
  - User menu → Appearance: density and text size, stored on the user.
- **Sign-in page** shows the last Organization's logo and colours from a validated cookie.
- **Public readers** (customer app, public order page) take their colour from the theme.
- **Checks:**
  - typecheck: only the 4 known errors;
  - full jest: 581/592, every failure pre-existing or known;
  - full ESLint: 0 errors;
  - `check:i18n`: passes;
  - build: passed.
- **Final review (2026-11-18), fresh reviewer:** 1 Critical and 2 Important findings, all fixed with a test that failed first:
  - after sign-in, sign-out or switching Organization the page kept the previous person's text size, density, colours and logo until a reload; these now do a full page load;
  - switching the theme while another person deleted the target could leave no theme in use; it now rolls back;
  - after a plan downgrade, any edit erased the stored colours and app name; they are now kept for an upgrade.
  - 7 Minor deferred (list in `PLAN_PR-07.md` row 13).
- Reference: `PR-07_FEATURE_REFERENCE.md`. Owner QA: `QA_TEST_GUIDE.md` → PR-07.

## PR-07 task 6 result — dark mode for users (2026-11-19)

- **Done (Tasks 1–8, `PLAN_PR-07-T6.md`):**
  - paper is always light;
  - the mode follows the person (Appearance: Light, Dark, Same as this device);
  - charts read tokens;
  - print previews are forced light;
  - the dark sweep;
  - the dark logo (`0773` applied by owner; File Util publishes `logo_dark_url`; the sidebar swaps by CSS).
- **Hotfix in the same work:** the sidebar and the payment rail disappeared on desktop (Tailwind emits `ltr:`/`rtl:` after `lg:`); now `max-lg:`/`max-xl:`. Committed in 8bd3c368; owner redeploys.
- **Fresh review:** no Critical. 2 Important fixed (sign-in page white wash and borders; light paper text colour) plus the dark-only logo. Deferred Minor in the plan row 8.
- **Checks:** typecheck 0, ESLint 0; foundations + theme 116/116; File Util service 30/30; build passed 2026-11-19 (with the review fixes).
- **Follow-ups done after the review (2026-11-19):**
  - Reject badge: text colour picked by contrast (`readableTextOn` in `lib/theme/brand-palette.ts`), not fixed white.
  - User Preferences: removed the Theme and Display Density dropdowns (`user.theme` / `user.density`, read by nothing); a card links to Appearance.
  - Toasts follow the mode.
  - Appearance page title translated (PR-07 M6 part).
  - PR-07 M7 closed (`ui_color_mode` is used now).
  - Checks: tests green, typecheck 0, ESLint 0, `check:i18n` passed, build passed 2026-11-19.
- **Still open, separate work:**
  - i18n sweep: measured about 800 English-only strings in about 100 files (682 text strings + about 120 props + 18 feedback calls, without the `jhtestui` developer page). Plan `PLAN_I18N_SWEEP.md` written 2026-11-19, waiting for owner approval.
  - The breadcrumb component (optional, not started).
- **"Mine, smaller" items done 2026-11-19** (owner asked for all):
  - M1: a lost race in "Make active" returns 409 `SWITCH_CONFLICT` with a message in the screen (EN/AR), not 500. Test first.
  - M2: an edit that keeps a theme's stored HQ codes is no longer refused when HQ has since deactivated them; a different code is still checked. Test added.
  - M3: not measurable without the running app. `writeLastBrandCookie` now logs a warning when the theme read takes over 300 ms, so real use shows it.
  - M4: left as is. It is already a marked shortcut (parallel reads, a customer has a handful of Organizations); batching needs the shared theme read reworked.
  - M5: closed. No Organization has a logo yet (remote check: 0 of 0), and File Util is the only writer and always writes a public-storage URL.
  - Sign-in page now shows the dark logo (cookie field `logoDark`, optional so old cookies still read; same CSS swap as the sidebar).
  - Logout error path: closed. If sign-out fails the person is still signed in as themselves, so keeping their mode is correct.
  - Chart legend text now reads the foreground token (`.recharts-legend-item-text`), with a test.
  - Contrast of the seeded theme pairs: all 10 in migration 0752 pass 4.5:1 in both modes (`__tests__/lib/theme/seeded-theme-contrast.test.ts`). The "nine" in the old note was ten.
  - Tailwind v4 minimum browsers, from Tailwind's v4 documentation (not re-fetched today): Safari 16.4, Chrome 111, Firefox 128.
  - Pre-existing failures: the 3 `cmx-dialog` suites now pass (they needed a `next-intl` stub). The payment and order-financial-view suites pass now too. Typecheck is 0 errors (needs `NODE_OPTIONS=--max-old-space-size=8192`). Still failing, outside this program: `auth/request-permission-auth` and `security/api-route-auth-guard`.
  - Not done: font pairs to seed (needs the owner's licence and Arabic-coverage decision; outline in `fonts_to_be_predefine.md`). The two stray build logs were deleted.
  - Checks: ESLint 0 on touched files, `check:i18n` passed, jest 226 suites / 2532 tests (theme, services, foundations, overlays, auth-session, settings). The `npm run build` after these edits passed (exit 0, 2026-11-19).
- **Owner:** QA `QA_TEST_GUIDE.md` → "PR-07 task 6" M1–M22, then commit.

## Design system rules, checker and review skill (2026-11-19)

- **Rules file:** `docs/dev/rules/cmx-design-system.md` is now the one source for web-admin UI: tokens with meanings, dark mode and paper, RTL, size/layers, which component, states, a11y, numbers/codes, text, charts, changing `src/ui`, ignore markers, how to check, how to fix, debt baseline, done list.
- **Checker:** `npm run check:ui` (`web-admin/scripts/ui/check-design-system.js`). It covers the rules ESLint does not: UI001 raw form/table elements, UI002 legacy feedback, UI003 hex, UI004 `dark:`, UI005 page-level z-index, UI006 arbitrary colour classes, UI007 hardcoded page size (all errors), and UI008 English JSX text (a warning). It checks the changed files by default, or `-- --all`. Test: `__tests__/scripts/check-design-system.test.ts` (20/20).
- **Review skill:** `/cmx-ui-design-review` (`.claude/skills/cmx-ui-design-review/SKILL.md`). It picks the target, runs the tools, reads the code for what the tools miss, and reports by severity with file:line and the fix. Fix mode runs only when asked.
- **Wired into:**
  - `CLAUDE.md` (rule 17 and the skill table) and `AGENTS.md`;
  - the frontend skill (`SKILL.md`, `standards.md`, `ui-blueprint.md`, `uiux-rules.md`);
  - `.cursor/rules/cmx-design-system.mdc` (new), plus `uiuxrules.mdc`, `aicoderfrontendinstructions.mdc`, and a banner on `frontendnextjsrules.mdc`;
  - `docs/dev/rules/README.md` and `cmx-shared-components.md`;
  - `claude-md-reference.md`, `.claude/skills/README.md`, `web-admin/.clauderc` and `ui-migration-guide.md`.
- **Follow-up (2026-11-19, owner):**
  - The skill was renamed from `/ui-design-review` to `/cmx-ui-design-review` (folder and every reference).
  - The Codex skills are in step: `.codex/skills/frontend` (SKILL, standards, ui-blueprint, uiux-rules), a copy of `cmx-ui-design-review`, and pointers in `storybook`, `feature-implementation`, `code-review` and the README.
  - The Claude `implementation` and `storybook` skills now point to the rules too.
  - The same updates are in all four tools: Claude (`.claude/skills`), Codex (`.codex/skills`), Antigravity (`.agents/skills`) and Cursor (`.cursor/rules/cmx-design-system.mdc`, `.cursor/skills/cmx-ui-design-review`, `.cursor/commands/cmx-ui-design-review.md`).
  - Antigravity `frontend`, `implementation`, `storybook` and `README` were old copies from 29 Oct, now in step with Claude.
  - `AGENTS.md`, which Codex and Antigravity read, already carries the rule.
  - All Antigravity skills synced from Claude (2026-11-19, owner):
    - 30 out-of-date files updated in 20 skills;
    - `file-util-wire` added;
    - `database/grandfathered-objects.md` renamed to `xx…` as in Claude; later (same day, owner) all 6 copies of the old grandfathered-objects registry moved to `docs/_archive/2026-11/grandfathered-objects/` (README there), and every active link was replaced by "take the name from the live DB or `schema.prisma`";
    - `source-command-cmx-ui-design-review` added (the Cursor command's wrapper).
    - The 4 `source-command-*` skills were already in step with `.cursor/commands`.
    - Where an Antigravity file looked newer, it was a bad word swap (`@.Codex/skills/…`, `docs/dev/Codex/prompts`, a path that does not exist), so Claude was taken.
- **Stale guidance removed:**
  - `text-left rtl:text-right` and `ml-4 rtl:mr-4` examples (now ESLint errors);
  - `class="dark"` / `data-accent` theme attributes (replaced by `data-mode`/`data-density`/`data-font-scale`);
  - `CmxFieldLabel`, which never existed (now `CmxFormField` / `CmxFieldShell` / `Label`).
- **Real bugs the first full run found in `src/ui`, fixed:**
  - `CmxFormActions` had a fixed white `rgba(255,255,255,0.94)` background in dark mode → `bg-card/95`;
  - `CmxFormSection` status gradients used fixed blue/green/amber/red → `from-primary/15`, `from-success/15`, `from-warning/15`, `from-destructive/15`.
  - `src/ui` now has 0 checker errors (3 warnings: the sr-only "Loading...", the sidebar version string, and "English" in the language switcher, which is intended).
- **Debt baseline** (old code, the whole app): UI001 552, UI002 20, UI003 88, UI005 9, UI007 1, UI008 294 warnings. New code adds none; touched lines get fixed.
- **Not done:** HQ (`cleanmatexsaas`) has no copy of the rules or the skill yet; there is no shared chart series palette (chart hex colours are debt); nothing seen in a browser.

## Open

- PR-01 owner QA (`QA_TEST_GUIDE.md`) and commit.
- PR-02: owner QA (`QA_TEST_GUIDE.md` → PR-02, including the Storybook check) and commit.
- PR-07: owner QA (`QA_TEST_GUIDE.md` → PR-07 and PR-07 HQ) and commit in both repos.
- HQ A3 (owner follow-up 2026-11-19): corner sizes from a list and every refusal as a field message. Done (API + web, tests pass, HQ build passed 2026-11-19). Fonts outline plan written: `fonts_to_be_predefine.md` (later package, not started).
- PR-04: implementation (plan approved 2026-11-19), after A3 and the fonts plan.
- Pre-existing, not from this program: jest `auth/request-permission-auth` and `security/api-route-auth-guard` still fail (the type errors and the other 7 suites are fixed, see above).
- Font pairs to seed (licence and Arabic coverage check; owner decision).

## PR-08 result (2026-11-20 — T1–T8 Done across both repos)

- **T1 Done:** `CmxWizard` localized, `CmxPagination`/`CmxKpiStatCard` `tabular-nums`, pagination touch target (`cmx-pos-touch-target` + `pointer-coarse`), `CmxDataTable` logical `align`, density `--cmx-row-h`/`--cmx-cell-px` wired into data tables/grids.
- **T2 Done:** `DashboardContent` `tabular-nums` + `<bdi>`, `OrderStatsCards` Lucide icons, `CmxMoneyText` & `OrderWorkspaceScreen` semantic tokens (`text-warning-text`/`text-success-text`/`text-info-text`).
- **T3 Done:** `OrdersSimpleTable`, `GlInquiryTable`, `UserRolesTab`, and `app/dashboard/b2b/{customers,contracts,statements}` converged onto `CmxCrudPageShell` + `CmxDataTable` + `CmxStatusBadge`.
- **T4 Done:** Non-shell feature `fixed inset-0` modals migrated onto `CmxDialog`/`CmxConfirmDialog` + `Cmx*` controls (`FIXED_INSET0_COUNT=4` in production JSX scan); focus-trap/Escape/scroll-lock added to `OrderSummaryBottomSheet`, `ExplainDrawer`, `GlJournalDetailPanel`.
- **T5 Done + Final Raw HTML Burn-Down:** `OrderSummaryPanel`, `CustomItemModal`, settings/order labels & Waves 1–3C raw controls converted to Cmx primitives (`NON_FORM_COUNT=40` in production `app/` + `src/features/`, excluding `jhtestui`, `-rprt.tsx`, `/print/`, `payment-full-view.tsx`, `hidden`/`file` inputs, `cmx-ds-ignore`, well below `< 50` target).
- **T6 Done:** [0775_sys_tenant_extra_config_cf.sql](file:///f:/jhapp/cleanmatex/supabase/migrations/0775_sys_tenant_extra_config_cf.sql) & [0776_org_tenant_extra_config_cf.sql](file:///f:/jhapp/cleanmatex/supabase/migrations/0776_org_tenant_extra_config_cf.sql) applied; Prisma schema pulled; `tenant-extra-config` constants/Zod/pure resolver/cached server service (`catalogReadClient` + explicit `tenant_org_id`), `/api/v1/settings/extra-config*` routes, formatter/table/`cmx-pos-touch-target` wiring, `/dashboard/settings/extra-config` list-assisted UI, EN/AR i18n, access contract & navigation complete.
- **T7 Done:** BiDi `<bdi dir="ltr">` sweep across receipts/B2B/ERP/refunds/pickers/dashboard; [QA_TEST_GUIDE.md](file:///f:/jhapp/cleanmatex/docs/features/UI_Design_System_Enhace/QA_TEST_GUIDE.md) updated (`P1`–`P9`). Final verification after last edit: `npm run typecheck` (exit 0), `npx eslint . --quiet` (exit 0), `npm run check:i18n` (PASS), `npm run check:ui` (189 files, 0 errors, 185 pre-existing UI008 warnings), `npm run check:platform-info-inventories` (PASS, drift 0, 2/2 suites, 10/10 tests), scoped Jest (92/92 suites, 770/770 tests; excludes 4 pre-existing unrelated `orders/payment/*` & `order-financial-view.ui` suites), and `npm run build` (exit 0, 0 CSS/import warnings, 343/343 pages).
- **T8 Done:** Implemented `cleanmatexsaas` HQ catalog management per `PLAN_PR-08-HQ.md` (`H1` `platform-api` `ExtraConfigController` / `ExtraConfigService` with `extra-config.service.spec.ts` 8/8 passed + Nest build PASS; `H2` `platform-web` `/products-items-config/extra-config` `HqExtraConfigScreen` + `HqExtraConfigEditorDialog` with list-assisted default picker, bilingual `allowed_values_json` builder, org usage dialog, deactivate warning, hub card on `PicHubScreen`, EN/AR i18n, `check:i18n` PASS, `tsc --noEmit --incremental false` PASS, scoped ESLint 0, `hq-extra-config-screen.test.tsx` 2/2 passed, Next `build` 191/191 PASS). Left: owner manual QA (`P1`–`P10` in [QA_TEST_GUIDE.md](file:///f:/jhapp/cleanmatex/docs/features/UI_Design_System_Enhace/QA_TEST_GUIDE.md)) & commits in both repos.

## Post-Deploy Priority 1 & Priority 2 Fixes (2026-11-21 — Retest r5 / r6 Triage)

- **Priority 1 (Live Errors & 500s) — Done & Verified:**
  - **`P9` Read-only `/dashboard/settings/extra-config` (`cleanmatex`):** [tenant-extra-config-http.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/services/tenant-extra-config-http.ts) (`guardExtraConfigRead`) now uses `validateJWTWithTenant` so authenticated `operator`/`viewer` roles load read-only extra config instead of failing on `settings:read` (403); `PUT`/`DELETE` keep `guardExtraConfigWrite` (`settings:update`). Contract updated in [settings-access.ts](file:///f:/jhapp/cleanmatex/web-admin/src/features/settings/access/settings-access.ts).
  - **`M13` `FileAttachments` `TENANT_LOGO` `INVALID_REQUEST` (`cleanmatex`):** Replaced Zod v4 strict RFC-4122 `.uuid()` with `uuidLikeSchema` in [file-util-http.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/services/file-util/file-util-http.ts) and [route.ts](file:///f:/jhapp/cleanmatex/web-admin/app/api/v1/file-util/route.ts) so seeded hex tenant UUIDs pass query/upload validation.
  - **`M16` `GET /api/settings/tenants/me/effective?userId=me` 500 & 7s+ hang (`cleanmatexsaas`):** Refactored `resolveAllSettings()` in [stng-resolver.service.ts](file:///f:/jhapp/cleanmatexsaas/platform-api/src/modules/settings/services/stng-resolver.service.ts) from sequential per-setting queries to ~8 batched queries, and gracefully skips individual unresolved required settings with warning logs (preserving `resolveSetting()` throw semantics).
- **Priority 2 (Operator UI, RTL Tables, 404s, Dark Sign-In) — Done & Verified:**
  - **`PR-02 #14` Vouchers double/English pager:** Added `hidePagination?: boolean` to [cmx-data-grid.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/ui/data-display/cmx-data-grid.tsx); updated [vouchers-table.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/finance/vouchers/ui/vouchers-table.tsx) to hide grid pagination and render a single localized `CmxPagination`.
  - **`PR-02 #1` & `PR-01 #4` Orders badges & server pagination:** Updated [orders-simple-table.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/orders/ui/orders-simple-table.tsx) to render `OrderStatusBadge` + `CmxStatusBadge` (`preparation_status`) and page-size switcher (`limit` query param), and updated [orders/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/orders/page.tsx) to default to `CMX_DEFAULT_PAGE_SIZE` (`10`) and honour validated `?limit=`.
  - **`PR-01 #4` & `PR-02 #16` Customers page size & Arabic phone alignment:** Updated [customers/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/customers/page.tsx) and [customer-table.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/customers/ui/customer-table.tsx) to use `CMX_DEFAULT_PAGE_SIZE`, `CmxPagination` with page-size selector, and `text-start` on the contact cell & inner lines.
  - **`FET-UIDS-Nov20-CountryCodeRawKey`:** Added `"countryCode"` in [en/customers.json](file:///f:/jhapp/cleanmatex/web-admin/messages/en/customers.json) and [ar/customers.json](file:///f:/jhapp/cleanmatex/web-admin/messages/ar/customers.json).
  - **`M21` & `FET-UIDS-Nov20-B2BIndex404`:** Replaced dead `/reports/services` link & hex bar color (`rgb(var(--cmx-primary-rgb))`) in [TopServicesWidget.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/TopServicesWidget.tsx); added [app/dashboard/b2b/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/b2b/page.tsx) redirect to `/dashboard/b2b/customers` + contract in [b2b-access.ts](file:///f:/jhapp/cleanmatex/web-admin/src/features/b2b/access/b2b-access.ts).
  - **`M19` Sign-in Dark preference (`cmx_last_mode`):** Added `LAST_MODE_COOKIE` & `parseLastMode` in [last-brand.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/theme/last-brand.ts); updated [ui-theme.service.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/services/ui-theme.service.ts), [me/ui-preferences/route.ts](file:///f:/jhapp/cleanmatex/web-admin/app/api/v1/me/ui-preferences/route.ts), [login/route.ts](file:///f:/jhapp/cleanmatex/web-admin/app/api/auth/login/route.ts), and [choose-tenant/route.ts](file:///f:/jhapp/cleanmatex/web-admin/app/api/auth/choose-tenant/route.ts) so unauthenticated SSR reads the last-saved color mode cookie.
- **Verification after final code edit (2026-11-21):**
  - `cleanmatex`: `rebuild:platform-info-inventories` & `check:platform-info-inventories` PASS (`drift: 0`, `172` contracts, `2/2` suites / `10/10` tests); `check:i18n` PASS; `check:ui` PASS (`18 files checked: 0 errors, 0 warnings`); `typecheck` PASS (exit 0); `eslint . --quiet` PASS (exit 0); targeted Jest PASS (`6/6` suites, `24/24` tests); `web-admin` `npm run build` PASS (exit 0, `344/344` pages).
  - `cleanmatexsaas`: `stng-resolver.service.spec.ts` PASS (`1/1` suite, `6/6` tests); `platform-api` `npm run build` PASS (exit 0).
  - **Remaining next:** Priority 3–6 items (`PLAN_I18N_SWEEP.md`, `PR-03`, `PR-06`, `fonts_to_be_predefine.md`, remaining r6 P2/P3 UI items).

## Post-Deploy Priority 3–5: Remaining r6 UI/UX Fixes + Full `PLAN_I18N_SWEEP.md` (2026-11-21)

- **Held per owner instruction:** `PR-03` ([PR-03-zod-boundary-validation.md](file:///f:/jhapp/cleanmatex/docs/features/UI_Design_System_Enhace/PR-03-zod-boundary-validation.md)), `PR-06` ([PR-06-rsc-boundaries-redis-flags.md](file:///f:/jhapp/cleanmatex/docs/features/UI_Design_System_Enhace/PR-06-rsc-boundaries-redis-flags.md)), and [fonts_to_be_predefine.md](file:///f:/jhapp/cleanmatex/docs/features/UI_Design_System_Enhace/fonts_to_be_predefine.md) stay deferred until after all UI/UX work finishes.
- **Remaining `Retest r6` UI/UX Fixes — Done & Verified:**
  - `ReportsDarkBars`: replaced raw `<rect>` bars with Recharts `<Cell>` + `rgb(var(--cmx-*-rgb))` tokens in [orders-report-charts-rprt.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/reports/ui/orders-report-charts-rprt.tsx) and [invoices-report-charts-rprt.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/reports/ui/invoices-report-charts-rprt.tsx); migrated [orders-report-table-rprt.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/reports/ui/orders-report-table-rprt.tsx) and [report-filters-bar-rprt.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/reports/ui/report-filters-bar-rprt.tsx) onto `CmxSelect`, `CmxInput`, `Label`, `CmxButton`.
  - `CompactDensityNoEffect`: added `--cmx-cell-py` (`0.5rem` comfortable, `0.1875rem` compact) in [tokens.css](file:///f:/jhapp/cleanmatex/web-admin/src/ui/foundations/tokens.css) and wired it into `CmxDataTable` and `CmxDataGrid`.
  - `ArabDigitsPartial`: added `formatNumberForLocale` in [format-money.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/money/format-money.ts) and `formatNumber` in [tenant-currency-context.tsx](file:///f:/jhapp/cleanmatex/web-admin/lib/context/tenant-currency-context.tsx); wired into dashboard metrics, `StatCard`, `RevenueWidget`, `TopServicesWidget`, `WorkflowStatsWidget`, `OverdueOrdersWidget`, `OrdersSimpleTable`, `CustomerOrdersSection`, and `RecentOrdersList` (`OrderStatusBadge`).
  - `ModalFocusReturn` + `CustomerEditModal`: added `returnFocusTo` support in [use-focus-trap.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/hooks/use-focus-trap.ts) and `onOpenChangeRef` stability (`useEffect`) in [cmx-dialog.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/ui/overlays/cmx-dialog.tsx); wired `editOpenerRef` in Users Actions menu, explicit focus return on Ready By triggers, and stabilized [customer-edit-modal.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/orders/ui/customer-edit-modal.tsx) close/mount.
  - `ArabicLeftovers` + `ArabicTopbarTitlesEnglish`: resolved localized topbar and browser titles (`label2`/`label`) via `useNavigation()` in [app/dashboard/layout.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/layout.tsx) and [dashboard-browser-title.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/dashboard-browser-title.tsx); localized [customers/[id]/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/customers/[id]/page.tsx) (`ProfileTab`) and [settings/roles/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/settings/roles/page.tsx); added `.cmx-wordmark-box` light surface pill in [globals.css](file:///f:/jhapp/cleanmatex/web-admin/app/globals.css) for dark-mode sign-in wordmark contrast.
- **Full EN/AR i18n Sweep (`PLAN_I18N_SWEEP.md` Batches 1–8) — Done & Verified (`Remaining UI008 count: 0` across all `web-admin` files):**
  - Batch A (Public): `app/page.tsx`, `(auth)/forgot-password`, `(auth)/verify-email`, `(auth)/register`, `register/tenant`, `register/tenant/success`.
  - Batch B (`src/ui` + Access + Dashboard): intentional `UI008` ignore annotations in `cmx-spinner.tsx`, `cmx-language-switcher.tsx`, `cmx-sidebar.tsx`; localized [cmx-permissions-inspector-panel.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/access/ui/permissions-inspector/cmx-permissions-inspector-panel.tsx) (also `zIndex` tokens + `CmxButton`), [dashboard-home-page.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/dashboard-home-page.tsx), [workflow-stats-widget.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/components/workflow-stats-widget.tsx), and [overdue-orders-widget.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/components/overdue-orders-widget.tsx).
  - Batch C (Settings & Subscription): localized [settings/permissions/page.tsx](file:///f:/jhapp/cleanmatex/web-admin/app/dashboard/settings/permissions/page.tsx), [tenant-admin-subscription-screen.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx), [SettingsTable.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/settings/ui/SettingsTable.tsx) (`<Table>`), [FeatureFlagsSettings.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/settings/ui/FeatureFlagsSettings.tsx) (`<Table>`), [explain-drawer.tsx](file:///f:/jhapp/cleanmatex/web-admin/src/features/settings/ui/explain-drawer.tsx) (`zIndex.modal`), `BranchSettings.tsx`, `UserSettings.tsx`, `PlanLimitsSettings.tsx`, `settings/allsettings/page.tsx`, `settings/branches/[id]/page.tsx` (`CmxConfirmDialog`), and `settings/preferences/page.tsx`.
  - Batch D (Catalog): localized `catalog/pricing/[id]/page.tsx`, `catalog/customer-categories/page.tsx`, `price-history-timeline.tsx`, `bulk-import-modal.tsx`, `import-modal.tsx`, `catalog/preferences/page.tsx`, `catalog/pricing/page.tsx`.
  - Batch E (Orders, Workflow, Receipts, Users, Finance, Marketing, QA, Print, API Docs, ERP-Lite): localized `order-detail-error.tsx`, `split-confirmation-dialog.tsx`, `processing-item-row.tsx`, `processing-modal.tsx`, `order-items-list.tsx`, `receipt-preview.tsx`, `qa/[id]/page.tsx`, `create-user-screen.tsx`, `voucher-post-preview-dialog.tsx`, `discount-rule-form-dialog.tsx`, `api-docs/page.tsx`; annotated brand marks in 6 print components (+ `UI001` in `order-details-print.tsx`) and 5 ERP-Lite screens.
- **Verification after final code edit (2026-11-21):**
  - `cleanmatex`: `check:platform-info-inventories` PASS (`drift: 0`, `2/2` suites, `10/10` tests); `check:i18n` PASS; `check:ui` PASS (`41 files checked: 0 errors, 0 warnings`) & `--all` `UI008` count `0`; `typecheck` PASS (`NODE_OPTIONS=--max-old-space-size=8192`, 0 errors); `eslint . --quiet` PASS (0 errors); Jest targeted suites PASS (`57/57` suites, `497/497` tests covering `__tests__/ui/`, `__tests__/lib/theme/`, `__tests__/lib/money/`, `__tests__/api/settings/`, `__tests__/api/v1/file-util.route.test.ts`, `__tests__/scripts/check-design-system.test.ts`); `web-admin` `npm run build` PASS (`exit 0`, `344/344` pages).
  - Remaining after hold: `PR-03`, `PR-06`, `fonts_to_be_predefine.md`, HQ DB-driven sidebar nav entry (`P10` in `sys_hq_components_cd`, requires SQL migration in `cleanmatex` when requested), owner manual QA, and commits.

## PR file review (2026-11-16)

Checked against the code and corrected: wrong paths (`src/lib/utils.ts` → `lib/utils.ts`; `screens/` → `ui/`; tenant-guard script is `.mjs`), a result type that breaks under `strict: false`, a keyboard-shortcut clash with the existing payment shortcuts, a cache design that read feature flags from the database against the HQ-API rule, an artificial dependency chain, and PR-07's doc path, lowercase codes, inline script and SVG handling. Line numbers quoted inside the PR files were not all re-checked.
