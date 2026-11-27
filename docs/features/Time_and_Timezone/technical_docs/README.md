# Technical docs

| File | Contents |
|---|---|
| [`surface-map.md`](./surface-map.md) | Every required surface: database, SQL, jobs, APIs, actions, services, pages, pickers, messages, exports, logs, `cmx-api`, mobile, HQ |
| [`column-inventory.md`](./column-inventory.md) | The 90 naive non-audit columns and the 398 audit columns, with the conversion class |
| [`work-packages.md`](./work-packages.md) | Phase tasks, files, and stop conditions |

The contract those tasks implement is [`docs/dev/rules/time-and-timezone.md`](../../../dev/rules/time-and-timezone.md). Where this folder is quieter, that file wins: one zone policy with a TypeScript door and a SQL door, documented scope then organization, the fast path of one resolution per action, typed versus computed daylight-saving policy, and expand-and-contract with no UTC assumption before provenance.
- [`api-clock-inventory.md`](./api-clock-inventory.md): screen endpoints that return the `clock` block (S6; read by `api-clock-inventory.test.ts`).
- [`s5/0846_preimage.sql`](./s5/0846_preimage.sql): prints the pre-`0846` definitions for an exact rollback (S5).
