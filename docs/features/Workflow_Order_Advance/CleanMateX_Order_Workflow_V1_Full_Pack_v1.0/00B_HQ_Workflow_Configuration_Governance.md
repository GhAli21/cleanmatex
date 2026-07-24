# CleanMateX Order Workflow V1 — HQ Configuration Governance

**Document ID:** CMX-OW-V1-PACK-000B  
**Status:** Locked baseline

## Decision

Workflow setup and configuration are primarily CleanMateX HQ Platform responsibilities.

Tenant workflow configuration is not required. Tenants receive an assigned, ready-to-use workflow profile.

## HQ responsibilities

- Stage and action catalog
- Presets
- Workflow definitions and versions
- Conditional transitions
- Gates and approvals
- Plan/market availability
- Tenant/service/branch assignments
- Simulation, validation, approval, publish, retire, rollback
- Customer milestone mappings
- Outsourcing and partial-fulfilment workflow behavior

## Tenant capabilities

Required:

- View operational queues
- Execute available actions
- Manage staff, services, vendors, branches, drivers, racks, and normal business data

Optional and HQ-controlled:

- View assigned workflow profile/version
- Choose from a very small HQ-approved profile list
- Set non-structural preferences
- Submit workflow change request

Not available in V1:

- Tenant workflow editor
- Tenant transition-rule builder
- Tenant stage authoring or reordering
- Tenant workflow publish/retire
- Arbitrary tenant workflow overrides

## Rationale

This model keeps CleanMateX easy to operate, reduces support and testing combinations, protects workflow correctness, and still lets HQ support different laundry operating models through centrally managed profiles.


## Status architecture governance

HQ controls the supported status and stage catalogs, transition semantics, aggregation policies, customer milestone mappings, and compatibility mappings.

Tenants may not create or rename persisted status codes.

Tenant-visible labels may use HQ-approved localized options without changing canonical status meaning.
