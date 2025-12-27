# Order Workflow Visual Diagram

**Version:** v1.0.0  
**Last Updated:** 2025-01-20

---

## Complete Order Workflow with Page Mapping

```mermaid
flowchart TD
    Start([Order Created]) --> Draft[DRAFT Status]
    Draft -->|Intake| Intake[INTAKE Status]
    Intake -->|Prepare| Prep[PREPARATION Status]
    
    Prep --> PrepPage[/dashboard/preparation<br/>Preparation Page]
    PrepPage -->|Complete| Sorting[SORTING Status]
    
    Sorting --> Processing[PROCESSING Status]
    Processing --> ProcessingPage[/dashboard/processing<br/>Processing Page]
    
    ProcessingPage -->|Sort| Washing[WASHING Status]
    Washing -->|Dry| Drying[DRYING Status]
    Drying -->|Finish| Finishing[FINISHING Status]
    Finishing -->|Assemble| Assembly[ASSEMBLY Status]
    
    Assembly --> AssemblyPage[/dashboard/assembly<br/>Assembly Page]
    AssemblyPage -->|Complete| QA[QA Status]
    
    QA --> QAPage[/dashboard/qa<br/>QA Page]
    QAPage -->|Pass| Packing[PACKING Status]
    QAPage -->|Fail| Washing
    
    Packing --> Ready[READY Status]
    Ready --> ReadyPage[/dashboard/ready<br/>Ready Page]
    
    ReadyPage -->|Deliver| OutDelivery[OUT_FOR_DELIVERY Status]
    OutDelivery -->|Complete| Delivered[DELIVERED Status]
    Delivered -->|Close| Closed[CLOSED Status]
    
    Intake -->|Cancel| Cancelled[CANCELLED Status]
    Draft -->|Cancel| Cancelled
    
    AllOrders[/dashboard/orders<br/>All Orders Page<br/>Shows ALL Statuses]
    
    style PrepPage fill:#3B82F6,stroke:#1E40AF,color:#fff
    style ProcessingPage fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style AssemblyPage fill:#22C55E,stroke:#16A34A,color:#fff
    style QAPage fill:#84CC16,stroke:#65A30D,color:#fff
    style ReadyPage fill:#10B981,stroke:#059669,color:#fff
    style AllOrders fill:#6B7280,stroke:#4B5563,color:#fff
    
    style Draft fill:#9CA3AF,stroke:#6B7280
    style Intake fill:#3B82F6,stroke:#2563EB
    style Prep fill:#8B5CF6,stroke:#7C3AED
    style Sorting fill:#6366F1,stroke:#4F46E5
    style Processing fill:#8B5CF6,stroke:#6D28D9
    style Washing fill:#06B6D4,stroke:#0891B2
    style Drying fill:#14B8A6,stroke:#0D9488
    style Finishing fill:#10B981,stroke:#059669
    style Assembly fill:#22C55E,stroke:#16A34A
    style QA fill:#84CC16,stroke:#65A30D
    style Packing fill:#EAB308,stroke:#CA8A04
    style Ready fill:#10B981,stroke:#059669
    style OutDelivery fill:#F59E0B,stroke:#D97706
    style Delivered fill:#22C55E,stroke:#16A34A
    style Closed fill:#6B7280,stroke:#4B5563
    style Cancelled fill:#EF4444,stroke:#DC2626
```

## Page Filtering Flow

```mermaid
flowchart LR
    subgraph "Order Pages"
        PrepPage[Preparation Page<br/>current_status='preparation']
        ProcPage[Processing Page<br/>current_status='processing']
        AssemPage[Assembly Page<br/>current_status='assembly']
        QAPage[QA Page<br/>current_status='qa']
        ReadyPage[Ready Page<br/>current_status='ready']
        AllPage[All Orders Page<br/>No Status Filter]
    end
    
    subgraph "Database"
        Orders[(org_orders_mst<br/>current_status field)]
    end
    
    Orders -->|Filter by status| PrepPage
    Orders -->|Filter by status| ProcPage
    Orders -->|Filter by status| AssemPage
    Orders -->|Filter by status| QAPage
    Orders -->|Filter by status| ReadyPage
    Orders -->|No filter| AllPage
    
    style PrepPage fill:#3B82F6,stroke:#1E40AF,color:#fff
    style ProcPage fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style AssemPage fill:#22C55E,stroke:#16A34A,color:#fff
    style QAPage fill:#84CC16,stroke:#65A30D,color:#fff
    style ReadyPage fill:#10B981,stroke:#059669,color:#fff
    style AllPage fill:#6B7280,stroke:#4B5563,color:#fff
    style Orders fill:#F3F4F6,stroke:#9CA3AF
```

## Status Transition Validation Flow

