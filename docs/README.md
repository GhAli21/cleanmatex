# CleanMateX Documentation Index

**Last Updated:** 2026-01-29

Welcome to the CleanMateX documentation. This index helps you find the right documentation for your needs.

---

## 🚀 Quick Start

**New to the project?** Start here:

1. **Setup:** [Getting Started](../CLAUDE.md) - Project overview and critical rules
2. **Efficiency Guide:** [Claude Code Best Practices](dev/claude-code-efficiency-guide.md) ⭐ **MUST READ**
3. **Quick Reference:** [Quick Reference Card](dev/claude-code-quick-reference.md) - Keep this handy
4. **Architecture:** [System Architecture](plan/master_plan_cc_01.md) - System design and tech stack

---

## 📚 Documentation Structure

```
docs/
├── README.md (this file)           # Documentation index
├── plan/                           # Active plans and PRDs
├── features/                       # Feature-specific documentation
├── dev/                            # Development guides and tools
├── api/                            # API documentation
├── config/                         # Configuration guides
├── deployment/                     # Deployment documentation
└── _archive/                       # Archived documentation
```

---

## 📋 Active Plans & PRDs

**Current Active Plans:**

- [Master Plan](plan/master_plan_cc_01.md) - Complete project roadmap and implementation guide
- [Invoice Feature Plan](plan/invoice_feature_plan.md) - Invoice and payments feature
- [Order Workflow Plan](plan/orders_workflow_plan.md) - Order processing workflow

**Note:** Old plans have been archived to `_archive/2025-01/old-plans/`

---

## 🎯 Features Documentation

Each feature has its own directory with a README.md. Navigate to the feature you're working on:

### Core Features

| Feature | Directory | Status |
|---------|-----------|--------|
| **Authentication** | [001_auth_dev_prd](features/001_auth_dev_prd/) | ✅ Complete |
| **Tenant Management** | [002_tenant_management_dev_prd](features/002_tenant_management_dev_prd/) | ✅ Complete |
| **Customer Management** | [003_customer_management](features/003_customer_management/) | ✅ Complete |
| **Order Intake** | [004_order_intake](features/004_order_intake/) | ✅ Complete |
| **Basic Workflow** | [005_basic_workflow](features/005_basic_workflow/) | ✅ Complete |
| **Digital Receipts** | [006_digital_receipts](features/006_digital_receipts/) | ✅ Complete |
| **Admin Dashboard** | [007_admin_dashboard](features/007_admin_dashboard/) | ✅ Complete |

### Order Processing Features

| Feature | Directory | Status |
|---------|-----------|--------|
| **Service Catalog** | [008_service_catalog_dev_prd](features/008_service_catalog_dev_prd/) | ✅ Complete |
| **Quick Drop** | [008_order_intake_quick_drop_dev_prd](features/008_order_intake_quick_drop_dev_prd/) | ✅ Complete |
| **Order Preparation** | [009 – Order Preparation & Itemization (Dev PRD)](features/009%20–%20Order%20Preparation%20&%20Itemization%20(Dev%20PRD)/) | ✅ Complete |
| **Assembly & QA** | [009_assembly_qa](features/009_assembly_qa/) | ✅ Complete |
| **Workflow Engine** | [010 - Order Workflow Engine (Dev Plan)](features/010%20-%20Order%20Workflow%20Engine%20(Dev%20Plan)/) | ✅ Complete |
| **Advanced Orders** | [010_advanced_orders](features/010_advanced_orders/) | 🚧 Active |
| **Payments** | [010_2_Payment Feature for Order Module](features/010_2_Payment%20Feature%20for%20Order%20Module/) | 🚧 Active |

### Operational Features

| Feature | Directory | Status |
|---------|-----------|--------|
| **Pricing** | [pricing](features/pricing/) | ✅ Complete |
| **Delivery Management** | [013_delivery_management](features/013_delivery_management/) | 📋 Planned |
| **RBAC** | [RBAC](features/RBAC/) | 🚧 Active |

---

## 🛠️ Development Guides

### Essential Guides

- **[Claude Code Efficiency Guide](dev/claude-code-efficiency-guide.md)** ⭐ - How to work efficiently with Claude
- **[Quick Reference Card](dev/claude-code-quick-reference.md)** - One-page cheat sheet
- **[Build Configuration](dev/BUILD_CONFIGURATION_GUIDE.md)** - Build setup and troubleshooting
- **[Creating Tenants](dev/CREATING_TENANTS.md)** - Tenant setup guide
- **[After DB Reset](dev/Do_After_Supabase_db_reset.md)** - Recovery steps after database reset

### Feature Development

- **[Finance & Invoices](dev/finance_invoices_payments_dev_guide.md)** - Invoice and payment implementation
- **[CMX Editable DataTable](dev/cmx-editable-datatable/)** - Reusable data table component

### Database

