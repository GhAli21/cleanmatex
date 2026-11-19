---
name: cmx-ui-design-review
description: Review (and, when asked, fix) web-admin UI against the Cmx design system rules — any component, page, screen, dialog, form, table, report, print view or chart, new or changed. Checks Cmx-only components, theme tokens (no palette classes, hex, dark:), logical RTL direction, dark mode and paper, states, accessibility, i18n, numbers/codes, and shared-component changes; runs the automated checks and reports ranked findings with file:line and the fix. Use when the user says "review the UI", "check the design system", "is this screen compliant", "design review", "check RTL/dark mode/tokens", before calling any UI work done, or after building or changing a screen or a Cmx component.
user-invocable: true
version: 1.0.0
---

# UI design review

The rules are in **`docs/dev/rules/cmx-design-system.md`**. Read it before reviewing. Every finding cites its section (§N). This skill decides how to review; the rules file decides what is right.

Default mode is **review only**: change nothing, report findings. **Fix mode** is used only when the user asks ("review and fix", `--fix`); it is described at the end.

## 1. Find the target

| The user gives | Review |
|---|---|
| Files or folders | Those files |
| A route (`/dashboard/orders`) | `app/<route>/page.tsx`, the feature screen it renders, and the feature components that screen imports (one level; follow further only for files in the same feature) |
| A component name | Its file, plus its story and test. For a `src/ui` component, also grep its callers to see if a change breaks them |
| Nothing | The changed and untracked UI files: `cd web-admin && git diff --name-only --relative HEAD; git ls-files --others --exclude-standard` filtered to `src/ui`, `src/features`, `app` `.tsx/.ts` |

Skip stories and tests as review targets (read them only for context). Do not scan the whole repo.

## 2. Run the tools (from `web-admin`)

Run these on the target files, and put the results in the report as they came out:

```bash
node scripts/ui/check-design-system.js <files>    # UI001–UI008
npx eslint <files> --quiet                         # palette, physical direction, banned imports, hooks
```

When the target touches `src/ui`, `globals.css`, `tokens.css`, theme code or print views, also run:

```bash
npx jest __tests__/ui __tests__/lib/theme __tests__/scripts/check-design-system.test.ts
```

When locale files changed, run `npm run check:i18n`. Do not run the build or the full jest suite during a review unless the user asks; say that they were not run.

A tool finding is already confirmed. Do not re-argue it; just place it in the report with its fix from §14 of the rules.

## 3. Read the code for what tools cannot see

Go through each target file against this list. Each item points to the rules section.

1. **Components (§1, §6):**
   - Is each control the right Cmx component?
   - Is a feature-local copy of a shared component being built?
   - Is a shared default copied (page size, tones)?
2. **Colour meaning (§2):**
   - Status tones match the meaning: an error is danger, paid/posted is success.
   - No decorative status colours.
   - White text sits only on solid fills that need it (`primary-foreground`, `on-solid`, `warning-foreground` on amber).
   - `text-primary-text`, not `text-primary`, for brand-coloured text on a surface.
3. **Dark mode and paper (§3):**
   - Any fill or text that would vanish or glare in dark mode: fixed light backgrounds, `bg-foreground` with muted text.
   - Print roots have `data-mode="LIGHT"`.
   - No mode branching in feature code.
4. **Direction (§4):**
   - `isRTL` used only for non-layout things.
   - Direction icons get `rtl:rotate-180`; no hand-made reverses.
   - Codes, phones and numbers are LTR (`<bdi>`, `dir="ltr"`, `CmxCodeChip`).
   - Off-canvas panels use the max-breakpoint pattern.
5. **Layout (§5, §7):**
   - No horizontal page scroll at 320 px.
   - One primary action per section; destructive actions apart and confirmed.
   - Spacing, radius, shadow and type come from the scale.
   - POS/touch actions are 44 px.
6. **States (§7):**
   - Loading skeleton, empty state, error with retry, busy and disabled buttons, `cmxMessage` results.
   - Permission-hidden or disabled actions.
7. **Accessibility (§8):**
   - Names on icon buttons, dialogs and inputs.
   - Focus visible; no `outline-none` alone.
   - Escape and focus return.
   - Not colour alone.
   - Contrast of any custom colour pair. Compute it when unsure, with `contrastRatio` in `lib/theme/brand-palette.ts`.
8. **Text (§10):**
   - No English in JSX or string props (`aria-label`, `title`, `placeholder`, `alt`).
   - Keys exist in EN and AR.
   - Glossary terms used.
   - ICU for counts.
9. **Numbers and money (§9):**
   - Locale formatting and `tabular-nums`.
   - Order money only through `OrderFinancialView` (`order-fin-rules.md`).
   - No silent money mutation.
10. **Shared component changes (§12):**
    - Backward compatible (optional props, no renames).
    - Callers still fit.
    - Story and test updated.
    - `.clauderc` snippet for a new component.
    - No feature imports.

Check a finding against the code before you report it. Read the component it uses: a Cmx component may already handle what looks missing, such as the focus trap, the `dir` or the pagination text.

If the app is running and the user wants it seen, load `/run` and look at the screen in EN/AR, light/dark, 320 px/desktop. Otherwise list "not seen in a browser" under Not checked.

## 4. Severity

| Level | Meaning | Examples |
|---|---|---|
| **Critical** | Broken or unusable for a group of users, or data shown wrong | Arabic layout broken or mirrored twice; text unreadable in dark mode; money shown wrong; a dialog that traps the keyboard or cannot close; a whole screen of English in Arabic |
| **Important** | Breaks a hard rule (§1) or will break with a theme, mode or locale | Raw element or palette colour in new code; hex brand colour; missing loading/empty/error state; missing name on an icon button; contrast under 4.5:1; feature-local copy of a Cmx component |
| **Minor** | Consistency or polish, works today | Spacing off the scale; a skeleton that doesn't match the content shape; a non-glossary word |

Old debt in lines the change did not touch goes under a "Debt seen (not from this change)" line with counts only. It is not a finding.

## 5. Report format

```
UI design review: <target> (<n> files)

Tools: check-design-system <e> errors / <w> warnings · eslint <n> · guard tests <pass/fail or not run> · i18n <…>

Critical
1. <file>:<line> — <what is wrong, in one sentence> (§N)
   Fix: <the concrete change>

Important
…

Minor
…

Debt seen (not from this change): <rule: count, …>
Not checked: <browser, build, other locales, print …>
Verdict: <Pass | Pass with minors | Needs fixes>
```

- Rank by severity, then by user impact.
- One finding per root cause: "14 `<label>`s in this form", not 14 findings.
- No praise and no restating the rules.
- If nothing is found, say so and still list what was not checked.

## 6. Fix mode (only when asked)

1. Fix Critical, then Important. Fix Minor only when asked.
2. Use the fixes in §14 of the rules. For classes, run `node scripts/ui/codemod-classes.js <file> --write`, then read its diff.
3. When a fix changes behaviour or logic, add a test that fails first (a state, a name, a direction). Changes to classes only need the guards to pass.
4. A missing capability in a shared component → extend it (§12). Do not work around it in the feature.
5. New text → load `/i18n`, keep EN and AR in step.
6. Run §2 again on the touched files. Then run `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. Run `npm run build` when you changed `src/ui` or more than a few screens, after checking that no other `next build` is running.
7. Report again in the same format, marking each finding fixed, skipped (with the reason) or not needed.
8. Update the owning feature's STATUS and QA guide when its docs ask for it.

Never apply migrations. Never commit. Never touch files another session has uncommitted without asking.