```mermaid
flowchart TD
    Start([Status Change Request]) --> Validate{Validate Transition}
    Validate -->|Check Allowed| CheckGates{Quality Gates<br/>Required?}
    CheckGates -->|For READY| CheckQA{QA Passed?}
    CheckQA -->|Yes| CheckAssembled{All Items<br/>Assembled?}
    CheckAssembled -->|Yes| CheckIssues{No Unresolved<br/>Issues?}
    CheckIssues -->|Yes| Execute[Execute Transition]
    CheckIssues -->|No| Block[Block Transition<br/>Show Blockers]
    CheckAssembled -->|No| Block
    CheckQA -->|No| Block
    CheckGates -->|Not Required| Execute
    Validate -->|Not Allowed| Block
    
    Execute --> UpdateDB[(Update Database<br/>current_status)]
    UpdateDB --> LogHistory[Log to<br/>org_order_status_history]
    LogHistory --> TriggerHooks[Trigger Workflow Hooks]
    TriggerHooks --> Success([Success])
    
    Block --> Error([Error Response])
    
    style Execute fill:#10B981,stroke:#059669,color:#fff
    style Block fill:#EF4444,stroke:#DC2626,color:#fff
    style Success fill:#22C55E,stroke:#16A34A,color:#fff
    style Error fill:#EF4444,stroke:#DC2626,color:#fff
```

## Order Lifecycle with Page Visibility

```mermaid
stateDiagram-v2
    [*] --> Draft: Order Created
    Draft --> Intake: Intake
    Intake --> Preparation: Start Prep
    Preparation --> Sorting: Complete Prep
    Sorting --> Processing: Start Processing
    Processing --> Washing: Sort Complete
    Washing --> Drying: Wash Complete
    Drying --> Finishing: Dry Complete
    Finishing --> Assembly: Finish Complete
    Assembly --> QA: Assemble Complete
    QA --> Packing: QA Passed
    QA --> Washing: QA Failed
    Packing --> Ready: Pack Complete
    Ready --> OutForDelivery: Start Delivery
    OutForDelivery --> Delivered: Delivery Complete
    Delivered --> Closed: Close Order
    
    note right of Preparation
        Visible on:
        /dashboard/preparation
    end note
    
    note right of Processing
        Visible on:
        /dashboard/processing
    end note
    
    note right of Assembly
        Visible on:
        /dashboard/assembly
    end note
    
    note right of QA
        Visible on:
        /dashboard/qa
    end note
    
    note right of Ready
        Visible on:
        /dashboard/ready
    end note
    
    note right of Draft
        Visible on:
        /dashboard/orders
        (with filter)
    end note
```

## Order Status to Page Mapping Matrix

```mermaid
graph TB
    subgraph "Workflow Stages"
        S1[DRAFT]
        S2[INTAKE]
        S3[PREPARATION]
        S4[SORTING]
        S5[PROCESSING]
        S6[WASHING]
        S7[DRYING]
        S8[FINISHING]
        S9[ASSEMBLY]
        S10[QA]
        S11[PACKING]
        S12[READY]
        S13[OUT_FOR_DELIVERY]
        S14[DELIVERED]
        S15[CLOSED]
        S16[CANCELLED]
    end
    
    subgraph "Dashboard Pages"
        P1[All Orders Page<br/>/dashboard/orders]
        P2[Preparation Page<br/>/dashboard/preparation]
        P3[Processing Page<br/>/dashboard/processing]
        P4[Assembly Page<br/>/dashboard/assembly]
        P5[QA Page<br/>/dashboard/qa]
        P6[Ready Page<br/>/dashboard/ready]
    end
    
    S1 --> P1
    S2 --> P1
    S3 --> P2
    S3 --> P1
    S4 --> P1
    S5 --> P3
    S5 --> P1
    S6 --> P1
    S7 --> P1
    S8 --> P1
    S9 --> P4
    S9 --> P1
    S10 --> P5
    S10 --> P1
    S11 --> P1
    S12 --> P6
    S12 --> P1
    S13 --> P1
    S14 --> P1
    S15 --> P1
    S16 --> P1
    
    style P1 fill:#6B7280,stroke:#4B5563,color:#fff
    style P2 fill:#3B82F6,stroke:#1E40AF,color:#fff
    style P3 fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style P4 fill:#22C55E,stroke:#16A34A,color:#fff
    style P5 fill:#84CC16,stroke:#65A30D,color:#fff
    style P6 fill:#10B981,stroke:#059669,color:#fff
```

---

## Diagram Legend

### Page Colors
- 🔵 **Blue** - Preparation Page
- 🟣 **Purple** - Processing Page
- 🟢 **Green** - Assembly Page
- 🟡 **Yellow** - QA Page
- 🟢 **Green** - Ready Page
- ⚫ **Gray** - All Orders Page

### Status Colors
- ⚪ **Gray** - Draft, Closed
- 🔵 **Blue** - Intake
- 🟣 **Purple** - Preparation, Processing, Sorting
- 🔵 **Cyan** - Washing
- 🟢 **Teal** - Drying
- 🟢 **Green** - Finishing, Assembly, Ready, Delivered
- 🟡 **Yellow** - QA, Packing
- 🟠 **Orange** - Out for Delivery
- 🔴 **Red** - Cancelled

---

**Diagram Version:** v1.0.0  
**Last Updated:** 2025-01-20

