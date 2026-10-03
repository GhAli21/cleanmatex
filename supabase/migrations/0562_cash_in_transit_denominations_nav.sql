-- =============================================================================
-- 0562_cash_in_transit_denominations_nav.sql
-- POS Session & Cash Drawer Hardening — D1-4 (in-transit cash transfers), C1-1b (tenant control of
-- counted denominations), E4 (navigation for the new screens) and a fix to the rollover notification.
--
-- 1. D1-4 — IN-TRANSIT TRANSFERS
--    Moving cash between two drawers was one atomic step (DRAWER_TO_DRAWER). When a different person
--    carries it (counter -> safe, branch -> branch's safe by a runner) the cash is neither in the source
--    nor yet in the destination. It is now two legs with a visible middle:
--        send    source drawer OUT  ->  the branch's IN_TRANSIT holder drawer IN   (TRANSIT_SEND)
--        receive holder OUT         ->  destination drawer IN                      (TRANSIT_RECEIVE)
--        cancel  holder OUT         ->  source drawer IN, mandatory reason         (TRANSIT_CANCEL)
--    Each leg is an ordinary balanced custody transaction through the existing ledger (so drawer
--    sequences, balances and the "custody never creates or destroys cash" trigger apply unchanged);
--    the holder drawer's balance IS the cash in transit. One row per transfer in
--    org_cash_drawer_transit_tr records who sent, who received or cancelled, and links the legs. A
--    drawer holds one currency, so the holder exists per branch and currency, created on first use by
--    ensure_branch_transit_drawer(). A transfer is settled exactly once (unique settle link + a
--    forward-only trigger).
--
-- 2. C1-1b — TENANT DENOMINATION CONTROL
--    HQ owns the global denomination catalog (sys_currency_denominations_cd). A tenant may stop
--    accepting a note or coin it does not handle, or reorder the counting grid, without touching HQ
--    data: org_currency_denom_cf holds sparse overrides (no row = inherit the HQ default = enabled).
--    Counts already recorded keep their lines untouched.
--
-- 3. E4 — NAVIGATION: sidebar entries for Cash Variance Approvals (C3) and Cash In Transit (D1-4),
--    and the Arabic label of the Cash Drawers entry aligned with the glossary term "درج" (a drawer),
--    which the earlier "الصناديق" contradicted.
--
-- 4. NOTIFICATION FIX: the pos_session.rolled_over template (0558) read {{action}} in both languages,
--    so the Arabic text carried the English verb. The Arabic version now reads {{action2}}, which the
--    rollover job already sends.
--
-- No new permission: send and cancel use cash_drawer:transfer, receive uses
-- cash_drawer:receive_transfer (both seeded by 0517); the variance queue uses
-- cash_drawer:approve_variance and the denomination admin uses cash_control:manage.
--
-- Prisma-safe composite FKs (CLAUDE.md database rule): every parent key here is (id, tenant_org_id),
-- so each child FK is (<parent>_id, tenant_org_id) in that order; the denomination FK mirrors the
-- parent unique (currency_code, denomination_code) and the tenant-currency FK the parent key
-- (tenant_org_id, currency_code).
--
-- IDEMPOTENT: IF NOT EXISTS / ON CONFLICT / dropped-if-exists-then-added throughout.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1a. Drawer type: IN_TRANSIT (system-managed holder, one per branch and currency)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_cash_drawer_type_cd (
  code, name, name2, description, description2,
  accepts_customer_cash, allows_customer_cash_out, can_be_trx_source, can_be_trx_dest,
  can_receive_disposition, is_mobile,
  requires_session_default, opening_count_required_default, closing_count_required_default,
  display_order, created_by
) VALUES (
  'IN_TRANSIT', 'In transit', 'قيد النقل',
  'System holder for cash that left one drawer and has not yet reached its destination; one per branch and currency. Never selectable by users.',
  'حاوية نظامية للنقدية التي غادرت درجاً ولم تصل وجهتها بعد؛ واحدة لكل فرع وعملة. لا يختارها المستخدمون.',
  FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,
  FALSE, FALSE, FALSE, 6, 'migration_0562'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  accepts_customer_cash = EXCLUDED.accepts_customer_cash,
  allows_customer_cash_out = EXCLUDED.allows_customer_cash_out,
  can_be_trx_source = EXCLUDED.can_be_trx_source,
  can_be_trx_dest = EXCLUDED.can_be_trx_dest,
  can_receive_disposition = EXCLUDED.can_receive_disposition,
  is_mobile = EXCLUDED.is_mobile,
  requires_session_default = EXCLUDED.requires_session_default,
  opening_count_required_default = EXCLUDED.opening_count_required_default,
  closing_count_required_default = EXCLUDED.closing_count_required_default,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0562';

-- -----------------------------------------------------------------------------
-- 1b. Custody transaction types for the three legs. System-only: users reach them through the
--     transit service (send / receive / cancel), never the generic transaction endpoint. REVERSAL
--     deliberately does NOT list IN_TRANSIT: a transit leg is undone by cancel, not by reversal, so a
--     reversal would leave the transfer record contradicting the ledger.
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_cash_drawer_trx_type_cd (
  code, name, name2, description, description2,
  allowed_src_types, allowed_dest_types, requires_notes, is_system, display_order, created_by
) VALUES
  ('TRANSIT_SEND', 'Sent in transit', 'إرسال نقدية قيد النقل',
   'System: cash handed over for carrying; it leaves the source drawer and sits in transit.',
   'نظامي: نقدية سُلّمت للنقل؛ تغادر الدرج المصدر وتبقى قيد النقل.',
   ARRAY['COUNTER','TEMPORARY','SAFE'], ARRAY['IN_TRANSIT'], FALSE, TRUE, 8, 'migration_0562'),
  ('TRANSIT_RECEIVE', 'Received from transit', 'استلام نقدية قيد النقل',
   'System: cash in transit counted into its destination drawer.',
   'نظامي: نقدية قيد النقل أُدخلت في الدرج الوجهة.',
   ARRAY['IN_TRANSIT'], ARRAY['COUNTER','TEMPORARY','SAFE'], FALSE, TRUE, 9, 'migration_0562'),
  ('TRANSIT_CANCEL', 'Transit cancelled', 'إلغاء النقل',
   'System: cash in transit returned to its source drawer; a reason is mandatory.',
   'نظامي: نقدية قيد النقل أُعيدت إلى الدرج المصدر؛ السبب إلزامي.',
   ARRAY['IN_TRANSIT'], ARRAY['COUNTER','TEMPORARY','SAFE'], TRUE, TRUE, 10, 'migration_0562')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  allowed_src_types = EXCLUDED.allowed_src_types,
  allowed_dest_types = EXCLUDED.allowed_dest_types,
  requires_notes = EXCLUDED.requires_notes,
  is_system = EXCLUDED.is_system,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0562';

-- -----------------------------------------------------------------------------
-- 1c. Holder drawer: one active per branch and currency, created on first use
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocd_branch_transit_cur
  ON public.org_cash_drawers_mst (tenant_org_id, branch_id, currency_code)
  WHERE drawer_type = 'IN_TRANSIT' AND is_active;

COMMENT ON INDEX public.uq_ocd_branch_transit_cur IS
  'At most one active IN_TRANSIT holder drawer per branch and currency; also the ON CONFLICT target of ensure_branch_transit_drawer().';

CREATE OR REPLACE FUNCTION public.ensure_branch_transit_drawer(
  p_tenant_org_id UUID,
  p_branch_id     UUID,
  p_currency_code TEXT,
  p_actor         TEXT DEFAULT NULL
)
RETURNS TABLE (drawer_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_currency  TEXT;
  v_name      TEXT;
  v_name2     TEXT;
  v_code_base TEXT;
  v_code      TEXT;
  v_suffix    INTEGER := 0;
  v_id        UUID;
BEGIN
  IF p_tenant_org_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'ensure_branch_transit_drawer: tenant and branch are required';
  END IF;
  v_currency := NULLIF(TRIM(p_currency_code), '');
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'ensure_branch_transit_drawer: currency is required';
  END IF;

  SELECT COALESCE(b.name, b.branch_name), COALESCE(b.name2, b.name, b.branch_name)
    INTO v_name, v_name2
    FROM org_branches_mst b
   WHERE b.id = p_branch_id AND b.tenant_org_id = p_tenant_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ensure_branch_transit_drawer: branch % not found for tenant %', p_branch_id, p_tenant_org_id;
  END IF;

  SELECT d.id INTO v_id
    FROM org_cash_drawers_mst d
   WHERE d.tenant_org_id = p_tenant_org_id AND d.branch_id = p_branch_id
     AND d.currency_code = v_currency AND d.drawer_type = 'IN_TRANSIT' AND d.is_active;
  IF FOUND THEN
    RETURN QUERY SELECT v_id, FALSE;
    RETURN;
  END IF;

  v_code_base := 'TRN-' || UPPER(LEFT(REPLACE(p_branch_id::TEXT, '-', ''), 8)) || '-' || v_currency;
  v_code := v_code_base;
  WHILE EXISTS (SELECT 1 FROM org_cash_drawers_mst
                 WHERE tenant_org_id = p_tenant_org_id AND drawer_code = v_code) LOOP
    v_suffix := v_suffix + 1;
    v_code := v_code_base || '-' || v_suffix;
  END LOOP;

  INSERT INTO org_cash_drawers_mst (
    tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
    drawer_type, currency_code,
    created_by, created_info, is_active, rec_status, metadata
  ) VALUES (
    p_tenant_org_id, p_branch_id, v_code,
    'In transit (' || v_currency || ')' || COALESCE(' - ' || v_name, ''),
    'قيد النقل (' || v_currency || ')' || COALESCE(' - ' || v_name2, ''),
    'IN_TRANSIT', v_currency,
    COALESCE(p_actor, 'system'), 'ensure_branch_transit_drawer', TRUE, 1,
    jsonb_build_object('system_drawer', TRUE)
  )
  ON CONFLICT (tenant_org_id, branch_id, currency_code) WHERE drawer_type = 'IN_TRANSIT' AND is_active
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, TRUE;
    RETURN;
  END IF;

  -- A concurrent caller created it first.
  SELECT d.id INTO v_id
    FROM org_cash_drawers_mst d
   WHERE d.tenant_org_id = p_tenant_org_id AND d.branch_id = p_branch_id
     AND d.currency_code = v_currency AND d.drawer_type = 'IN_TRANSIT' AND d.is_active;
  RETURN QUERY SELECT v_id, FALSE;
END;
$function$;

COMMENT ON FUNCTION public.ensure_branch_transit_drawer(UUID, UUID, TEXT, TEXT) IS
  'Idempotently creates the branch IN_TRANSIT holder drawer for one currency (race-safe through uq_ocd_branch_transit_cur) and returns (drawer_id, created). The currency must be enabled for the tenant (fk_ocd_tenant_currency). Called by the cash-transit service on the first send in a currency.';

-- -----------------------------------------------------------------------------
-- 1d. org_cash_drawer_transit_tr — one row per in-transit transfer
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_cash_drawer_transit_tr (
  id                  UUID           NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID           NOT NULL REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  branch_id           UUID           NOT NULL,
  transit_no          TEXT           NOT NULL,
  source_drawer_id    UUID           NOT NULL,
  dest_drawer_id      UUID           NOT NULL,
  transit_drawer_id   UUID           NOT NULL,
  currency_code       TEXT           NOT NULL REFERENCES public.sys_currency_cd (code),
  amount              NUMERIC(19, 4) NOT NULL,
  status              TEXT           NOT NULL DEFAULT 'IN_TRANSIT',
  send_trx_id         UUID           NOT NULL,
  settle_trx_id       UUID           NULL,
  carried_by_user_id  UUID           NULL,
  notes               TEXT           NULL,
  sent_by             TEXT           NOT NULL,
  sent_at             TIMESTAMPTZ    NOT NULL DEFAULT clock_timestamp(),
  received_by         TEXT           NULL,
  received_at         TIMESTAMPTZ    NULL,
  cancelled_by        TEXT           NULL,
  cancelled_at        TIMESTAMPTZ    NULL,
  cancel_reason       TEXT           NULL,
  metadata            JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT           NULL,
  created_info        TEXT           NULL,
  updated_at          TIMESTAMPTZ    NULL,
  updated_by          TEXT           NULL,
  updated_info        TEXT           NULL,
  rec_status          SMALLINT       NOT NULL DEFAULT 1,
  is_active           BOOLEAN        NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_octt PRIMARY KEY (id),
  CONSTRAINT uq_octt_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_octt_no UNIQUE (tenant_org_id, transit_no),
  -- A send leg belongs to exactly one transfer (1:1; same column order as the FK).
  CONSTRAINT uq_octt_send UNIQUE (send_trx_id, tenant_org_id),
  CONSTRAINT fk_octt_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst (id, tenant_org_id),
  CONSTRAINT fk_octt_source FOREIGN KEY (source_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_octt_dest FOREIGN KEY (dest_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_octt_holder FOREIGN KEY (transit_drawer_id, tenant_org_id)
    REFERENCES public.org_cash_drawers_mst (id, tenant_org_id),
  CONSTRAINT fk_octt_send_trx FOREIGN KEY (send_trx_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_trx_mst (id, tenant_org_id),
  CONSTRAINT fk_octt_settle_trx FOREIGN KEY (settle_trx_id, tenant_org_id)
    REFERENCES public.org_cash_drawer_trx_mst (id, tenant_org_id),
  CONSTRAINT chk_octt_status CHECK (status IN ('IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  CONSTRAINT chk_octt_amount CHECK (amount > 0),
  CONSTRAINT chk_octt_distinct CHECK (source_drawer_id <> dest_drawer_id),
  -- A transfer is open, or settled exactly one way, with the facts of that way and none of the other.
  CONSTRAINT chk_octt_lifecycle CHECK (
    (status = 'IN_TRANSIT' AND settle_trx_id IS NULL
       AND received_by IS NULL AND received_at IS NULL
       AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancel_reason IS NULL)
    OR (status = 'RECEIVED' AND settle_trx_id IS NOT NULL
       AND received_by IS NOT NULL AND received_at IS NOT NULL
       AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancel_reason IS NULL)
    OR (status = 'CANCELLED' AND settle_trx_id IS NOT NULL
       AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL
       AND received_by IS NULL AND received_at IS NULL)
  )
);

-- A transfer is settled once: one settle leg belongs to at most one transfer (same order as the FK).
CREATE UNIQUE INDEX IF NOT EXISTS uq_octt_settle
  ON public.org_cash_drawer_transit_tr (settle_trx_id, tenant_org_id)
  WHERE settle_trx_id IS NOT NULL;

-- The open list: what is on the road right now, per branch, oldest first.
CREATE INDEX IF NOT EXISTS idx_octt_open
  ON public.org_cash_drawer_transit_tr (tenant_org_id, branch_id, sent_at)
  WHERE status = 'IN_TRANSIT';

CREATE INDEX IF NOT EXISTS idx_octt_branch_sent
  ON public.org_cash_drawer_transit_tr (tenant_org_id, branch_id, sent_at DESC);

ALTER TABLE public.org_cash_drawer_transit_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_octt_tenant ON public.org_cash_drawer_transit_tr;
CREATE POLICY pol_octt_tenant ON public.org_cash_drawer_transit_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- Forward-only: only an open transfer can be settled, and what was sent never changes. A settled row
-- is history. (Maintenance bypass, migrations and test cleanup only: SET LOCAL cmx.allow_ledger_edit = 'on'.)
CREATE OR REPLACE FUNCTION public.fn_octt_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('cmx.allow_ledger_edit', TRUE), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = 'TRANSIT_IMMUTABLE: an in-transit transfer record is never deleted';
  END IF;

  IF OLD.status <> 'IN_TRANSIT' THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = format('TRANSIT_IMMUTABLE: transfer %s is already %s', OLD.transit_no, OLD.status);
  END IF;

  IF NEW.tenant_org_id <> OLD.tenant_org_id OR NEW.branch_id <> OLD.branch_id
     OR NEW.transit_no <> OLD.transit_no
     OR NEW.source_drawer_id <> OLD.source_drawer_id OR NEW.dest_drawer_id <> OLD.dest_drawer_id
     OR NEW.transit_drawer_id <> OLD.transit_drawer_id
     OR NEW.currency_code <> OLD.currency_code OR NEW.amount <> OLD.amount
     OR NEW.send_trx_id <> OLD.send_trx_id
     OR NEW.sent_by <> OLD.sent_by OR NEW.sent_at <> OLD.sent_at THEN
    RAISE EXCEPTION USING ERRCODE = 'CMX02',
      MESSAGE = format('TRANSIT_IMMUTABLE: what transfer %s sent cannot be changed', OLD.transit_no);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_octt_guard() IS
  'In-transit transfers: only an IN_TRANSIT row may be updated (to settle it), the sent facts never change, and no row is deleted. Maintenance bypass: SET LOCAL cmx.allow_ledger_edit = ''on''.';

DROP TRIGGER IF EXISTS trg_octt_guard ON public.org_cash_drawer_transit_tr;
CREATE TRIGGER trg_octt_guard
  BEFORE UPDATE OR DELETE ON public.org_cash_drawer_transit_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_octt_guard();

COMMENT ON TABLE public.org_cash_drawer_transit_tr IS
  'D1-4: one row per in-transit cash transfer — cash sent from a source drawer, carried, and then received into the destination or cancelled back to the source. The two legs are ordinary custody transactions (TRANSIT_SEND, then TRANSIT_RECEIVE or TRANSIT_CANCEL); this row links them and records who did what. The IN_TRANSIT holder drawer''s balance is the cash on the road.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.id IS 'Primary key.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.tenant_org_id IS 'Owning tenant (RLS key); part of every composite key.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.branch_id IS 'Branch of the transfer; the source, destination and holder drawers are all in it.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.transit_no IS 'Human reference, equal to the send leg''s custody transaction number (CDT-YYYYMMDD-NNNN); unique per tenant.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.source_drawer_id IS 'Drawer the cash left (and returns to on cancel).';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.dest_drawer_id IS 'Drawer the cash is meant to reach; it is credited on receive.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.transit_drawer_id IS 'The branch IN_TRANSIT holder drawer (this currency) that carries the cash while it is on the road.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.currency_code IS 'Currency of the transfer; one currency per transfer because a drawer holds one currency.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.amount IS 'Amount sent, DECIMAL(19,4), always positive. Receiving moves exactly this amount; a counting difference is handled by the destination''s own counts and variance.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.status IS 'IN_TRANSIT (open) | RECEIVED | CANCELLED. Forward-only: only an open transfer can be settled.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.send_trx_id IS 'The TRANSIT_SEND custody transaction (source OUT, holder IN); 1:1 with this row.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.settle_trx_id IS 'The TRANSIT_RECEIVE or TRANSIT_CANCEL custody transaction that settled the transfer; NULL while it is open; at most one transfer per settle leg.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.carried_by_user_id IS 'Optional: the person the cash was handed to for carrying (informational; not an authorization).';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.notes IS 'Optional note given when the cash was sent.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.sent_by IS 'User id that sent the transfer.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.sent_at IS 'When the cash left the source drawer (server clock).';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.received_by IS 'User id that received the cash at the destination; set only when RECEIVED. The sender may receive their own transfer — permission is the only gate.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.received_at IS 'When the destination drawer was credited; set only when RECEIVED.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.cancelled_by IS 'User id that cancelled the transfer; set only when CANCELLED.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.cancelled_at IS 'When the cash returned to the source drawer; set only when CANCELLED.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.cancel_reason IS 'Mandatory reason given on cancel; set only when CANCELLED.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.metadata IS 'Free-form extension point; not read by the application.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.created_at IS 'Standard audit column: insert time.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.created_by IS 'Standard audit column: inserting actor.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.created_info IS 'Standard audit column: free-text context of the insert.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.updated_at IS 'Standard audit column: last update time (the settle step).';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.updated_by IS 'Standard audit column: last updating actor.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.updated_info IS 'Standard audit column: free-text context of the last update.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.rec_status IS 'Standard record status (1 = active); a transfer is never soft-deleted.';
COMMENT ON COLUMN public.org_cash_drawer_transit_tr.is_active IS 'Standard active flag; always true for a transfer.';
COMMENT ON CONSTRAINT uq_octt_no ON public.org_cash_drawer_transit_tr IS 'One transfer per human reference within a tenant.';
COMMENT ON CONSTRAINT uq_octt_send ON public.org_cash_drawer_transit_tr IS 'A send leg opens exactly one transfer (and the Prisma-safe 1:1 key, same column order as fk_octt_send_trx).';
COMMENT ON CONSTRAINT fk_octt_branch ON public.org_cash_drawer_transit_tr IS 'The transfer belongs to a branch of the same tenant.';
COMMENT ON CONSTRAINT fk_octt_source ON public.org_cash_drawer_transit_tr IS 'The source drawer belongs to the same tenant.';
COMMENT ON CONSTRAINT fk_octt_dest ON public.org_cash_drawer_transit_tr IS 'The destination drawer belongs to the same tenant.';
COMMENT ON CONSTRAINT fk_octt_holder ON public.org_cash_drawer_transit_tr IS 'The IN_TRANSIT holder drawer belongs to the same tenant.';
COMMENT ON CONSTRAINT fk_octt_send_trx ON public.org_cash_drawer_transit_tr IS 'The send leg is a custody transaction of the same tenant.';
COMMENT ON CONSTRAINT fk_octt_settle_trx ON public.org_cash_drawer_transit_tr IS 'The settle leg is a custody transaction of the same tenant.';
COMMENT ON CONSTRAINT chk_octt_status ON public.org_cash_drawer_transit_tr IS 'Allowed transfer statuses; mirrored by CASH_TRANSIT_STATUS in lib/constants/cash-drawer.ts.';
COMMENT ON CONSTRAINT chk_octt_amount ON public.org_cash_drawer_transit_tr IS 'A transfer moves a positive amount.';
COMMENT ON CONSTRAINT chk_octt_distinct ON public.org_cash_drawer_transit_tr IS 'Source and destination are different drawers.';
COMMENT ON CONSTRAINT chk_octt_lifecycle ON public.org_cash_drawer_transit_tr IS 'An open transfer has no settle facts; a received one has settle leg + receiver + time and no cancel facts; a cancelled one has settle leg + canceller + time + reason and no receive facts.';
COMMENT ON INDEX public.uq_octt_settle IS 'A settle leg settles at most one transfer.';
COMMENT ON INDEX public.idx_octt_open IS 'The open list: transfers still on the road, per branch, oldest first.';
COMMENT ON INDEX public.idx_octt_branch_sent IS 'Branch history of transfers, newest first.';
COMMENT ON POLICY pol_octt_tenant ON public.org_cash_drawer_transit_tr IS 'Tenant isolation: rows are visible and writable only for the current tenant.';

-- -----------------------------------------------------------------------------
-- 2. org_currency_denom_cf — sparse tenant overrides of the HQ denomination catalog (C1-1b)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_currency_denom_cf (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id      UUID        NOT NULL REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  currency_code      TEXT        NOT NULL,
  denomination_code  TEXT        NOT NULL,
  is_enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order      INTEGER     NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by         TEXT        NULL,
  created_info       TEXT        NULL,
  updated_at         TIMESTAMPTZ NULL,
  updated_by         TEXT        NULL,
  updated_info       TEXT        NULL,
  rec_status         SMALLINT    NOT NULL DEFAULT 1,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT pk_ocdn PRIMARY KEY (id),
  CONSTRAINT uq_ocdn UNIQUE (tenant_org_id, currency_code, denomination_code),
  -- Same columns and order as the parent's unique key uq_scdn_code (Prisma-safe).
  CONSTRAINT fk_ocdn_denom FOREIGN KEY (currency_code, denomination_code)
    REFERENCES public.sys_currency_denominations_cd (currency_code, denomination_code),
  -- A tenant can only tune denominations of a currency it has enabled (same shape as fk_ocd_tenant_currency).
  CONSTRAINT fk_ocdn_tenant_cur FOREIGN KEY (tenant_org_id, currency_code)
    REFERENCES public.org_currency_cf (tenant_org_id, currency_code),
  CONSTRAINT chk_ocdn_order CHECK (display_order IS NULL OR display_order >= 0)
);

ALTER TABLE public.org_currency_denom_cf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_ocdn_tenant ON public.org_currency_denom_cf;
CREATE POLICY pol_ocdn_tenant ON public.org_currency_denom_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_currency_denom_cf IS
  'C1-1b: sparse tenant overrides of the HQ denomination catalog (sys_currency_denominations_cd). No row = inherit HQ = the denomination is offered when counting. A row can switch a denomination off for this tenant (a note it does not handle) and/or reorder the counting grid. Counts already recorded are never rewritten.';
COMMENT ON COLUMN public.org_currency_denom_cf.id IS 'Primary key.';
COMMENT ON COLUMN public.org_currency_denom_cf.tenant_org_id IS 'Owning tenant (RLS key).';
COMMENT ON COLUMN public.org_currency_denom_cf.currency_code IS 'Currency of the denomination; must be enabled for the tenant (fk_ocdn_tenant_cur).';
COMMENT ON COLUMN public.org_currency_denom_cf.denomination_code IS 'HQ denomination code within the currency (sys_currency_denominations_cd).';
COMMENT ON COLUMN public.org_currency_denom_cf.is_enabled IS 'False = this tenant does not accept or count this denomination; it disappears from the counting grid and a count line using it is refused.';
COMMENT ON COLUMN public.org_currency_denom_cf.display_order IS 'Optional counting-grid order for this tenant; NULL keeps the HQ order.';
COMMENT ON COLUMN public.org_currency_denom_cf.created_at IS 'Standard audit column: insert time.';
COMMENT ON COLUMN public.org_currency_denom_cf.created_by IS 'Standard audit column: inserting actor.';
COMMENT ON COLUMN public.org_currency_denom_cf.created_info IS 'Standard audit column: free-text context of the insert.';
COMMENT ON COLUMN public.org_currency_denom_cf.updated_at IS 'Standard audit column: last update time.';
COMMENT ON COLUMN public.org_currency_denom_cf.updated_by IS 'Standard audit column: last updating actor.';
COMMENT ON COLUMN public.org_currency_denom_cf.updated_info IS 'Standard audit column: free-text context of the last update.';
COMMENT ON COLUMN public.org_currency_denom_cf.rec_status IS 'Standard record status (1 = active).';
COMMENT ON COLUMN public.org_currency_denom_cf.is_active IS 'Standard active flag; an inactive override is ignored.';
COMMENT ON CONSTRAINT uq_ocdn ON public.org_currency_denom_cf IS 'One override per tenant, currency and denomination.';
COMMENT ON CONSTRAINT fk_ocdn_denom ON public.org_currency_denom_cf IS 'The override refers to a real HQ denomination (same column order as the parent unique key).';
COMMENT ON CONSTRAINT fk_ocdn_tenant_cur ON public.org_currency_denom_cf IS 'A tenant tunes only currencies it has enabled.';
COMMENT ON CONSTRAINT chk_ocdn_order ON public.org_currency_denom_cf IS 'Grid order is non-negative when set.';
COMMENT ON POLICY pol_ocdn_tenant ON public.org_currency_denom_cf IS 'Tenant isolation: rows are visible and writable only for the current tenant.';

-- -----------------------------------------------------------------------------
-- 3. Navigation (dual-write half 2 of 2 — web-admin/config/navigation.ts carries the same two keys)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, main_permission_code, display_order, comp_level,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, permissions, feature_flag, badge, rec_status, created_info
)
VALUES
  (
    'billing_cash_drawer_variance_approvals',
    (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'billing'),
    'billing',
    'Cash Variance Approvals', 'اعتماد فروقات النقد',
    'Closed drawer sessions over their variance threshold: approve, reject or review',
    'جلسات أدراج النقد المغلقة التي تجاوز فرقها الحد: اعتماد أو رفض أو مراجعة',
    '/dashboard/internal_fin/cash-drawers/variance-approvals',
    'ShieldAlert',
    'cash_drawer:approve_variance',
    (SELECT COALESCE(MIN(display_order), 40) + 2 FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
    (SELECT comp_level FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
    TRUE, TRUE, TRUE, TRUE, TRUE,
    '["super_admin","tenant_admin","admin","branch_manager","finance_manager"]'::jsonb,
    '["cash_drawer:approve_variance"]'::jsonb,
    '[]'::jsonb, NULL, 1,
    'POS_Session_Cash_Drawer_Hardening C3 — supervisor queue of over-threshold drawer close variances.'
  ),
  (
    'billing_cash_drawer_in_transit',
    (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'billing'),
    'billing',
    'Cash In Transit', 'النقد قيد النقل',
    'Cash sent from one drawer and not yet received: send, receive or cancel',
    'نقدية أُرسلت من درج ولم تُستلم بعد: إرسال أو استلام أو إلغاء',
    '/dashboard/internal_fin/cash-drawers/in-transit',
    'Truck',
    'cash_drawer:transfer',
    (SELECT COALESCE(MIN(display_order), 40) + 3 FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
    (SELECT comp_level FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
    TRUE, TRUE, TRUE, TRUE, TRUE,
    '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
    '["cash_drawer:transfer"]'::jsonb,
    '[]'::jsonb, NULL, 1,
    'POS_Session_Cash_Drawer_Hardening D1-4 — two-leg in-transit cash transfers (send, receive, cancel).'
  )
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  comp_level           = EXCLUDED.comp_level,
  is_leaf              = TRUE,
  is_navigable         = TRUE,
  is_active            = TRUE,
  roles                = EXCLUDED.roles,
  permissions          = EXCLUDED.permissions,
  updated_at           = CURRENT_TIMESTAMP;

-- Glossary alignment: a cash drawer is "درج" (never "صندوق"); navigation.ts carries the same label.
UPDATE public.sys_components_cd
   SET label2 = 'أدراج النقد', updated_at = CURRENT_TIMESTAMP
 WHERE comp_code = 'billing_cash_drawers' AND label2 IS DISTINCT FROM 'أدراج النقد';

-- -----------------------------------------------------------------------------
-- 4. Rollover notification: the Arabic text must read the Arabic action word ({{action2}})
-- -----------------------------------------------------------------------------
UPDATE public.sys_ntf_template_ver_dtl
   SET subject2 = REPLACE(subject2, '{{action}}', '{{action2}}'),
       body2    = REPLACE(body2,    '{{action}}', '{{action2}}'),
       updated_at = CURRENT_TIMESTAMP
 WHERE template_code = 'pos_session.rolled_over.default'
   AND (subject2 LIKE '%{{action}}%' OR body2 LIKE '%{{action}}%');

UPDATE public.sys_ntf_template_chan_dtl c
   SET rendered_subject2 = REPLACE(c.rendered_subject2, '{{action}}', '{{action2}}'),
       rendered_body2    = REPLACE(c.rendered_body2,    '{{action}}', '{{action2}}'),
       updated_at = CURRENT_TIMESTAMP
  FROM public.sys_ntf_template_ver_dtl v
 WHERE v.id = c.template_version_id
   AND v.template_code = 'pos_session.rolled_over.default'
   AND (c.rendered_subject2 LIKE '%{{action}}%' OR c.rendered_body2 LIKE '%{{action}}%');

-- -----------------------------------------------------------------------------
-- 5. Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_cash_drawer_trx_type_cd
   WHERE code IN ('TRANSIT_SEND', 'TRANSIT_RECEIVE', 'TRANSIT_CANCEL') AND is_system;
  IF v_count <> 3 THEN
    RAISE EXCEPTION '0562: transit transaction types missing (found % of 3)', v_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sys_cash_drawer_type_cd WHERE code = 'IN_TRANSIT') THEN
    RAISE EXCEPTION '0562: IN_TRANSIT drawer type missing';
  END IF;

  SELECT COUNT(*) INTO v_count FROM pg_trigger
   WHERE tgrelid = 'public.org_cash_drawer_transit_tr'::regclass AND tgname = 'trg_octt_guard' AND NOT tgisinternal;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '0562: trg_octt_guard missing';
  END IF;

  SELECT COUNT(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('org_cash_drawer_transit_tr', 'org_currency_denom_cf') AND c.relrowsecurity;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '0562: RLS not enabled on both new tables (found % of 2)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_components_cd
   WHERE comp_code IN ('billing_cash_drawer_variance_approvals', 'billing_cash_drawer_in_transit') AND parent_comp_id IS NOT NULL;
  IF v_count <> 2 THEN
    RAISE EXCEPTION '0562: navigation entries not attached to billing (found % of 2)', v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sys_ntf_template_ver_dtl
     WHERE template_code = 'pos_session.rolled_over.default' AND (subject2 LIKE '%{{action}}%' OR body2 LIKE '%{{action}}%')
  ) THEN
    RAISE EXCEPTION '0562: rolled_over Arabic template still reads {{action}}';
  END IF;

  RAISE NOTICE 'Migration 0562 validation passed';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Run `npm run prisma:pull`, then `npx prisma generate`, and restart the dev server.
-- 2. No data is changed for existing tenants: no transfer exists, no override exists, and the holder
--    drawers are created on the first send in a currency.
-- 3. Rollback (forward-only repo): drop trg_octt_guard / fn_octt_guard / org_cash_drawer_transit_tr and
--    org_currency_denom_cf; drop ensure_branch_transit_drawer() and uq_ocd_branch_transit_cur; delete the
--    three TRANSIT_* trx types and the IN_TRANSIT drawer type (only if no drawer of that type exists);
--    delete the two navigation rows; restore the Arabic template text from 0558.
-- =============================================================================
