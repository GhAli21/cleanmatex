import 'server-only';

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  ERP_LITE_AMOUNT_SOURCES,
  ERP_LITE_ATTEMPT_STATUSES,
  ERP_LITE_ENTRY_SIDES,
  ERP_LITE_ERROR_CODES,
  ERP_LITE_EXCEPTION_STATUSES,
  ERP_LITE_EXCEPTION_TYPES,
  ERP_LITE_LOG_STATUSES,
  ERP_LITE_PAYMENT_USAGE_MAP,
  ERP_LITE_POSTING_MODES,
  type ErpLiteAttemptStatus,
  type ErpLiteExceptionType,
  type ErpLiteLogStatus,
  type ErpLitePostingMode,
} from '@/lib/constants/erp-lite-posting';
import type {
  ErpLiteNormalizedPostingRequest,
  ErpLitePostingExecuteResult,
  ErpLitePostingPreviewLine,
  ErpLitePostingPreviewResult,
  ErpLitePostingRequest,
  ErpLitePostingRequestEnvelope,
  ErpLiteRepostParams,
  ErpLiteRetryParams,
} from '@/lib/types/erp-lite-posting';
import type { Json } from '@/types/database';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaSqlExecutor = Pick<typeof prisma, '$queryRaw' | '$executeRaw'>;

interface GovernanceRuleRow {
  pkg_id: string;
  pkg_code: string;
  pkg_version_no: number;
  compat_version: string;
  rule_id: string;
  rule_code: string;
  rule_version_no: number;
  priority_no: number;
  condition_json: Json | null;
  is_fallback: boolean;
  stop_on_match: boolean;
}

interface GovernanceLineRow {
  line_no: number;
  entry_side: string;
  usage_code_id: string | null;
  usage_code: string | null;
  resolver_id: string | null;
  resolver_code: string | null;
  amount_source_code: string;
  line_type_code: string;
  condition_json: Json | null;
}

interface TenantAccountRow {
  account_id: string;
  account_code: string;
  account_name: string;
  is_active: boolean;
  is_postable: boolean;
  acc_type_id: string | null;
  required_acc_type_id: string | null;
}

interface PeriodRow {
  period_id: string;
  period_code: string;
  status_code: string;
}

interface ExistingPostedLogRow {
  id: string;
  journal_id: string | null;
}

interface StoredPostingLogRow {
  id: string;
  request_payload_json: Json | null;
  source_doc_id: string;
  source_doc_type_code: string;
  txn_event_code: string;
  idempotency_key: string;
  attempt_no: number;
}

interface ResolvedGovernanceContext {
  package_id: string;
  package_code: string;
  package_version_no: number;
  rule_id: string;
  rule_code: string;
  rule_version_no: number;
  lines: GovernanceLineRow[];
}

interface ResolvedPostingLine extends ErpLitePostingPreviewLine {
  account_id: string;
}

interface ResolvedPostingContext {
  envelope: ErpLitePostingRequestEnvelope;
  governance: ResolvedGovernanceContext;
  lines: ResolvedPostingLine[];
  total_debit: number;
  total_credit: number;
  period_id: string;
  period_code: string;
}

class ErpLitePostingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly attemptStatus: ErpLiteAttemptStatus,
    public readonly exceptionType?: ErpLiteExceptionType
  ) {
    super(message);
    this.name = 'ErpLitePostingError';
  }
}

/**
 * Phase 4 governed runtime posting engine.
 *
 * This service stays intentionally isolated from business modules so Phase 5
 * can integrate invoice/payment/refund flows without duplicating finance logic.
 */
