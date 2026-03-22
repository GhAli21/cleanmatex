# Code Documentation Tooling Guide

**Date:** 2026-03-22
**Covers:** `/code-documentation` skill, `code-documenter` agent, TypeDoc, Storybook, ESLint JSDoc

---

## What Was Implemented

| Tool | Purpose | Status |
|---|---|---|
| `/code-documentation` skill | Rules for JSDoc, SQL comments, Tailwind annotations, config comments | ✅ Ready |
| `code-documenter` agent | Auto-adds documentation to code you just wrote | ✅ Ready |
| ESLint JSDoc plugin | Warns on undocumented exports (never blocks build) | ✅ Ready |
| TypeDoc | Generates browsable HTML docs from JSDoc | ✅ Ready |
| Storybook | Interactive UI component browser | ✅ Ready |

---

## 1. `/code-documentation` Skill

**What it is:** A set of rules Claude loads before writing any comments, JSDoc, or annotations.

**When Claude loads it automatically:**
- When you write TypeScript files (`.ts` / `.tsx`)
- When you write SQL migrations
- When you write CSS / Tailwind
- When you edit config files (`next.config.ts`, `tailwind.config.ts`, `.env.example`, `tsconfig.json`)

**You don't need to invoke it manually** — CLAUDE.md instructs Claude to load it whenever code documentation is involved. But you can say `/code-documentation` to load it explicitly if needed.

**What it enforces:**
- Every exported function/hook/component/type/constant → JSDoc block required
- Comment the WHY, not the WHAT
- English only
- Tenant context (`tenantOrgId`, `withTenantContext`, `getAuthContext`) must always be noted in JSDoc

**Skill files:**

| File | Domain |
|---|---|
| [SKILL.md](.claude/skills/code-documentation/SKILL.md) | Main rules + mandatory inline positions |
| [typescript-jsdoc.md](.claude/skills/code-documentation/typescript-jsdoc.md) | Copy-paste JSDoc templates per file type |
| [sql-migration.md](.claude/skills/code-documentation/sql-migration.md) | Migration file header, table, index, RLS comment rules |
| [css-tailwind.md](.claude/skills/code-documentation/css-tailwind.md) | RTL class annotations, intent comments |
| [config-files.md](.claude/skills/code-documentation/config-files.md) | next.config, tailwind.config, prisma, .env.example |

---

## 2. `code-documenter` Agent

**What it does:** Reads code you just finished writing and adds all missing JSDoc + inline comments in one pass. It never changes logic — documentation only.

**When to use it:**

Say any of the following and Claude will proactively suggest it, or you can ask directly:

- "I finished the `createOrderPiece` service method"
- "Migration 0172 is done"
- "I added RTL support to OrderCard"
- "I added a new env variable"
- "The code review is done, now document it"

**What it does per domain:**

| Domain | What it adds |
|---|---|
| TypeScript | JSDoc on every exported symbol, inline comments at CSRF/rate-limit/tenant/revalidatePath/magic numbers/useRef guards |
| SQL migration | File header block, table purpose comment, index rationale, RLS policy intent, CASCADE drop note |
| CSS/Tailwind | Intent comment on class groups >5 classes, always on `rtl:` / `ltr:` classes |
| Config files | Annotation on every non-default option and every `.env.example` variable |

**Output format** — the agent reports exactly what it added:
```
## Documentation Pass — orders-service.ts

### JSDoc Added
- `getOrdersByTenant()` — added @param tenantOrgId, @returns, withTenantContext note

### Inline Comments Added
- Line 42: tenant resolution via getAuthContext()
- Line 87: magic number — 5 * 60 * 1000 = 5-min cache TTL

### Already Documented (no change)
- `mapOrderToDto()` — complete JSDoc present
```

---

## 3. ESLint JSDoc (warn-only)

**What it does:** Surfaces undocumented exports as **warnings** during `npm run lint`. Never blocks build or commits.

