# Developer Guide (diagrams) — Human-Friendly Codes

Text version: [`developer_guide.md`](./developer_guide.md).

## 1. Create an order → order number

```mermaid
sequenceDiagram
  participant UI as web-admin UI
  participant API as web-admin API / OrderService
  participant DB as Tenant DB
  UI->>API: create order
  API->>DB: BEGIN; insert order (last step)
  DB->>DB: generate_order_number(tenant)
  DB->>DB: fn_doc_seq_next('ORDER', tenant, now, tz)
  Note over DB: INSERT … ON CONFLICT DO UPDATE … RETURNING on sys_doc_seq_counter_tr
  DB-->>API: ORD-20261031-0001
  API->>DB: COMMIT
  API-->>UI: order with order_no
```

## 2. Split an order

```mermaid
flowchart LR
  A[ORD-…-0007] -->|split| B[ORD-…-0007-S1]
  B -->|split again| C[ORD-…-0007-S3]
  A -->|split| D[ORD-…-0007-S2]
  C -. root_order_id .-> A
  B -. root_order_id .-> A
```

## 3. Scan

```mermaid
flowchart TD
  S[Scanner / keyboard wedge] --> I[CmxScanInput / global scan dialog]
  I --> N[Normalize: Arabic layout → Latin, trim, upper-case]
  N --> R[POST /api/v1/scan/resolve]
  R --> P{Code shape?}
  P -->|order / item / piece code| C[Lookup on unique index tenant_org_id + code]
  P -->|other text| T[Lookup live external tag]
  C --> O[Open order / piece]
  T --> O
  C -->|not found or other tenant| NF[Code not found]
  T -->|not found| NF
```

## 4. Store credit note (P5)

```mermaid
sequenceDiagram
  participant SV as StoredValueService
  participant DB as Tenant DB
  SV->>DB: INSERT org_credit_notes_mst (credit_note_no = '')
  DB->>DB: BEFORE INSERT fn_doc_seq_assign_code → fn_doc_seq_next('STORE_CREDIT_NOTE')
  DB-->>SV: row with SCN-2026-000001
  Note over SV: LEGACY mode (fallback constant) still sends CN-… which the trigger keeps
```

## 5. HQ screens

```mermaid
flowchart LR
  W[platform-web: Code Types / Code Consistency / General Config] -->|JWT + hq_* permission| A[platform-api /api/hq/v1/doc-seq, /general-config]
  A -->|service role, read config, PATCH hq_general_config| DB[(Tenant DB engine tables)]
  WZ[HQ tenant wizard] -->|prefill| A
```
