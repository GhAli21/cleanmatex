# Archived: grandfathered database objects registry

**Archived:** 2026-11-19, at the owner's request ("old and misleading").

**What it was:** a list of database objects using the old naming, without the feature group (for example `sys_payment_method_cd` instead of `sys_pay_…`). Its purpose was to make agents use the exact existing names.

**Why it was archived:**
- It was last updated on 2025-11-14 and was still marked "Active".
- Hundreds of migrations have run since, so tables have been added, renamed and dropped. Agents that trusted the list could use names that no longer exist.

**Copies moved here.** Six near-identical copies of the registry existed:

| File here | Came from |
|---|---|
| `claude-docs_database_grandfathered_objects.md` | `.claude/docs/database_grandfathered_objects.md` |
| `codex-docs_database_grandfathered_objects.md` | `.codex/docs/database_grandfathered_objects.md` |
| `claude-skill_grandfathered-objects.md` | `.claude/skills/database/xxgrandfathered-objects.md` |
| `codex-skill_grandfathered-objects.md` | `.codex/skills/database/grandfathered-objects.md` |
| `agents-skill_grandfathered-objects.md` | `.agents/skills/database/xxgrandfathered-objects.md` (Antigravity) |
| `cursor-rule_databasegrandfatheredobjects.md` | `.cursor/rules/databasegrandfatheredobjects.mdc` (renamed to `.md` so Cursor no longer loads it) |

**Use instead:**
- **Real names of existing objects:** the live database (Supabase remote MCP, read-only), or `web-admin/prisma/schema.prisma`. Never take a name from memory or from an old list.
- **The rule itself still holds:** existing objects with the old naming are not bulk-renamed. Rename one only as its own reviewed migration (`.claude/skills/database/conventions.md`).

Do not link to these files from active docs.
