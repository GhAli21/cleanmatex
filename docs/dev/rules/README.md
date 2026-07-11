# Portable React / ESLint rules (copy kit)

Copy these files to other React 19 + Next.js + ESLint projects. Names are **framework-generic** (no product prefix).

## Documentation (`docs/dev/rules/`)

| File | Contents |
|------|----------|
| `react-effects-patterns.md` | `useEffect` + `setState`, Next `Link`, `useMemo`/`useCallback` deps |
| `react-rhf-and-table-lint.md` | `useWatch`, TanStack `useReactTable`, a11y combobox, default exports |
| `react-lint-verification-checklist.md` | Agent pre-submit checklist + `eslint . --quiet` gate |
| `no-silent-money-mutation.md` | Canonical money-field behavior rule: prevent first, explain inline, never rewrite typed money as a side effect |
| `integration-contracts.md` | CleanMateX-specific (do not copy unless needed) |

## Cursor rules (`.cursor/rules/`)

| File | `globs` (edit per project) |
|------|----------------------------|
| `react-effects-patterns.mdc` | e.g. `web-admin/**/*.ts, web-admin/**/*.tsx` |
| `react-rhf-and-table-lint.mdc` | same |

## Wire into agents (one bullet each)

- `AGENTS.md` / `CLAUDE.md` → UI Quick Rules + Key Documentation
- `.claude/skills/frontend/SKILL.md` → CRITICAL rule + Additional Resources
- `<app>/.clauderc` → `react_hooks` block (see `web-admin/.clauderc`)
- `.codex/skills/feature-implementation/SKILL.md` → Rules section

## Per-project tweaks

1. Change `globs` in `.mdc` files to your frontend app path.
2. Change `cd web-admin` in checklist/docs to your app folder name.
3. Keep ESLint rule names identical if using `eslint-config-next` + React Compiler plugin.

**Sibling HQ app:** `F:/jhapp/cleanmatexsaas/docs/dev/rules/` — same files with `platform-web` paths.
