# CleanMateX Skills Directory

This directory contains Claude Code Skills for the CleanMateX project, following best practices from the [official Claude Code documentation](https://code.claude.com/docs/en/skills).

## Skills Structure

Each skill is organized in its own directory with:
- `SKILL.md` - Main skill file with YAML frontmatter and core instructions
- Supporting files - Detailed reference documentation

## Available Skills

### Priority 1: Critical Security & Core Development

| Skill | Type | Description |
|-------|------|-------------|
| **multitenancy** | Reference | RLS policies, tenant isolation (CRITICAL for security) |
| **database** | Reference | Schema conventions, naming patterns, table workflow |
| **frontend** | Reference | Next.js 15, React 19, Cmx Design System |
| **debugging** | Task | Common issues, build fixes, troubleshooting |

### Priority 2: Foundation & Architecture

| Skill | Type | Description |
|-------|------|-------------|
| **architecture** | Reference | System design, tech stack, data access patterns |
| **backend** | Reference | API routes, service layer, Supabase server-side |
| **i18n** | Reference | Bilingual (EN/AR), RTL support, translations |
| **business-logic** | Reference | Order workflows, pricing, quality gates |

### Priority 3: Development Workflow

| Skill | Type | Description |
|-------|------|-------------|
| **implementation** | Task | Feature development workflow, coding standards |
| **dev-commands** | Task | Supabase, Prisma, Next.js commands |
| **testing** | Task | Testing strategy, multi-tenant tests |
| **documentation** | Task | Documentation standards and structure |

### Utility Skills

| Skill | Type | Description |
|-------|------|-------------|
| **explain-code** | Task | Explain code with diagrams and analogies |
| **codebase-visualizer** | Task | Generate interactive codebase tree |
| **navigation** | Reference | Navigation tree management |

## How to Use Skills

### Manual Invocation
```
/multitenancy
/database
/frontend
```

### Auto-Invocation
Claude automatically invokes relevant skills based on context:
- Writing database queries → `/multitenancy` and `/database` auto-invoked
- Creating React components → `/frontend` auto-invoked
- Encountering errors → `/debugging` auto-invoked

## Skill Types

**Reference Skills** - Applied automatically when relevant work is detected:
- Encode standards and conventions
- Auto-invoked by Claude based on context
- Examples: multitenancy, database, frontend

**Task Skills** - Explicitly invoked by users for specific actions:
- Step-by-step instructions
- User requests invocation
- Examples: debugging, testing, dev-commands

## File Organization

```
.claude/skills/
├── multitenancy/
│   ├── SKILL.md
│   └── reference.md
├── database/
│   ├── SKILL.md
│   ├── conventions.md
│   ├── feature-abbreviations.md
│   ├── grandfathered-objects.md
│   ├── migration-plan.md
│   ├── postgresql-prisma.md
│   └── table-check-workflow.md
├── frontend/
│   ├── SKILL.md
│   ├── architecture.md
│   ├── standards.md
│   ├── ui-blueprint.md
│   └── uiux-rules.md
└── [other skills...]
```

## SKILL.md Format

All skills follow this structure:

```yaml
---
name: skill-name
description: Clear description for Claude auto-invocation
user-invocable: true
---

# Skill Title

## Quick Reference
[Condensed critical rules]

## Core Rules
[Main instructions]

## Examples
[Code examples]

## Additional Resources
[Links to supporting files]
```

## Benefits of This Structure

1. **Organized** - Each skill has its own directory with related docs
2. **Scalable** - Easy to add new skills or update existing ones
3. **Discoverable** - Clear skill names and descriptions
4. **Context-Aware** - Claude auto-invokes based on work being done
5. **Best Practice** - Follows official Claude Code documentation

## Migration from Old Structure

**Before:**
- 7 simple wrapper files (just pointers to docs)
- Flat structure in `.claude/skills/*.md`

**After:**
- 14 properly structured skills with YAML frontmatter
- Hierarchical organization with supporting files
- Clear auto-invocation descriptions

## Related Documentation

- Main project file: [CLAUDE.md](../../CLAUDE.md)
- Original docs archive: [.claude/docs/](../docs/)
- Implementation plan: [C:\Users\DELL\.claude\plans\elegant-whistling-shell.md]

## Maintenance

When updating skills:
1. Update `SKILL.md` for quick reference changes
2. Update supporting files for detailed documentation
3. Keep SKILL.md under 500 lines (use supporting files for details)
4. Test skill invocation manually
5. Update this README if adding new skills

---

**Created:** 2025-01-29
**Based on:** [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