**How to use:**

```bash
cd web-admin
npm run lint
```

Look for warnings prefixed with `jsdoc/` — these tell you what's missing:
- `jsdoc/require-jsdoc` — exported function/class/interface missing JSDoc block
- `jsdoc/require-param` — `@param` tag missing
- `jsdoc/require-returns` — `@returns` tag missing

**These are warnings only** — CI will not fail, build will not fail. They are a guide for what the `code-documenter` agent should fill in.

---

## 4. TypeDoc — Browsable HTML Docs

**What it does:** Reads JSDoc from your TypeScript source and generates a static HTML documentation site.

**Scanned directories:** `lib/`, `src/ui/`, `src/features/` (not `app/` — those are Next.js route files)

**Output:** `web-admin/docs/typedoc/` (git-ignored)

**Commands:**

```bash
cd web-admin

# Generate TypeDoc HTML
npm run docs:typedoc

# Then open in browser
start docs/typedoc/index.html
```

**What you'll see:**
- All exported functions, hooks, services, types, constants
- Organized by category: UI Components → Features → Services → Hooks → Utilities
- Full JSDoc rendered: description, `@param`, `@returns`, `@example`, `@throws`
- Search bar across all symbols

**When to run it:**
- After a feature is complete and documented
- Before a release, to review the public API surface
- When onboarding a new developer — share the generated HTML

**Config file:** [web-admin/typedoc.json](web-admin/typedoc.json)

---

## 5. Storybook — Interactive UI Component Browser

**What it does:** Renders each UI component in isolation, with controls to change props, RTL toggle, and accessibility audit.

**Commands:**

```bash
cd web-admin

# Start dev server (hot reload)
npm run storybook
# Opens at http://localhost:6006

# Build static version
npm run docs:storybook
# Output: docs/storybook/ (git-ignored)
```

**Story files location:** `web-admin/src/stories/` (sample stories from Storybook init are there now)

**How to write a story for your component:**

Create `YourComponent.stories.tsx` alongside the component:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs';
import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  title: 'UI/YourComponent',
  component: YourComponent,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Click me' },
};

export const RTL: Story = {
  args: { label: 'انقر هنا' },
  parameters: { direction: 'rtl' },
};
```

**RTL toggle:** The Storybook toolbar has a Direction toggle (LTR/RTL) to preview Arabic layout. This is already configured in `.storybook/preview.ts`.

**Where to put stories:**
- `src/ui/` components (Cmx Design System) → **required**, put story next to component
- `src/features/` components → optional but encouraged

**Current sample stories** (from Storybook init — these are just demos):
- `src/stories/Button.stories.ts`
- `src/stories/Header.stories.ts`
- `src/stories/Page.stories.ts`

You can delete these once you have real component stories.

---

## 6. Generate Everything at Once

```bash
cd web-admin

# Generates TypeDoc HTML + Storybook static build
npm run docs:generate
```

Output:
- `docs/typedoc/index.html` — API reference
- `docs/storybook/index.html` — component browser

Both are git-ignored. Share with teammates by copying the folders or serving them locally.

---

## Daily Workflow Summary

| When | What to do |
|---|---|
| Finish writing a service/hook/action | Tell Claude "I finished X" → `code-documenter` agent runs |
| Finish writing a migration | Tell Claude "Migration 0NNN is done" → agent adds SQL comment blocks |
| Add `rtl:` Tailwind classes | Tell Claude → agent adds layout-intent comments |
| Add `.env.example` variable | Tell Claude → agent annotates purpose + format |
| Want to see all warnings | `npm run lint` → look for `jsdoc/` prefixed warnings |
| Want browsable API docs | `npm run docs:typedoc` → open `docs/typedoc/index.html` |
| Want to preview a component | `npm run storybook` → open `localhost:6006` |
| Onboarding / release | `npm run docs:generate` → share both HTML folders |
