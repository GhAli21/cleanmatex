# Changelog

## 0.1.0-plan — 2026-11-24

- Added the implementation pack for the time and timezone rule.
- Recorded the Prisma inventory: 977 `timestamptz` columns, 488 naive `timestamp` columns (398 audit, 90 other).
- Sequenced the work so lockout, notification schedule, and Ready By are fixed before the audit-column batches.
- Required a provenance sample before any `USING col AT TIME ZONE` conversion.
