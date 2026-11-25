-- =============================================================================
-- Migration: 0827_prc_batch_trx.sql
-- Purpose:   1. Create Processing batch/operator transaction tables
--               (org_prc_trx_mst + org_prc_trx_dtl) with DB-generated
--               immutable trx_code (<order_no>-PRC-<0001..>) and HFC registry
--               entry PROCESSING_TRX (type_prefix PRCT).
--            2. Add unified append-only notes_followup JSONB arrays to
--               org_orders_mst, org_order_items_dtl, and
--               org_order_item_pieces_dtl (matching org_order_preferences_dtl),
--               plus multi-level atomic append RPC org_ord_append_notes_followup.
-- Affected:  org_prc_trx_mst (new), org_prc_trx_dtl (new),
--            org_orders_mst (notes_followup), org_order_items_dtl (notes_followup),
--            org_order_item_pieces_dtl (notes_followup), sys_doc_seq_type_cd (seed),
--            fn_prc_trx_code_assign (new), org_ord_append_notes_followup (new).
-- Related:   0406 (org_order_preferences_dtl.notes_followup),
--            0667 / 0670 / 0671 (Human-Friendly Codes registry & guards),
--            0702 (committed-order commercial column guard; new tables &
--                  notes_followup stay writable during Processing).
-- Rollback (forward-only repo; use a new migration, RESTRICT):
--   DROP FUNCTION IF EXISTS public.org_ord_append_notes_followup(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) RESTRICT;
--   DROP TABLE IF EXISTS public.org_prc_trx_dtl RESTRICT;
--   DROP TABLE IF EXISTS public.org_prc_trx_mst RESTRICT;
--   DROP FUNCTION IF EXISTS public.fn_prc_trx_code_assign() RESTRICT;
--   DELETE FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'PROCESSING_TRX';
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 1. Processing Transaction Header (org_prc_trx_mst)
-- =============================================================================

