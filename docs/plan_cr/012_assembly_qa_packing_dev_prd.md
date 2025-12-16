# Assembly, QA & Packing - Development Plan & PRD

**Document ID**: 012  
**Version**: 1.0  
**Dependencies**: 001-011  
**Related Requirements**: FR-ASM-001, FR-QA-001, FR-PCK-001, UC05-07

---

## Overview

Implement assembly completeness checking, QA inspection workflows, and packing with quality gates enforced before "ready" status.

## Functional Requirements

### Assembly (FR-ASM-001)

- Completeness scan (100% required)
- Exception handling (missing/wrong/damaged)
- Bin/rack locations with capacity
- Packaging rules per service type
- Bilingual packing lists

### QA (FR-QA-001)

- Pass/fail inspection
- Photo capture on fail
- Rework loop routing
- QA checklist per service

### Packing (FR-PCK-001)

- Apply packaging profile
- Generate packing list (EN/AR)
- Mark ready (gate: assembly + QA complete)

## Technical Design

Uses existing:

- `org_assembly_tasks_mst`
- `org_assembly_items_dtl`
- `org_qa_checks_log`

### Quality Gate

```typescript
async function canMarkReady(orderId: string): Promise<boolean> {
  // 1. Assembly 100% complete
  const assembly = await db.query(
    `
    SELECT 
      COUNT(*) as expected,
      SUM(CASE WHEN scanned THEN 1 ELSE 0 END) as scanned
    FROM org_assembly_items_dtl ai
    JOIN org_assembly_tasks_mst at ON ai.assembly_task_id = at.id
    WHERE at.order_id = $1
  `,
    [orderId]
  );

  if (assembly.rows[0].expected !== assembly.rows[0].scanned) {
    return false;
  }

  // 2. QA passed
  const qa = await db.query(
    `
    SELECT result FROM org_qa_checks_log
    WHERE order_id = $1
    ORDER BY checked_at DESC LIMIT 1
  `,
    [orderId]
  );

  return qa.rows[0]?.result === "pass";
}
```

## API Endpoints

```typescript
// Assembly
POST   /api/v1/assembly/start/:orderId
POST   /api/v1/assembly/:id/scan
POST   /api/v1/assembly/:id/exception
POST   /api/v1/assembly/:id/complete

// QA
POST   /api/v1/qa/:orderId/inspect
POST   /api/v1/qa/:orderId/pass
POST   /api/v1/qa/:orderId/fail

// Packing
POST   /api/v1/packing/:orderId/pack
GET    /api/v1/packing/:orderId/list
```

## Implementation (6 days)

1. Assembly APIs & UI (2 days)
2. QA workflow (2 days)
3. Packing & lists (1 day)
4. Quality gates (1 day)

## Success Metrics

- Assembly incident rate: < 0.5%
- QA pass rate: > 95%
- Packing time: < 5 min

## Acceptance Checklist

- [ ] Assembly scanning complete
- [ ] Exception handling working
- [ ] QA pass/fail functional
- [ ] Rework loop operational
- [ ] Packing lists bilingual
- [ ] Quality gates enforced

---

**Last Updated**: 2025-10-09
