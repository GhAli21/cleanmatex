# CLAUDE.md — CleanMateX AI Assistant (Modular Edition)

**Scope:** Primary entry-point for Claude Code and AI assistants. Treat linked modules as first-class content of this file.

**Project:** CleanMateX — Multi-Tenant Laundry SaaS Platform

---

## CRITICAL Rules:
** Never do Supabase db reset, I will do migration when needed just tell me**

### Supabase MCPs:
- **for local database Supabase is supabase_local MCP**
- **for remote database Supabase is supabase_remote MCP**

### Modular Imports (Authoritative)

- **Overview & Differentiators** → @.claude/docs/overview.md
- **System Architecture** → @.claude/docs/architecture.md
- **Documentation Rules and implementation Rules** → @.claude/docs/documentation_rules.md
- **Features implementation Rules** → @.claude/docs/prd-implementation_rules.md
- **Database Conventions** → @.claude/docs/database_conventions.md
- **Frontend Rules** → @.claude/docs/frontend_standards.md
- **Frontend Instructions** → @.claude/docs/AI_Coder_Frontend_Instructions.md
- **Internationalization (i18n + RTL)** → @.claude/docs/i18n.md
- **Backend Rules** → @.claude/docs/backend_standards.md
- **Error Handling Patterns** → @.claude/docs/error-handling-rules.md
- **Logging Standards** → @.claude/docs/logging-rules.md
- **Project Next.js UI Layer Blueprint** → @.claude/docs/ui_blueprint.md
- **Node.js Development Rules** → @.claude/docs/nodejs-rules.md
- **Supabase Usage Guidelines** → @.claude/docs/supabase-rules.md
- **Flutter Development Rules** → @.claude/docs/flutter-rules.md
- **UI/UX Design** → @.claude/docs/uiux-rules.md
- **Business Logic & Workflows** → @.claude/docs/business_logic.md
- **Multi-Tenancy Enforcement** → @.claude/docs/multitenancy.md
- **Testing Strategy** → @.claude/docs/testing.md
- **Dev Commands & Tooling** → @.claude/docs/dev_commands.md
- **Environment Configuration** → @.claude/docs/env_config.md
- **Code Review Checklist** → @.claude/docs/code_review_checklist.md
- **Documentation Map** → @.claude/docs/documentation_map.md
- **Project Structure** → @.claude/docs/project_structure.md
- **Common Issues & Debugging** → @.claude/docs/common_issues.md
- **Working With Claude Code** → @.claude/docs/working_with_claude_code.md
- **Status & Roadmap** → @.claude/docs/roadmap.md
- **Support & External Resources** → @.claude/docs/support_resources.md

> Use: `claude "@.claude/docs/architecture.md - summarize RLS patterns"`

### Quick Reference

**IMPORTANT**: This is the main reference file. Detailed documentation is split into modules below.

**Always Follow Documentation and implementation Rules**: `.claude/docs/documentation_rules.md`

### Documentation And Progress Rules

**Always Follow Documentation and implementation Rules**: `.claude/docs/documentation_rules.md`

- For each work session, the user will explicitly specify the **feature or task** to be worked on
- Claude must **only** review and update documentation related to the user-specified feature or task by following instructions in `.claude/docs/documentation_rules.md`
- Claude must not autonomously decide to switch or select topics outside the user instruction.
- Documentation updates and progress checks must strictly follow the directed focus by following instructions in `.claude/docs/documentation_rules.md`

### Priority Rules

**Always Follow Documentation and implementation Rules**: `.claude/docs/documentation_rules.md`
**Always Follow implementation Rules**: `.claude/docs/prd-implementation_rules.md`
**Always Create OR Update the documents that captures all remaining work and tasks from the current session to be used as reference in the next session, preventing any loss of context or progress when this session expires**: `.claude/docs/documentation_rules.md`

1. **Always check implementation plans first**: `docs/plan/master_plan_cc_01.md`
2. **Always Follow implementation Rules**: `.claude/docs/prd-implementation_rules.md`
3. **Every query MUST filter by `tenant_org_id`** - NO EXCEPTIONS
4. **Use free/open-source tools whenever possible**
5. **Bilingual support (EN/AR) is mandatory**
6. **All documentation files must be placed under the docs/ directory according to the type of documentation. **: `docs/`
7. **Always after finish Implement or modify any frontend component Do run build (npm run build) and fix the issues to make sure the project always ready for deploy**
8. **When you run build and you find issues fix it and keep run build until it success and keep updating the issue info to common issues file**: .claude/docs/common_issues.md

### Operating Model

**Always Follow implementation Rules**: `.claude/docs/prd-implementation_rules.md`

1. **Always check implementation plans first.**

   - `docs/plan/master_plan_cc_01.md`
   - Other plans in `docs/plan/`

2. **Imports below are canonical.** Claude Code: reference modules with the `@` syntax, e.g.

   - `@.claude/docs/architecture.md`
   - `@.claude/docs/multitenancy.md`  
     When prompted from this root file, treat imported content as inlined.

3. **Security + Multi-Tenant discipline is non-negotiable.**
   - Every query filters by `tenant_org_id`
   - RLS enforced and tested
   - Composite FKs across tenant tables
   - Never ship hardcoded secrets

