# .cursor/rules vs .claude Audit Report

**Date:** 2026-03-12  
**Scope:** Section-by-section comparison of `.cursor/rules/*.mdc` with corresponding `.claude` docs/skills

---

## Executive Summary

- **prdimplementationrules.mdc** — "Feature Implementation Requirements (Documentation Checklist)" section is **MISSING** in `.claude/skills/implementation/prd-rules.md`
- **documentationrules.mdc** — "Feature Implementation Requirements Checklist" (Section 2) is **MISSING** in `.claude/skills/documentation/reference.md`; `deploy_guide.md` is missing from the folder structure list
- **frontendstandards.mdc** — "web-admin/.clauderc (AI Hints)" section is **MISSING** in `.claude` frontend docs/skills
- **report-implement-or-build.mdc** — "use centralized/reusable themes/fonts/layout/ UI/UX" is **MISSING** in `.claude`
- **settings-reference.mdc** — **NO equivalent** in `.claude` (always-applied rule with no .claude counterpart)
- Several `.claude` files have **MORE** content than `.cursor` (e.g., tenant context, centralized `getTenantIdFromSession`)

---

## 1. prdimplementationrules.mdc

### Main Sections (## headers)

| Section | .cursor | .claude docs | .claude skills |
|---------|---------|--------------|----------------|
| Don't Do This | ✅ | ✅ (legacy) | ✅ prd-rules.md |
| Code Style | ✅ | ✅ | ✅ |
| Error Handling | ✅ | ✅ | ✅ |
| Logging | ✅ | ✅ | ✅ |
| Git Commit Conventions | ✅ | ✅ | ✅ |
| API Versioning | ✅ | ✅ | ✅ |
| Performance Guidelines | ✅ | ✅ | ✅ |
| Architecture Notes | ✅ | ✅ | ✅ |
| Security Best Practices | ✅ | ✅ | ✅ |
| **Feature Implementation Requirements (Documentation Checklist)** | ✅ | ❌ | ❌ |
| Code Review Checklist | ✅ | ✅ | ✅ |
| Related Documentation | ✅ | ✅ | ✅ |

### MISSING in .claude

**File:** `.claude/skills/implementation/prd-rules.md`  
**Section:** "Feature Implementation Requirements (Documentation Checklist)"

The entire section (lines 393–416 in prdimplementationrules.mdc) is **absent** from prd-rules.md. It goes directly from "Security Best Practices" to "Code Review Checklist".

**Content that should exist in .claude:**

```markdown
## Feature Implementation Requirements (Documentation Checklist)

**CRITICAL**: When implementing any feature, add to the feature documentation a list of platform-level items that must be done or considered. Include this in the feature's `README.md`, `development_plan.md`, or a dedicated `implementation_requirements.md`.

### Required Checklist Items

Document which of the following apply to the feature (mark N/A if not applicable):

- [ ] **New permissions** — Add to `sys_permission_*` and assign to roles
- [ ] **Navigation tree / screen** — Add new menu item or screen to `sys_nav_tree_*` / sys tree
- [ ] **New tenant setting** — Add to `sys_tenant_settings_cd` and seed data
- [ ] **New feature flag** — Add to `sys_ff_*` if feature is gated
- [ ] **New plan limit / constraint** — Add to plan limits if feature is tiered
- [ ] **New i18n keys** — Add to `en.json` / `ar.json` (search existing first)
- [ ] **New API route(s)** — Document endpoint(s) and version
- [ ] **Database migration(s)** — New tables, columns, indexes, RLS
- [ ] **New constants / types** — Add to `lib/constants/` and `lib/types/`
- [ ] **RBAC / role changes** — Update role-permission mappings
- [ ] **Environment variables** — New `.env` keys if needed
- [ ] **Other** — Document any other platform-level requirements

Use this checklist during planning and keep it updated as the feature evolves.
```

**Note:** `.claude/skills/implementation/SKILL.md` Phase 6 references "Feature Implementation Requirements" and points to `/documentation` skill. `.claude/skills/documentation/SKILL.md` has a more detailed "Feature Implementation Documentation Checklist" with different structure (categories vs flat list). The simple flat checklist above is not present in prd-rules.md.

### .cursor has LESS than .claude