-- Stores one header row per Processing batch save, step action, item completion,
-- external tag link, or standalone Processing note. Append-only operational fact
-- table; trx_code (<order_no>-PRC-000x) is assigned by DB trigger and immutable.
CREATE TABLE public.org_prc_trx_mst (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(), -- Immutable transaction batch identifier
  tenant_org_id   UUID        NOT NULL,                           -- Organization ownership for multi-tenant isolation
  branch_id       UUID        NULL,                               -- Branch where processing occurred; NULL if branchless/backfilled from order
  order_id        UUID        NOT NULL,                           -- Parent order whose pieces/items were processed
  trx_code        TEXT        NOT NULL,                           -- Immutable human-friendly code: <order_no>-PRC-000x (HFC PRCT)
  trans_type      TEXT        NOT NULL,                           -- Batch classification (PROCESSING_BATCH, STEP_RECORD, TAG_LINK, etc.)
  trx_description TEXT        NULL,                               -- Human-readable summary of the batch transaction
  source_screen   TEXT        NOT NULL,                           -- Origin surface (processing_modal, simple_processing, scan_station, etc.)
  actor_user_id   UUID        NULL,                               -- Authenticated operator auth.users id when available
  actor_name      TEXT        NULL,                               -- Operator display name snapshot retained independently of profile edits
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),             -- Business occurrence instant (UTC)
  idempotency_key TEXT        NULL,                               -- Optional client deduplication key scoped per tenant
  notes           TEXT        NULL,                               -- Optional batch-level operator note
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,       -- Structured summary counts and context payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),             -- Row creation instant (UTC)
  created_by      TEXT        NULL,                               -- Creator identifier or system actor
  created_info    TEXT        NULL,                               -- Creation provenance / endpoint context
  updated_at      TIMESTAMPTZ NULL,                               -- Last modification instant (UTC), maintained by trg_set_updated_at
  updated_by      TEXT        NULL,                               -- Modifier identifier
  updated_info    TEXT        NULL,                               -- Modification provenance
  rec_status      SMALLINT    NOT NULL DEFAULT 1,                 -- Standard status: 1=active, 0=soft-deleted
  rec_order       INTEGER     NULL,                               -- Optional manual display sequence
  rec_notes       TEXT        NULL,                               -- Optional administrative audit remarks
  is_active       BOOLEAN     NOT NULL DEFAULT true,              -- Lifecycle active flag; true for active history rows

  CONSTRAINT pk_org_prc_trx_mst PRIMARY KEY (id),
  CONSTRAINT uq_prc_trx_mst_id_tnt UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_prc_trx_mst_agg UNIQUE (id, order_id, tenant_org_id),
  CONSTRAINT uq_prc_trx_mst_code UNIQUE (tenant_org_id, trx_code),
  CONSTRAINT fk_prc_trx_mst_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_mst_br FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst (id, tenant_org_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_mst_ord FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst (id, tenant_org_id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_mst_act FOREIGN KEY (actor_user_id)
    REFERENCES auth.users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_prc_trx_mst_code CHECK (btrim(trx_code) <> '' AND trx_code LIKE '%-PRC-%'),
  CONSTRAINT ck_prc_trx_mst_type CHECK (
    trans_type IN (
      'PROCESSING_BATCH',
      'SIMPLE_PROCESSING',
      'STEP_RECORD',
      'ITEM_COMPLETE',
      'RACK_ASSIGN',
      'TAG_LINK',
      'NOTE_ADD',
      'OTHERS'
    )
  ),
  CONSTRAINT ck_prc_trx_mst_src CHECK (btrim(source_screen) <> ''),
  CONSTRAINT ck_prc_trx_mst_rec CHECK (rec_status IN (0, 1))
);

COMMENT ON TABLE public.org_prc_trx_mst IS 'Processing batch and operator transaction header table (one row per processing save, step record, tag link, or operational note batch).';
COMMENT ON COLUMN public.org_prc_trx_mst.id IS 'Immutable Processing transaction batch UUID.';
COMMENT ON COLUMN public.org_prc_trx_mst.tenant_org_id IS 'Tenant organization UUID scoping all queries and RLS policies.';
COMMENT ON COLUMN public.org_prc_trx_mst.branch_id IS 'Branch UUID where the processing transaction occurred; defaults from parent order when omitted.';
COMMENT ON COLUMN public.org_prc_trx_mst.order_id IS 'Order UUID associated with this processing transaction.';
COMMENT ON COLUMN public.org_prc_trx_mst.trx_code IS 'Immutable human-friendly transaction code (<order_no>-PRC-<0001..>); DB-assigned on INSERT and never truncated above 9999.';
COMMENT ON COLUMN public.org_prc_trx_mst.trans_type IS 'Transaction header classification: PROCESSING_BATCH, SIMPLE_PROCESSING, STEP_RECORD, ITEM_COMPLETE, RACK_ASSIGN, TAG_LINK, NOTE_ADD, OTHERS.';
COMMENT ON COLUMN public.org_prc_trx_mst.trx_description IS 'Human-readable description summarizing what changed in the batch.';
COMMENT ON COLUMN public.org_prc_trx_mst.source_screen IS 'UI screen or API origin that submitted this batch (e.g., processing_modal, simple_processing, processing_detail, scan_station).';
COMMENT ON COLUMN public.org_prc_trx_mst.actor_user_id IS 'Authenticated operator auth.users UUID when executed by a signed-in user.';
COMMENT ON COLUMN public.org_prc_trx_mst.actor_name IS 'Operator display name snapshot captured at transaction occurrence time.';
COMMENT ON COLUMN public.org_prc_trx_mst.occurred_at IS 'Instant (UTC) when the processing action occurred.';
COMMENT ON COLUMN public.org_prc_trx_mst.idempotency_key IS 'Optional caller idempotency token preventing duplicate batch entries on retries.';
COMMENT ON COLUMN public.org_prc_trx_mst.notes IS 'Optional batch-level operator note (always writable on committed orders).';
COMMENT ON COLUMN public.org_prc_trx_mst.metadata IS 'Structured JSONB summary metadata (counts, screen metrics).';
COMMENT ON COLUMN public.org_prc_trx_mst.created_at IS 'Row insertion instant (UTC).';
COMMENT ON COLUMN public.org_prc_trx_mst.created_by IS 'Row creator identity.';
COMMENT ON COLUMN public.org_prc_trx_mst.created_info IS 'Row creation context.';
COMMENT ON COLUMN public.org_prc_trx_mst.updated_at IS 'Row update instant (UTC), maintained by trigger.';
COMMENT ON COLUMN public.org_prc_trx_mst.updated_by IS 'Row updater identity.';
COMMENT ON COLUMN public.org_prc_trx_mst.updated_info IS 'Row update context.';
COMMENT ON COLUMN public.org_prc_trx_mst.rec_status IS 'Record lifecycle state: 1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.org_prc_trx_mst.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.org_prc_trx_mst.rec_notes IS 'Administrative record notes.';
COMMENT ON COLUMN public.org_prc_trx_mst.is_active IS 'Boolean active flag matching rec_status lifecycle.';
COMMENT ON CONSTRAINT pk_org_prc_trx_mst ON public.org_prc_trx_mst IS 'Primary key on id.';
COMMENT ON CONSTRAINT uq_prc_trx_mst_id_tnt ON public.org_prc_trx_mst IS 'Tenant-qualified identity key for composite references.';
COMMENT ON CONSTRAINT uq_prc_trx_mst_agg ON public.org_prc_trx_mst IS 'Parent aggregate key (id, order_id, tenant_org_id) enforcing detail lines stay on the same tenant and order.';
COMMENT ON CONSTRAINT uq_prc_trx_mst_code ON public.org_prc_trx_mst IS 'Enforces human-friendly trx_code uniqueness per tenant.';
COMMENT ON CONSTRAINT fk_prc_trx_mst_tnt ON public.org_prc_trx_mst IS 'Tenant scope FK; cascades only with tenant deletion.';
COMMENT ON CONSTRAINT fk_prc_trx_mst_br ON public.org_prc_trx_mst IS 'Composite branch FK matching org_branches_mst PK (id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_prc_trx_mst_ord ON public.org_prc_trx_mst IS 'Composite order FK matching org_orders_mst (id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_prc_trx_mst_act ON public.org_prc_trx_mst IS 'Actor user FK to auth.users(id); RESTRICT prevents deleting users with audit history.';
COMMENT ON CONSTRAINT ck_prc_trx_mst_code ON public.org_prc_trx_mst IS 'Ensures non-blank trx_code carrying -PRC- token.';
COMMENT ON CONSTRAINT ck_prc_trx_mst_type ON public.org_prc_trx_mst IS 'Restricts trans_type to supported Processing transaction categories.';
COMMENT ON CONSTRAINT ck_prc_trx_mst_src ON public.org_prc_trx_mst IS 'Requires a non-blank source_screen identifier.';
COMMENT ON CONSTRAINT ck_prc_trx_mst_rec ON public.org_prc_trx_mst IS 'Restricts rec_status to 0 or 1.';

-- Partial unique index for tenant-scoped idempotency when idempotency_key is provided
CREATE UNIQUE INDEX uq_prc_trx_mst_idem
  ON public.org_prc_trx_mst (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
COMMENT ON INDEX public.uq_prc_trx_mst_idem IS 'Guarantees idempotent batch recording when caller passes idempotency_key.';

-- Tenant-first indexes supporting order activity timeline, operator KPIs, and branch filtering
CREATE INDEX idx_prc_trx_mst_tnt_ord
  ON public.org_prc_trx_mst (tenant_org_id, order_id, occurred_at DESC);
COMMENT ON INDEX public.idx_prc_trx_mst_tnt_ord IS 'Supports chronological Processing transaction timeline queries per tenant and order.';

CREATE INDEX idx_prc_trx_mst_tnt_act
  ON public.org_prc_trx_mst (tenant_org_id, actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_mst_tnt_act IS 'Supports operator productivity and audit queries per tenant and actor.';

CREATE INDEX idx_prc_trx_mst_tnt_br
  ON public.org_prc_trx_mst (tenant_org_id, branch_id, occurred_at DESC)
  WHERE branch_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_mst_tnt_br IS 'Supports branch-filtered Processing activity reporting.';

-- Trigger to keep updated_at current if administrative updates occur
CREATE TRIGGER trg_prc_trx_mst_upd
  BEFORE UPDATE ON public.org_prc_trx_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_prc_trx_mst_upd ON public.org_prc_trx_mst IS 'Maintains updated_at (UTC) on row update.';

-- RLS + Public-key grants (append-only for authenticated: SELECT and INSERT only; no anon)
ALTER TABLE public.org_prc_trx_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_org_prc_trx_mst ON public.org_prc_trx_mst
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());
COMMENT ON POLICY tenant_iso_org_prc_trx_mst ON public.org_prc_trx_mst IS 'Restricts access to rows matching the authenticated session tenant.';

REVOKE ALL ON TABLE public.org_prc_trx_mst FROM PUBLIC, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.org_prc_trx_mst FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.org_prc_trx_mst TO authenticated;
GRANT ALL ON TABLE public.org_prc_trx_mst TO service_role;

-- =============================================================================
-- 2. Processing Transaction Detail Lines (org_prc_trx_dtl)
-- =============================================================================

-- Stores individual operation lines within an org_prc_trx_mst batch across
-- ORDER, ITEM, PIECE, PREFERENCE, or OTHERS targets.
CREATE TABLE public.org_prc_trx_dtl (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(), -- Immutable detail line UUID
  tenant_org_id         UUID        NOT NULL,                           -- Organization scope
  branch_id             UUID        NULL,                               -- Branch snapshot for this line
  order_id              UUID        NOT NULL,                           -- Parent order UUID (matches header order_id)
  trx_id                UUID        NOT NULL,                           -- Parent transaction header UUID
  line_seq              INTEGER     NOT NULL,                           -- Deterministic 1-based sequence within batch
  target_level          TEXT        NOT NULL,                           -- Target scope: ORDER, ITEM, PIECE, PREFERENCE, or OTHERS
  target_level_text     TEXT        NULL,                               -- Required custom target label when target_level = OTHERS
  order_item_id         UUID        NULL,                               -- Target order item UUID when applicable
  order_item_piece_id   UUID        NULL,                               -- Target order piece UUID when applicable
  order_preference_id   UUID        NULL,                               -- Target order preference UUID when applicable
  trans_dtl_type        TEXT        NOT NULL,                           -- Detail action code (STEP_CHANGE, MARK_READY, RACK_ASSIGN, NOTE_ADD, OTHERS, etc.)
  trans_dtl_description TEXT        NULL,                               -- Human-readable summary of this detail operation
  step_code             TEXT        NULL,                               -- Processing step code when applicable
  from_value            TEXT        NULL,                               -- Prior scalar value
  to_value              TEXT        NULL,                               -- Resulting scalar value
  before_values         JSONB       NOT NULL DEFAULT '{}'::jsonb,       -- Structured prior fields snapshot
  after_values          JSONB       NOT NULL DEFAULT '{}'::jsonb,       -- Structured resulting fields snapshot
  notes                 TEXT        NULL,                               -- Operational note recorded for this line (always writable on committed orders)
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,       -- Extra line context
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),             -- Row creation instant (UTC)
  created_by            TEXT        NULL,                               -- Creator identifier
  created_info          TEXT        NULL,                               -- Creation provenance
  updated_at            TIMESTAMPTZ NULL,                               -- Last modification instant (UTC)
  updated_by            TEXT        NULL,                               -- Modifier identifier
  updated_info          TEXT        NULL,                               -- Modification provenance
  rec_status            SMALLINT    NOT NULL DEFAULT 1,                 -- Standard status: 1=active, 0=soft-deleted
  rec_order             INTEGER     NULL,                               -- Optional manual display sequence
  rec_notes             TEXT        NULL,                               -- Administrative remarks
  is_active             BOOLEAN     NOT NULL DEFAULT true,              -- Lifecycle active flag

  CONSTRAINT pk_org_prc_trx_dtl PRIMARY KEY (id),
  CONSTRAINT uq_prc_trx_dtl_seq UNIQUE (tenant_org_id, trx_id, line_seq),
  CONSTRAINT fk_prc_trx_dtl_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_dtl_br FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst (id, tenant_org_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_dtl_hdr FOREIGN KEY (trx_id, order_id, tenant_org_id)
    REFERENCES public.org_prc_trx_mst (id, order_id, tenant_org_id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_dtl_itm FOREIGN KEY (order_item_id, tenant_org_id)
    REFERENCES public.org_order_items_dtl (id, tenant_org_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_dtl_pc FOREIGN KEY (order_item_piece_id, tenant_org_id)
    REFERENCES public.org_order_item_pieces_dtl (id, tenant_org_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_prc_trx_dtl_prf FOREIGN KEY (order_preference_id, tenant_org_id)
    REFERENCES public.org_order_preferences_dtl (id, tenant_org_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT ck_prc_trx_dtl_seq CHECK (line_seq > 0),
  CONSTRAINT ck_prc_trx_dtl_lvl CHECK (target_level IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE', 'OTHERS')),
  CONSTRAINT ck_prc_trx_dtl_tgt CHECK (
    (target_level = 'ORDER'
      AND order_item_id IS NULL
      AND order_item_piece_id IS NULL
      AND order_preference_id IS NULL
      AND target_level_text IS NULL)
    OR (target_level = 'ITEM'
      AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NULL
      AND order_preference_id IS NULL
      AND target_level_text IS NULL)
    OR (target_level = 'PIECE'
      AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NOT NULL
      AND order_preference_id IS NULL
      AND target_level_text IS NULL)
    OR (target_level = 'PREFERENCE'
      AND order_preference_id IS NOT NULL
      AND target_level_text IS NULL)
    OR (target_level = 'OTHERS'
      AND target_level_text IS NOT NULL
      AND btrim(target_level_text) <> '')
  ),
  CONSTRAINT ck_prc_trx_dtl_type CHECK (
    trans_dtl_type IN (
      'STEP_CHANGE',
      'STAGE_CHANGE',
      'MARK_READY',
      'UNMARK_READY',
      'REJECT',
      'UNREJECT',
      'RACK_ASSIGN',
      'ORDER_RACK_ASSIGN',
      'LOCKER_ASSIGN',
      'BAG_COUNT_CHANGE',
      'HANGING_COUNT_CHANGE',
      'BARCODE_SCAN',
      'TAG_LINK',
      'ITEM_COMPLETE',
      'PREF_CONFIRM',
      'NOTE_ADD',
      'OTHERS'
    )
  ),
  CONSTRAINT ck_prc_trx_dtl_rec CHECK (rec_status IN (0, 1))
);

COMMENT ON TABLE public.org_prc_trx_dtl IS 'Line-level Processing transaction operations linked to org_prc_trx_mst across ORDER, ITEM, PIECE, PREFERENCE, and OTHERS targets.';
COMMENT ON COLUMN public.org_prc_trx_dtl.id IS 'Immutable Processing detail line UUID.';
COMMENT ON COLUMN public.org_prc_trx_dtl.tenant_org_id IS 'Tenant organization UUID.';
COMMENT ON COLUMN public.org_prc_trx_dtl.branch_id IS 'Branch UUID snapshot where the detail operation executed.';
COMMENT ON COLUMN public.org_prc_trx_dtl.order_id IS 'Order UUID (constrained to match header via fk_prc_trx_dtl_hdr).';
COMMENT ON COLUMN public.org_prc_trx_dtl.trx_id IS 'Parent org_prc_trx_mst header UUID.';
COMMENT ON COLUMN public.org_prc_trx_dtl.line_seq IS '1-based line sequence within the batch transaction.';
COMMENT ON COLUMN public.org_prc_trx_dtl.target_level IS 'Affected object level: ORDER, ITEM, PIECE, PREFERENCE, or OTHERS.';
COMMENT ON COLUMN public.org_prc_trx_dtl.target_level_text IS 'Descriptive target identifier required when target_level = OTHERS (e.g., GARMENT_BAG, RACK_BIN).';
COMMENT ON COLUMN public.org_prc_trx_dtl.order_item_id IS 'Referenced order item UUID (required for ITEM and PIECE targets).';
COMMENT ON COLUMN public.org_prc_trx_dtl.order_item_piece_id IS 'Referenced order piece UUID (required for PIECE targets).';
COMMENT ON COLUMN public.org_prc_trx_dtl.order_preference_id IS 'Referenced order preference UUID (required for PREFERENCE targets).';
COMMENT ON COLUMN public.org_prc_trx_dtl.trans_dtl_type IS 'Detail operation type (STEP_CHANGE, MARK_READY, TAG_LINK, NOTE_ADD, OTHERS, etc.).';
COMMENT ON COLUMN public.org_prc_trx_dtl.trans_dtl_description IS 'Human-readable summary describing this specific detail action.';
COMMENT ON COLUMN public.org_prc_trx_dtl.step_code IS 'Processing step code (sorting, pretreatment, washing, drying, finishing, etc.) when applicable.';
COMMENT ON COLUMN public.org_prc_trx_dtl.from_value IS 'Previous scalar value before change.';
COMMENT ON COLUMN public.org_prc_trx_dtl.to_value IS 'New scalar value after change.';
COMMENT ON COLUMN public.org_prc_trx_dtl.before_values IS 'Structured prior field snapshot.';
COMMENT ON COLUMN public.org_prc_trx_dtl.after_values IS 'Structured resulting field snapshot.';
COMMENT ON COLUMN public.org_prc_trx_dtl.notes IS 'Operational floor note captured on this detail line.';
COMMENT ON COLUMN public.org_prc_trx_dtl.metadata IS 'Structured JSONB extension context.';
COMMENT ON COLUMN public.org_prc_trx_dtl.created_at IS 'Row creation instant (UTC).';
COMMENT ON COLUMN public.org_prc_trx_dtl.created_by IS 'Row creator identity.';
COMMENT ON COLUMN public.org_prc_trx_dtl.created_info IS 'Row creation provenance.';
COMMENT ON COLUMN public.org_prc_trx_dtl.updated_at IS 'Row modification instant (UTC).';
COMMENT ON COLUMN public.org_prc_trx_dtl.updated_by IS 'Row modifier identity.';
COMMENT ON COLUMN public.org_prc_trx_dtl.updated_info IS 'Row modification provenance.';
COMMENT ON COLUMN public.org_prc_trx_dtl.rec_status IS 'Record lifecycle state: 1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.org_prc_trx_dtl.rec_order IS 'Optional manual sort order.';
COMMENT ON COLUMN public.org_prc_trx_dtl.rec_notes IS 'Administrative remarks.';
COMMENT ON COLUMN public.org_prc_trx_dtl.is_active IS 'Boolean active flag matching rec_status lifecycle.';
COMMENT ON CONSTRAINT pk_org_prc_trx_dtl ON public.org_prc_trx_dtl IS 'Primary key on id.';
COMMENT ON CONSTRAINT uq_prc_trx_dtl_seq ON public.org_prc_trx_dtl IS 'Deterministic line ordering uniqueness within a batch.';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_tnt ON public.org_prc_trx_dtl IS 'Tenant scope FK.';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_br ON public.org_prc_trx_dtl IS 'Composite branch FK matching org_branches_mst PK (id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_hdr ON public.org_prc_trx_dtl IS 'Composite header FK guaranteeing detail shares tenant_org_id and order_id with org_prc_trx_mst.';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_itm ON public.org_prc_trx_dtl IS 'Composite item FK matching org_order_items_dtl (id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_pc ON public.org_prc_trx_dtl IS 'Composite piece FK matching org_order_item_pieces_dtl (id, tenant_org_id).';
COMMENT ON CONSTRAINT fk_prc_trx_dtl_prf ON public.org_prc_trx_dtl IS 'Composite preference FK matching org_order_preferences_dtl (id, tenant_org_id).';
COMMENT ON CONSTRAINT ck_prc_trx_dtl_seq ON public.org_prc_trx_dtl IS 'Line sequence must be positive.';
COMMENT ON CONSTRAINT ck_prc_trx_dtl_lvl ON public.org_prc_trx_dtl IS 'Restricts target_level to ORDER, ITEM, PIECE, PREFERENCE, or OTHERS.';
COMMENT ON CONSTRAINT ck_prc_trx_dtl_tgt ON public.org_prc_trx_dtl IS 'Enforces required target UUIDs or target_level_text per target_level.';
COMMENT ON CONSTRAINT ck_prc_trx_dtl_type ON public.org_prc_trx_dtl IS 'Restricts trans_dtl_type to known Processing detail action codes plus OTHERS.';
COMMENT ON CONSTRAINT ck_prc_trx_dtl_rec ON public.org_prc_trx_dtl IS 'Restricts rec_status to 0 or 1.';

-- Tenant-first indexes supporting batch expansion and target-level drill-downs
CREATE INDEX idx_prc_trx_dtl_tnt_trx
  ON public.org_prc_trx_dtl (tenant_org_id, trx_id, line_seq);
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_trx IS 'Loads ordered detail lines for a transaction batch.';

CREATE INDEX idx_prc_trx_dtl_tnt_ord
  ON public.org_prc_trx_dtl (tenant_org_id, order_id, created_at DESC);
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_ord IS 'Supports order-scoped operational line queries.';

CREATE INDEX idx_prc_trx_dtl_tnt_itm
  ON public.org_prc_trx_dtl (tenant_org_id, order_item_id, created_at DESC)
  WHERE order_item_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_itm IS 'Supports item-scoped operational history lookups.';

CREATE INDEX idx_prc_trx_dtl_tnt_pc
  ON public.org_prc_trx_dtl (tenant_org_id, order_item_piece_id, created_at DESC)
  WHERE order_item_piece_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_pc IS 'Supports piece-scoped operational history lookups.';

CREATE INDEX idx_prc_trx_dtl_tnt_prf
  ON public.org_prc_trx_dtl (tenant_org_id, order_preference_id, created_at DESC)
  WHERE order_preference_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_prf IS 'Supports preference-scoped operational history lookups.';

CREATE INDEX idx_prc_trx_dtl_tnt_br
  ON public.org_prc_trx_dtl (tenant_org_id, branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;
COMMENT ON INDEX public.idx_prc_trx_dtl_tnt_br IS 'Supports branch-scoped detail analytics.';

CREATE TRIGGER trg_prc_trx_dtl_upd
  BEFORE UPDATE ON public.org_prc_trx_dtl
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_prc_trx_dtl_upd ON public.org_prc_trx_dtl IS 'Maintains updated_at (UTC) on row update.';

ALTER TABLE public.org_prc_trx_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_org_prc_trx_dtl ON public.org_prc_trx_dtl
  FOR ALL
  USING (tenant_org_id = public.current_tenant_id())
  WITH CHECK (tenant_org_id = public.current_tenant_id());
COMMENT ON POLICY tenant_iso_org_prc_trx_dtl ON public.org_prc_trx_dtl IS 'Restricts detail lines to the authenticated session tenant.';

REVOKE ALL ON TABLE public.org_prc_trx_dtl FROM PUBLIC, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.org_prc_trx_dtl FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.org_prc_trx_dtl TO authenticated;
GRANT ALL ON TABLE public.org_prc_trx_dtl TO service_role;

-- =============================================================================
-- 3. DB-Generated trx_code (<order_no>-PRC-000x) & HFC Registry (PRCT)
-- =============================================================================

-- Assigns trx_code atomically on INSERT by locking the parent org_orders_mst row
-- (preventing per-order sequence races) and computing MAX suffix + 1. Never
-- truncates sequence numbers >= 10000. Also defaults branch_id from parent order.
CREATE OR REPLACE FUNCTION public.fn_prc_trx_code_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_no        TEXT;
  v_order_branch_id UUID;
  v_next_seq        INTEGER;
BEGIN
  SELECT o.order_no, o.branch_id
  INTO v_order_no, v_order_branch_id
  FROM public.org_orders_mst o
  WHERE o.id = NEW.order_id
    AND o.tenant_org_id = NEW.tenant_org_id
  FOR UPDATE;

  IF NOT FOUND OR v_order_no IS NULL OR btrim(v_order_no) = '' THEN
    RAISE EXCEPTION 'PRC_TRX_ORDER_NOT_FOUND: tenant=% order=%', NEW.tenant_org_id, NEW.order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := v_order_branch_id;
  END IF;

  SELECT COALESCE(
           MAX(NULLIF(substring(m.trx_code FROM '-PRC-([0-9]+)$'), '')::INTEGER),
           0
         ) + 1
  INTO v_next_seq
  FROM public.org_prc_trx_mst m
  WHERE m.tenant_org_id = NEW.tenant_org_id
    AND m.order_id = NEW.order_id;

  NEW.trx_code := v_order_no
    || '-PRC-'
    || CASE
         WHEN v_next_seq < 10000 THEN LPAD(v_next_seq::TEXT, 4, '0')
         ELSE v_next_seq::TEXT
       END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_prc_trx_code_assign() IS
  'BEFORE INSERT trigger on org_prc_trx_mst: locks parent org_orders_mst row, defaults branch_id, and assigns immutable trx_code (<order_no>-PRC-000x, growing cleanly past 9999).';
REVOKE ALL ON FUNCTION public.fn_prc_trx_code_assign() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_prc_trx_code_assign
  BEFORE INSERT ON public.org_prc_trx_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_prc_trx_code_assign();
COMMENT ON TRIGGER trg_prc_trx_code_assign ON public.org_prc_trx_mst IS
  'Always generates trx_code server-side in PostgreSQL before INSERT.';

CREATE TRIGGER trg_prc_trx_code_guard
  BEFORE UPDATE OF trx_code ON public.org_prc_trx_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('trx_code');
COMMENT ON TRIGGER trg_prc_trx_code_guard ON public.org_prc_trx_mst IS
  'Enforces immutability of trx_code once assigned (HFC PRCT).';

-- Register PROCESSING_TRX in the HFC document sequence registry (DOMAIN / PER_PARENT)
INSERT INTO public.sys_doc_seq_type_cd (
  doc_type_code, name, name2, description, description2, scope_code, category_code,
  module_code, sub_system_code, target_table, target_column,
  is_unique, unique_with, prefix, type_prefix, separator,
  parts_format, seq_pad_length, reset_policy, manage_by_level, managed_by_object,
  implement_description, implement_description2, display_order, created_by, created_info
) VALUES (
  'PROCESSING_TRX',
  'Order Processing transaction',
  'حركة معالجة الطلبات',
  'Batch/operator processing transaction code derived per order (<order_no>-PRC-000x).',
  'رمز حركة معالجة الطلبات على مستوى الدفعة أو المشغل مشتق لكل طلب (<order_no>-PRC-000x).',
  'TENANT_ORG',
  'TRANSACTION',
  'ORDERS',
  'ORDER',
  'org_prc_trx_mst',
  'trx_code',
  true,
  ARRAY['tenant_org_id']::TEXT[],
  'PRC',
  'PRCT',
  '-',
  'PARENT-SEQ',
  4,
  'PER_PARENT',
  'DOMAIN',
  'public.fn_prc_trx_code_assign()',
  'Child code derived per order: trg_prc_trx_code_assign -> public.fn_prc_trx_code_assign() locks org_orders_mst(id, tenant_org_id) FOR UPDATE, reads MAX numeric suffix of -PRC-<n> for that (tenant_org_id, order_id), and writes <order_no>-PRC-<LPAD 4, grows past 9999>. Immutable via trg_prc_trx_code_guard -> fn_doc_seq_guard_immutable(''trx_code''). Check: SELECT trx_code FROM org_prc_trx_mst WHERE tenant_org_id = $1 ORDER BY occurred_at DESC LIMIT 10; Reserved type prefix PRCT: the unique 4-letter key of this document type used in scan payloads (CMX1:PRCT:<code>), logs, and screens.',
  $ar$رمز فرعي مشتق لكل طلب بصيغة <order_no>-PRC-<تسلسل بأربع خانات يتمدّد بعد 9999>. يولّده المشغّل trg_prc_trx_code_assign عبر public.fn_prc_trx_code_assign() الذي يقفل صف org_orders_mst(id, tenant_org_id) بـ FOR UPDATE ويقرأ أعلى لاحقة رقمية بعد -PRC- لنفس الطلب والمنشأة، بينما يمنع trg_prc_trx_code_guard تعديل trx_code عبر fn_doc_seq_guard_immutable('trx_code'). افحص trx_code في org_prc_trx_mst ضمن المنشأة؛ PRCT هو المفتاح المحجوز المكون من أربعة أحرف في حمولات المسح (CMX1:PRCT:<code>) والسجلات.$ar$,
  25,
  'migration',
  '0827_prc_batch_trx'
)
ON CONFLICT (doc_type_code) DO UPDATE SET
  name                   = EXCLUDED.name,
  name2                  = EXCLUDED.name2,
  description            = EXCLUDED.description,
  description2           = EXCLUDED.description2,
  target_table           = EXCLUDED.target_table,
  target_column          = EXCLUDED.target_column,
  prefix                 = EXCLUDED.prefix,
  separator              = EXCLUDED.separator,
  parts_format           = EXCLUDED.parts_format,
  seq_pad_length         = EXCLUDED.seq_pad_length,
  reset_policy           = EXCLUDED.reset_policy,
  manage_by_level        = EXCLUDED.manage_by_level,
  managed_by_object      = EXCLUDED.managed_by_object,
  implement_description  = EXCLUDED.implement_description,
  implement_description2 = EXCLUDED.implement_description2,
  is_active              = true,
  rec_status             = 1;

-- =============================================================================
-- 4. Unified notes_followup JSONB (Order, Item, Piece, Preference) + Append RPC
-- =============================================================================

-- Order-level append-only operational follow-up notes (not restricted by 0702)
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS notes_followup JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.org_orders_mst.notes_followup IS
  'Append-only JSONB array of operational follow-up notes [{note_seq, note_user_id, note_user_name, note_datetime, note_source, note_text, trx_code}]. Unlocked on committed orders.';

ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS ck_ord_mst_notes_fw_arr;
ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT ck_ord_mst_notes_fw_arr CHECK (jsonb_typeof(notes_followup) = 'array');
COMMENT ON CONSTRAINT ck_ord_mst_notes_fw_arr ON public.org_orders_mst IS
  'Ensures notes_followup is always a valid JSONB array.';

-- Item-level append-only operational follow-up notes (not restricted by 0702)
ALTER TABLE public.org_order_items_dtl
  ADD COLUMN IF NOT EXISTS notes_followup JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.org_order_items_dtl.notes_followup IS
  'Append-only JSONB array of operational follow-up notes on this item. Unlocked on committed orders (unlike intake notes).';

ALTER TABLE public.org_order_items_dtl
  DROP CONSTRAINT IF EXISTS ck_ord_itm_notes_fw_arr;
ALTER TABLE public.org_order_items_dtl
  ADD CONSTRAINT ck_ord_itm_notes_fw_arr CHECK (jsonb_typeof(notes_followup) = 'array');
COMMENT ON CONSTRAINT ck_ord_itm_notes_fw_arr ON public.org_order_items_dtl IS
  'Ensures notes_followup is always a valid JSONB array.';

-- Piece-level append-only operational follow-up notes (not restricted by 0702)
ALTER TABLE public.org_order_item_pieces_dtl
  ADD COLUMN IF NOT EXISTS notes_followup JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.org_order_item_pieces_dtl.notes_followup IS
  'Append-only JSONB array of operational floor notes on this piece. Unlocked on committed orders (unlike intake notes).';

ALTER TABLE public.org_order_item_pieces_dtl
  DROP CONSTRAINT IF EXISTS ck_ord_pc_notes_fw_arr;
ALTER TABLE public.org_order_item_pieces_dtl
  ADD CONSTRAINT ck_ord_pc_notes_fw_arr CHECK (jsonb_typeof(notes_followup) = 'array');
COMMENT ON CONSTRAINT ck_ord_pc_notes_fw_arr ON public.org_order_item_pieces_dtl IS
  'Ensures notes_followup is always a valid JSONB array.';

-- Unified atomic append function supporting ORDER, ITEM, PIECE, and PREFERENCE
-- (including ORDER/ITEM/PIECE preferences). Enforces tenant ownership and
-- authenticated JWT tenant match; keeps cmx_ord_pref_append_notes_followup intact.
CREATE OR REPLACE FUNCTION public.org_ord_append_notes_followup(
  p_tenant_org_id  UUID,
  p_target_level   TEXT,
  p_target_id      UUID,
  p_note_user_id   TEXT,
  p_note_source    TEXT,
  p_note_text      TEXT,
  p_note_user_name TEXT DEFAULT NULL,
  p_trx_code       TEXT DEFAULT NULL,
  p_updated_by     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_notes    JSONB;
  v_next_seq INT;
  v_entry    JSONB;
  v_now      TIMESTAMPTZ := now();
  v_level    TEXT := upper(btrim(COALESCE(p_target_level, '')));
  v_actor    TEXT := COALESCE(NULLIF(btrim(p_updated_by), ''), NULLIF(btrim(p_note_user_id), ''));
BEGIN
  IF p_tenant_org_id IS NULL THEN
    RAISE EXCEPTION 'tenant_org_id is required' USING ERRCODE = '22023';
  END IF;

  -- User JWT callers may only append inside their active session tenant.
  IF current_user = 'authenticated' AND p_tenant_org_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'target_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_note_text IS NULL OR btrim(p_note_text) = '' THEN
    RAISE EXCEPTION 'note_text is required' USING ERRCODE = '22023';
  END IF;

  IF p_note_source IS NULL OR btrim(p_note_source) = '' THEN
    RAISE EXCEPTION 'note_source is required' USING ERRCODE = '22023';
  END IF;

  IF v_level NOT IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE') THEN
    RAISE EXCEPTION 'Unsupported target_level: %', p_target_level USING ERRCODE = '22023';
  END IF;

  IF v_level = 'ORDER' THEN
    SELECT COALESCE(notes_followup, '[]'::jsonb) INTO v_notes
    FROM public.org_orders_mst
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    FOR UPDATE;
  ELSIF v_level = 'ITEM' THEN
    SELECT COALESCE(notes_followup, '[]'::jsonb) INTO v_notes
    FROM public.org_order_items_dtl
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    FOR UPDATE;
  ELSIF v_level = 'PIECE' THEN
    SELECT COALESCE(notes_followup, '[]'::jsonb) INTO v_notes
    FROM public.org_order_item_pieces_dtl
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    FOR UPDATE;
  ELSE
    SELECT COALESCE(notes_followup, '[]'::jsonb) INTO v_notes
    FROM public.org_order_preferences_dtl
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target record not found for % (%)', v_level, p_target_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX((elem->>'note_seq')::INT), 0) + 1
  INTO v_next_seq
  FROM jsonb_array_elements(v_notes) AS elem;

  v_entry := jsonb_strip_nulls(
    jsonb_build_object(
      'note_seq', v_next_seq,
      'note_user_id', COALESCE(p_note_user_id, ''),
      'note_user_name', NULLIF(btrim(COALESCE(p_note_user_name, '')), ''),
      'note_datetime', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'note_source', btrim(p_note_source),
      'note_text', btrim(p_note_text),
      'trx_code', NULLIF(btrim(COALESCE(p_trx_code, '')), '')
    )
  );

  IF v_level = 'ORDER' THEN
    UPDATE public.org_orders_mst
    SET notes_followup = v_notes || jsonb_build_array(v_entry),
        updated_at = v_now,
        updated_by = v_actor
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    RETURNING notes_followup INTO v_notes;
  ELSIF v_level = 'ITEM' THEN
    UPDATE public.org_order_items_dtl
    SET notes_followup = v_notes || jsonb_build_array(v_entry),
        updated_at = v_now,
        updated_by = v_actor
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    RETURNING notes_followup INTO v_notes;
  ELSIF v_level = 'PIECE' THEN
    UPDATE public.org_order_item_pieces_dtl
    SET notes_followup = v_notes || jsonb_build_array(v_entry),
        updated_at = v_now,
        updated_by = v_actor
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    RETURNING notes_followup INTO v_notes;
  ELSE
    UPDATE public.org_order_preferences_dtl
    SET notes_followup = v_notes || jsonb_build_array(v_entry),
        updated_at = v_now,
        updated_by = v_actor
    WHERE id = p_target_id AND tenant_org_id = p_tenant_org_id
    RETURNING notes_followup INTO v_notes;
  END IF;

  RETURN v_notes;
END;
$$;

COMMENT ON FUNCTION public.org_ord_append_notes_followup(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically appends one follow-up note entry to notes_followup JSONB on ORDER, ITEM, PIECE, or PREFERENCE within tenant_org_id.';
REVOKE ALL ON FUNCTION public.org_ord_append_notes_followup(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_ord_append_notes_followup(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
