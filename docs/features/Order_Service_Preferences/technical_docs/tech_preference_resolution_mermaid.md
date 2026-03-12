---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Service Preferences — Preference Resolution Flow

## resolve_item_preferences (DB Function)

```mermaid
flowchart TD
    subgraph Input["Input Parameters"]
        A[p_tenant_org_id]
        B[p_customer_id]
        C[p_product_code optional]
        D[p_service_category_code optional]
    end

    subgraph DB["Database Lookups"]
        A --> E[org_customer_service_prefs]
        B --> E
        E --> F[Standing prefs: preference_code, source]
        C --> G[org_product_data_mst]
        G --> H[default_packing_pref]
        F --> I[Resolved service prefs]
        H --> J[Resolved packing pref]
    end

    subgraph Output["Output"]
        I --> K[Return: preference_code, source]
        J --> K
    end
```

## Resolution Flow (API → Service → DB)

```mermaid
sequenceDiagram
    participant API as API Route
    participant Svc as PreferenceResolutionService
    participant DB as Supabase RPC

    API->>Svc: resolveItemPreferences(tenantId, customerId, productCode?, serviceCategoryCode?)
    Svc->>DB: rpc('resolve_item_preferences', {...})
    DB-->>Svc: ResolvedPref[]
    Svc-->>API: ResolvedPref[]
    API-->>API: Return JSON
```

## get_last_order_preferences Flow

```mermaid
flowchart TD
    A[get_last_order_preferences RPC] --> B[p_tenant_org_id, p_customer_id]
    B --> C[Query last completed order]
    C --> D[Get items with prefs]
    D --> E[Return per product: product_id, service_category_code, packing_pref_code, service_pref_codes]
    E --> F[Used by Repeat Last Order UI]
```

## suggest_preferences_from_history Flow

```mermaid
flowchart TD
    A[suggest_preferences_from_history RPC] --> B[p_tenant_org_id, p_customer_id]
    B --> C[Query order history]
    C --> D[Count preference usage]
    D --> E[Return: preference_code, usage_count]
    E --> F[Used by Smart Suggestions UI]
```
