---
name: code-documentation
description: >
  Inline code documentation standards for CleanMateX — all domains.
  Auto-invoked when writing or reviewing TypeScript (.ts/.tsx), SQL migrations,
  CSS/Tailwind, or config files (next.config.ts, tailwind.config.ts, prisma schema,
  .env.example, tsconfig.json). Covers JSDoc/TSDoc, SQL migration comment blocks,
  RTL Tailwind annotations, and config option explanations.
  Comment the WHY not the WHAT. English only.
user-invocable: true
---

# Code Documentation Skill

## Scope — What This Skill Owns

| Concern | This skill | Other skill |
|---|---|---|
| JSDoc on TS exported functions | ✅ | |
| Which tenant pattern to use | | `/multitenancy`, `/backend` |
| SQL migration comment blocks | ✅ | |
| SQL schema naming rules | | `/database` |
| RLS policy intent comment | ✅ | |
| RLS policy creation rules | | `/database` |
| Tailwind RTL class intent comment | ✅ | |
| Which RTL classes to use | | `/frontend` |
| Config file option explanation | ✅ | |
| Which config options are allowed | | `/frontend`, `/architecture` |
| PRDs, API ref docs, session notes | | `/documentation` |
| Feature docs structure | | `/documentation` |

---

## 3 Absolute Rules

1. **Every exported function, hook, component, type, constant → JSDoc block required**
2. **Comment WHY, not WHAT.** Never restate what the code already reads.
3. **English only** — even in bilingual modules (AR UI text stays in i18n JSON, not in comments)

---

## Required JSDoc by TypeScript File Type

| File type | Required elements |
|---|---|
| Server Action | File-level block + `@param` + `@returns` + tenant note |
| API Route handler | File-level block (METHOD + path) |
| Service method | `@param tenantOrgId` + `@returns` + `@throws` if applicable |
| React Hook | `@returns` describing shape + tenant scope note |
| React Component | Props interface JSDoc + component JSDoc if non-trivial |
| Utility function | Full JSDoc always |
| Type/Interface | Purpose block + inline `//` on non-obvious fields |
| Constant (`lib/constants/`) | Purpose block + derive-type note |

---

## Tenant Context Rule

Whenever tenant context is involved, add a JSDoc or inline comment:

| Pattern | Required comment |
|---|---|
| `tenantOrgId` as param | Document in `@param tenantOrgId` |
| `getTenantIdFromSession()` called | Note "Tenant resolved server-side from session" |
| `withTenantContext()` called | Note "All Prisma queries scoped to tenant via RLS context" |
| `useAuth().currentTenant` used | Note "Scopes data to authenticated tenant" |
| `getAuthContext()` called | Note "Tenant resolved server-side from authenticated session" |

---

## Mandatory Inline Comment Positions

Never skip these — they are always required:

- **CSRF token check** — explain the threat being guarded against
- **Rate-limit guard** — note the limit value and purpose
- **Tenant resolution** (`getAuthContext()` / `getTenantIdFromSession()`) — note server-side resolution
- **`revalidatePath()`** — explain what cache is cleared and why
- **Complex business rule** — one sentence of business reason
- **Magic numbers/values** — explain origin (e.g. `5 * 60 * 1000` → "5-minute TTL for order status cache")
- **`enabled: !!currentTenant`** — "Prevent query before tenant is confirmed"
- **`useRef` guards** — document both `isFetchingRef` and `loadedForTenantRef` pattern

---

## `@example` Rule

- **Mandatory** on all public service methods and hooks
- **Optional** (but encouraged) on server actions
- Must show a minimal working call with real-looking but non-sensitive data

---

## Domain References

- **TypeScript / JSDoc templates** → [typescript-jsdoc.md](typescript-jsdoc.md)
- **SQL migration comments** → [sql-migration.md](sql-migration.md)
- **CSS / Tailwind annotations** → [css-tailwind.md](css-tailwind.md)
- **Config file annotations** → [config-files.md](config-files.md)

---

## Storybook Stories

`.stories.tsx` files are TypeScript — follow all JSDoc rules above, plus:

- Every story file must have a file-level JSDoc block naming the component and its variants
- Each named export (story) must have an inline `//` comment if its purpose isn't obvious from the name
- RTL stories must have a comment: `// RTL variant — verifies Arabic layout direction`

---

## Anti-Patterns — Never Do These

```typescript
// BAD: Restates what the code says
// This function returns the order by id
async function getOrderById(id: string) { ... }

// BAD: Arabic text in a comment
// هذا يحدد المستأجر

// BAD: Commented-out code left in file
// const oldLogic = doSomething();

// BAD: Obvious comment
const count = orders.length; // Get the length of orders
```

---

## Section Separators (Functions >40 Lines)

Use these visual separators for readability in long functions:

```typescript
// ─── Input Validation ─────────────────────────────────────────────────────
// ─── Tenant Resolution ────────────────────────────────────────────────────
// ─── Database Write ───────────────────────────────────────────────────────
// ─── Cache Invalidation ───────────────────────────────────────────────────
```
