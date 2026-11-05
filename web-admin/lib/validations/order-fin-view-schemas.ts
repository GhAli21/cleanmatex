/**
 * Runtime guard for the Order Financial View contract (PR-04, P3-09).
 * Validates responses in tests and dev. `orderFinancialPublicViewSchema` is the
 * stricter one for the public projection (P3-06).
 */
import { z } from 'zod';
import {
  ORDER_FIN_BALANCE_STATES,
  ORDER_FIN_HEADER_METRICS,
  ORDER_FIN_HEADERS_MAX,
  ORDER_FIN_LINE_ROLES,
  ORDER_FIN_LINE_SIGNS,
  ORDER_FIN_LINE_STATES,
  ORDER_FIN_LINE_UNITS,
  ORDER_FIN_PRESETS,
  ORDER_FIN_PUBLIC_HEADER_METRICS,
  ORDER_FIN_PUBLIC_SECTION_KEYS,
  ORDER_FIN_SECTION_KEYS,
  ORDER_FIN_SECTION_MODES,
  ORDER_FIN_SECTION_STATUSES,
  ORDER_FIN_SOURCE_KINDS,
  ORDER_FIN_VIEW_SCHEMA_VERSION,
  ORDER_FIN_WARNING_SEVERITIES,
} from '@/lib/constants/order-fin-view';

const sectionKey = z.enum(ORDER_FIN_SECTION_KEYS);
const names = z.object({ name: z.string().nullable(), name2: z.string().nullable() });

export const orderFinLineSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().optional(),
  label: names.optional(),
  unit: z.enum(ORDER_FIN_LINE_UNITS),
  amount: z.number().finite().nullable(),
  previousAmount: z.number().finite().nullable().optional(),
  sign: z.enum(ORDER_FIN_LINE_SIGNS),
  role: z.enum(ORDER_FIN_LINE_ROLES),
  state: z.enum(ORDER_FIN_LINE_STATES),
  countsInTotal: z.boolean(),
  meta: z.object({
    dateIso: z.string().optional(),
    methodCode: z.string().optional(),
    ref: z.string().optional(),
    statusCode: z.string().optional(),
  }).optional(),
});

export const orderFinSectionPayloadSchema = z.object({
  key: sectionKey,
  status: z.enum(ORDER_FIN_SECTION_STATUSES),
  totals: z.array(orderFinLineSchema),
  lines: z.array(orderFinLineSchema).optional(),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  warningCodes: z.array(z.string()).optional(),
  partial: z.boolean().optional(),
});

export const financialWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(ORDER_FIN_WARNING_SEVERITIES),
  messageKey: z.string().min(1),
  messageParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const orderFinancialViewSchema = z.object({
  schemaVersion: z.literal(ORDER_FIN_VIEW_SCHEMA_VERSION),
  orderId: z.string().nullable(),
  orderNo: z.string().nullable(),
  orderStatus: z.string().nullable(),
  currency: z.object({
    code: z.string().nullable(),
    decimalPlaces: z.number().int().min(0).max(4).nullable(),
  }),
  currencyKnown: z.boolean(),
  snapshotStatus: z.string().nullable(),
  sourceKind: z.enum(ORDER_FIN_SOURCE_KINDS),
  generatedAt: z.string().min(1),
  header: z.object({
    metrics: z.partialRecord(z.enum(ORDER_FIN_HEADER_METRICS), z.number().finite().nullable()),
    balanceState: z.enum(ORDER_FIN_BALANCE_STATES).nullable(),
    paymentStatus: z.string().nullable(),
    settlementType: z.string().nullable(),
    // Mirrors OrderChangeFinancialOutcome (order-change-financial-result.service.ts); the test pins it.
    editOutcome: z.enum(['SETTLED', 'OUTSTANDING', 'OVERPAYMENT', 'DENIED']).optional(),
    baseCurrency: z.object({
      code: z.string(),
      total: z.number().finite().nullable(),
      exchangeRate: z.number().finite().nullable(),
    }).nullable().optional(),
  }),
  sections: z.partialRecord(sectionKey, orderFinSectionPayloadSchema),
  warnings: z.array(financialWarningSchema),
})
  // A section stored under one key must describe that key.
  .refine(
    (v) => Object.entries(v.sections).every(([k, s]) => !s || s.key === k),
    { message: 'section key mismatch', path: ['sections'] },
  );

// ─── Public projection (§6.2, P3-06): strict objects, so any field outside the allowlist fails ───

