# Developer flows

## Classify a value

```mermaid
flowchart TD
  start[A date or time value] --> kind{What is it?}
  kind -->|A point on the timeline| instant[timestamptz and RFC 3339 Z]
  kind -->|A calendar day in a place| civil[date YYYY-MM-DD stored once]
  kind -->|A wall time that repeats each day| local[time or HH:mm plus the documented scope]
  kind -->|A date and time not yet resolved| civilDt[Civil fields plus IANA zone until the server stores one timestamptz]
  kind -->|Elapsed minutes| duration[Subtract two instants]
  instant --> store[Database clock for authoritative instants]
  civil --> snap[Write the date and the IANA zone from one database instant]
  local --> fire[Materialize the next UTC instant for workers]
  civilDt --> resolve[Server resolves the documented scope. Typed gap or overlap needs an explicit choice]
```

## Convert a legacy naive column

```mermaid
flowchart TD
  find[Find every writer and every reader] --> sample[Sample rows against a known UTC log line]
  sample --> shape{One stored clock?}
  shape -->|Unknown or both| stop[Stop. Do not read the column as UTC]
  shape -->|One proven clock| twin[Add a timestamptz twin. Keep the source]
  twin --> dual[Dual-write from one authoritative instant]
  dual --> backfill[Backfill in batches with the proven AT TIME ZONE]
  backfill --> readers[Move readers to the twin]
  readers --> later[Drop the old column in a later migration]
  later --> review[Human review and apply each migration]
  review --> pull[npm run prisma:pull]
  pull --> tests[Lockout, quiet hours, Ready By, midnight business date]
```

## Request path for an operational screen

```mermaid
sequenceDiagram
  participant Page
  participant Resolver
  participant API
  participant DB
  Page->>Resolver: documented scope, else organization zone
  Note over Resolver,DB: SQL uses fn_ops_zone with the same inputs. Resolve once per action.
  alt zone missing
    Resolver-->>Page: skeleton, no absolute clock
  else zone known
    Resolver-->>Page: IANA zone
    Page->>API: civil fields or RFC 3339 Z
    API->>DB: timestamptz and, when assigning a day, date plus zone
    DB-->>API: instants
    API-->>Page: RFC 3339 Z
    Page->>Page: format with the resolved zone
  end
```