---

### Critical Guardrails (Keep in Root)

1. **Multi-Tenant Filtering:** Always filter by `tenant_org_id`.
2. **RLS Policies:** Create, enable, and test RLS on every org\_\* table.
3. **Composite Keys:** Use composite FKs for tenant-scoped joins.
4. **Bilingual Fields:** `name/name2`, `description/description2` for user-facing text.
5. **Audit Fields:** `created_at/_by`, `updated_at/_by`, `rec_status`, `is_active`.
6. **Soft Delete:** Prefer `is_active=false` over hard deletes.
7. **Plans First:** Check `docs/plan/master_plan_cc_01.md` before new work.
8. **Testing:** Cover business logic and tenant isolation.
9. **Performance:** Indexes, avoid N+1, paginate.
10. **Security:** No secrets in client, validate all inputs.

---

## QUICK START

### Quick Start Prompts

- `@docs/plan/master_plan_cc_01.md - What is the next execution item?`
- `@.claude/docs/project_structure.md - scaffold orders module folders in web-admin`
- `@supabase/migrations/0001_core.sql - generate TS types for org_orders_mst`
- `@.claude/docs/multitenancy.md - verify RLS examples and write a test`
- `@.claude/docs/prd-implementation_rules.md - `

### For New Features

1. Check **[master_plan_cc_01.md](@docs/plan/master_plan_cc_01.md)** for current priorities
2. Review **[Architecture](@.claude/docs/architecture.md)** for system design
3. Follow **[Database conventions](@.claude/docs/database_conventions.md)** for schema changes
4. Implement **[Multitenancy Security patterns](@.claude/docs/multitenancy.md)** for multi-tenancy
5. Add **[i18n support](@.claude/docs/i18n.md)** for multi-language and localization and all user-facing text

### For Bug Fixes

1. Check **[Debugging Guide](@.claude/docs/common_issues)** for known issues
2. Verify **[Multi-tenant isolation](@.claude/docs/multitenancy.md)** is maintained
3. Run tests per **[Testing Strategy](.claude/docs/testing.md)**

### For Development

- **Dev Commands & Tooling** → @.claude/docs/dev_commands.md
- **Environment Configuration** → @.claude/docs/env_config.md
- **Code Review Checklist** → @.claude/docs/code_review_checklist.md

1. Setup environment per **[Commands Guide](@.claude/docs/dev_commands.md)**
2. Configure per **[Environment Setup](@.claude/docs/env_config.md)**
3. Follow **[Claude Code Tips](@.claude/docs/working_with_claude_code.md)** for efficient AI collaboration

### Daily Startup

**Quick Start (Automated):**

```powershell
# From project root - starts all services
.\scripts\dev\start-services.ps1
```

**Service Management:**

- **Start:** `.\scripts\dev\start-services.ps1`
- **Status:** `.\scripts\dev\status-services.ps1`
- **Stop:** `.\scripts\dev\stop-services.ps1`

**Then start web admin:**

```bash
cd web-admin
npm run dev
```

See **[Quick Start Guide](@docs/dev/QUICK_START.md)** for detailed instructions.

**Important:** We use Supabase Local's PostgreSQL (port 54322), NOT a separate Docker postgres container.

---

## 🏗️ PROJECT STRUCTURE

```
cleanmatex/
├── supabase/              # Database & Auth (PostgreSQL + RLS)
├── web-admin/             # Next.js Admin Dashboard (Active)
├── backend/               # NestJS API (Phase 2)
├── mobile-apps/
    ├── customer-app/          # Flutter Customer App (Future)
    ├── driver-app/            # Flutter Driver App (Future)
    ├── store-app/             # Flutter Store App (Future)
└── docs/                  # All documentation
```

---

## 🎯 CURRENT STATUS

### Phase 1: MVP (In Progress)

- ✅ Database schema with multi-tenancy
- ✅ Supabase setup with RLS
- 🚧 Web admin UI development
- 🚧 Order management system
- ⏳ Customer management
- ⏳ Basic invoicing

### Phase 2: Backend Enhancement

- ⏳ NestJS backend for complex logic
- ⏳ Payment gateway integration
- ⏳ WhatsApp Business API
- ⏳ Advanced reporting

### Phase 3: Mobile Apps

- ⏳ Flutter customer app
- ⏳ Driver tracking app
- ⏳ Store staff app

---

## 🚨 CRITICAL REMINDERS

### Always

✅ Filter by `tenant_org_id` in EVERY query  
✅ Include audit fields in new tables  
✅ Add bilingual fields (name/name2)  
✅ Test multi-tenant isolation  
✅ Use TypeScript strict mode

### Never

❌ Query without tenant filter  
❌ Hardcode secrets  
❌ Skip RLS policies  
❌ Use `any` in TypeScript  
❌ Deploy without testing

---

## 📚 EXTERNAL RESOURCES

- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **NestJS**: https://docs.nestjs.com/
- **PostgreSQL**: https://postgresql.org/docs
- **TypeScript**: https://typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Note**: This file is optimized for Claude Code. For detailed information, navigate to the specific module documentation linked above.

**Version:** 3.0 (Modular) • **Status:** Active Development — MVP