- **[Current Tables](Database_Design/Current_Tables_jh.md)** - Database schema reference
- **[Migration Reorganization](dev/migration-reorganization.md)** - Migration management guide

---

## 🔧 Configuration

- **[Supabase Auth Setup](config/supabase_auth_setup.md)** - Authentication configuration
- **[Supabase Keys](config/supabase_keys.md)** - Environment variables and keys

---

## 🌐 API Documentation

- **[API Endpoints](api/PRD-002-API-Endpoints.md)** - Complete API reference

---

## 🚢 Deployment

- **[Deployment Guide](deployment/README.md)** - Production deployment instructions
- **[Deployment Index](deployment/INDEX.md)** - Deployment resources

---

## 📦 Archived Documentation

Old plans, completed features, and historical documentation have been moved to:

**[docs/_archive/2025-01/](\_archive/2025-01/)**

```
_archive/2025-01/
├── progress-tracking/       # Old progress/status files (30 files)
├── old-plans/               # Old PRD files (21 files)
├── completed-features/      # Completed implementations (5 files)
├── fixes/                   # Old fix documentation (2 files)
├── database-design/         # Old DB design docs (1 file)
└── features-loose-files/    # Archived feature files (8 files)
```

---

## 🎯 Skills & Best Practices

CleanMateX uses Claude Code Skills for specialized guidance. See [CLAUDE.md](../CLAUDE.md) for complete skill list.

### Core Skills

- `/multitenancy` - **CRITICAL** - Tenant isolation, RLS policies
- `/database` - Schema conventions, migrations, naming
- `/frontend` - Next.js 15, React 19, UI components
- `/backend` - API routes, service layer
- `/i18n` - Bilingual support (EN/AR), RTL layout

### Development Skills

- `/implementation` - Feature development workflow
- `/dev-commands` - CLI commands reference
- `/testing` - Testing strategy and patterns
- `/debugging` - Troubleshooting and fixes
- `/documentation` - Documentation standards

---

## 🔍 Finding Documentation

### By Task

| Task | Where to Look |
|------|---------------|
| **Starting a new feature** | Check [features/](features/) for similar implementations |
| **Database changes** | Use `/database` skill, check [Database Design](Database_Design/) |
| **API development** | See [API docs](api/), use `/backend` skill |
| **UI components** | Use `/frontend` skill, check existing components |
| **Troubleshooting** | See [debugging guides](dev/), use `/debugging` skill |
| **Testing** | Use `/testing` skill |

### By Role

| Role | Key Documentation |
|------|-------------------|
| **New Developer** | [Efficiency Guide](dev/claude-code-efficiency-guide.md), [Quick Reference](dev/claude-code-quick-reference.md), [CLAUDE.md](../CLAUDE.md) |
| **Frontend Developer** | `/frontend` skill, [UI Integration](features/RBAC/), [i18n guide](config/) |
| **Backend Developer** | `/backend` skill, [API docs](api/), [Database Design](Database_Design/) |
| **Full Stack** | [Master Plan](plan/master_plan_cc_01.md), All skills |
| **DevOps** | [Deployment](deployment/), [Config](config/), [Dev Commands](dev/) |

---

## 📊 Documentation Statistics

**Last Audit:** 2026-01-29

- **Total markdown files:** ~365
- **Active plans:** 8 files
- **Feature directories:** 20+ features
- **Archived files:** 67 files (moved to _archive/2025-01/)
- **Feature READMEs created:** 14 new READMEs

---

## 🔄 Maintenance

### When to Update This Index

- After adding new features (add to Features section)
- After archiving old docs (update Archive section)
- After major structural changes
- Monthly review (update statistics)

### Documentation Standards

See [Documentation Skill](../.claude/skills/documentation/SKILL.md) for:
- File naming conventions
- Structure requirements
- When to archive
- How to organize

---

## 💡 Tips for Efficient Documentation Use

1. **Use agents for exploration** - "Explore how feature X works" instead of reading all files
2. **Clear context frequently** - Use `/clear` when switching topics
3. **Start with Quick Reference** - Keep [Quick Reference Card](dev/claude-code-quick-reference.md) handy
4. **Check skills first** - Use `/skill-name` for specialized guidance
5. **Archive aggressively** - Keep active docs lean

---

## 🆘 Need Help?

1. **Claude Code Help:** Type `/help` in Claude Code CLI
2. **Common Issues:** See [debugging guides](dev/) or use `/debugging` skill
3. **Best Practices:** Read [Efficiency Guide](dev/claude-code-efficiency-guide.md)
4. **Report Issues:** https://github.com/anthropics/claude-code/issues

---

**Navigation:**
- [← Back to Project Root](../)
- [CLAUDE.md (Project Instructions)](../CLAUDE.md)
- [Efficiency Guide](dev/claude-code-efficiency-guide.md)
- [Quick Reference](dev/claude-code-quick-reference.md)
