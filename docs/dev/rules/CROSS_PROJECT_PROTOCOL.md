# Cross-Project Work Protocol

**Owned by:** `cleanmatex` CLAUDE.md
**Referenced by:** CLAUDE.md → Cross-Project Work Protocol section
**Last Update:** 13-05-2026

This document contains the full cross-project protocol for features that span `cleanmatex` and `cleanmatexsaas`. Load this when working on any feature that touches both projects.

---

## Context

**Active Project:** `cleanmatex` (Tenant-Facing Application)
- Directory: `F:\jhapp\cleanmatex`
- CLAUDE.md: `F:\jhapp\cleanmatex\CLAUDE.md`
- Skills: `F:\jhapp\cleanmatex\.claude\skills\`
- Standards: `F:\jhapp\cleanmatex\.claude\docs\`

**Sibling Project:** `cleanmatexsaas` (Platform HQ Console)
- Directory: `F:\jhapp\cleanmatexsaas`
- CLAUDE.md: `F:\jhapp\cleanmatexsaas\CLAUDE.md`
- Skills: `F:\jhapp\cleanmatexsaas\.claude\skills\`
- Standards: `F:\jhapp\cleanmatexsaas\.claude\docs\`

---

## Project Differences Quick Reference

| Aspect | cleanmatex (this project) | cleanmatexsaas |
|--------|--------------------------|----------------|
| Purpose | Tenant-facing application | Platform admin console |
| Users | Tenant users (managers, operators, staff) | Platform administrators |
| Database Access | Anon key + RLS | Service role key (bypasses RLS) |
| Tenant Scope | Single tenant only (ALWAYS filter) | All tenants (cross-tenant admin) |
| Migrations | ✅ Create here (source of truth) | ❌ Never create, only consume |
| RLS Policies | ✅ REQUIRED for org_* tables | ❌ Not applicable |
| Query Filtering | ALWAYS by tenant_org_id | Only when tenant-specific |
| Port | 3000 | 3001 (web), 3002 (api) |

---

## Feature Placement Decision

**Before implementing ANY feature**, use the [Feature Placement Guide](.claude/docs/Dev/FEATURE_PLACEMENT_GUIDE.md):

1. **Q1:** Who are the primary users? (Tenant users / Platform admins / Both)
2. **Q2:** What is the data scope? (Single tenant / Cross-tenant / Both)
3. **Q3:** What is the access pattern? (RLS enforced / Service role key / Both)

**Decision Matrix:**
- Tenant Operations (Orders, Customers, Inventory, Lite ERP) → **cleanmatex** (this project)
- Platform Admin (Tenant Management, Billing, Analytics) → **cleanmatexsaas**
- Dual-Purpose (Settings, Feature Flags, Audit Logs) → **Both projects**

---

## MANDATORY STEP 1: Declare Intent First

**BEFORE any implementation**, output this analysis and wait for user approval:

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
- Database schema: [list tables, functions, views]
- Settings: [list new settings]
- Feature flags: [list new flags]
- RLS Policies: [list policies - created in cleanmatex]

**User Confirmation Required Before Proceeding**
```

**WAIT for user approval before proceeding.**

---

## MANDATORY STEP 2: Context Switch Protocol

### Switching to cleanmatexsaas

When switching to cleanmatexsaas context, announce:

```markdown
---
🔄 **CONTEXT SWITCH: cleanmatex → cleanmatexsaas**
---

**New Active Project**: cleanmatexsaas (Platform HQ Console)
**Directory**: F:/jhapp/cleanmatexsaas
**Active CLAUDE.md**: F:/jhapp/cleanmatexsaas/CLAUDE.md
**Active Skills**: F:/jhapp/cleanmatexsaas/.claude/skills/
**Active Standards**: F:/jhapp/cleanmatexsaas/.claude/docs/

**Rules Now in Effect**:
- ✅ Use service role key Supabase client
- ✅ Cross-tenant queries allowed (for admin features)
- ✅ Regenerate types after cleanmatex migrations
- ✅ Implement platform admin features
- ❌ NEVER create migrations here
- ❌ NEVER use RLS-only patterns (we bypass RLS)
```

### Switching back to cleanmatex

When switching back to cleanmatex context, announce:

```markdown
---
🔄 **CONTEXT SWITCH: cleanmatexsaas → cleanmatex**
---

**New Active Project**: cleanmatex (Tenant-Facing Application)
**Directory**: F:/jhapp/cleanmatex
**Active CLAUDE.md**: F:/jhapp/cleanmatex/CLAUDE.md
**Active Skills**: F:/jhapp/cleanmatex/.claude/skills/
**Active Standards**: F:/jhapp/cleanmatex/.claude/docs/

**Rules Now in Effect**:
- ✅ Use RLS policies for ALL org_* tables
- ✅ Use anon key Supabase client
- ✅ Filter ALL queries by tenant_org_id
- ✅ Create migrations HERE (source of truth)
- ✅ Implement tenant-scoped features only
- ❌ NO cross-tenant queries
- ❌ NO service role key usage
```

---

## MANDATORY STEP 3: Database Migrations Protocol

**Absolute rules — NEVER violate:**

| Rule | cleanmatex | cleanmatexsaas |
|------|-----------|----------------|
| **Create migrations** | ✅ ALWAYS HERE (source of truth) | ❌ NEVER HERE |
| **Migration location** | `F:/jhapp/cleanmatex/supabase/migrations/` | N/A |
| **Apply migrations** | ✅ User applies here | ❌ Never |
| **RLS policies** | ✅ MUST implement for org_* tables | ❌ Not applicable (service role bypasses) |
| **Type generation** | ✅ After migration | ✅ After migration (run update-types.ps1) |

