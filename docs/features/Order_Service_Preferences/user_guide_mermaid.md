---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — User Guide Flowcharts

## New Order — Add Preferences Flow

```mermaid
flowchart TD
    A[Start New Order] --> B[Add Customer & Items]
    B --> C[Open Order Details tab]
    C --> D{For each item}
    D --> E[Select Service Preferences]
    E --> F[Select Packing Preference]
    F --> G{Care Package available?}
    G -->|Yes| H[Apply bundle optional]
    G -->|No| I[Continue]
    H --> I
    I --> J{Repeat Last Order?}
    J -->|Yes| K[Apply last order prefs]
    J -->|No| L[Continue]
    K --> L
    L --> D
    D --> M[Review Additional Services charge]
    M --> N[Submit Order]
    N --> O[End]
```

## Edit Order — Change Preferences Flow

```mermaid
flowchart TD
    A[Open Order] --> B[Click Edit]
    B --> C[Order Details section]
    C --> D[Change Service Preferences]
    D --> E[Change Packing Preference]
    E --> F[Order total updates]
    F --> G[Save Order]
    G --> H[End]
```

## Per-Piece Override Flow (Enterprise)

```mermaid
flowchart TD
    A[Expand item to show pieces] --> B[Select piece]
    B --> C{Override packing?}
    C -->|Yes| D[Set packing pref for piece]
    C -->|No| E[Inherit item default]
    D --> F{Override service prefs?}
    E --> F
    F -->|Yes| G[Add/remove prefs on piece]
    F -->|No| H[Inherit item prefs]
    G --> I[Apply default to all optional]
    H --> I
    I --> J[End]
```

## Processing Confirmation Flow

```mermaid
flowchart TD
    A[Processing screen] --> B[View piece prefs]
    B --> C{Piece has prefs?}
    C -->|Yes| D{Confirmation enabled?}
    C -->|No| E[Continue]
    D -->|Yes| F[Click Confirm]
    D -->|No| E
    F --> G[prefs confirmed]
    G --> E
    E --> H[Move to next step]
```
