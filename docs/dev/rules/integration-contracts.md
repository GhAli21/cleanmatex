# integration-contracts.md — Cross-Project Single Source of Truth

**Applies to:** `cleanmatex` ↔ `cleanmatexsaas`
**Location (both projects):**
- `F:\jhapp\cleanmatex\docs\dev\integration-contracts.md`
- `F:\jhapp\cleanmatexsaas\docs\dev\integration-contracts.md`

> This file is the authoritative reference for all cross-project work. Both CLAUDE.md files point here. Keep both copies identical.

---

## 1. Ownership Table

| Concern | Owner | Consumer |
|---|---|---|
| Database migrations | `cleanmatex` | `cleanmatexsaas` (reads only) |
| RLS policies | `cleanmatex` | N/A (cleanmatexsaas bypasses via service role) |
| TypeScript type generation | Both (run after cleanmatex migrations) | — |
| Settings (`sys_stng_*`) | `cleanmatexsaas` | `cleanmatex` via HQ API |
| Feature Flags (`sys_feature_flags_*`) | `cleanmatexsaas` | `cleanmatex` via HQ API |
| Tenant-scoped business logic | `cleanmatex` | — |
| Cross-tenant admin operations | `cleanmatexsaas` | — |
| ADR approval | User (writes `Approved_By_Jh` in ADR file) | Both projects |

---

## 2. Feature Placement Decision Matrix

**Before implementing ANY feature**, answer these three questions:

| Q | Question | Answers |
|---|---|---|
| Q1 | Who are the primary users? | Tenant users / Platform admins / Both |
| Q2 | What is the data scope? | Single tenant / Cross-tenant / Both |
| Q3 | What is the access pattern? | RLS enforced / Service role key / Both |

**Result:**
- **Tenant Operations** (Orders, Customers, Inventory, Lite ERP) → `cleanmatex`
- **Platform Admin** (Tenant Management, Billing, Analytics) → `cleanmatexsaas`
- **Dual-Purpose** (Settings, Feature Flags, Audit Logs) → Both projects

For complex decisions: create an ADR using `.claude/docs/Dev/ADR_TEMPLATE.md` and follow `.claude/docs/Dev/ADR_PROCESS.md`.

---

## 3. Cross-Project Feature: Declare Intent First

**BEFORE any cross-project implementation**, output this analysis and wait for user approval:

```markdown
## Cross-Project Feature: [Feature Name]

### Scope Analysis

**cleanmatex Components** (Tenant App):
- Database: [migrations, tables, RLS policies, functions]
- Backend: [tenant-scoped APIs, services]
- Frontend: [tenant-facing UI components]
- Access Pattern: RLS + anon key (tenant-scoped only)

**cleanmatexsaas Components** (Platform HQ):
- Backend: [platform admin APIs, cross-tenant queries]
- Frontend: [platform admin UI, dashboards]
- Type Regeneration: [Required after cleanmatex migrations? Y/N]
- Access Pattern: Service role key (cross-tenant allowed)

**Shared Resources**:
- Database schema: [tables, functions, views]
- Settings: [new settings]
- Feature flags: [new flags]
- RLS Policies: [list policies — created in cleanmatex]

**User Confirmation Required Before Proceeding**
```

---

## 4. Context Switch Protocol

### Switching TO cleanmatex (from cleanmatexsaas)

```
─────────────────────────────────────────────
🔄 CONTEXT SWITCH: cleanmatexsaas → cleanmatex
─────────────────────────────────────────────
Active Project:   cleanmatex (Tenant-Facing Application)
Directory:        F:/jhapp/cleanmatex
Active CLAUDE.md: F:/jhapp/cleanmatex/CLAUDE.md
Active Skills:    F:/jhapp/cleanmatex/.claude/skills/
Active Standards: F:/jhapp/cleanmatex/.claude/docs/

Rules Now in Effect:
✅ Use RLS policies for ALL org_* tables
✅ Use anon key Supabase client
✅ Filter ALL queries by tenant_org_id
✅ Create migrations HERE (source of truth)
✅ Implement tenant-scoped features only
❌ NO cross-tenant queries
❌ NO service role key usage
```

### Switching TO cleanmatexsaas (from cleanmatex)

```
─────────────────────────────────────────────
🔄 CONTEXT SWITCH: cleanmatex → cleanmatexsaas
─────────────────────────────────────────────
Active Project:   cleanmatexsaas (Platform HQ Console)
Directory:        F:/jhapp/cleanmatexsaas
Active CLAUDE.md: F:/jhapp/cleanmatexsaas/CLAUDE.md
Active Skills:    F:/jhapp/cleanmatexsaas/.claude/skills/
Active Standards: F:/jhapp/cleanmatexsaas/.claude/docs/

Rules Now in Effect:
✅ Use service role key Supabase client
✅ Cross-tenant queries allowed (for admin features)
✅ Regenerate types after cleanmatex migrations
✅ Implement platform admin features
❌ NEVER create migrations here
❌ NEVER use RLS-only patterns (we bypass RLS)
```

---

## 5. Database Migration Protocol

**ABSOLUTE RULES — NEVER VIOLATE:**

| Rule | cleanmatex | cleanmatexsaas |
|------|-----------|----------------|
| Create migrations | ✅ ALWAYS HERE | ❌ NEVER HERE |
| Migration location | `F:/jhapp/cleanmatex/supabase/migrations/` | N/A |
| Apply migrations | ✅ User applies | ❌ Never |
| RLS policies | ✅ MUST implement for org_* tables | ❌ Not applicable (service role bypasses) |
| Type generation | ✅ After migration | ✅ After cleanmatex migration |