- **Don't Do This:** `.claude` adds: "NEVER create duplicate `getTenantIdFromSession()` implementations"
- **Security Best Practices / Multi-Tenant Security:** `.claude` adds full "Centralized Tenant Context Management" block (Prisma, Supabase, API routes, code review checklist)
- **Code Review Checklist:** `.claude` adds tenant context bullets (no duplicate getTenantIdFromSession, withTenantContext, .eq('tenant_org_id'))

---

## 2. documentationrules.mdc

### Main Sections (## headers)

| Section | .cursor | .claude docs | .claude skills reference.md |
|---------|---------|--------------|-----------------------------|
| 1. Folder and Lookup File Structure | ✅ | N/A (minimal doc) | ✅ |
| **2. Feature Implementation Requirements Checklist** | ✅ | ❌ | ❌ |
| 3. Documentation Folder Structure and Content | ✅ | N/A | ✅ (as "2.") |
| 4. Content and Metadata Standards | ✅ | N/A | ✅ (as "3.") |
| 5. Versioning and Change Management | ✅ | N/A | ✅ |
| 6. User Guide and Workflow Documentation | ✅ | N/A | ✅ |
| 7. Developer Guide and Code Flow Documentation | ✅ | N/A | ✅ |
| 8. Testing Scenarios | ✅ | N/A | ✅ |
| 9. Regular Updates and Synchronization | ✅ | N/A | ✅ |
| 10. Automated Validation and Enforcement | ✅ | N/A | ✅ |
| 11. Versioning and Release Tag Enforcement Rules | ✅ | N/A | ✅ |
| 11. Consolidated Checklist | ✅ | N/A | ✅ |
| 13. Sample Folder Tree | ✅ | N/A | ✅ |

### MISSING in .claude

**File:** `.claude/skills/documentation/reference.md`  
**Section:** "2. Feature Implementation Requirements Checklist"

