# CleanMateX Order Workflow V1 — Traceability Matrix

**Document ID:** CMX-OW-V1-PACK-018  
**Version:** 1.0  
**Status:** Living control document

| Req | Requirement | Design | Migration | API | UI | Test |
|---|---|---|---|---|---|---|
| OWV1-FR-001 | One facade | PACK-005 | 0418 | action endpoint | all actions | unit/API/E2E |
| OWV1-FR-002 | Multidimensional state | PACK-002/003 | 0406/0407 | state | summary/tabs | aggregation |
| OWV1-FR-003 | HQ configuration | PACK-004 | 0408 | HQ APIs | HQ pages | E2E |
| OWV1-FR-004 | Immutable versions | PACK-004 | 0408/0416 | publish | versions | DB/API |
| OWV1-FR-005 | Conditions | PACK-004/005 | 0411 | simulate/action | rule builder | property |
| OWV1-FR-006 | Work groups | PACK-003/007 | 0410 | groups | work tab | mixed order |
| OWV1-FR-007 | Stage execution | PACK-003/007 | 0410 | action/timeline | queues | rework |
| OWV1-FR-008 | Outsourcing | PACK-010 | 0412 | outsource | pages | E2E |
| OWV1-FR-009 | Partial fulfilment | PACK-011 | 0413 | releases | ready/release | E2E |
| OWV1-FR-010 | Custody | PACK-003/010/011 | 0414 | timeline | custody | DB/E2E |
| OWV1-FR-011 | Holds/approvals | PACK-003/012 | 0414 | holds | blockers | policy |
| OWV1-FR-012 | Finance gate | PACK-005/007 | integration | release | payment blocker | integration |
| OWV1-FR-013 | Idempotency | PACK-005 | 0409/0418 | header | conflict | API |
| OWV1-FR-014 | Concurrency | PACK-005 | 0407/0418 | version | refresh | conflict |
| OWV1-FR-015 | History/outbox | PACK-005/013 | 0409/0418 | timeline | timeline | atomicity |
| OWV1-FR-016 | Arabic/RTL | PACK-009 | labels | localized | all | RTL |
| OWV1-FR-017 | Clean migration | PACK-006/015 | 0406–0420 | n/a | n/a | replay |
| OWV1-FR-018 | Milestones | PACK-003/004 | 0406/0408 | tracking | tracking | mapping |
| OWV1-FR-019 | Atomic delivery | PACK-005/011 | 0413/0418 | delivery | driver | E2E |
| OWV1-FR-020 | No tenant authoring | PACK-004/012 | RLS | 403 | read-only | auth |

Every new requirement must link design, migration/table, API, UI, tests, status, and decision evidence.
