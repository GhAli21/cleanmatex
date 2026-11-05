import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type {
  DocSeqCategory,
  DocSeqCheckSeverity,
  DocSeqManageLevel,
  DocSeqResetPolicy,
  DocSeqType,
  SaasScope,
} from '@/lib/constants/doc-seq';

/**
 * Document numbering (Human-Friendly Codes) — read access to the P1 config and the engine.
 *
 * Uses $queryRaw on purpose: the P1 tables are not in the Prisma schema until you run
 * `prisma db pull` + `prisma generate` after applying the migrations. Switch to model calls then.
 *
 * Security: the engine functions are granted to service_role only. Prisma must connect with a role
 * that can execute them (the function owner, usually postgres) — pre-apply check Q-N1 in
 * docs/features/Human_Friendly_Codes/DEV_GUIDE_DOC_SEQ_ENGINE.md.
 *
 * Raw SQL is not seen by the Tenant Guard; every tenant query below passes tenant_org_id explicitly.
 */

type Tx = Prisma.TransactionClient;

/** One row of sys_doc_seq_type_cd as the app sees it. */
export interface DocSeqTypeConfig {
  docTypeCode: DocSeqType;
  name: string;
  name2: string | null;
  scopeCode: SaasScope;
  categoryCode: DocSeqCategory;
  moduleCode: string;
  subSystemCode: string;
  targetTable: string;
  targetColumn: string;
  isUnique: boolean;
  uniqueWith: string[] | null;
  prefix: string | null;
  typePrefix: string;
  separator: string;
  partsFormat: string;
  seqPadLength: number;
  fullSize: number | null;
  resetPolicy: DocSeqResetPolicy | null;
  manageByLevel: DocSeqManageLevel;
  managedByObject: string | null;
  implementDescription: string;
  isActive: boolean;
}

/** One finding from vw_doc_seq_consistency. */
export interface DocSeqConsistencyRow {
  checkCode: string;
  severity: DocSeqCheckSeverity;
  docTypeCode: string | null;
  objectName: string | null;
  detail: string | null;
}

interface DocSeqTypeRecord {
  doc_type_code: string;
  name: string;
  name2: string | null;
  scope_code: string;
  category_code: string;
  module_code: string;
  sub_system_code: string;
  target_table: string;
  target_column: string;
  is_unique: boolean;
  unique_with: string[] | null;
  prefix: string | null;
  type_prefix: string;
  separator: string;
  parts_format: string;
  seq_pad_length: number;
  full_size: number | null;
  reset_policy: string | null;
  manage_by_level: string;
  managed_by_object: string | null;
  implement_description: string;
  is_active: boolean;
}

function mapType(row: DocSeqTypeRecord): DocSeqTypeConfig {
  return {
    docTypeCode: row.doc_type_code as DocSeqType,
    name: row.name,
    name2: row.name2,
    scopeCode: row.scope_code as SaasScope,
    categoryCode: row.category_code as DocSeqCategory,
    moduleCode: row.module_code,
    subSystemCode: row.sub_system_code,
    targetTable: row.target_table,
    targetColumn: row.target_column,
    isUnique: row.is_unique,
    uniqueWith: row.unique_with,
    prefix: row.prefix,
    typePrefix: row.type_prefix,
    separator: row.separator,
    partsFormat: row.parts_format,
    seqPadLength: Number(row.seq_pad_length),
    fullSize: row.full_size === null ? null : Number(row.full_size),
    resetPolicy: row.reset_policy as DocSeqResetPolicy | null,
    manageByLevel: row.manage_by_level as DocSeqManageLevel,
    managedByObject: row.managed_by_object,
    implementDescription: row.implement_description,
    isActive: row.is_active,
  };
}

const TYPE_COLUMNS = Prisma.sql`
  doc_type_code, name, name2, scope_code, category_code, module_code, sub_system_code,
  target_table, target_column, is_unique, unique_with, prefix, type_prefix, separator,
  parts_format, seq_pad_length, full_size, reset_policy, manage_by_level, managed_by_object,
  implement_description, is_active`;

/**
 * Lists the live doc type configs (rec_status = 1), in display order.
 * @param options.activeOnly when true (default) only is_active rows
 * @returns doc type configs
 */
export async function listDocSeqTypes(options: { activeOnly?: boolean } = {}): Promise<DocSeqTypeConfig[]> {
  const activeOnly = options.activeOnly ?? true;
  const rows = await prisma.$queryRaw<DocSeqTypeRecord[]>(Prisma.sql`
    SELECT ${TYPE_COLUMNS}
    FROM public.sys_doc_seq_type_cd
    WHERE rec_status = 1
      AND (${activeOnly} = false OR is_active)
    ORDER BY display_order, doc_type_code
  `);
  return rows.map(mapType);
}

/**
 * Reads one doc type config.
 * @param docType doc type code
 * @returns the config, or null when it does not exist
 */
export async function getDocSeqType(docType: DocSeqType): Promise<DocSeqTypeConfig | null> {
  const rows = await prisma.$queryRaw<DocSeqTypeRecord[]>(Prisma.sql`
    SELECT ${TYPE_COLUMNS}
    FROM public.sys_doc_seq_type_cd
    WHERE doc_type_code = ${docType}
  `);
  return rows[0] ? mapType(rows[0]) : null;
}

/**
 * Takes the next code of a TENANT_ORG GENERAL doc type inside the caller's transaction.
 * Call it in the same transaction that inserts the document: a rollback then gives the number back
 * (no gap). Prefer the table trigger (fn_doc_seq_assign_code) once the doc type is GENERAL; use this
 * only where the code is needed before the insert.
 * @param tx Prisma transaction client
 * @param tenantId tenant_org_id of the document
 * @param docType a doc type whose manage_by_level is GENERAL (else DOC_SEQ_NOT_GENERAL)
 * @returns the formatted code, e.g. ORD-20261031-0001
 */
export async function nextTenantDocCodeTx(tx: Tx, tenantId: string, docType: DocSeqType): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ code: string }>>(Prisma.sql`
    SELECT public.fn_doc_seq_next(${tenantId}::uuid, ${docType}, now()) AS code
  `);
  const code = rows[0]?.code;
  if (!code) throw new Error(`fn_doc_seq_next returned no code for ${docType}`);
  return code;
}

/**
 * Reads the structural self-checks (triggers, indexes, owners, formats). Cheap: catalog reads only.
 * @param options.minSeverity ERROR (default) | WARN | INFO
 * @returns findings, worst first
 */
export async function listDocSeqConsistency(
  options: { minSeverity?: DocSeqCheckSeverity } = {}
): Promise<DocSeqConsistencyRow[]> {
  const rank: Record<DocSeqCheckSeverity, number> = { ERROR: 3, WARN: 2, INFO: 1 };
  const min = rank[options.minSeverity ?? 'ERROR'];
  const rows = await prisma.$queryRaw<
    Array<{ check_code: string; severity: string; doc_type_code: string | null; object_name: string | null; detail: string | null }>
  >(Prisma.sql`
    SELECT check_code, severity, doc_type_code, object_name, detail
    FROM public.vw_doc_seq_consistency
  `);
  return rows
    .filter((r) => (rank[r.severity as DocSeqCheckSeverity] ?? 0) >= min)
    .sort((a, b) => (rank[b.severity as DocSeqCheckSeverity] ?? 0) - (rank[a.severity as DocSeqCheckSeverity] ?? 0))
    .map((r) => ({
      checkCode: r.check_code,
      severity: r.severity as DocSeqCheckSeverity,
      docTypeCode: r.doc_type_code,
      objectName: r.object_name,
      detail: r.detail,
    }));
}
