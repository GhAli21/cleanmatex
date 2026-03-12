# UI General Rules

## Naming (Brief Reference)

- **Suffixes:** `_mst` master, `_dtl` detail, `_tr` transactions, `_cd` codes, `_cf` config
- **Prefixes:** `sys_` global system and HQ SAAS Platform, `org_` tenant

For full database naming conventions, see `.claude/skills/database/conventions.md` and `.claude/docs/database_conventions.md`.

## Audit Record Fields UI

If the data table has audit fields (`created_at`, `created_by`, `updated_at`, etc.):

- **Audit Record Fields UI** should be a **standard component** such as a Card or small popup window, used consistently across the app.
- Provide a **small icon button** to open the audit fields for the current record.

## Bilingual Fields

- `name`, `name2`
- `description`, `description2`

## Money, Price Fields Size

- `DECIMAL(19, 4)`

## Branding/UI Fields

- `{entity}_color1`, `{entity}_color2`, `{entity}_color3`, `{entity}_icon`, `{entity}_image`