The entire section 2 from documentationrules.mdc is **absent** from reference.md. reference.md jumps from "1. Folder and Lookup File Structure" to "2. Documentation Folder Structure and Content" (which corresponds to .cursor's section 3).

**Content that should exist:**

```markdown
## 2. Feature Implementation Requirements Checklist

When implementing any feature, add to the feature documentation a list of platform-level items that must be done or considered. Include this in `development_plan.md`, `README.md`, or a dedicated `implementation_requirements.md`.

**Document which of the following apply** (mark N/A if not applicable):

- **Platform docs** — See [docs/platform/README.md](../../docs/platform/README.md) for permissions, settings, feature flags, and plan limits reference
- **New permissions** — Add to `sys_permission_*` and assign to roles
- **Navigation tree / screen** — Add new menu item or screen to sys tree
- **New tenant setting** — Add to `sys_tenant_settings_cd` and seed data
- **New feature flag** — Add to `sys_ff_*` if feature is gated
- **New plan limit / constraint** — Add to plan limits if feature is tiered
- **New i18n keys** — Add to `en.json` / `ar.json` (search existing first)
- **New API route(s)** — Document endpoint(s) and version
- **Database migration(s)** — New tables, columns, indexes, RLS
- **New constants / types** — Add to `lib/constants/` and `lib/types/`
- **RBAC / role changes** — Update role-permission mappings
- **Environment variables** — New `.env` keys if needed
- **Other** — Document any other platform-level requirements

See also: [PRD Implementation Rules](./prdimplementationrules.mdc#feature-implementation-requirements-documentation-checklist)
```

**File:** `.claude/docs/documentation_rules.md`  
- This file is a minimal "Authority Note" and does not contain the full documentation structure or checklist. It defers to `docs/README.md`.

### INCOMPLETE in .claude

**File:** `.claude/skills/documentation/reference.md` — Section "2. Documentation Folder Structure and Content"

- **Missing file:** `deploy_guide.md`  
  - .cursor section 3 lists: `deploy_guide.md` — Step-by-step deploy workflows, requirements, FAQs, troubleshooting  
  - reference.md does **not** include `deploy_guide.md` in the required files list.

### .claude has MORE (different structure)

- `.claude/skills/documentation/SKILL.md` has "Feature Implementation Documentation Checklist" with categories (Security & Access Control, Navigation & UI Structure, Configuration & Settings, etc.) and a full example. This is more detailed but uses a different structure than the flat checklist in documentationrules.mdc.

---

## 3. frontendstandards.mdc

### Main Sections (## headers)

| Section | .cursor | .claude docs | .claude skills |
|---------|---------|--------------|----------------|
| **web-admin/.clauderc (AI Hints)** | ✅ | ❌ | ❌ |
| 1. Tech Stack & Core Principles | ✅ | ✅ | ✅ |
| 2. Folder Responsibilities | ✅ | ✅ | ✅ |
| 3. UI Standards | ✅ | ✅ | ✅ |
| 4. Forms & Validation | ✅ | ✅ | ✅ |
| 5. API Client & Data Fetching | ✅ | ✅ | ✅ |
| 6. Supabase Types Usage | ✅ | ✅ | ✅ |
| 7. Tables, Charts, and Analytics | ✅ | ✅ | ✅ |
| 8. Error Handling & UX | ✅ | ✅ | ✅ |
| 9. Linting, Formatting, and DX | ✅ | ✅ | ✅ |
| 10. Quick Rules Checklist | ✅ | ✅ | ✅ |

### MISSING in .claude

**File:** `.claude/docs/frontend_standards.md`, `.claude/skills/frontend/standards.md`  
**Section:** "web-admin/.clauderc (AI Hints)"

The entire section is **absent** from both .claude files. No .claude doc or skill explains:
- What `.clauderc` is
- Why it matters (ui_components for AI import suggestions)
- The 5 rules (sync with src/ui, Cmx only, comment section, version control, don't rely for correctness)
- Current snippet keys (button, input, textarea, select, etc.)

**Content:** See `.cursor/rules/frontendstandards.mdc` lines 42–56.

---

## 4. report-implement-or-build.mdc

### Content (always-applied, no ## headers)

- When building/Implementing A New report: put main feature name + report name + `rprt` suffix (e.g. `orders-payments-print-rprt.tsx`)
- Always use best practice
- Use centralized/reusable themes/fonts/layout/ UI/UX for all alike reports

### .claude equivalent

- **File:** `.claude/skills/frontend/architecture.md` (line 20)  
- **Present:** Naming rule (feature + report name + `rprt`)  
- **MISSING:** "use centralized/reusable themes/fonts/layout/ UI/UX for all alike reports"

---

## 5. settings-reference.mdc

### Content (always-applied)

- Query `sys_tenant_settings_cd` for live data
- Or read `F:\jhapp\cleanmatex\.claude\docs\Allsettings.md` / `Allsettings.json` for offline reference

### .claude equivalent

**NONE.** There is no dedicated .claude doc or skill for "when you need to check settings."  
- `sys_tenant_settings_cd` appears in database grandfathered objects  
- Allsettings.md/Allsettings.json exist but are not referenced by any rule/skill

---

## 6. web-admin-ui-imports.mdc

### Content (always-applied)

- Use Cmx design system only
- Use exact import snippets from `web-admin/.clauderc` ui_components
- Run `npm run build` after UI changes
- Restricted: `@ui/compat`, `@/components/ui`, `@/components/ui/*`

### .claude equivalent

- Overlaps with `frontendstandards.mdc` "web-admin/.clauderc" section
- That section is **missing** from .claude (see #3)
- No standalone .claude rule for web-admin UI imports

---

## 7. codereviewchecklist.mdc

### Content

- Security, Isolation, Performance, Quality, Testing, i18n, Docs

### .claude equivalent

- **Files:** `.claude/docs/code_review_checklist.md`, `.claude/skills/implementation/code-review.md`
- **MORE in .claude:** Centralized tenant context bullets (no duplicate getTenantIdFromSession, withTenantContext, .eq('tenant_org_id'))
- **.cursor has LESS:** No tenant context items

---

## 8. documentationmap.mdc

### Content

- Requirements → `docs/Requirments Specifications/clean_mate_x_unified_requirements_pack_v_0.12.1.md`
- Plans → `docs/plan/`
- Database → `docs/Database_Design/`
- Config → `docs/config/`

### .claude equivalent

- **File:** `.claude/docs/documentation_map.md`
- **Different structure:** Uses `docs/README.md` as main index; Key Areas with different paths
- **Note:** .cursor has typo `Requirments`; .claude uses `docs/` more generally

---

## 9. Other Rules (Brief)

| .cursor rule | .claude equivalent | Gap |
|--------------|--------------------|-----|
| errorhandlingrules.mdc | error-handling-rules.md, debugging/error-handling.md | Aligned |
| loggingrules.mdc | logging-rules.md, debugging/logging.md | Aligned |
| multitenancy.mdc | multitenancy.md, skills/multitenancy | .cursor is shorter; .claude has more |
| databaseconventions.mdc | database_conventions.md, skills/database | Aligned |
| postgresqlrules.mdc | postgresql-rules.md, postgresql-prisma.md | Aligned |
| supabaserules.mdc | supabase-rules.md, backend/supabase-rules.md | Aligned |
| i18n.mdc | i18n.md, skills/i18n | Aligned |
| testing.mdc | testing.md, skills/testing | Aligned |
| devcommands.mdc | dev_commands.md, skills/dev-commands | Aligned |
| commonissues.mdc | common_issues.md, debugging/common-issues.md | Aligned |
| uiblueprint.mdc | ui_blueprint.md, frontend/ui-blueprint.md | Aligned |
| uiuxrules.mdc | uiux-rules.md, frontend/uiux-rules.md | Aligned |
| nodjsrules.mdc | (nodjsrules — agent-requestable) | Not in .claude docs |
| rulesenhancementanalysis.mdc | rules_enhancement_analysis.md | Meta-analysis doc |
| databasetablecheckworkflow.mdc | database_table_check_workflow.md, table-check-workflow.md | Aligned |
| overview.mdc | overview.md | .claude marked legacy |
| roadmap.mdc | roadmap.md | Aligned |
| supportresources.mdc | support_resources.md | Aligned |

---

## Complete List: Missing/Incomplete Content

| # | File Path | Section / Content | Status |
|---|-----------|-------------------|--------|
| 1 | `.claude/skills/implementation/prd-rules.md` | Feature Implementation Requirements (Documentation Checklist) | **MISSING** |
| 2 | `.claude/skills/documentation/reference.md` | Feature Implementation Requirements Checklist (Section 2) | **MISSING** |
| 3 | `.claude/skills/documentation/reference.md` | `deploy_guide.md` in Documentation Folder Structure list | **MISSING** |
| 4 | `.claude/docs/frontend_standards.md`, `.claude/skills/frontend/standards.md` | web-admin/.clauderc (AI Hints) section | **MISSING** |
| 5 | `.claude/skills/frontend/architecture.md` (or equivalent) | "use centralized/reusable themes/fonts/layout/ UI/UX for all alike reports" | **MISSING** |
| 6 | `.claude` (any doc/skill) | Settings reference rule (sys_tenant_settings_cd, Allsettings.md/Allsettings.json) | **NO EQUIVALENT** |
| 7 | `.claude/docs/documentation_rules.md` | Full documentation structure and checklist | Minimal; defers to docs/README.md |

---

## .cursor Rules with MORE Detail Than .claude

| .cursor rule | Section | Extra in .cursor |
|--------------|---------|-----------------|
| prdimplementationrules.mdc | Feature Implementation Requirements | Full checklist (12 items) — not in prd-rules.md |
| documentationrules.mdc | Feature Implementation Requirements Checklist | Platform docs link, flat checklist — not in reference.md |
| documentationrules.mdc | Documentation Folder Structure | deploy_guide.md — not in reference.md |
| frontendstandards.mdc | web-admin/.clauderc | Entire section (5 rules, snippet keys) — not in .claude |
| report-implement-or-build.mdc | — | "centralized/reusable themes/fonts/layout" — not in .claude |

---

## Recommendations

1. **Add to `.claude/skills/implementation/prd-rules.md`:** The "Feature Implementation Requirements (Documentation Checklist)" section from prdimplementationrules.mdc.
2. **Add to `.claude/skills/documentation/reference.md`:** Section 2 "Feature Implementation Requirements Checklist" and include `deploy_guide.md` in the folder structure list.
3. **Add to `.claude/skills/frontend/standards.md` (and optionally docs):** The "web-admin/.clauderc (AI Hints)" section from frontendstandards.mdc.
4. **Add to `.claude/skills/frontend/architecture.md`:** "use centralized/reusable themes/fonts/layout/ UI/UX for all alike reports."
5. **Create `.claude/docs/settings_reference.md` or add to an existing skill:** Settings lookup rule (sys_tenant_settings_cd, Allsettings.md/Allsettings.json).
6. **Sync tenant context rules:** Ensure .cursor prdimplementationrules.mdc and codereviewchecklist.mdc include the centralized tenant context items present in .claude.
