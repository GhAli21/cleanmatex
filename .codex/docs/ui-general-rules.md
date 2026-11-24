# UI General Rules

## Naming (Brief Reference)

- **Suffixes:** `_mst` master, `_dtl` detail, `_tr` transactions, `_cd` codes, `_cf` config
- **Prefixes:** `sys_` global system and HQ SAAS Platform, `org_` tenant

For full database naming conventions, see `.claude/skills/database/conventions.md` and `.claude/docs/database_conventions.md`.

## Audit Record Fields UI

If the data table has audit fields (`created_at`, `created_by`, `updated_at`, etc.):

- **Audit Record Fields UI** should be a **standard component** such as a Card or small popup window, used consistently across the app.
- Provide a **small icon button** to open the audit fields for the current record.
- Format those instants with the branch zone, else the organization zone, after that zone is known. Full rule: `docs/dev/rules/time-and-timezone.md`.

## Bilingual Fields

- `name`, `name2`
- `description`, `description2`

## Numeric precision by class

Full rule: docs/dev/rules/numeric-precision.md.

```
AMOUNT      DECIMAL(19,4)   totals, payments, balances, tax amounts, GL
UNIT_PRICE  DECIMAL(21,6)   price per one unit (sell, list, line price per unit)
UNIT_COST   DECIMAL(23,8)   cost per base unit
QUANTITY    DECIMAL(21,6)   measured / billed / stock / tier quantities (piece counts stay INTEGER)
RATE        DECIMAL(28,12)  unit conversion rates
```

## Branding/UI Fields

- `{entity}_color1`, `{entity}_color2`, `{entity}_color3`, `{entity}_icon`, `{entity}_image`
