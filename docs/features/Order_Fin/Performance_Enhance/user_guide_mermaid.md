# Cashier flow diagrams

Status: **proposed cashier experience; implementation pending**. See [user guide](user_guide.md). Diagrams describe behavior, not final localized labels or a deployed screen contract.

## Open and prepare payment

```mermaid
flowchart TD
    A[Cashier opens payment] --> B[Show payment window and available Cancel action]
    B --> C{Matching prior display is available}
    C -->|Yes| D[Show prior numbers with refresh state]
    C -->|No| E[Show preparation state]
    D --> F[Verify current currency totals and methods]
    E --> F
    F --> G{Preparation succeeds}
    G -->|Yes| H[Enable methods whose requirements are satisfied]
    G -->|No| I[Explain issue and offer relevant recovery]
    I --> J[Retry after recovery]
    J --> F
    I --> K[Cancel and return to order]
```

Displaying prior numbers does not enable posting before current required checks succeed.

## Explicit review when facts change

```mermaid
sequenceDiagram
    participant Cashier
    participant Payment as Payment window
    participant Server
    Cashier->>Payment: Review current amount and payment details
    Cashier->>Payment: Confirm
    Payment->>Server: Submit reviewed inputs and retry identity
    Server->>Server: Recalculate and validate current facts
    alt Current facts match
        Server-->>Payment: Validated submission result
        Payment-->>Cashier: Show result
    else Relevant facts changed
        Server-->>Payment: Proposed structured mismatch and refreshed facts
        Payment-->>Cashier: Explain changes without rewriting entered money
        Cashier->>Payment: Correct details and review again
    else Temporary failure
        Server-->>Payment: Recoverable failure
        Payment-->>Cashier: Explain failure and safe retry
    end
```

The new mismatch and retry contract still requires implementation. Existing confirmation safeguards must be preserved during that work.

## Required operational setup

```mermaid
flowchart TD
    A[Choose eligible method] --> B{Method requires drawer or terminal}
    B -->|No| C[Continue ordinary payment review]
    B -->|Yes| D[Verify required operational setup]
    D --> E{Setup is currently valid}
    E -->|Yes| C
    E -->|No| F[Explain the specific requirement]
    F --> G[Recover through established setup workflow]
    G --> D
    F --> H[Choose another eligible method when allowed]
    H --> A
```

A stale cache, an optional event notification, or a loading placeholder never substitutes for the required operational checks.
