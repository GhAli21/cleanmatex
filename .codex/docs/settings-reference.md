# Settings Reference

When you need to check the **list or details of settings** (codes, names, types, defaults, validation, etc.):

## 1. Query the database table (live data)

Query `sys_tenant_settings_cd` (system table, no tenant filter needed) for current, live data.

## 2. Read the settings files (offline/quick reference)

For quick lookup without a database connection, use:

- `.claude/docs/Allsettings.md` — human-readable table
- `.claude/docs/Allsettings.json` — structured JSON

**Use the table for live/current data; use the files for quick lookup without a DB connection.**
