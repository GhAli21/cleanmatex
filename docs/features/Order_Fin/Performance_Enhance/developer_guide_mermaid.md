# Developer flow diagrams

Status: **documentation only**. The first diagram describes observed source structure. All subsequent diagrams are proposed and unimplemented. See [developer guide](developer_guide.md) and [financial contract](technical_docs/financial_snapshot_contract.md).

## Current source flow

```mermaid
sequenceDiagram
    participant Cashier
    participant Shell as Payment modal shell
    participant Hook as Shared quote hook
    participant API as Quote route and service
    participant Full as Payment full view
    participant Metadata as Metadata and session reads
    Cashier->>Shell: Open payment
    Shell->>Hook: Opening scope and financial inputs
    Hook->>API: CSRF protected quote POST
    API->>API: Validate security and referenced context
    par Financial calculation
        API->>API: Taxes prices discounts currency and credit
    and Methods
        API->>API: Effective method configuration
    and Balances
        API->>API: Stored value and possible loyalty expiry sync
    end
    API-->>Hook: Atomic totals currency and eligibility
    Hook-->>Shell: Verified currency snapshot
    Shell->>Full: Mount full view
    Full->>Hook: Share opening quote
    Full->>Metadata: Brands terminals drawers and required POS context
    Metadata-->>Full: Metadata or explicit failures
    Full-->>Cashier: Applicable methods become usable
```

## Proposed request-local reuse

```mermaid
flowchart TD
    A[Authenticated authorized request] --> B[Validated tenant context]
    B --> C[Create request scoped financial context]
    C --> D[Resolved settings promise by full resolution scope]
    C --> E[Verified currency promise]
    C --> F[Tax profiles and exemption facts]
    C --> G[Price and promotion facts]
    D --> H[Strict or permissive adapter keeps existing semantics]
    E --> I[Currency dependent rounding configuration]
    H --> J[Existing financial calculation]
    F --> J
    G --> J
    I --> J
    J --> K[Amount matched eligibility]
    K --> L[Single quote response]
```

The graph is an orchestration proposal, not an assertion that every fact can be loaded in one round trip. Request-local promise reuse does not require a shared Redis cache.

## Proposed display reuse and review

```mermaid
flowchart TD
    A[Open payment with complete input fingerprint] --> B{Matching display snapshot exists}
    B -->|Yes| C[Show cached presentation with refresh state]
    B -->|No| D[Show initial loading state]
    C --> E[Resolve current server quote]
    D --> E
    E --> F{Quote is usable for current revision}
    F -->|No| G[Explain failure and offer Retry or Cancel]
    F -->|Yes| H[Use verified totals and eligible methods]
    H --> I[Validate required drawer and terminal state]
    I --> J[Cashier reviews current amounts]
    J --> K[Submit reviewed inputs with idempotency identity]
    K --> L[Server recalculates and validates current authority]
    L --> M{Financial facts still match}
    M -->|Yes| N[Protected transactional submission]
    M -->|No| O[Return proposed structured mismatch]
    O --> P[Refresh in place and require new review]
    P --> J
```

The proposed submit identity, server comparison, and in-place mismatch response need implementation across create/edit paths. A cache hit never skips those checks.

## Proposed independent metadata preparation

```mermaid
flowchart TD
    A[Authorized page or modal intent] --> B[Warm brand and terminal configuration]
    A --> C[Start current financial quote]
    A --> D[Warm current drawer and POS reads]
    B --> E[Metadata with bounded freshness]
    C --> F[Financial snapshot]
    D --> G[Operational state with short freshness]
    E --> H[Method specific readiness]
    F --> H
    G --> H
    H --> I[Cash uses required drawer authority]
    H --> J[Terminal methods use required terminal authority]
    H --> K[Other methods use their own requirements]
```

Warm operations remain scoped and authorized. Long-lived static catalog caching must not be applied to active drawer/POS session state.