export class ErpLitePostingEngineService {
  static async preview(
    input: ErpLitePostingRequest
  ): Promise<ErpLitePostingPreviewResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);

    return withTenantContext(tenantId, async () => {
      const envelope = await this.buildEnvelope(input, tenantId, ERP_LITE_POSTING_MODES.PREVIEW);

      try {
        const context = await this.resolvePostingContext(envelope, prisma);
        const previewResult = this.buildPreviewResult(
          context,
          true,
          ERP_LITE_POSTING_MODES.PREVIEW
        );

        const postingLogId = await this.insertPostingLog({
          envelope,
          attemptStatus: ERP_LITE_ATTEMPT_STATUSES.VALIDATED,
          logStatus: ERP_LITE_LOG_STATUSES.PREVIEWED,
          previewResult,
          resolvedPayload: context,
        });

        return {
          ...previewResult,
          posting_log_id: postingLogId,
        };
      } catch (error) {
        return this.handlePreviewFailure(envelope, error);
      }
    });
  }

  static async execute(
    input: ErpLitePostingRequest
  ): Promise<ErpLitePostingExecuteResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);

    return withTenantContext(tenantId, async () => {
      const envelope = await this.buildEnvelope(input, tenantId, ERP_LITE_POSTING_MODES.EXECUTE);
      return this.executeEnvelope(envelope, prisma);
    });
  }

  static async executeInTransaction(
    tx: PrismaTx,
    input: ErpLitePostingRequest
  ): Promise<ErpLitePostingExecuteResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);

    return withTenantContext(tenantId, async () => {
      const envelope = await this.buildEnvelope(
        input,
        tenantId,
        ERP_LITE_POSTING_MODES.EXECUTE,
        undefined,
        undefined,
        undefined,
        tx
      );
      return this.executeEnvelope(envelope, tx, tx);
    });
  }

  static async retry(params: ErpLiteRetryParams): Promise<ErpLitePostingExecuteResult> {
    return this.replayStoredAttempt(params.posting_log_id, ERP_LITE_POSTING_MODES.RETRY);
  }

  static async repost(params: ErpLiteRepostParams): Promise<ErpLitePostingExecuteResult> {
    return this.replayStoredAttempt(params.posting_log_id, ERP_LITE_POSTING_MODES.REPOST);
  }

  private static async replayStoredAttempt(
    postingLogId: string,
    mode: ErpLitePostingMode
  ): Promise<ErpLitePostingExecuteResult> {
    const tenantId = await this.resolveTenantId();

    return withTenantContext(tenantId, async () => {
      const stored = await this.loadStoredPostingLog(tenantId, postingLogId);
      const normalizedRequest = this.deserializeStoredRequest(stored.request_payload_json);
      const envelope = await this.buildEnvelope(
        normalizedRequest,
        tenantId,
        mode,
        stored.idempotency_key,
        mode === ERP_LITE_POSTING_MODES.RETRY ? stored.id : null,
        mode === ERP_LITE_POSTING_MODES.REPOST ? stored.id : null
      );

      return this.executeEnvelope(envelope, prisma);
    });
  }

  private static async executeEnvelope(
    envelope: ErpLitePostingRequestEnvelope,
    db: PrismaSqlExecutor,
    journalTx?: PrismaTx
  ): Promise<ErpLitePostingExecuteResult> {
    let postingLogId: string | undefined;

    try {
      const duplicate = await this.findExistingPostedLog(
        envelope.request.tenant_org_id,
        envelope.idempotency_key,
        db
      );

      if (duplicate) {
        postingLogId = await this.insertPostingLog({
          envelope,
          attemptStatus: ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
          logStatus: ERP_LITE_LOG_STATUSES.SKIPPED,
          executeResult: {
            success: false,
            mode: envelope.mode,
            idempotency_key: envelope.idempotency_key,
            attempt_status_code: ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
            log_status_code: ERP_LITE_LOG_STATUSES.SKIPPED,
            error_code: ERP_LITE_ERROR_CODES.DUPLICATE_POST,
            error_message: 'A posted journal already exists for this idempotency key.',
            journal_id: duplicate.journal_id ?? undefined,
          },
        }, db);

        const exceptionId = await this.insertPostingException(
          envelope,
          postingLogId,
          ERP_LITE_EXCEPTION_TYPES.DUPLICATE_POST,
          'Duplicate posting attempt blocked by idempotency enforcement.',
          db
        );

        return {
          success: false,
          mode: envelope.mode,
          posting_log_id: postingLogId,
          idempotency_key: envelope.idempotency_key,
          attempt_status_code: ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
          log_status_code: ERP_LITE_LOG_STATUSES.SKIPPED,
          error_code: ERP_LITE_ERROR_CODES.DUPLICATE_POST,
          error_message: 'A posted journal already exists for this idempotency key.',
          journal_id: duplicate.journal_id ?? undefined,
          exception_id: exceptionId,
          exception_type_code: ERP_LITE_EXCEPTION_TYPES.DUPLICATE_POST,
        };
      }

      // PB-C5 fix: resolve posting context (read-only) outside the write transaction, then wrap
      // insertPostingLog + persistJournal + updatePostingLog in a single atomic transaction.
      // This guarantees that a journal can never exist without a matching POSTED log row.
      const context = await this.resolvePostingContext(envelope, db);

      let executeResult!: ErpLitePostingExecuteResult;
      let journalResult!: { journalId: string; journalNo: string };

      const atomicWrite = async (tx: PrismaTx) => {
        postingLogId = await this.insertPostingLog({
          envelope,
          attemptStatus: ERP_LITE_ATTEMPT_STATUSES.INITIATED,
          logStatus: ERP_LITE_LOG_STATUSES.FAILED,
        }, tx);

        journalResult = await this.persistJournal(tx, context);

        executeResult = {
          ...this.buildPreviewResult(context, true, envelope.mode),
          success: true,
          posting_log_id: postingLogId,
          journal_id: journalResult.journalId,
          journal_no: journalResult.journalNo,
          attempt_status_code: ERP_LITE_ATTEMPT_STATUSES.POSTED,
          log_status_code: ERP_LITE_LOG_STATUSES.POSTED,
        };

        await this.updatePostingLog(
          postingLogId,
          ERP_LITE_ATTEMPT_STATUSES.POSTED,
          ERP_LITE_LOG_STATUSES.POSTED,
          context,
          undefined,
          executeResult,
          journalResult.journalId,
          tx
        );

        // Gate B (snapshot): write immutable audit snapshot inside the same atomic transaction.
        // One row per posting attempt — UNIQUE(tenant_org_id, posting_log_id) guards duplicates.
        await this.writePostingSnapshot(tx, context, postingLogId, journalResult);
      };

      if (journalTx) {
        await atomicWrite(journalTx);
      } else {
        await prisma.$transaction(atomicWrite);
      }

      return executeResult;
    } catch (error) {
      // Use the global prisma client (not the transaction) for failure logging.
      // The transaction may be aborted at this point (PostgreSQL 25P02), which
      // would cause any further operations on `db` to fail immediately.
      //
      // When running inside an external transaction (journalTx is set), the
      // postingLogId was written inside that transaction and may have been
      // rolled back on failure. Passing it to handleExecuteFailure would cause
      // an FK violation on org_fin_post_exc_tr (fk_ofpe_log) because the parent
      // row in org_fin_post_log_tr no longer exists in the DB.
      // Pass undefined instead so handleExecuteFailure creates a fresh log row
      // via the global prisma client before inserting the exception record.
      const safeLogId = journalTx ? undefined : postingLogId;
      return this.handleExecuteFailure(envelope, safeLogId, error, prisma);
    }
  }

  private static async buildEnvelope(
    input: ErpLitePostingRequest,
    tenantId: string,
    mode: ErpLitePostingMode,
    existingIdempotencyKey?: string,
    retryOfLogId?: string | null,
    repostOfLogId?: string | null,
    db: PrismaSqlExecutor = prisma
  ): Promise<ErpLitePostingRequestEnvelope> {
    const request = this.normalizeRequest(input, tenantId);
    const idempotencyKey =
      existingIdempotencyKey ?? this.buildIdempotencyKey(request.tenant_org_id, request.txn_event_code, request.source_doc_id);
    const attemptNo = await this.getNextAttemptNo(request.tenant_org_id, idempotencyKey, db);

    return {
      request,
      mode,
      attempt_no: attemptNo,
      idempotency_key: idempotencyKey,
      retry_of_log_id: retryOfLogId ?? null,
      repost_of_log_id: repostOfLogId ?? null,
    };
  }

  private static normalizeRequest(
    input: ErpLitePostingRequest,
    tenantId: string
  ): ErpLiteNormalizedPostingRequest {
    if (!input.txn_event_code || !input.source_module_code || !input.source_doc_type_code || !input.source_doc_id) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.REQUEST_MISSING_SOURCE_METADATA,
        'Posting request is missing required source metadata.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    if (!input.currency_code || !input.journal_date) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.REQUEST_MISSING_CURRENCY_OR_DATE,
        'Posting request is missing currency or journal date.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    const amounts = {
      net_amount: Number(input.amounts.net_amount ?? 0),
      tax_amount: Number(input.amounts.tax_amount ?? 0),
      gross_amount: Number(input.amounts.gross_amount ?? 0),
      discount_amount: Number(input.amounts.discount_amount ?? 0),
      delivery_fee_amount: Number(input.amounts.delivery_fee_amount ?? 0),
      rounding_amount: Number(input.amounts.rounding_amount ?? 0),
    };

    return {
      tenant_org_id: tenantId,
      branch_id: input.branch_id ?? input.dimensions?.branch_id ?? null,
      txn_event_code: input.txn_event_code,
      source_module_code: input.source_module_code,
      source_doc_type_code: input.source_doc_type_code,
      source_doc_id: input.source_doc_id,
      source_doc_no: input.source_doc_no ?? null,
      journal_date: input.journal_date,
      posting_date: input.posting_date ?? input.journal_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts,
      dimensions: input.dimensions ?? {},
      meta: input.meta ?? {},
    };
  }

  private static async resolvePostingContext(
    envelope: ErpLitePostingRequestEnvelope,
    db: PrismaSqlExecutor
  ): Promise<ResolvedPostingContext> {
    const governance = await this.loadGovernance(envelope.request, db);
    const period = await this.loadOpenPeriod(
      envelope.request.tenant_org_id,
      envelope.request.posting_date,
      db
    );
    const lines: ResolvedPostingLine[] = [];

    for (const line of governance.lines) {
      if (!this.matchesLineCondition(line.condition_json, envelope.request)) {
        continue;
      }

      const amount = this.resolveAmount(line.amount_source_code, envelope.request);
      if (amount === 0) {
        continue;
      }

      const account = await this.resolveAccount(line, envelope.request, db);
      lines.push({
        line_no: line.line_no,
        entry_side: this.normalizeEntrySide(line.entry_side),
        amount_source_code: line.amount_source_code,
        amount,
        account_id: account.account_id,
        account_code: account.account_code,
        account_name: account.account_name,
        usage_code: line.usage_code,
        resolver_code: line.resolver_code,
        line_type_code: line.line_type_code,
      });
    }

    if (lines.length === 0) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.GOV_NO_LINES_RESOLVED,
        'Resolved posting produced no journal lines.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    const total_debit = this.sumSide(lines, ERP_LITE_ENTRY_SIDES.DEBIT);
    const total_credit = this.sumSide(lines, ERP_LITE_ENTRY_SIDES.CREDIT);

    if (Number(total_debit.toFixed(4)) !== Number(total_credit.toFixed(4))) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.JOURNAL_UNBALANCED,
        'Resolved journal lines are not balanced.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    return {
      envelope,
      governance,
      lines,
      total_debit,
      total_credit,
      period_id: period.period_id,
      period_code: period.period_code,
    };
  }

  private static async loadGovernance(
    request: ErpLiteNormalizedPostingRequest,
    db: PrismaSqlExecutor
  ): Promise<ResolvedGovernanceContext> {
    // PB-H2 fix: resolve only the tenant's assigned governance package via org_fin_gov_assign_mst.
    // Querying sys_fin_gov_pkg_mst directly would match any published package, not just the one
    // assigned to this tenant. The view vw_fin_effective_gov_for_tenant gives the assigned pkg_id.
    const candidateRules = await db.$queryRaw<GovernanceRuleRow[]>(Prisma.sql`
      SELECT
        p.pkg_id,
        p.pkg_code,
        p.version_no AS pkg_version_no,
        p.compat_version,
        r.rule_id,
        r.rule_code,
        r.version_no AS rule_version_no,
        r.priority_no,
        r.condition_json,
        r.is_fallback,
        r.stop_on_match
      FROM public.vw_fin_effective_gov_for_tenant gov
      INNER JOIN public.sys_fin_gov_pkg_mst p
        ON p.pkg_id = gov.pkg_id
      INNER JOIN public.sys_fin_map_rule_mst r
        ON r.pkg_id = p.pkg_id
      INNER JOIN public.sys_fin_evt_cd e
        ON e.evt_id = r.evt_id
      WHERE gov.tenant_org_id = ${request.tenant_org_id}::uuid
        AND p.status_code = 'PUBLISHED'
        AND p.is_active = true
        AND p.rec_status = 1
        AND (p.effective_from IS NULL OR p.effective_from <= ${request.posting_date}::date)
        AND (p.effective_to IS NULL OR p.effective_to >= ${request.posting_date}::date)
        AND r.status_code = 'ACTIVE'
        AND r.is_active = true
        AND r.rec_status = 1
        AND e.evt_code = ${request.txn_event_code}
      ORDER BY r.priority_no ASC, r.version_no DESC, p.version_no DESC
    `);

    const matchingRules = candidateRules.filter((rule) =>
      this.matchesRuleCondition(rule.condition_json, request)
    );

    if (matchingRules.length === 0) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.GOV_RULE_NOT_FOUND,
        `No published active posting rule found for event ${request.txn_event_code}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_RULE,
        ERP_LITE_EXCEPTION_TYPES.RULE_NOT_FOUND
      );
    }

    const rankedRules = [...matchingRules].sort((left, right) => {
      // PB-H3 fix: non-fallback rules always outrank fallback rules.
      if (left.is_fallback !== right.is_fallback) return left.is_fallback ? 1 : -1;
      const specificityDiff = this.getConditionSpecificity(right.condition_json) - this.getConditionSpecificity(left.condition_json);
      if (specificityDiff !== 0) return specificityDiff;
      if (left.priority_no !== right.priority_no) return left.priority_no - right.priority_no;
      if (left.rule_version_no !== right.rule_version_no) return right.rule_version_no - left.rule_version_no;
      return right.pkg_version_no - left.pkg_version_no;
    });

    // PB-H3 fix: if any non-fallback rule matched, exclude all fallback rules from contention.
    const nonFallbackRules = rankedRules.filter((r) => !r.is_fallback);
    const effectiveRules = nonFallbackRules.length > 0 ? nonFallbackRules : rankedRules;

    const winner = effectiveRules[0];

    const tied = effectiveRules.filter((rule) =>
      rule.is_fallback === winner.is_fallback &&
      this.getConditionSpecificity(rule.condition_json) === this.getConditionSpecificity(winner.condition_json) &&
      rule.priority_no === winner.priority_no &&
      rule.rule_version_no === winner.rule_version_no &&
      rule.pkg_version_no === winner.pkg_version_no
    );

    if (tied.length > 1) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.GOV_AMBIGUOUS_RULE,
        `Multiple rules remain tied for event ${request.txn_event_code}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_RULE,
        ERP_LITE_EXCEPTION_TYPES.AMBIGUOUS_RULE
      );
    }

    // PB-H3 fix: if winner has stop_on_match=true, no further rule candidates are considered.
    // (Already satisfied by winner selection above — we take exactly one winner.
    //  The flag is recorded here for audit/future use if multi-pass evaluation is added.)

    const lines = await db.$queryRaw<GovernanceLineRow[]>(Prisma.sql`
      SELECT
        d.line_no,
        d.entry_side,
        u.usage_code_id,
        u.usage_code,
        s.resolver_id,
        s.resolver_code,
        d.amount_source_code,
        d.line_type_code,
        d.condition_json
      FROM public.sys_fin_map_rule_dtl d
      LEFT JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = d.usage_code_id
      LEFT JOIN public.sys_fin_resolver_cd s
        ON s.resolver_id = d.resolver_id
      WHERE d.rule_id = ${winner.rule_id}::uuid
        AND d.is_active = true
        AND d.rec_status = 1
      ORDER BY d.line_no ASC
    `);

    return {
      package_id: winner.pkg_id,
      package_code: winner.pkg_code,
      package_version_no: winner.pkg_version_no,
      rule_id: winner.rule_id,
      rule_code: winner.rule_code,
      rule_version_no: winner.rule_version_no,
      lines,
    };
  }

  private static async resolveAccount(
    line: GovernanceLineRow,
    request: ErpLiteNormalizedPostingRequest,
    db: PrismaSqlExecutor
  ): Promise<TenantAccountRow> {
    if (line.usage_code) {
      return this.findTenantAccountByUsage(line.usage_code, request, db);
    }

    if (line.resolver_code === 'PAYMENT_METHOD_MAP') {
      const usageCode = this.resolvePaymentMethodUsage(request);
      return this.findTenantAccountByUsage(usageCode, request, db);
    }

    throw new ErpLitePostingError(
      ERP_LITE_ERROR_CODES.ACCOUNT_NOT_FOUND,
      'Posting line could not resolve a tenant account.',
      ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT,
      ERP_LITE_EXCEPTION_TYPES.ACCOUNT_NOT_FOUND
    );
  }

  private static async findTenantAccountByUsage(
    usageCode: string,
    request: ErpLiteNormalizedPostingRequest,
    db: PrismaSqlExecutor
  ): Promise<TenantAccountRow> {
    const branchScoped = request.branch_id
      ? await this.findMappedAccount(usageCode, request.tenant_org_id, request.branch_id, db)
      : null;
    const globalScoped = await this.findMappedAccount(usageCode, request.tenant_org_id, null, db);
    const account = branchScoped ?? globalScoped;

    if (!account) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.USAGE_MAPPING_NOT_FOUND,
        `No active usage mapping exists for ${usageCode}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT,
        ERP_LITE_EXCEPTION_TYPES.MISSING_USAGE_MAPPING
      );
    }

    if (!account.is_active) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.ACCOUNT_INACTIVE,
        `Resolved account ${account.account_code} is inactive.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT,
        ERP_LITE_EXCEPTION_TYPES.ACCOUNT_INACTIVE
      );
    }

    if (!account.is_postable) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.ACCOUNT_NOT_POSTABLE,
        `Resolved account ${account.account_code} is not postable.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT,
        ERP_LITE_EXCEPTION_TYPES.ACCOUNT_NOT_POSTABLE
      );
    }

    // PB-C2 fix: enforce account-type compatibility. If the usage code restricts to a specific
    // account type (primary_acc_type_id is not null), the mapped account must match it.
    if (
      account.required_acc_type_id !== null &&
      account.acc_type_id !== account.required_acc_type_id
    ) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.ACCOUNT_TYPE_MISMATCH,
        `Account ${account.account_code} type does not match the required type for usage code ${usageCode}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_ACCOUNT,
        ERP_LITE_EXCEPTION_TYPES.ACCOUNT_TYPE_MISMATCH
      );
    }

    return account;
  }

  private static async findMappedAccount(
    usageCode: string,
    tenantOrgId: string,
    branchId: string | null,
    db: PrismaSqlExecutor
  ): Promise<TenantAccountRow | null> {
    const branchFilter = branchId
      ? Prisma.sql`m.branch_id = ${branchId}::uuid`
      : Prisma.sql`m.branch_id IS NULL`;

    const rows = await db.$queryRaw<TenantAccountRow[]>(Prisma.sql`
      SELECT
        a.id AS account_id,
        a.account_code,
        a.name AS account_name,
        a.is_active,
        a.is_postable,
        a.acc_type_id::text AS acc_type_id,
        u.primary_acc_type_id::text AS required_acc_type_id
      FROM public.org_fin_usage_map_mst m
      INNER JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = m.usage_code_id
      INNER JOIN public.org_fin_acct_mst a
        ON a.id = m.account_id
       AND a.tenant_org_id = m.tenant_org_id
      WHERE m.tenant_org_id = ${tenantOrgId}::uuid
        AND ${branchFilter}
        AND u.usage_code = ${usageCode}
        AND m.status_code = 'ACTIVE'
        AND m.is_active = true
        AND m.rec_status = 1
      ORDER BY m.created_at DESC
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private static async loadOpenPeriod(
    tenantOrgId: string,
    postingDate: string,
    db: PrismaSqlExecutor
  ): Promise<PeriodRow> {
    const rows = await db.$queryRaw<PeriodRow[]>(Prisma.sql`
      SELECT
        id AS period_id,
        period_code,
        status_code
      FROM public.org_fin_period_mst
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND start_date <= ${postingDate}::date
        AND end_date >= ${postingDate}::date
        AND status_code = 'OPEN'
        AND is_active = true
        AND rec_status = 1
      ORDER BY start_date DESC
      LIMIT 1
    `);

    const period = rows[0];
    if (!period) {
      throw new ErpLitePostingError(
        ERP_LITE_ERROR_CODES.PERIOD_CLOSED,
        `No open accounting period exists for posting date ${postingDate}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.PERIOD_CLOSED
      );
    }

    return period;
  }

  private static resolveAmount(source: string, request: ErpLiteNormalizedPostingRequest): number {
    switch (source.toUpperCase()) {
      case ERP_LITE_AMOUNT_SOURCES.NET_AMOUNT:
        return this.roundAmount(request.amounts.net_amount);
      case ERP_LITE_AMOUNT_SOURCES.TAX_AMOUNT:
        return this.roundAmount(request.amounts.tax_amount);
      case ERP_LITE_AMOUNT_SOURCES.GROSS_AMOUNT:
        return this.roundAmount(request.amounts.gross_amount);
      case ERP_LITE_AMOUNT_SOURCES.DISCOUNT_AMOUNT:
        return this.roundAmount(request.amounts.discount_amount);
      case ERP_LITE_AMOUNT_SOURCES.DELIVERY_FEE_AMOUNT:
        return this.roundAmount(request.amounts.delivery_fee_amount);
      case ERP_LITE_AMOUNT_SOURCES.ROUNDING_AMOUNT:
        return this.roundAmount(request.amounts.rounding_amount);
      default:
        throw new ErpLitePostingError(
          ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR,
          `Unsupported amount source ${source}.`,
          ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
          ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
        );
    }
  }

  private static resolvePaymentMethodUsage(
    request: ErpLiteNormalizedPostingRequest
  ): string {
    const paymentMethod =
      request.meta.payment_method_code ??
      (request.txn_event_code === 'ORDER_SETTLED_WALLET' ? 'WALLET' : null) ??
      (request.txn_event_code === 'ORDER_SETTLED_CASH' ? PAYMENT_METHODS.CASH : null) ??
      (request.txn_event_code === 'ORDER_SETTLED_CARD' ? PAYMENT_METHODS.CARD : null);

    if (!paymentMethod) {
      throw new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR,
        'Payment method context is required for resolver PAYMENT_METHOD_MAP.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    const usageCode =
      ERP_LITE_PAYMENT_USAGE_MAP[paymentMethod as keyof typeof ERP_LITE_PAYMENT_USAGE_MAP];

    if (!usageCode) {
      throw new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR,
        `Unsupported payment method ${paymentMethod} for resolver PAYMENT_METHOD_MAP.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
      );
    }

    return usageCode;
  }

  private static normalizeEntrySide(entrySide: string): 'DEBIT' | 'CREDIT' {
    // PB-C3 fix: unknown entry_side must throw hard — never silently default to CREDIT.
    const upper = entrySide.toUpperCase();
    if (upper === ERP_LITE_ENTRY_SIDES.DEBIT || upper === ERP_LITE_ENTRY_SIDES.DR) {
      return ERP_LITE_ENTRY_SIDES.DEBIT;
    }
    if (upper === ERP_LITE_ENTRY_SIDES.CREDIT || upper === ERP_LITE_ENTRY_SIDES.CR) {
      return ERP_LITE_ENTRY_SIDES.CREDIT;
    }
    throw new ErpLitePostingError(
      ERP_LITE_ERROR_CODES.RULE_INVALID_ENTRY_SIDE,
      `Unknown entry_side value "${entrySide}" in governance rule line. Must be DEBIT, CREDIT, DR, or CR.`,
      ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
      ERP_LITE_EXCEPTION_TYPES.VALIDATION_ERROR
    );
  }

  private static sumSide(lines: ResolvedPostingLine[], side: 'DEBIT' | 'CREDIT'): number {
    return this.roundAmount(
      lines
        .filter((line) => line.entry_side === side)
        .reduce((sum, line) => sum + line.amount, 0)
    );
  }

  private static buildPreviewResult(
    context: ResolvedPostingContext,
    success: boolean,
    mode: ErpLitePostingMode
  ): ErpLitePostingPreviewResult {
    return {
      success,
      mode,
      idempotency_key: context.envelope.idempotency_key,
      package_code: context.governance.package_code,
      package_version_no: context.governance.package_version_no,
      rule_code: context.governance.rule_code,
      rule_version_no: context.governance.rule_version_no,
      journal_date: context.envelope.request.journal_date,
      posting_date: context.envelope.request.posting_date,
      total_debit: context.total_debit,
      total_credit: context.total_credit,
      lines: context.lines,
    };
  }

  /**
   * Writes one immutable audit snapshot row to org_fin_post_snapshot_tr inside the
   * same atomic transaction that persists the journal.  ON CONFLICT DO NOTHING ensures
   * idempotency when the engine is retried after a partial failure.
   *
   * All data is already resolved in `context` — no extra DB reads are needed here.
   */
  private static async writePostingSnapshot(
    tx: PrismaTx,
    context: ResolvedPostingContext,
    postingLogId: string,
    journalResult: { journalId: string; journalNo: string }
  ): Promise<void> {
    const req = context.envelope.request;
    const gov = context.governance;

    const resolvedRuleJson = JSON.stringify({
      rule_id: gov.rule_id,
      rule_code: gov.rule_code,
      rule_version_no: gov.rule_version_no,
    });

    const resolvedLinesJson = JSON.stringify(gov.lines);

    const resolvedMappingsJson = JSON.stringify(
      context.lines.map((l) => ({
        line_no: l.line_no,
        entry_side: l.entry_side,
        account_id: l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        usage_code: l.usage_code,
        resolver_code: l.resolver_code,
        amount_source_code: l.amount_source_code,
        amount: l.amount,
      }))
    );

    const uniqueAccountIds = [...new Set(context.lines.map((l) => l.account_id))];
    const resolvedAccountsJson = JSON.stringify(
      context.lines
        .filter((l, i) => uniqueAccountIds.indexOf(l.account_id) === i)
        .map((l) => ({ account_id: l.account_id, account_code: l.account_code, account_name: l.account_name }))
    );

    const journalHeaderJson = JSON.stringify({
      journal_id: journalResult.journalId,
      journal_no: journalResult.journalNo,
      total_debit: context.total_debit,
      total_credit: context.total_credit,
      period_code: context.period_code,
    });

    const journalLinesJson = JSON.stringify(
      context.lines.map((l) => ({
        entry_side: l.entry_side,
        account_id: l.account_id,
        account_code: l.account_code,
        debit: l.entry_side === 'DEBIT' ? l.amount : 0,
        credit: l.entry_side === 'CREDIT' ? l.amount : 0,
      }))
    );

    const actorType =
      context.envelope.mode === 'RETRY'
        ? 'RETRY'
        : context.envelope.mode === 'REPOST'
          ? 'REPOST'
          : 'AUTO';

    const actorUserId = req.meta?.created_by ?? null;

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public.org_fin_post_snapshot_tr (
        tenant_org_id,
        posting_log_id,
        journal_id,
        gov_pkg_id,
        gov_pkg_code,
        gov_pkg_version,
        gov_rule_id,
        gov_rule_code,
        gov_rule_version,
        source_module_code,
        source_doc_type_code,
        source_doc_id,
        txn_event_code,
        normalized_request_json,
        resolved_rule_json,
        resolved_lines_json,
        resolved_mappings_json,
        resolved_accounts_json,
        journal_header_json,
        journal_lines_json,
        actor_type,
        actor_user_id,
        created_by,
        created_info
      ) VALUES (
        ${req.tenant_org_id}::uuid,
        ${postingLogId}::uuid,
        ${journalResult.journalId}::uuid,
        ${gov.package_id}::uuid,
        ${gov.package_code},
        ${gov.package_version_no},
        ${gov.rule_id}::uuid,
        ${gov.rule_code},
        ${gov.rule_version_no},
        ${req.source_module_code},
        ${req.source_doc_type_code},
        ${req.source_doc_id},
        ${req.txn_event_code},
        ${JSON.stringify(req)}::jsonb,
        ${resolvedRuleJson}::jsonb,
        ${resolvedLinesJson}::jsonb,
        ${resolvedMappingsJson}::jsonb,
        ${resolvedAccountsJson}::jsonb,
        ${journalHeaderJson}::jsonb,
        ${journalLinesJson}::jsonb,
        ${actorType},
        ${actorUserId}::uuid,
        'erp_lite_engine',
        'Phase 7 snapshot wire'
      )
      ON CONFLICT (tenant_org_id, posting_log_id) DO NOTHING
    `);
  }

  private static async persistJournal(
    tx: PrismaTx,
    context: ResolvedPostingContext
  ): Promise<{ journalId: string; journalNo: string }> {
    const journalId = randomUUID();
    // PB-C4 fix: use deterministic DB sequence instead of random number.
    const journalNo = await this.nextFinDocNo(tx, context.envelope.request.tenant_org_id, 'JOURNAL');

    await this.insertJournal(tx, context, journalId, journalNo);
    await this.insertJournalLines(tx, context, journalId);

    return { journalId, journalNo };
  }

  private static async nextFinDocNo(
    db: PrismaSqlExecutor,
    tenantOrgId: string,
    docTypeCode: string
  ): Promise<string> {
    const rows = await db.$queryRaw<[{ doc_no: string }]>(Prisma.sql`
      SELECT fn_next_fin_doc_no(${tenantOrgId}::uuid, ${docTypeCode}) AS doc_no
    `);
    const docNo = rows[0]?.doc_no;
    if (!docNo) {
      throw new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR,
        `fn_next_fin_doc_no returned null for doc type ${docTypeCode}.`,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_VALIDATION,
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR
      );
    }
    return docNo;
  }

  private static async insertJournal(
    tx: PrismaTx,
    context: ResolvedPostingContext,
    journalId: string,
    journalNo: string
  ): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO public.org_fin_journal_mst (
          id,
          tenant_org_id,
          branch_id,
          journal_no,
          journal_date,
          posting_date,
          source_module_code,
          source_doc_type_code,
          source_doc_id,
          source_doc_no,
          txn_event_code,
          mapping_rule_id,
          mapping_rule_version_no,
          currency_code,
          exchange_rate,
          total_debit,
          total_credit,
          status_code,
          narration,
          created_at,
          created_by,
          created_info,
          is_active,
          rec_status
        ) VALUES (
          ${journalId}::uuid,
          ${context.envelope.request.tenant_org_id}::uuid,
          ${context.envelope.request.branch_id ? Prisma.sql`${context.envelope.request.branch_id}::uuid` : Prisma.sql`NULL`},
          ${journalNo},
          ${context.envelope.request.journal_date}::date,
          ${context.envelope.request.posting_date}::date,
          ${context.envelope.request.source_module_code},
          ${context.envelope.request.source_doc_type_code},
          ${context.envelope.request.source_doc_id}::uuid,
          ${context.envelope.request.source_doc_no},
          ${context.envelope.request.txn_event_code},
          ${context.governance.rule_id}::uuid,
          ${context.governance.rule_version_no},
          ${context.envelope.request.currency_code},
          ${context.envelope.request.exchange_rate},
          ${context.total_debit},
          ${context.total_credit},
          'POSTED',
          ${`${context.envelope.request.txn_event_code} posted by ERP-Lite engine`},
          CURRENT_TIMESTAMP,
          ${context.envelope.request.meta.created_by ?? 'erp_lite_engine'},
          ${`mode=${context.envelope.mode}; period=${context.period_code}`},
          true,
          1
        )
      `
    );
  }

  private static async insertJournalLines(
    tx: PrismaTx,
    context: ResolvedPostingContext,
    journalId: string
  ): Promise<void> {
    for (const line of context.lines) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO public.org_fin_journal_dtl (
            id,
            tenant_org_id,
            journal_id,
            line_no,
            branch_id,
            account_id,
            entry_side,
            amount_txn_currency,
            amount_base_currency,
            line_description,
            tax_code,
            tax_rate,
            created_at,
            created_by,
            created_info,
            is_active,
            rec_status
          ) VALUES (
            ${randomUUID()}::uuid,
            ${context.envelope.request.tenant_org_id}::uuid,
            ${journalId}::uuid,
            ${line.line_no},
            ${context.envelope.request.branch_id ? Prisma.sql`${context.envelope.request.branch_id}::uuid` : Prisma.sql`NULL`},
            ${line.account_id}::uuid,
            ${line.entry_side},
            ${line.amount},
            ${this.roundAmount(line.amount * context.envelope.request.exchange_rate)},
            ${`${line.entry_side} ${line.account_code} via ${line.amount_source_code}`},
            ${context.envelope.request.dimensions.tax_code ?? null},
            ${context.envelope.request.dimensions.tax_rate ?? null},
            CURRENT_TIMESTAMP,
            ${context.envelope.request.meta.created_by ?? 'erp_lite_engine'},
            ${`usage=${line.usage_code ?? 'resolver'}; resolver=${line.resolver_code ?? 'none'}`},
            true,
            1
          )
        `
      );
    }
  }

  private static async insertPostingLog(args: {
    envelope: ErpLitePostingRequestEnvelope;
    attemptStatus: ErpLiteAttemptStatus;
    logStatus: ErpLiteLogStatus;
    previewResult?: ErpLitePostingPreviewResult;
    executeResult?: ErpLitePostingExecuteResult;
    resolvedPayload?: ResolvedPostingContext;
  }, db: PrismaSqlExecutor = prisma): Promise<string> {
    const id = randomUUID();
    const { envelope } = args;

    await db.$executeRaw(
      Prisma.sql`
        INSERT INTO public.org_fin_post_log_tr (
          id,
          tenant_org_id,
          branch_id,
          source_module_code,
          source_doc_type_code,
          source_doc_id,
          source_doc_no,
          txn_event_code,
          mapping_rule_id,
          mapping_rule_version_no,
          idempotency_key,
          attempt_no,
          attempt_status_code,
          log_status_code,
          retry_of_log_id,
          repost_of_log_id,
          request_payload_json,
          resolved_payload_json,
          preview_result_json,
          execute_result_json,
          error_code,
          error_message,
          created_at,
          created_by,
          created_info,
          is_active,
          rec_status
        ) VALUES (
          ${id}::uuid,
          ${envelope.request.tenant_org_id}::uuid,
          ${envelope.request.branch_id ? Prisma.sql`${envelope.request.branch_id}::uuid` : Prisma.sql`NULL`},
          ${envelope.request.source_module_code},
          ${envelope.request.source_doc_type_code},
          ${envelope.request.source_doc_id}::uuid,
          ${envelope.request.source_doc_no},
          ${envelope.request.txn_event_code},
          NULL,
          NULL,
          ${envelope.idempotency_key},
          ${envelope.attempt_no},
          ${args.attemptStatus},
          ${args.logStatus},
          ${envelope.retry_of_log_id ? Prisma.sql`${envelope.retry_of_log_id}::uuid` : Prisma.sql`NULL`},
          ${envelope.repost_of_log_id ? Prisma.sql`${envelope.repost_of_log_id}::uuid` : Prisma.sql`NULL`},
          ${JSON.stringify(envelope.request)}::jsonb,
          ${args.resolvedPayload ? Prisma.sql`${JSON.stringify(this.toResolvedPayloadJson(args.resolvedPayload))}::jsonb` : Prisma.sql`NULL`},
          ${args.previewResult ? Prisma.sql`${JSON.stringify(args.previewResult)}::jsonb` : Prisma.sql`NULL`},
          ${args.executeResult ? Prisma.sql`${JSON.stringify(args.executeResult)}::jsonb` : Prisma.sql`NULL`},
          NULL,
          NULL,
          CURRENT_TIMESTAMP,
          ${envelope.request.meta.created_by ?? 'erp_lite_engine'},
          ${`mode=${envelope.mode}`},
          true,
          1
        )
      `
    );

    return id;
  }

  private static async updatePostingLog(
    postingLogId: string,
    attemptStatus: ErpLiteAttemptStatus,
    logStatus: ErpLiteLogStatus,
    resolvedPayload?: ResolvedPostingContext,
    error?: { code: string; message: string },
    executeResult?: ErpLitePostingExecuteResult,
    journalId?: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    await db.$executeRaw(
      Prisma.sql`
        UPDATE public.org_fin_post_log_tr
        SET
          journal_id = ${journalId ? Prisma.sql`${journalId}::uuid` : Prisma.sql`journal_id`},
          mapping_rule_id = ${resolvedPayload ? Prisma.sql`${resolvedPayload.governance.rule_id}::uuid` : Prisma.sql`mapping_rule_id`},
          mapping_rule_version_no = ${resolvedPayload ? resolvedPayload.governance.rule_version_no : Prisma.sql`mapping_rule_version_no`},
          attempt_status_code = ${attemptStatus},
          log_status_code = ${logStatus},
          resolved_payload_json = ${resolvedPayload ? Prisma.sql`${JSON.stringify(this.toResolvedPayloadJson(resolvedPayload))}::jsonb` : Prisma.sql`resolved_payload_json`},
          execute_result_json = ${executeResult ? Prisma.sql`${JSON.stringify(executeResult)}::jsonb` : Prisma.sql`execute_result_json`},
          error_code = ${error?.code ?? null},
          error_message = ${error?.message ?? null},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = 'erp_lite_engine',
          updated_info = 'posting lifecycle update'
        WHERE id = ${postingLogId}::uuid
      `
    );
  }

  private static async insertPostingException(
    envelope: ErpLitePostingRequestEnvelope,
    postingLogId: string,
    exceptionType: ErpLiteExceptionType,
    errorMessage: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<string> {
    const id = randomUUID();
    await db.$executeRaw(
      Prisma.sql`
        INSERT INTO public.org_fin_post_exc_tr (
          id,
          tenant_org_id,
          branch_id,
          posting_log_id,
          source_doc_id,
          source_doc_type_code,
          txn_event_code,
          exception_type_code,
          status_code,
          error_message,
          created_at,
          created_by,
          created_info,
          is_active,
          rec_status
        ) VALUES (
          ${id}::uuid,
          ${envelope.request.tenant_org_id}::uuid,
          ${envelope.request.branch_id ? Prisma.sql`${envelope.request.branch_id}::uuid` : Prisma.sql`NULL`},
          ${postingLogId}::uuid,
          ${envelope.request.source_doc_id}::uuid,
          ${envelope.request.source_doc_type_code},
          ${envelope.request.txn_event_code},
          ${exceptionType},
          ${ERP_LITE_EXCEPTION_STATUSES.NEW},
          ${errorMessage},
          CURRENT_TIMESTAMP,
          ${envelope.request.meta.created_by ?? 'erp_lite_engine'},
          ${`mode=${envelope.mode}`},
          true,
          1
        )
      `
    );

    return id;
  }

  private static async handlePreviewFailure(
    envelope: ErpLitePostingRequestEnvelope,
    error: unknown,
    db: PrismaSqlExecutor = prisma
  ): Promise<ErpLitePostingPreviewResult> {
    const resolved = this.toPostingError(error);

    const postingLogId = await this.insertPostingLog({
      envelope,
      attemptStatus: resolved.attemptStatus,
      logStatus: ERP_LITE_LOG_STATUSES.FAILED,
      previewResult: {
        success: false,
        mode: envelope.mode,
        idempotency_key: envelope.idempotency_key,
        error_code: resolved.code,
        error_message: resolved.message,
      },
    }, db);

    logger.warn('ERP-Lite preview failed', {
      tenantId: envelope.request.tenant_org_id,
      feature: 'erp-lite',
      action: 'posting-preview',
      sourceDocId: envelope.request.source_doc_id,
      eventCode: envelope.request.txn_event_code,
      errorCode: resolved.code,
    });

    return {
      success: false,
      mode: envelope.mode,
      posting_log_id: postingLogId,
      idempotency_key: envelope.idempotency_key,
      error_code: resolved.code,
      error_message: resolved.message,
    };
  }

  private static async handleExecuteFailure(
    envelope: ErpLitePostingRequestEnvelope,
    postingLogId: string | undefined,
    error: unknown,
    db: PrismaSqlExecutor = prisma
  ): Promise<ErpLitePostingExecuteResult> {
    const resolved = this.toPostingError(error);
    const effectiveLogId =
      postingLogId ??
      (await this.insertPostingLog({
        envelope,
        attemptStatus: resolved.attemptStatus,
        logStatus: ERP_LITE_LOG_STATUSES.FAILED,
      }, db));

    await this.updatePostingLog(
      effectiveLogId,
      resolved.attemptStatus,
      ERP_LITE_LOG_STATUSES.FAILED,
      undefined,
      { code: resolved.code, message: resolved.message },
      undefined,
      undefined,
      db
    );

    let exceptionId: string | undefined;
    if (resolved.exceptionType) {
      exceptionId = await this.insertPostingException(
        envelope,
        effectiveLogId,
        resolved.exceptionType,
        resolved.message,
        db
      );
    }

    logger.error('ERP-Lite execute failed', resolved, {
      tenantId: envelope.request.tenant_org_id,
      feature: 'erp-lite',
      action: 'posting-execute',
      sourceDocId: envelope.request.source_doc_id,
      eventCode: envelope.request.txn_event_code,
      errorCode: resolved.code,
    });

    return {
      success: false,
      mode: envelope.mode,
      posting_log_id: effectiveLogId,
      idempotency_key: envelope.idempotency_key,
      attempt_status_code: resolved.attemptStatus,
      log_status_code: ERP_LITE_LOG_STATUSES.FAILED,
      error_code: resolved.code,
      error_message: resolved.message,
      exception_id: exceptionId,
      exception_type_code: resolved.exceptionType,
    };
  }

  private static toPostingError(error: unknown): ErpLitePostingError {
    if (error instanceof ErpLitePostingError) {
      return error;
    }

    if (error instanceof Error) {
      return new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR,
        error.message,
        ERP_LITE_ATTEMPT_STATUSES.FAILED_SYSTEM,
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR
      );
    }

    return new ErpLitePostingError(
      ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR,
      'Unknown ERP-Lite posting error.',
      ERP_LITE_ATTEMPT_STATUSES.FAILED_SYSTEM,
      ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR
    );
  }

  private static async loadStoredPostingLog(
    tenantOrgId: string,
    postingLogId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<StoredPostingLogRow> {
    const rows = await db.$queryRaw<StoredPostingLogRow[]>(Prisma.sql`
      SELECT
        id,
        request_payload_json,
        source_doc_id,
        source_doc_type_code,
        txn_event_code,
        idempotency_key,
        attempt_no
      FROM public.org_fin_post_log_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND id = ${postingLogId}::uuid
      LIMIT 1
    `);

    const row = rows[0];
    if (!row || !row.request_payload_json) {
      throw new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR,
        'Stored posting log could not be loaded for retry/repost.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_SYSTEM,
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR
      );
    }

    return row;
  }

  private static deserializeStoredRequest(payload: Json): ErpLitePostingRequest {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ErpLitePostingError(
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR,
        'Stored posting request payload is invalid.',
        ERP_LITE_ATTEMPT_STATUSES.FAILED_SYSTEM,
        ERP_LITE_EXCEPTION_TYPES.SYSTEM_ERROR
      );
    }

    return payload as unknown as ErpLitePostingRequest;
  }

  private static async findExistingPostedLog(
    tenantOrgId: string,
    idempotencyKey: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<ExistingPostedLogRow | null> {
    const rows = await db.$queryRaw<ExistingPostedLogRow[]>(Prisma.sql`
      SELECT id, journal_id
      FROM public.org_fin_post_log_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND idempotency_key = ${idempotencyKey}
        AND attempt_status_code = 'POSTED'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private static async getNextAttemptNo(
    tenantOrgId: string,
    idempotencyKey: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<number> {
    const rows = await db.$queryRaw<Array<{ next_attempt: number }>>(Prisma.sql`
      SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next_attempt
      FROM public.org_fin_post_log_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND idempotency_key = ${idempotencyKey}
    `);

    return rows[0]?.next_attempt ?? 1;
  }

  private static matchesRuleCondition(condition: Json | null, request: ErpLiteNormalizedPostingRequest): boolean {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return true;
    }

    const entries = Object.entries(condition as Record<string, Json>);
    if (entries.length === 0) {
      return true;
    }

    return entries.every(([key, value]) => this.getRequestValueByKey(request, key) === value);
  }

  private static matchesLineCondition(condition: Json | null, request: ErpLiteNormalizedPostingRequest): boolean {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return true;
    }

    const whenExpression = (condition as Record<string, Json>).when;
    if (typeof whenExpression !== 'string' || whenExpression.trim() === '') {
      return true;
    }

    const normalized = whenExpression.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized === 'tax_amount > 0') {
      return request.amounts.tax_amount > 0;
    }
    if (normalized === 'rounding_amount != 0' || normalized === 'rounding_amount <> 0') {
      return request.amounts.rounding_amount !== 0;
    }

    return true;
  }

  private static getConditionSpecificity(condition: Json | null): number {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return 0;
    }

    return Object.keys(condition as Record<string, Json>).filter((key) => key !== 'when').length;
  }

  private static getRequestValueByKey(request: ErpLiteNormalizedPostingRequest, key: string): Json | undefined {
    switch (key) {
      case 'txn_event_code':
        return request.txn_event_code;
      case 'source_module_code':
        return request.source_module_code;
      case 'source_doc_type_code':
        return request.source_doc_type_code;
      case 'branch_id':
        return request.branch_id;
      default:
        return undefined;
    }
  }

  private static buildIdempotencyKey(
    tenantOrgId: string,
    eventCode: string,
    sourceDocId: string
  ): string {
    return `${tenantOrgId}:${eventCode}:${sourceDocId}:v1`;
  }

  private static roundAmount(value: number | undefined | null): number {
    return Number((value ?? 0).toFixed(4));
  }

  private static toResolvedPayloadJson(context: ResolvedPostingContext): Json {
    return {
      package_code: context.governance.package_code,
      package_version_no: context.governance.package_version_no,
      rule_code: context.governance.rule_code,
      rule_version_no: context.governance.rule_version_no,
      period_code: context.period_code,
      total_debit: context.total_debit,
      total_credit: context.total_credit,
      lines: context.lines.map((line) => ({
        line_no: line.line_no,
        entry_side: line.entry_side,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        amount: line.amount,
        amount_source_code: line.amount_source_code,
        usage_code: line.usage_code,
        resolver_code: line.resolver_code,
        line_type_code: line.line_type_code,
      })),
    };
  }

  private static async resolveTenantId(explicitTenantId?: string): Promise<string> {
    if (explicitTenantId) {
      return explicitTenantId;
    }

    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }

    return tenantId;
  }
}
