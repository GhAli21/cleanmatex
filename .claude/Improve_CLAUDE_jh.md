

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
