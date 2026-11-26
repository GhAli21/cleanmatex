/**
 * web-admin entry to the shared clock package (`@cmx/clock`, MASTER_PLAN_v2 §6.1).
 * New code imports date and time rules from here or from `@cmx/clock` directly.
 * The older helpers in `operational-time.ts` keep their names and behaviour until their
 * callers move (S3–S7); a few of them share a name with a package function but not its
 * signature (`parseInstant`, `formatInstant`, `formatCivilDate`), so they are not merged yet.
 */
export * from '@cmx/clock';