**Workflow for database changes:**
1. Announce switch to cleanmatex context
2. Create migration in `F:/jhapp/cleanmatex/supabase/migrations/`
3. Add RLS policies if creating org_* tables
4. Stop and tell user to review and apply migration
5. Wait for user confirmation migration is applied
6. Announce switch to cleanmatexsaas context
7. Regenerate types: `F:/jhapp/cleanmatexsaas/scripts/dev/update-types.ps1`
8. Verify types build in cleanmatexsaas

---

## 6. Context Verification Checklist

**Before executing ANY code in a cross-project task:**

```markdown
### Current Context Verification
- Active Project:        [cleanmatex | cleanmatexsaas]
- Current Directory:     [F:/jhapp/cleanmatex | F:/jhapp/cleanmatexsaas]
- Active CLAUDE.md:      [project]/CLAUDE.md
- Active Skills Dir:     [project]/.claude/skills/
- Active Standards Dir:  [project]/.claude/docs/
- DB Access Pattern:     [RLS + anon key | Service role key]
- Tenant Filtering:      [ALWAYS filter | Filter only when tenant-specific]
- Cross-Tenant Queries:  [FORBIDDEN | ALLOWED for admin]

Action:          [What I'm about to do]
Correct Context: [✅ Yes | ❌ No — MUST SWITCH]
```

---

## 7. Skills & Standards: Never Mix Across Projects

| Context | Skills from | Standards from |
|---|---|---|
| cleanmatex | `F:/jhapp/cleanmatex/.claude/skills/` | `F:/jhapp/cleanmatex/.claude/docs/` |
| cleanmatexsaas | `F:/jhapp/cleanmatexsaas/.claude/skills/` | `F:/jhapp/cleanmatexsaas/.claude/docs/` |

---

## 8. Integration Contract Strategy (No Code Copying)

**Do not copy implementation code** between projects. Each project implements its own code with its own rules.

**Use contracts and ownership instead:**
- **Placement decision first** — confirm which project owns the behavior
- **Integration contract** — document API endpoints, request/response shapes, error shapes, auth expectations, event payloads, generated DB types, schema ownership
- **Local implementation** — cleanmatex = RLS + `tenant_org_id`; cleanmatexsaas = service role + platform admin boundaries
- **Shared implementation exception** — if strict identical implementation is proposed, stop at an ADR proposal. The ADR is approved only when the file contains the exact marker `Approved_By_Jh` written by the user. Until then, do not implement. Do not automatically create packages, copy files, or sync code.

---

## 9. Settings & Feature Flags API Contract

| Resource | Managed by | Consumed by | Access method |
|---|---|---|---|
| `sys_stng_*` (settings) | cleanmatexsaas | cleanmatex | HQ API endpoint (to be documented) |
| `sys_feature_flags_*` | cleanmatexsaas | cleanmatex | HQ API endpoint (to be documented) |

**API shapes (fill in as built):**

| Endpoint | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/api/settings/{key}` | GET | tenant JWT | — | `{ key, value, type }` |
| `/api/feature-flags/{flag}` | GET | tenant JWT | — | `{ flag, enabled }` |

---

## 10. Error Recovery Protocol

**If context is violated** (e.g. migration created in cleanmatexsaas, service role used in cleanmatex):

1. User flags violation: "Wrong context!"
2. Immediately stop and acknowledge error
3. Delete/revert incorrect work
4. Announce correct context switch
5. Re-do work in correct context with correct rules

---

## 11. Cross-Project Feature Checklist (Quick Summary)

For the full 200+ checkpoint list: `.claude/docs/Dev/CROSS_PROJECT_FEATURE_CHECKLIST.md`

- [ ] Feature placement determined (Feature Placement Guide)
- [ ] ADR created if complex (ADR Template + ADR Process)
- [ ] Scope analysis completed and user-approved
- [ ] Context switches announced explicitly
- [ ] Migrations created in cleanmatex (if needed)
- [ ] RLS policies added in cleanmatex (if new org_* tables)
- [ ] User applied migrations
- [ ] Types regenerated in both projects
- [ ] Integration contract strategy followed
- [ ] cleanmatex implementation follows cleanmatex rules
- [ ] cleanmatexsaas implementation follows cleanmatexsaas rules
- [ ] Both projects build successfully
- [ ] No context violations occurred

---

## 12. Project Quick Reference

| Aspect | cleanmatex | cleanmatexsaas |
|--------|-----------|----------------|
| Purpose | Tenant-facing application | Platform admin console |
| Users | Tenant users | Platform administrators |
| DB Access | Anon key + RLS | Service role key (bypasses RLS) |
| Tenant Scope | Single tenant only | All tenants (cross-tenant admin) |
| Migrations | ✅ Create here | ❌ Never create |
| RLS Policies | ✅ REQUIRED | ❌ Not applicable |
| Query Filtering | ALWAYS by `tenant_org_id` | Only when tenant-specific |
| Port | 3000 | 3001 (web), 3002 (api) |
| CLAUDE.md | `F:/jhapp/cleanmatex/CLAUDE.md` | `F:/jhapp/cleanmatexsaas/CLAUDE.md` |

---

## 13. Port Reference

| Project | Service | Port |
|---|---|---|
| cleanmatex | web-admin (Next.js) | 3000 |
| cleanmatexsaas | platform-web (Next.js) | 3001 |
| cleanmatexsaas | platform-api (NestJS) | 3002 |
| Shared | Supabase API | 54321 |
| Shared | Supabase DB | 54322 |
| Shared | Supabase Studio | 54323 |

---

## Update Log

| Date | Change | Author |
|---|---|---|
| 13-05-2026 | Initial creation — migrated cross-project protocol from both CLAUDE.md files to Option B structure | Jh |