const publicLineSchema = z.strictObject({
  id: z.string().min(1),
  labelKey: z.string().optional(),
  label: z.strictObject({ name: z.string().nullable(), name2: z.string().nullable() }).optional(),
  unit: z.literal('money'),
  amount: z.number().finite().nullable(),
  sign: z.enum(ORDER_FIN_LINE_SIGNS),
  role: z.enum(ORDER_FIN_LINE_ROLES),
  state: z.enum(ORDER_FIN_LINE_STATES),
  countsInTotal: z.boolean(),
  meta: z.strictObject({ methodCode: z.string().min(1) }).optional(),
});

const publicSectionSchema = z.strictObject({
  key: z.enum(ORDER_FIN_PUBLIC_SECTION_KEYS),
  status: z.enum(ORDER_FIN_SECTION_STATUSES),
  totals: z.array(publicLineSchema),
  lines: z.array(publicLineSchema).optional(),
});

/** The public view (tracking token, customer portal). Rejects unknown fields at every level. */
export const orderFinancialPublicViewSchema = z.strictObject({
  schemaVersion: z.literal(ORDER_FIN_VIEW_SCHEMA_VERSION),
  orderId: z.null(),
  orderNo: z.string().nullable(),
  orderStatus: z.null(),
  currency: z.strictObject({
    code: z.string().nullable(),
    decimalPlaces: z.number().int().min(0).max(4).nullable(),
  }),
  currencyKnown: z.boolean(),
  snapshotStatus: z.null(),
  sourceKind: z.literal('saved'),
  generatedAt: z.string().min(1),
  header: z.strictObject({
    metrics: z.partialRecord(z.enum(ORDER_FIN_PUBLIC_HEADER_METRICS), z.number().finite().nullable()),
    balanceState: z.enum(ORDER_FIN_BALANCE_STATES).nullable(),
    paymentStatus: z.string().nullable(),
    settlementType: z.null(),
  }),
  sections: z.partialRecord(z.enum(ORDER_FIN_PUBLIC_SECTION_KEYS), publicSectionSchema),
  warnings: z.array(z.never()),
}).refine(
  (v) => Object.entries(v.sections).every(([k, s]) => !s || s.key === k),
  { message: 'section key mismatch', path: ['sections'] },
);

// shortcut: no `satisfies z.ZodType<OrderFinancialView>` — under web-admin's strict:false, Zod reads
// `.nullable()` as optional and the check cannot hold; the schema test parses a typed fixture instead.
// Upgrade when web-admin turns on strictNullChecks.

// ─── Request schemas (P4-01/P4-02/P4-03, PR-05) ───────────────────────────

const sectionMode = z.enum(ORDER_FIN_SECTION_MODES);

/**
 * `sections` as one query value, `key:mode` pairs separated by commas
 * (`items:detail,taxes:total`). Only known keys and modes pass; a key given
 * twice is refused, so the request means one thing.
 */
const sectionOverrides = z.string().max(600).transform((raw, ctx) => {
  const out: Partial<Record<(typeof ORDER_FIN_SECTION_KEYS)[number], (typeof ORDER_FIN_SECTION_MODES)[number]>> = {};
  for (const pair of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [key, mode, extra] = pair.split(':');
    const k = sectionKey.safeParse(key);
    const m = sectionMode.safeParse(mode);
    if (!k.success || !m.success || extra !== undefined || out[k.data]) {
      ctx.addIssue({ code: 'custom', message: `Invalid section override: ${pair.slice(0, 40)}` });
      return z.NEVER;
    }
    out[k.data] = m.data;
  }
  return out;
});

/** The display request a staff caller may send; everything else is ignored. */
export const orderFinViewRequestSchema = z.object({
  preset: z.enum(ORDER_FIN_PRESETS).optional(),
  sections: sectionOverrides.optional(),
});
export type OrderFinViewRequest = z.infer<typeof orderFinViewRequestSchema>;

/** Batch headers: 1 to `ORDER_FIN_HEADERS_MAX` order ids (the service dedupes). */
export const orderFinHeadersRequestSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(ORDER_FIN_HEADERS_MAX),
});

/** The same display request as an object (server action): known keys and modes only. */
export const orderFinViewConfigSchema = z.object({
  preset: z.enum(ORDER_FIN_PRESETS).optional(),
  sections: z.partialRecord(sectionKey, sectionMode).optional(),
}).strict();
