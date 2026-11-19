# Design system rules, checker and review skill — plan and record

**Status:** DONE in code and docs, 2026-11-19. Owner: QA (`QA_TEST_GUIDE.md` → "Design system rules", plus M22), then commit.

**Asked by the owner (2026-11-19):**
- a full design system rules file;
- the related rules, instructions and skills updated, so they say how to follow it, fix it and check it;
- a skill that reviews any component, page or screen against it;
- all of this in Claude, Codex, Cursor and Antigravity.

## Progress

| # | Step | Status | Result |
|---|---|---|---|
| 1 | Rules file | Done | `docs/dev/rules/cmx-design-system.md`, sections §1–§16: hard rules, token table, theme/dark/paper, RTL, size and layers, which component, states, a11y, numbers/codes, text, charts/icons, changing `src/ui` and ignore markers, how to check, how to fix, debt baseline, done list |
| 2 | Checker | Done | `web-admin/scripts/ui/check-design-system.js`, `npm run check:ui` (changed files) / `-- --all`. Rules UI001–UI007 are errors; UI008 (English JSX text) is a warning. Test `__tests__/scripts/check-design-system.test.ts` 20/20 |
| 3 | Real bugs from the first run | Done | `CmxFormActions` white background in dark mode → `bg-card/95`; `CmxFormSection` fixed-colour gradients → token gradients. `src/ui` has 0 errors. QA row M22 |
| 4 | Review skill | Done | `cmx-ui-design-review` (renamed from `ui-design-review` at the owner's request): target, tools, manual checklist, severity, report format, fix mode only when asked |
| 5 | Wire into rules and instructions | Done | `CLAUDE.md` rule 17 + skill table, `AGENTS.md`, `docs/dev/rules/README.md`, `cmx-shared-components.md` (the non-existent `CmxFieldLabel` fixed), `claude-md-reference.md`, `web-admin/.clauderc`, `ui-migration-guide.md`. Stale examples removed (`text-left rtl:text-right`, `ml-4 rtl:mr-4`, `class="dark"`, `data-accent`) |
| 6 | All four tools | Done | **Claude** `.claude/skills` (frontend, implementation, storybook, README, the skill). **Codex** `.codex/skills` (frontend in step, the skill, storybook, feature-implementation, code-review, README). **Cursor** `.cursor/rules/cmx-design-system.mdc` (new), fixes in `uiuxrules.mdc`, `aicoderfrontendinstructions.mdc`, a banner on `frontendnextjsrules.mdc`, plus `.cursor/skills/cmx-ui-design-review` and `.cursor/commands/cmx-ui-design-review.md`. **Antigravity** `.agents/skills`: every shared skill synced from Claude (30 files were out of date; `file-util-wire` added), the skill, and `source-command-cmx-ui-design-review` |
| 7 | Archive the old grandfathered registry | Done | All 6 copies moved to `docs/_archive/2026-11/grandfathered-objects/` (README there). 33 active files now say "take the exact name from the live DB or `schema.prisma`". The Cursor rule no longer loads |
| 8 | STATUS, RESUME, QA guide, this plan | Done | |

## Rulings made while doing it

1. The checker covers only what ESLint does not. Palette and physical-direction classes stay in ESLint.
2. Old debt is reported, not fixed. New code adds none, and lines you change get fixed. Baseline is in the rules file §15.
3. Exceptions use `cmx-ds-ignore UI00N: <reason>`. A marker without a reason does not count.
4. Small z-index values (`z-[1]`, `z-[19]`) for local stacking are allowed. 50 and over fail outside `src/ui`, because `src/ui` owns the scale.
5. Antigravity copies keep the `.claude/...` paths and the `CLAUDE.md` references, as the copies that already matched did. Where an Antigravity file looked newer, it held an old "claude → Codex" word swap with paths that do not exist, so Claude's version was taken.
6. The four copies of the review skill must stay identical (the rules file says so).

## Left

- HQ (`cleanmatexsaas`) has no copy of the rules, the checker or the skill.
- There is no shared chart series palette (chart hex colours are debt).
- Codex skills other than frontend were not compared file by file with Claude.
- Nothing was seen in a browser; the build was not rerun after the two `src/ui` class fixes.
