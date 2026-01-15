# Database Function & Table Naming Convention

## Rule 1: ALL Order Workflow Functions Use `cmx_ord_*` Prefix

**Mandatory:** All database functions related to order workflow must start with `cmx_ord_` prefix.

## Rule 2: ALL Order Workflow Configuration Tables Use `sys_ord_*_cf` Naming

**Mandatory:** All configuration tables for order workflow must use `sys_ord_*_cf` naming pattern.

---

## Table Naming Convention

### Configuration Tables (sys*ord*\*\_cf)

All order workflow configuration tables must follow this pattern:

- `sys_ord_screen_contracts_cf` - Screen contract customization
- `sys_ord_custom_validations_cf` - Custom validation functions
- `sys_ord_webhook_subscriptions_cf` - Webhook subscription configuration

**Note:** Configuration tables can have `tenant_org_id` for tenant-specific customization, but they use `sys_ord_` prefix to indicate they're system-level order workflow configuration.

### Data Tables (org*ord*_ or org\__)

Data/logs tables use `org_` prefix:

- `org_ord_transition_events` - Event logs
- `org_order_history` - Status transition history

### Versioning Tables (sys*ord*\*)

Versioning/history tables use `sys_ord_` prefix:

- `sys_ord_workflow_template_versions` - Workflow template version history

---

## Function Categories

### 1. Core Screen Contract Functions (Generic)

These functions work with any screen:

- `cmx_ord_screen_pre_conditions(p_screen text)` - Returns PRE conditions for a screen
- `cmx_ord_screen_required_permissions(p_screen text)` - Returns required permissions
- `cmx_ord_screen_end_user_help(p_screen text)` - Returns end-user help text
- `cmx_ord_screen_dev_help(p_screen text)` - Returns developer help text
- `cmx_ord_resolve_post_status(...)` - Resolves next status from screen/input
- `cmx_ord_validate_transition(...)` - Validates transition before execution
- `cmx_ord_execute_screen_transition(...)` - Atomic transition execution
- `cmx_ord_get_effective_screen_contract(...)` - Gets tenant-specific or default contract

### 2. Order-Specific Functions

- `cmx_ord_order_workflow_flags(p_tenant_org_id uuid, p_order_id uuid)` - Gets workflow template flags
- `cmx_ord_order_live_metrics(p_tenant_org_id uuid, p_order_id uuid)` - Computes order metrics
- `cmx_ord_get_allowed_transitions(...)` - Gets allowed transitions for order
- `cmx_ord_get_workflow_version(p_order_id uuid)` - Gets workflow version used

### 3. Per-Screen Wrapper Functions

Pattern: `cmx_ord_{screen}_{function_type}()`

**Screens:** `preparation`, `processing`, `assembly`, `qa`, `packing`, `ready_release`, `driver_delivery`, `exceptions`, `new_order`, `workboard`

**Function Types:**

- `pre_conditions()` - Returns PRE conditions
- `required_permissions()` - Returns required permissions
- `resolve_post_status(...)` - Resolves POST status
- `transition(...)` - Executes transition
- `end_user_help()` - End-user help
- `dev_help()` - Developer help

**Examples:**

- `cmx_ord_preparation_pre_conditions()`
- `cmx_ord_preparation_transition(...)`
- `cmx_ord_processing_pre_conditions()`
- `cmx_ord_assembly_transition(...)`
- `cmx_ord_qa_resolve_post_status(...)`

### 4. Utility Functions

- `cmx_ord_prevent_direct_status_update()` - Trigger function to prevent direct updates
- `cmx_ord_emit_transition_event(...)` - Emits transition events
- `cmx_ord_validate_transition_enhanced(...)` - Enhanced validation with custom rules

### 5. Legacy Functions (To Be Renamed/Deprecated)

These existing functions should be considered for renaming:

- `cmx_order_transition()` → **Deprecate** in favor of `cmx_ord_execute_screen_transition()` or per-screen wrappers
- `cmx_get_allowed_transitions()` → **Rename** to `cmx_ord_get_allowed_transitions()`

---

## Naming Pattern Summary

```
cmx_ord_{category}_{specific}_{action}()

Examples:
- cmx_ord_screen_pre_conditions()          [category: screen, specific: pre, action: conditions]
- cmx_ord_order_workflow_flags()           [category: order, specific: workflow, action: flags]
- cmx_ord_preparation_transition()          [category: preparation (screen), action: transition]
- cmx_ord_execute_screen_transition()       [category: execute, specific: screen, action: transition]
```

---

## Implementation Checklist

### Functions

- [ ] All core functions use `cmx_ord_*` prefix
- [ ] All per-screen wrapper functions use `cmx_ord_*` prefix
- [ ] All utility functions use `cmx_ord_*` prefix
- [ ] Legacy functions documented for deprecation/renaming
- [ ] No functions use `cmx_*` prefix (without `ord_`)
- [ ] No functions use `cmx_screen_*` prefix
- [ ] All function calls reference correct `cmx_ord_*` functions

### Tables

- [ ] All configuration tables use `sys_ord_*_cf` naming
- [ ] Data tables use appropriate `org_*` or `org_ord_*` naming
- [ ] Versioning tables use `sys_ord_*` naming
- [ ] All table references updated in functions

---

## Migration Notes

When implementing:

1. Create all new functions with `cmx_ord_*` prefix
2. Update wrapper functions to use `cmx_ord_*` prefix
3. Update all function calls to use correct names
4. Create all configuration tables with `sys_ord_*_cf` naming
5. Update all function references to use correct table names
6. Consider creating aliases for legacy functions during transition period
7. Document deprecation timeline for legacy functions and tables