**Workflow for database changes:**

1. **Create migration** in `F:/jhapp/cleanmatex/supabase/migrations/` (THIS PROJECT)
2. **Add RLS policies** if creating org_* tables
3. **Stop and tell user** to review and apply migration
4. **Wait for user confirmation** that migration is applied
5. **Tell user** to regenerate types in cleanmatexsaas: Run `F:/jhapp/cleanmatexsaas/scripts/dev/update-types.ps1`
6. **Verify types** in both codebases build successfully

---

## MANDATORY STEP 4: Verification Before Each Context Action

Before executing ANY code, output this verification:

```markdown
### Current Context Verification

- **Active Project**: [cleanmatex | cleanmatexsaas]
- **Current Directory**: [F:/jhapp/cleanmatex | F:/jhapp/cleanmatexsaas]
- **Active CLAUDE.md**: [project]/CLAUDE.md
- **Active Skills Directory**: [project]/.claude/skills/
- **Active Standards Directory**: [project]/.claude/docs/
- **Database Access Pattern**: [RLS + anon key | Service role key]
- **Tenant Filtering**: [ALWAYS filter | Filter only when tenant-specific]
- **Cross-Tenant Queries**: [FORBIDDEN | ALLOWED for admin]

**Action**: [What I'm about to do]
**Correct Context**: [✅ Yes | ❌ No - MUST SWITCH]
```

---

## MANDATORY STEP 5: Skills and Standards Selection

**When in cleanmatex context** (THIS PROJECT), use:
- Skills from: `F:/jhapp/cleanmatex/.claude/skills/`
- Standards from: `F:/jhapp/cleanmatex/.claude/docs/`
- Examples: `/database`, `/create-rls-policy`, `/frontend` (cleanmatex version)

**When in cleanmatexsaas context**, use:
- Skills from: `F:/jhapp/cleanmatexsaas/.claude/skills/`
- Standards from: `F:/jhapp/cleanmatexsaas/.claude/docs/`
- Examples: `/backend-hq`, `/frontend` (cleanmatexsaas version), `/cross-project-sync`

**NEVER mix skills/standards across projects.**

---

## MANDATORY STEP 6: Integration Contract Strategy

**Do not copy implementation code** between `cleanmatex` and `cleanmatexsaas`. Cross-project guidance must explain what the sibling project needs to build, expose, call, or consume — not instruct agents to copy DTOs, enums, utilities, UI components, or source files between repositories.

**Use contracts and ownership instead:**

- **Placement first:** Confirm which project owns the behavior using [Feature Placement Guide](.claude/docs/Dev/FEATURE_PLACEMENT_GUIDE.md)
- **Integration contract:** Document API endpoints, request/response shapes, error shapes, auth expectations, event payloads, generated DB types, or schema ownership
- **Local implementation:** Each project implements its own code using its own rules:
  - `cleanmatex` = RLS + `tenant_org_id`
  - `cleanmatexsaas` = service role + platform admin boundaries
- **Shared implementation exception:** If identical implementation or UI coordination is proposed, stop at an ADR proposal. The ADR is approved only when the ADR file contains the exact marker `Approved_By_Jh` written by the user inside the ADR file. Until then, treat as not approved and do not implement. Do not automatically create packages, copy files, or sync code.

**API-Based Consumption (mandatory for Settings/Feature Flags):**
- Settings: cleanmatexsaas manages (`sys_stng_*`) → cleanmatex consumes via documented HQ API
- Feature Flags: cleanmatexsaas manages (`sys_feature_flags_*`) → cleanmatex consumes via documented HQ API
- ❌ NEVER query `sys_stng_*` or `sys_feature_flags_*` directly from cleanmatex

---

## Error Recovery Protocol

**If a context violation occurs** (e.g. used service role patterns in cleanmatex, forgot to filter by tenant_org_id):

1. **User flags violation:** "Wrong context!"
2. **Immediately stop** and acknowledge the error
3. **Delete/revert** incorrect work
4. **Announce correct context**
5. **Re-do work** in correct context with correct rules

---

## Cross-Project Feature Implementation Checklist

For complete implementation guidance (200+ checkpoints across 12 phases), use:
→ [Cross-Project Feature Checklist](.claude/docs/Dev/CROSS_PROJECT_FEATURE_CHECKLIST.md)

**Quick summary checklist:**

- [ ] Feature placement determined using [Feature Placement Guide](.claude/docs/Dev/FEATURE_PLACEMENT_GUIDE.md)
- [ ] ADR created (if complex cross-project feature) using [ADR Template](.claude/docs/Dev/ADR_TEMPLATE.md)
- [ ] Scope analysis completed and user-approved (Step 1)
- [ ] Context switches announced explicitly (Step 2)
- [ ] Migrations created in cleanmatex — if needed (Step 3)
- [ ] RLS policies added in cleanmatex — if new org_* tables (Step 3)
- [ ] User applied migrations (Step 3)
- [ ] Types regenerated in both projects — if migrations applied (Step 3)
- [ ] Integration contract strategy followed (Step 6)
- [ ] cleanmatex implementation follows cleanmatex rules
- [ ] cleanmatexsaas implementation follows cleanmatexsaas rules
- [ ] Both projects build successfully
- [ ] No context violations occurred
