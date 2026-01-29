
how to solve those "Primary Causes in Your Project"
Here's how to solve each primary cause and optimize your context usage:

1. Massive Git Status Load
Problem: 50+ modified files loaded every conversation

Solutions:


# Option A: Commit your work in logical chunks
git add web-admin/app/dashboard/orders/
git commit -m "Update order management UI"

# Option B: Stash work-in-progress
git stash push -m "WIP: pricing feature"

# Option C: Create feature branch and clean main
git checkout -b feature/pricing
git commit -am "WIP: pricing implementation"
git checkout main
Best Practice: Keep modified files under 10-15 at a time

2. Skills System Auto-Loading
Problem: 15+ skills loading documentation automatically

Solutions:

Option A: Streamline Skills (Recommended)


# Move rarely-used skills to archive
mkdir .claude/skills/_archived
mv .claude/skills/codebase-visualizer .claude/skills/_archived/
mv .claude/skills/explain-code .claude/skills/_archived/
Option B: Consolidate Skills

Merge related skills (e.g., combine backend + architecture)
Keep only active development skills
Option C: Reduce Skill File Sizes
Edit .claude/skills/*/SKILL.md files to be more concise:

Remove redundant examples
Keep only essential rules
Use references instead of full content
Quick Win:


# Check skill file sizes
ls -lh .claude/skills/**/*.md

# Target: Keep each skill under 500 lines
3. Large Documentation Set
Problem: Multiple plans, guides, migration files loaded

Solutions:

A: Archive Completed Work


# Create archive structure
mkdir -p docs/_archive/{2025-01,completed-features}

