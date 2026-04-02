---
document_id: ERP_LITE_DEFAULT_SEED_PACKAGE_001
title: ERP-Lite Default Seed Package
version: "1.0"
status: Superseded
last_updated: 2026-04-02
author: CleanMateX AI Assistant
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Default Seed Package

> **Superseded:** use the business-type template foundation migrations `0198` to `0202` instead of this hardcoded default seed path.

## Purpose

This package was the first hardcoded ERP-Lite default baseline approach before the template-governance model was introduced.

It added:
- a live default HQ governance baseline for v1 posting
- an idempotent tenant default seed function
- automatic seeding for future tenants
- backfill seeding for existing active tenants

## Migration Set

### `0196_erp_lite_default_gov_live.sql`

Makes the approved v1 ERP-Lite governance baseline live by:
- publishing `ERP_LITE_V1_CORE`
- activating all v1 mapping rules in that package
- activating all v1 auto-post policy rows in that package

This closes the gap between approved ERP-Lite documentation and runtime dependency checks.

### `0197_erp_lite_default_seed.sql`

Creates and uses `seed_tenant_erp_lite_defaults(UUID)`.

The function seeds missing tenant defaults only. It does not overwrite tenant customizations.

Seeded tenant defaults:
- ideal hierarchical Chart of Accounts
- active default usage-code mappings
- current-year and next-year monthly accounting periods
- one default petty-cash cashbox when tenant currency is known

The migration also:
- backfills all existing active tenants
- adds an `AFTER INSERT` trigger on `org_tenants_mst` for future tenants

## Default COA Scope

The seeded default COA is designed to be safe for:
- v1 runtime posting
- v2 treasury, suppliers, AP, and PO readiness
- v3 advanced controls, profitability, and costing readiness

It includes:
- current assets
- current liabilities
- equity
- operating revenue
- operating expenses
- control and system-linked accounts required by v1 usage mappings

## Intentional Exclusions

The package does not seed these as fake defaults:
- bank accounts with placeholder account numbers
- supplier master records
- AP invoices or PO documents
- bank statements or reconciliation records

Those require tenant-specific operational data and should be created by users or future onboarding flows.

## Review Notes

Before applying:
- verify the default COA account codes match your preferred numbering convention
- verify the current/next-year period model matches your tenant rollout policy
- verify automatic tenant-trigger seeding is desired for all future tenants

## Superseded By

- [ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md](ADR_011_ERP_LITE_TEMPLATE_GOVERNANCE_MODEL.md)
- [PHASE_TEMPLATE_FOUNDATION_CHECKLIST.md](PHASE_TEMPLATE_FOUNDATION_CHECKLIST.md)
- [PHASE_TEMPLATE_FOUNDATION_EXECUTION_PACKAGE.md](PHASE_TEMPLATE_FOUNDATION_EXECUTION_PACKAGE.md)

## Related Documents

- [ERP_LITE_FINANCE_CORE_RULES.md](ERP_LITE_FINANCE_CORE_RULES.md)
- [ACCOUNT_USAGE_CODE_CATALOG.md](ACCOUNT_USAGE_CODE_CATALOG.md)
- [V1_POSTING_RULES_CATALOG.md](V1_POSTING_RULES_CATALOG.md)
- [BLOCKING_POLICY_TABLE.md](BLOCKING_POLICY_TABLE.md)
- [PHASE_3_TENANT_FINANCE_SCHEMA_EXECUTION_PACKAGE.md](PHASE_3_TENANT_FINANCE_SCHEMA_EXECUTION_PACKAGE.md)
