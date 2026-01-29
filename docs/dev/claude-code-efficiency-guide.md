# Claude Code Efficiency Guide
## Best Practices for Agent Usage & Context Management

**Last Updated:** 2026-01-29
**Project:** CleanMateX

---

## Table of Contents
1. [Context Management Fundamentals](#context-management-fundamentals)
2. [Agent-First Workflow](#agent-first-workflow)
3. [Project Structure Optimization](#project-structure-optimization)
4. [Communication Best Practices](#communication-best-practices)
5. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Context Management Fundamentals

### Understanding Context Budget

**Total Budget:** 200,000 tokens per conversation
**Warning Threshold:** 80% (~160,000 tokens)
**Critical Threshold:** 95% (~190,000 tokens)

**What Consumes Context:**
```
High Impact (thousands of tokens):
├─ File reads (500-2000 tokens per file)
├─ Search results with content (1000-5000 tokens)
├─ Build/test outputs (2000-10000 tokens)
├─ Long conversations (accumulates over time)
└─ Multiple skill auto-loads (100-500 tokens each)

Low Impact (negligible):
├─ Git status snapshot (<100 tokens)
├─ Simple bash commands (<50 tokens)
├─ Todo list updates (<100 tokens)
└─ Short user questions (<50 tokens)
```

### The Golden Rule

**ALWAYS use `/clear` when:**
- Switching to a different feature/module
- Context reaches 70%+
- Starting a new work session
- Finishing a major task

**EXAMPLE:**
```
Session 1: Working on pricing feature (0% → 65%)
→ /clear
Session 2: Working on invoice feature (0% → 60%)
→ /clear
Session 3: Debugging order workflow (0% → 55%)
```

---

## Agent-First Workflow

### Decision Tree: Agent vs Direct Action

```
START: You have a task
│
├─ Is it EXPLORATORY? (understand/find/explain/how does X work?)
│  ├─ YES → USE AGENT (Explore)
│  └─ NO → Continue
│
├─ Do you know the EXACT file/location?
│  ├─ YES → Direct Read/Edit
│  └─ NO → USE AGENT (Explore to find it)
│
├─ Does it involve MULTIPLE files/systems?
│  ├─ YES → USE AGENT (General-purpose or specialized)
│  └─ NO → Continue
│
├─ Is it a RESEARCH question? (what/where/why/how)
│  ├─ YES → USE AGENT (Explore)
│  └─ NO → Direct action
│
└─ DEFAULT: If unsure → USE AGENT
```

### Agent Types & When to Use

#### 1. **Explore Agent** (Most Common)
**Use for:**
- "How does [feature] work?"
- "Where is [functionality] implemented?"
- "Find all files related to [topic]"
- "Explain the [module] architecture"
- "What's the structure of [component]?"

**Thoroughness Levels:**
```typescript
"quick"         → 2-3 files, basic search (30 seconds)
"medium"        → 5-10 files, moderate depth (1-2 minutes)
"very thorough" → 15+ files, comprehensive (3-5 minutes)
```

**Example Requests:**
```
✅ "Do a medium exploration of the pricing system"
✅ "Quick search for where tenant_org_id is validated"
✅ "Very thorough analysis of the order workflow states"
```

#### 2. **Implementer-Tester Agent**
**Use for:**
- Implementing features WITH tests
- Running test suites after code changes
- Test-driven development workflows

**Example:**
```
"Implement discount field in order form with validation and tests"
→ Agent writes code + tests + runs them + reports results
```

#### 3. **Debugging-Specialist Agent**
**Use for:**
- Build failures
- Runtime errors
- Test failures
- RLS policy issues
- Performance problems

**Example:**
```
"Debug why orders API is returning 403 for tenant ABC123"
→ Agent investigates RLS, checks policies, finds root cause
```

#### 4. **Code-Reviewer Agent**
**Use for:**
- After implementing features
- Before committing code
- Quality assurance checks

**Example:**
```
"Review the pricing service I just wrote"
→ Agent checks security, performance, patterns, suggests improvements
```

#### 5. **PM-Spec-Converter / PRD-Producer Agents**
**Use for:**
- Converting feature ideas to formal specs
- Creating product requirements documents
- Planning new features

**Example:**
```
"Convert my invoice feature notes into a PM spec"
→ Agent structures requirements, user stories, acceptance criteria
```

#### 6. **Documentation Agent**
**Use for:**
- Creating API documentation
- Updating feature docs
- Adding inline code comments

**Example:**
```
"Document the new pricing API endpoints"
→ Agent creates comprehensive API docs with examples
```

---

## Project Structure Optimization

### 1. Optimize CLAUDE.md

**Current Issue:** Your CLAUDE.md is comprehensive but loads every conversation.

**Solution: Streamlined CLAUDE.md**

```markdown
# CLAUDE.md — CleanMateX AI Assistant

**Project:** CleanMateX — Multi-Tenant Laundry SaaS (GCC region, EN/AR)

## CRITICAL RULES (Top 7)
1. **Never reset Supabase** - Tell user to run migrations
2. **Tenant filtering mandatory** - Every query MUST filter by `tenant_org_id`
3. **Build after frontend changes** - `npm run build` until success
4. **Bilingual mandatory** - EN/AR + RTL support required
5. **Use agents for exploration** - See efficiency guide
6. **Skills provide detailed rules** - Use `/skill-name` for specifics
7. **Clear context frequently** - Use `/clear` when switching topics

## Quick Commands
```bash
.\scripts\dev\start-services.ps1  # Start all
cd web-admin && npm run dev       # Dev server
npm run build                     # Build & validate
```

## Skills (Auto-loaded on demand)
- `/multitenancy` - Tenant isolation, RLS (CRITICAL)
- `/database` - Schema, migrations, naming
- `/frontend` - Next.js, React, UI components
- `/backend` - API routes, services
- `/i18n` - EN/AR bilingual support

See `.claude/skills/README.md` for full skill list.

## Project Structure
```
supabase/     → Database + RLS (PostgreSQL)
web-admin/    → Next.js Admin (Active)
backend/      → NestJS API (Phase 2)
docs/         → All documentation
```

## Documentation
- **Efficiency Guide:** `docs/dev/claude-code-efficiency-guide.md`
- **Database Rules:** `.claude/skills/database/SKILL.md`
- **Multi-tenancy:** `.claude/skills/multitenancy/SKILL.md`
- **Master Plan:** `docs/plan/master_plan_cc_01.md`

## Key Principles
- Security: RLS on all `org_*` tables
- Performance: Indexes, avoid N+1, paginate
- Testing: Business logic + tenant isolation
- Validation: All inputs at system boundaries
```

**Result:** Reduced from ~200 lines to ~60 lines (70% reduction)

### 2. Optimize Skills Files

**Before (Bloated):**
```markdown
# .claude/skills/database/SKILL.md (500 lines)
[Detailed examples...]
[Every edge case...]
[Full migration templates...]
```

**After (Concise):**
```markdown
# Database Skill (150 lines max)

## Core Rules
- Table names: `sys_*` (global), `org_*` (tenant+RLS)
- Max 30 chars for all DB objects
- Composite FKs for tenant joins

## Quick Reference
- Audit fields: created_at/by/info, updated_at/by/info
- Bilingual: name/name2, description/description2
- Soft delete: is_active=false, rec_status=0

## See Also
- Migration guide: ./migration-guide.md
- PostgreSQL rules: ./postgresql-prisma.md
- Examples: ./examples/ (separate files)
```

**Strategy:** Keep SKILL.md under 200 lines, move details to supporting files.

### 3. Documentation Organization

**Optimal Structure:**
```
docs/
├─ README.md                          # Index to all docs
├─ dev/
│  ├─ claude-code-efficiency-guide.md # This guide
│  ├─ getting-started.md
│  └─ troubleshooting.md
├─ features/
│  ├─ pricing/
│  │  └─ README.md                    # Single source of truth
│  ├─ invoices/
│  │  └─ README.md
│  └─ orders/
│     └─ README.md
├─ plan/
│  └─ master_plan_cc_01.md            # Active plan only
└─ _archive/
   ├─ 2025-01/                        # Archive by month
   │  ├─ old_pricing_plan.md
   │  └─ completed_features/
   └─ 2025-02/
```

**Rules:**
- ✅ One README.md per feature (single source of truth)
- ✅ Archive completed docs monthly
- ✅ Keep only active plans in `docs/plan/`
- ❌ No duplicate documentation
- ❌ No scattered plan files

### 4. Git Workflow for Context Efficiency

**Best Practice: Feature Branches + Small Commits**

```bash
# Start new feature
git checkout -b feature/pricing-override
git commit -m "Initial pricing override structure"

# Work session 1
[Make changes]
git add web-admin/lib/services/pricing.service.ts
git commit -m "Add price override validation"

# Work session 2
[Make changes]
git add web-admin/app/dashboard/orders/new/components/
git commit -m "Add price override modal UI"

# Result: Clean git status (<5 modified files at any time)
```

**Why it helps:**
- Smaller cognitive load
- Cleaner conversations with Claude
- Easier to focus on specific changes

**Anti-pattern:**
```bash
# 50+ modified files across multiple features
# Hard to reason about
# Context gets polluted with unrelated changes
```

---

## Communication Best Practices

### 1. How to Ask Questions

#### ❌ BAD (Consumes High Context)
```
"Explain the entire order system to me"
→ Claude reads 20+ files, dumps everything into context
→ 50-80% context consumed
```

#### ✅ GOOD (Agent-Based)
```
"Use an exploration agent to explain the order workflow from creation to delivery"
→ Agent explores independently, returns summary
→ 5-15% context consumed
```

#### ❌ BAD (Vague)
```
"Fix the bug in orders"
→ Claude searches everywhere, loads many files
```

#### ✅ GOOD (Specific)
```
"Debug the 403 error when creating orders for tenant ABC123"
→ Focused investigation with debugging agent
```

### 2. Request Structure Templates

#### For Exploration
```
"Use a [quick/medium/thorough] exploration agent to [task]"

Examples:
- "Use a medium exploration agent to find where customer emails are sent"
- "Do a thorough analysis of the pricing calculation logic"
- "Quick search for where tenant_org_id filtering is implemented"
```

#### For Implementation
```
"Implement [feature] in [location] following [pattern]"

Examples:
- "Implement discount field in order form following the pricing pattern"
- "Add email validation to customer form using existing validation helpers"
```

#### For Debugging
```
"Debug [specific error/behavior] in [context]"

Examples:
- "Debug why build fails with type error in pricing.service.ts:45"
- "Debug slow query performance on orders list page"
```

### 3. Progressive Refinement Pattern

Instead of one massive request, break it down:

```
Session 1 (Exploration):
You: "Explore how invoicing currently works"
Claude: [Uses Explore agent, provides summary]

[Review summary, /clear if needed]

Session 2 (Planning):
You: "Plan how to add PDF invoice generation"
Claude: [Uses Plan agent or creates implementation plan]

[Review plan, approve, /clear]

Session 3 (Implementation):
You: "Implement PDF invoice generation per the plan"
Claude: [Implements with Implementer-Tester agent]

[Review code, /clear]

Session 4 (Testing):
You: "Run tests and fix any failures"
Claude: [Uses Testing agent]
```

**Result:** Each session uses 30-50% context instead of one session hitting 95%

---

## Quick Reference Cheat Sheet

### Daily Workflow Commands

```bash
# Start of day
/clear                                    # Fresh context

# During work
"Use exploration agent to [question]"     # Research
"Implement [feature]"                     # Build
"Debug [error]"                           # Fix
/clear                                    # Switch topics

# Check context
# Look at footer: "X% used" indicator

# When context > 70%
/clear                                    # Reset

# End of day
git add . && git commit -m "EOD: [what you did]"
```

### Agent Selection Quick Guide

| Task Type | Agent to Use | Example |
|-----------|--------------|---------|
| How does X work? | Explore | "Explore pricing calculation" |
| Where is Y? | Explore | "Find customer validation code" |
| Implement Z | Implementer-Tester | "Implement discount field with tests" |
| Error/Bug | Debugging-Specialist | "Debug 403 error in orders API" |
| Review code | Code-Reviewer | "Review pricing.service.ts changes" |
| Document X | Code-Documenter | "Document pricing API endpoints" |
| Plan feature | Plan | "Plan invoice PDF generation" |

### Context-Saving Phrases

**Use these to trigger agent-based work:**

```
✅ "Use an exploration agent to..."
✅ "Launch a debugging agent to investigate..."
✅ "Run an implementation agent to build..."
✅ "Use the testing agent to verify..."

❌ "Show me all files related to..." (loads everything)
❌ "Explain the entire..." (reads too much)
❌ "Find everything about..." (context explosion)
```

### File Operation Efficiency

| Operation | Context-Efficient Way | Context-Wasteful Way |
|-----------|----------------------|---------------------|
| Find pricing code | "Explore pricing system" (agent) | "Grep for 'pricing'" (loads all matches) |
| Understand workflow | "Explore order workflow" (agent) | "Read all order files" (reads 20+ files) |
| Debug error | "Debug [specific error]" (agent) | "Show me all error logs" (huge output) |
| Implement feature | "Implement X following Y pattern" | "Show me similar code first" (loads examples) |

### Skill Usage Patterns

**Auto-loaded (no action needed):**
- `/multitenancy` - When working with queries
- `/database` - When creating tables/migrations
- `/frontend` - When working with UI components
- `/backend` - When creating API routes
- `/i18n` - When adding translations

**Manually invoke when needed:**
```
/dev-commands    # When you need CLI reference
/debugging       # When troubleshooting builds
/testing         # When writing tests
/documentation   # When creating docs
```

---

## Advanced Techniques

### 1. Multi-Agent Parallel Execution

For independent tasks, run agents in parallel:

```
"Launch these agents in parallel:
1. Explore pricing calculation logic
2. Debug customer form validation error
3. Review order service code quality"

Result: 3 agents work simultaneously, return summaries
Context: Only summaries loaded (not exploration work)
```

### 2. Agent Resumption

If an agent times out or you need follow-up:

```
# Claude returns agent ID: a89046c
"Resume agent a89046c and continue exploring the invoice module"

Result: Agent continues with full context preserved
```

### 3. Background Agents

For long-running tasks:

```
"Run exploration agent in background to analyze all pricing-related code"

Result: Agent works in background, you continue other work
Check results later: Read the output file or use tail
```

### 4. Targeted File Reading

When you DO need to read files directly:

```
✅ "Read web-admin/lib/services/pricing.service.ts lines 100-150"
   (Specific range)

✅ "Read the getPriceWithTax function in pricing.service.ts"
   (Specific function)

❌ "Read all pricing files"
   (Loads everything)
```

---

## Monitoring & Optimization

### Context Usage Indicators

**Footer shows: "X% used"**

```
0-30%   ✅ Healthy - Continue working
30-60%  ⚠️  Moderate - Be mindful, consider /clear soon
60-80%  🟡 High - Finish current task, then /clear
80-95%  🔴 Critical - /clear immediately
95-100% 🚨 Emergency - Must /clear or conversation ends
```

### Session Planning

**Estimate context per operation:**

```
Exploration agent:        5-15%
Implementer agent:        20-40%
File read (large):        5-10%
Build output:             10-20%
Debugging session:        15-30%
Long conversation:        +5% per exchange
```

**Example session plan:**
```
Session budget: 100%
- Explore pricing (agent):     -10%  → 90% left
- Implement discount:          -30%  → 60% left
- Run tests:                   -15%  → 45% left
- Review code:                 -10%  → 35% left
✅ Comfortable margin, no /clear needed

vs.

- Read 10 pricing files:       -50%  → 50% left
- Grep for pricing patterns:   -20%  → 30% left
- Implement discount:          -30%  → 0% left
🚨 Ran out of context!
```

---

## Project-Specific Optimizations for CleanMateX

### 1. Tenant-Aware Queries Template

**Store this pattern, reference it:**

```typescript
// lib/patterns/tenant-query-pattern.ts
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { withTenantContext } from '@/lib/db/tenant-context';

// Pattern 1: API Route
export async function GET(req: Request) {
  const tenantId = await getTenantIdFromSession();
  const data = await withTenantContext(async (prisma) => {
    return prisma.org_orders_mst.findMany({
      where: { tenant_org_id: tenantId }
    });
  });
}
```

**Usage:**
```
"Implement customer list API following the tenant-query-pattern"
→ Claude references pattern file instead of loading examples
→ Saves context by not reading multiple example files
```

### 2. Common Code Patterns Repository

Create `docs/dev/code-patterns.md`:

```markdown
# CleanMateX Code Patterns

## API Route Pattern
[Standard API route template]

## Service Layer Pattern
[Standard service template]

## UI Component Pattern
[Standard component template]

## Test Pattern
[Standard test template]
```

**Usage:**
```
"Create customer service following the service-layer-pattern"
→ Claude reads one pattern doc instead of exploring examples
```

### 3. Bilingual Message Keys Strategy

Instead of loading `messages/en.json` and `messages/ar.json`:

```markdown
# docs/dev/i18n-patterns.md

## Message Key Conventions
- common.* - Shared UI (buttons, labels)
- orders.* - Order management
- customers.* - Customer management

## Before Adding Keys
1. Search existing keys: npx i18n-unused
2. Reuse common keys when possible
3. Follow naming: feature.component.element

## Examples
common.buttons.save
common.labels.name
orders.list.title
orders.form.customerName
```

**Usage:**
```
"Add translation keys for discount field following i18n-patterns"
→ Claude follows pattern doc, doesn't load full message files
```

---

## Troubleshooting

### Problem: Context Hitting 95%+ Quickly

**Diagnosis:**
```
1. Check conversation length - How many exchanges?
2. Check file reads - Did you read large files?
3. Check search results - Did grep return hundreds of matches?
4. Check build outputs - Did build fail with huge error log?
```

**Solution:**
```
1. /clear immediately
2. Break task into smaller sessions
3. Use agents for exploration instead of direct file reads
4. Ask focused questions with specific file paths
```

### Problem: Agent Taking Too Long

**Diagnosis:**
- Thorough exploration on large codebase
- Too broad of a question

**Solution:**
```
1. Use "quick" thoroughness level for initial exploration
2. Ask more specific questions
3. Narrow scope: "Explore pricing in lib/services only" vs "Explore pricing everywhere"
```

### Problem: Agent Not Finding What You Need

**Diagnosis:**
- Question too vague
- Agent searched wrong locations
- Code uses unexpected naming

**Solution:**
```
1. Resume agent with more specific guidance
2. Provide file path hints: "Explore pricing, start with lib/services/"
3. Use direct file read if you know exact location
```

---

## Success Metrics

Track your efficiency improvements:

```markdown
# Context Efficiency Log

## Before Optimization
- Average context per session: 75%
- Sessions per feature: 2-3 (ran out of context)
- Files read per session: 15-20
- Agent usage: 10%

## After Optimization
- Average context per session: 35%
- Sessions per feature: 1 (single session sufficient)
- Files read per session: 3-5 (targeted reads)
- Agent usage: 70%

## Improvement
- Context efficiency: 53% improvement
- Fewer /clear interruptions
- Faster feature completion
```

---

## Conclusion

**Core Principles:**
1. **Agents First** - Use agents for exploration, research, and complex tasks
2. **Clear Often** - Don't hoard context, /clear when switching topics
3. **Be Specific** - Focused questions get better answers with less context
4. **Optimize Structure** - Lean CLAUDE.md, organized docs, clean git status
5. **Monitor Usage** - Watch the context indicator, plan your sessions

**The 80/20 Rule:**
- 80% of your work should use agents (exploration, implementation, debugging)
- 20% direct actions (targeted file edits, specific commands)

**Remember:**
- Context is precious - spend it wisely
- Agents are free workers - use them liberally
- A clean conversation is a productive conversation

---

**Questions or issues with this guide?**
File in: `docs/dev/claude-code-efficiency-guide.md` (this file)
Update as you learn new patterns!