# Move completed feature docs
mv docs/plan/pricing_feature_summary.md docs/_archive/completed-features/
mv .cursor/plans/*.plan.md docs/_archive/2025-01/

# Keep only active plans in docs/plan/
B: Use Single Source of Truth


# Instead of multiple pricing docs, maintain one:
docs/features/pricing/README.md  # Main reference
# Delete:
# - docs/plan/pricing_feature_implementation_plan.md
# - docs/plan/pricing_feature_summary.md
# - docs/plan/pricing_database_verification.md
C: Reduce Migration Context


# Migrations don't need to be tracked - they're in DB
# Remove from active context by moving to archive after running
4. CLAUDE.md Instructions
Problem: Comprehensive instructions load every time

Solutions:

Option A: Split CLAUDE.md (Recommended)


# CLAUDE.md (keep essentials only - ~100 lines)
**Project:** CleanMateX — Multi-Tenant Laundry SaaS

## CRITICAL RULES (Top 5 only)
1. Never do Supabase db reset
2. Every query MUST filter by tenant_org_id
3. After frontend changes: run npm run build
4. Bilingual support (EN/AR + RTL) mandatory
5. Check skills for detailed guidance

## Quick Reference
- Skills: Use /skill-name for detailed rules
- Docs: See docs/README.md for architecture
- Structure: web-admin/ (Active), supabase/ (DB)

# Move detailed rules to skills:
# Database rules → .claude/skills/database/SKILL.md
# Code rules → .claude/skills/implementation/SKILL.md
# UI rules → .claude/skills/frontend/SKILL.md
Option B: External Reference Pattern


# CLAUDE.md
See detailed documentation:
- Database: .claude/skills/database/
- Frontend: .claude/skills/frontend/
- Architecture: docs/architecture/README.md
5. Bilingual Project Complexity
Problem: EN/AR message files double UI context

Solutions:

A: Don't Load Message Files Automatically

Remove auto-loading of messages/*.json
Load only when working on i18n
B: Use Message Key Patterns
Instead of loading full files, document patterns:


# In .claude/skills/i18n/SKILL.md
Message key patterns:
- common.* - Shared UI elements
- orders.* - Order management
- Use existing keys before creating new ones
- Check: npx i18n-unused (to find duplicates)
C: Split Message Files by Domain


# Instead of monolithic en.json/ar.json
messages/
  en/
    common.json      # ~50 keys
    orders.json      # ~100 keys
    catalog.json     # ~80 keys
  ar/
    common.json
    orders.json
    catalog.json
Implementation Plan
Phase 1: Quick Wins (Do Now - 15 min)


# 1. Commit or stash changes
git add . && git commit -m "WIP: current work"

# 2. Archive old plans
mkdir -p docs/_archive/2025-01
mv .cursor/plans/*.plan.md docs/_archive/2025-01/

# 3. Archive completed features
mv docs/plan/pricing_feature_summary.md docs/_archive/completed-features/
Phase 2: Streamline Skills (30 min)


# 1. Archive utility skills
mkdir .claude/skills/_archived
mv .claude/skills/codebase-visualizer .claude/skills/_archived/

# 2. Edit CLAUDE.md - reduce to ~100 lines
# 3. Move detailed rules into respective skills
Phase 3: Documentation Cleanup (1 hour)


# 1. Consolidate feature docs
# 2. Create docs/README.md as index
# 3. Remove duplicate documentation
Expected Results
Before:

Git status: 50+ files
Skills: 15+ files loaded
CLAUDE.md: 200+ lines
Context usage: Hits 95%+ quickly
After:

Git status: <15 files (committed/stashed)
Skills: 8-10 core skills
CLAUDE.md: ~100 lines
Context usage: ~40-60% for typical tasks
Quick Start Template
Create this file to track context optimization:


# docs/dev/context-optimization.md
# Context Optimization Checklist

## Before Starting Work
- [ ] Commit or stash unrelated changes
- [ ] Check git status (<15 files)
- [ ] Clear Claude context (/clear)

## During Work
- [ ] Focus on single feature
- [ ] Load only necessary files
- [ ] Use /skill-name for guidance (don't ask broad questions)

## After Work
- [ ] Commit completed work
- [ ] Archive completed docs
- [ ] Update this checklist
Would you like me to help implement any of these solutions? I can start with Phase 1 (quick wins) if you'd like.

====================

Summary
I've successfully built a complete, best-practice Claude Code Skills structure for CleanMateX following the official documentation. Here's what was accomplished:

✅ Created 14 Properly Structured Skills
Priority 1: Critical Security & Core Development

✅ multitenancy - RLS policies, tenant isolation (CRITICAL)
✅ database - Schema conventions, naming patterns, 30-char limit
✅ frontend - Next.js 15, React 19, Cmx Design System
✅ debugging - Common issues, build fixes, quick reference
Priority 2: Foundation & Architecture
5. ✅ architecture - System design, tech stack
6. ✅ backend - API routes, service layer
7. ✅ i18n - Bilingual EN/AR, RTL support
8. ✅ business-logic - Order workflows, pricing

Priority 3: Development Workflow
9. ✅ implementation - Feature development workflow
10. ✅ dev-commands - Supabase, Prisma commands
11. ✅ testing - Multi-tenant testing strategy
12. ✅ documentation - Documentation standards

Kept Existing:
13. ✅ explain-code - Already properly formatted
14. ✅ codebase-visualizer - Existing utility

✅ Key Features
YAML Frontmatter - All skills have proper frontmatter with name, description, user-invocable
Auto-Invocation - Clear descriptions tell Claude when to invoke each skill
Supporting Files - Each skill has reference documentation (35+ supporting files)
Under 500 Lines - All SKILL.md files are concise with details in supporting files
Hierarchical Organization - Each skill in its own directory
✅ Files Created/Modified
Created:

14 SKILL.md files with YAML frontmatter
35+ supporting reference files
.claude/skills/README.md - Comprehensive skills directory documentation
Modified:

CLAUDE.md - Updated with new skills documentation section
Removed:

7 old wrapper skill files (architecture.md, backend_standards.md, etc.)
✅ Skills Follow Best Practices
Clear Descriptions - Each skill has a description that includes keywords for auto-invocation
Proper Format - YAML frontmatter, structured content, resource links
Context-Aware - Skills are invoked automatically based on work context
Scannable - Quick reference sections for fast lookup
Complete - Supporting files provide comprehensive documentation
📂 Final Structure

.claude/skills/
├── README.md (skills directory documentation)
├── multitenancy/    (SKILL.md + reference.md)
├── database/        (SKILL.md + 6 supporting files)
├── frontend/        (SKILL.md + 4 supporting files)
├── debugging/       (SKILL.md + 3 supporting files)
├── architecture/    (SKILL.md + 2 files)
├── backend/         (SKILL.md + 2 files)
├── i18n/            (SKILL.md + reference.md)
├── business-logic/  (SKILL.md + reference.md)
├── implementation/  (SKILL.md + 2 files)
├── dev-commands/    (SKILL.md + reference.md)
├── testing/         (SKILL.md + reference.md)
├── documentation/   (SKILL.md + reference.md)
├── explain-code/    (existing)
├── codebase-visualizer/ (existing)
└── navigation/      (existing)
🎯 Next Steps
The skills are now ready to use! They will:

Auto-invoke when Claude detects relevant work
Provide consistent guidance across development tasks
Ensure critical rules (multi-tenancy, naming conventions) are always followed
Support both manual invocation (/skill-name) and automatic context-based loading
All skills are production-ready and follow the official Claude Code best practices! 🚀

===================


Done! Here's the summary of changes:

Changes Made
1. CLAUDE.md Slimmed Down
Before: 255 lines
After: 53 lines
Savings: ~80% reduction
Key changes:

Removed 25+ modular imports list (now use /skill-name on-demand)
Removed redundant sections (Quick Start, Project Structure, Current Status)
Kept only critical rules and essential commands
2. Redundant Documentation Removed
Files deleted (6 files):

ui_general_rules.md - duplicated database_conventions.md
nodjs-rules.md - tiny file, content in backend_standards.md
postgresql and prisma-rules.md - duplicate of postgresql-rules.md
tenant-isolation-guide.md - content in multitenancy.md
frontend-nextjs-rules.md - overlapped with frontend_standards.md
backend-nestjs-rules.md - overlapped with backend_standards.md
Before: 39 files
After: 33 files

Expected Impact
Change	Context Savings
CLAUDE.md slim	~30-40%
6 docs removed	~15-20%
Expanded deny list (previous)	~15-25%
Concise output (previous)	~10-15%
Total estimated	~50-70%
Your sessions should now last significantly longer.

=================

🛠️ Recommendations to Extend Session Life

1. Slim Down CLAUDE.md (HIGH IMPACT)
Your CLAUDE.md is ~255 lines with extensive inline content AND references to 25+ external docs. Consider:

# CLAUDE.md — CleanMateX (Slim Version)

## Critical Rules (Always Apply)
1. Filter by `tenant_org_id` - NO EXCEPTIONS
2. Never do `supabase db reset`
3. Run `npm run build` after frontend changes
4. Use `cmxMessage` for all UI messages

## Reference Docs (Load On-Demand)
Use `@.claude/docs/{name}.md` ONLY when needed for current task:
- Database work → @database_conventions.md
- Frontend → @frontend_standards.md
- Multi-tenancy → @multitenancy.md

Reduce from 255 lines to ~50 lines max.

2. Use Skills Instead of Inline Docs
Your skills are already defined. Instead of loading docs into context, reference them via skills:


"For database work, use /database_conventions skill"

3. Improve Deny List (MEDIUM IMPACT)
Add more deny patterns to prevent accidental context waste:3. Improve Deny List (MEDIUM IMPACT)
Add more deny patterns to prevent accidental context waste:

{
  "deny": [
    "Read(node_modules)",
    "Read(node_modules/*)",
    "Read(./node_modules/**)",
    "Read(.next)",
    "Read(.next/*)",
    "Read(./.next/*)",
    "Read(*.lock)",
    "Read(package-lock.json)",
    "Read(pnpm-lock.yaml)",
    "Read(.git/**)",
    "Read(*.map)",
    "Read(*.min.js)",
    "Read(*.min.css)"
  ]
}


4. Consolidate Documentation (HIGH IMPACT)
You have 38 docs, many with overlapping content. Consider:

Merge frontend_standards.md + AI_Coder_Frontend_Instructions.md + frontend-nextjs-rules.md
Merge backend_standards.md + backend-nestjs-rules.md
Merge postgresql-rules.md + postgresql and prisma-rules.md


5. Add outputStyle: "concise" (MEDIUM IMPACT)

{
  "outputStyle": "concise"
}
This reduces my response verbosity, saving context for actual work.


6. Use /compact More Frequently
Run /compact proactively after completing each major task, not just when running out of context.

📊 Projected Impact
Change	Context Saved	Effort
Slim CLAUDE.md	30-40%	Medium
Expand deny list	5-10%	Low
Consolidate docs	20-30%	High
Use concise output	10-15%	Low
Use /compact proactively	Variable	Low
Quick Fix (Apply Now)
Want me to update your settings.local.json with an expanded deny list and concise output? This is a quick win with immediate impact.
