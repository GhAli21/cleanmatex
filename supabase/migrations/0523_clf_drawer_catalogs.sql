-- =============================================================================
-- Migration 0523 — CLF M1: cash-drawer catalogs + pending-deposit drawer
-- Package CLF (Cash Ledger Foundation), release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B
-- and docs/features/Order_Fin/ADR/ADR-057-Two-Domain-Cash-Ledger.md
--
-- What this migration does
--   1. sys_cash_drawer_type_cd      — drawer types with hard capabilities and
--                                      overridable defaults; replaces the CHECK
--                                      chk_org_cash_drawers_type with an FK.
--   2. sys_cash_drawer_trx_type_cd  — custody (operational) transaction types.
--   3. sys_cash_drawer_cnt_type_cd  — count types (OPENING/SPOT/CLOSING/RECOUNT).
--   4. sys_cash_drawer_ses_disp_cd  — mandatory close disposition codes.
--   5. sys_cash_drawer_ses_post_cd  — optional after-close follow-up statuses.
--   6. CLOSING added to sys_cash_drawer_session_status_cd (two-step close).
--   7. PENDING_DEPOSIT drawer: exactly one active per branch (partial unique
--      index), idempotent ensure_branch_pd_drawer(), AFTER INSERT trigger on
--      org_branches_mst, and a one-time provisioning for existing branches.
--
-- Catalog access: the new sys_* catalogs enable RLS with a read-only policy for
-- authenticated users and revoke write grants from anon/authenticated, so they
-- cannot be edited through the public API. Writes come only from migrations and
-- server-side roles (which bypass RLS). The older sys_cash_drawer_* catalogs keep
-- their current grants — tightening them is recorded as a separate follow-up.
--
-- Codes are mirrored exactly in web-admin/lib/constants/cash-drawer.ts
-- (CRITICAL RULE #12).
--
-- Reversal (forward migration; lossless while no org rows reference the codes):
--   DROP TRIGGER trg_branch_pd_drawer ON org_branches_mst;
--   DROP FUNCTION trg_fn_branch_pd_drawer() RESTRICT;
--   DROP FUNCTION ensure_branch_pd_drawer(UUID, UUID, TEXT, TEXT) RESTRICT;
--   DROP INDEX uq_ocd_branch_pending_dep;
--   UPDATE org_cash_drawers_mst SET is_active = FALSE WHERE drawer_type = 'PENDING_DEPOSIT';
--     (then DELETE them if no ledger rows reference them)
--   ALTER TABLE org_cash_drawers_mst DROP CONSTRAINT fk_ocd_drawer_type,
--     ADD CONSTRAINT chk_org_cash_drawers_type CHECK (drawer_type IN
--     ('COUNTER','SAFE','DRIVER_BAG','TEMPORARY'));
--   DELETE FROM sys_cash_drawer_session_status_cd WHERE code = 'CLOSING';
--   DROP TABLE sys_cash_drawer_ses_post_cd, sys_cash_drawer_ses_disp_cd,
--     sys_cash_drawer_cnt_type_cd, sys_cash_drawer_trx_type_cd,
--     sys_cash_drawer_type_cd RESTRICT;
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. sys_cash_drawer_type_cd
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_type_cd (
  code                            TEXT PRIMARY KEY,
  name                            TEXT NOT NULL,
  name2                           TEXT,
  description                     TEXT,
  description2                    TEXT,

  -- Hard capabilities: never overridable by settings.
  accepts_customer_cash           BOOLEAN NOT NULL,
  allows_customer_cash_out        BOOLEAN NOT NULL,
  can_be_trx_source               BOOLEAN NOT NULL,
  can_be_trx_dest                 BOOLEAN NOT NULL,
  can_receive_disposition         BOOLEAN NOT NULL,
  is_mobile                       BOOLEAN NOT NULL,

  -- Overridable defaults: the cash-control settings chain wins when set.
  requires_session_default        BOOLEAN NOT NULL,
  opening_count_required_default  BOOLEAN NOT NULL,
  closing_count_required_default  BOOLEAN NOT NULL,

  display_order                   INTEGER NOT NULL DEFAULT 0,

  created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by                      TEXT,
  created_info                    TEXT,
  updated_at                      TIMESTAMPTZ,
  updated_by                      TEXT,
  updated_info                    TEXT,
  rec_status                      SMALLINT NOT NULL DEFAULT 1,
  rec_order                       INTEGER,
  rec_notes                       TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.sys_cash_drawer_type_cd IS
  'CLF (ADR-057): cash drawer types. Capability columns are hard rules enforced by the cash-drawer ledger gate; *_default columns are overridable through org_fin_cash_ctrl_stng_cf.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.code IS 'Type code, mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.accepts_customer_cash IS 'Hard: finance cash IN lines (customer payments) may land in this drawer.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.allows_customer_cash_out IS 'Hard: finance cash OUT lines (refunds, reversals, cash out) may be paid from this drawer.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.can_be_trx_source IS 'Hard: may be the source side of a drawer (custody) transaction.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.can_be_trx_dest IS 'Hard: may be the destination side of a drawer (custody) transaction.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.can_receive_disposition IS 'Hard: valid destination for a session close disposition that moves cash.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.is_mobile IS 'Carried by a person (driver bag), not fixed at a counter.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.requires_session_default IS 'Default: interactive cash needs an open session. Overridable by settings.';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.opening_count_required_default IS 'Default: an opening count is required. Overridable by settings (owner: optional).';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.closing_count_required_default IS 'Default: a closing count is required. Overridable by settings (owner: optional).';
COMMENT ON COLUMN public.sys_cash_drawer_type_cd.display_order IS 'UI ordering.';

INSERT INTO public.sys_cash_drawer_type_cd (
  code, name, name2, description, description2,
  accepts_customer_cash, allows_customer_cash_out, can_be_trx_source, can_be_trx_dest,
  can_receive_disposition, is_mobile,
  requires_session_default, opening_count_required_default, closing_count_required_default,
  display_order, created_by
) VALUES
  ('COUNTER', 'Counter drawer', 'درج الكاشير',
   'Till at a service counter; takes and pays out customer cash.',
   'درج نقدية عند نقطة الخدمة؛ يستقبل نقدية العملاء ويصرف منها.',
   TRUE,  TRUE,  TRUE, TRUE, FALSE, FALSE,  TRUE,  FALSE, FALSE, 1, 'migration_0523'),
  ('TEMPORARY', 'Temporary drawer', 'درج مؤقت',
   'Short-lived till (event, pop-up); same rules as a counter drawer.',
   'درج مؤقت (فعالية أو نقطة بيع مؤقتة)؛ نفس قواعد درج الكاشير.',
   TRUE,  TRUE,  TRUE, TRUE, FALSE, FALSE,  TRUE,  FALSE, FALSE, 2, 'migration_0523'),
  ('DRIVER_BAG', 'Driver bag', 'حقيبة السائق',
   'Cash collected by a driver on delivery; reconciled by counts and handovers until a driver app exists.',
   'نقدية يحصّلها السائق عند التوصيل؛ تُطابَق بالجرد والتسليم إلى حين توفر تطبيق السائق.',
   TRUE,  FALSE, TRUE, TRUE, FALSE, TRUE,   FALSE, FALSE, FALSE, 3, 'migration_0523'),
  ('SAFE', 'Safe', 'الخزنة',
   'Branch safe; receives drops and dispositions, never customer cash.',
   'خزنة الفرع؛ تستقبل النقدية المسحوبة والمحوّلة، ولا تستقبل نقدية العملاء مباشرة.',
   FALSE, FALSE, TRUE, TRUE, TRUE,  FALSE,  FALSE, FALSE, FALSE, 4, 'migration_0523'),
  ('PENDING_DEPOSIT', 'Pending deposit', 'قيد الإيداع',
   'Cash removed from drawers and awaiting bank deposit; exactly one per branch.',
   'نقدية سُحبت من الأدراج وتنتظر الإيداع في البنك؛ واحدة فقط لكل فرع.',
   FALSE, FALSE, TRUE, TRUE, TRUE,  FALSE,  FALSE, FALSE, FALSE, 5, 'migration_0523')
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
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0523';

-- -----------------------------------------------------------------------------
-- 2. sys_cash_drawer_trx_type_cd
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_trx_type_cd (
  code                TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  name2               TEXT,
  description         TEXT,
  description2        TEXT,
  allowed_src_types   TEXT[] NOT NULL,
  allowed_dest_types  TEXT[] NOT NULL,
  requires_notes      BOOLEAN NOT NULL DEFAULT FALSE,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  display_order       INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  rec_status          SMALLINT NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_scdtt_types_nonempty
    CHECK (cardinality(allowed_src_types) > 0 AND cardinality(allowed_dest_types) > 0)
);

COMMENT ON TABLE public.sys_cash_drawer_trx_type_cd IS
  'CLF (ADR-057): custody (operational) transaction types between drawers. Custody only moves cash — lines net to zero per currency. Money that enters or leaves the business is a finance voucher, never a custody transaction.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.code IS 'Type code, mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.allowed_src_types IS 'Drawer type codes allowed on the source side (validated against sys_cash_drawer_type_cd in this migration).';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.allowed_dest_types IS 'Drawer type codes allowed on the destination side.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.requires_notes IS 'Notes are mandatory for this type.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.is_system IS 'Created by the system only (close disposition, reversal); not selectable by users.';
COMMENT ON COLUMN public.sys_cash_drawer_trx_type_cd.display_order IS 'UI ordering.';

INSERT INTO public.sys_cash_drawer_trx_type_cd (
  code, name, name2, description, description2,
  allowed_src_types, allowed_dest_types, requires_notes, is_system, display_order, created_by
) VALUES
  ('FLOAT_ISSUE', 'Float issue', 'صرف فكة من الخزنة',
   'Change fund moved from the safe into a drawer.',
   'نقل فكة من الخزنة إلى درج.',
   ARRAY['SAFE'], ARRAY['COUNTER','TEMPORARY','DRIVER_BAG'], FALSE, FALSE, 1, 'migration_0523'),
  ('CASH_DROP', 'Cash drop', 'سحب نقدية من الدرج',
   'Excess cash removed from a drawer into the safe or pending deposit.',
   'سحب النقدية الزائدة من الدرج إلى الخزنة أو إلى قيد الإيداع.',
   ARRAY['COUNTER','TEMPORARY'], ARRAY['SAFE','PENDING_DEPOSIT'], FALSE, FALSE, 2, 'migration_0523'),
  ('DRAWER_TO_DRAWER', 'Drawer to drawer', 'تحويل بين الأدراج',
   'Cash moved between two drawers in the same branch.',
   'نقل نقدية بين درجين في نفس الفرع.',
   ARRAY['COUNTER','TEMPORARY'], ARRAY['COUNTER','TEMPORARY'], TRUE, FALSE, 3, 'migration_0523'),
  ('DRIVER_HANDOVER', 'Driver handover', 'تسليم نقدية السائق',
   'Driver hands collected cash to a drawer, the safe or pending deposit.',
   'تسليم السائق النقدية المحصّلة إلى درج أو الخزنة أو قيد الإيداع.',
   ARRAY['DRIVER_BAG'], ARRAY['COUNTER','SAFE','PENDING_DEPOSIT'], FALSE, FALSE, 4, 'migration_0523'),
  ('DEPOSIT_PREP', 'Deposit preparation', 'تجهيز للإيداع البنكي',
   'Cash set aside for bank deposit.',
   'تجنيب نقدية لإيداعها في البنك.',
   ARRAY['SAFE','COUNTER'], ARRAY['PENDING_DEPOSIT'], FALSE, FALSE, 5, 'migration_0523'),
  ('CLOSE_DISPOSITION', 'Close disposition', 'تصرف نقدية الإغلاق',
   'System: cash moved out of a drawer by its session close disposition.',
   'نظامي: نقل النقدية من الدرج حسب اختيار التصرف عند إغلاق الجلسة.',
   ARRAY['COUNTER','TEMPORARY','DRIVER_BAG'], ARRAY['SAFE','PENDING_DEPOSIT'], FALSE, TRUE, 6, 'migration_0523'),
  ('REVERSAL', 'Reversal', 'عكس حركة',
   'System: mirror of a reversed custody transaction; the original is never edited.',
   'نظامي: عكس حركة عهدة سابقة؛ لا تُعدَّل الحركة الأصلية أبداً.',
   ARRAY['COUNTER','TEMPORARY','DRIVER_BAG','SAFE','PENDING_DEPOSIT'],
   ARRAY['COUNTER','TEMPORARY','DRIVER_BAG','SAFE','PENDING_DEPOSIT'], TRUE, TRUE, 7, 'migration_0523')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  allowed_src_types = EXCLUDED.allowed_src_types,
  allowed_dest_types = EXCLUDED.allowed_dest_types,
  requires_notes = EXCLUDED.requires_notes,
  is_system = EXCLUDED.is_system,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0523';

-- -----------------------------------------------------------------------------
-- 3. sys_cash_drawer_cnt_type_cd
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_cnt_type_cd (
  code           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name2          TEXT,
  description    TEXT,
  description2   TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,

  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT,
  rec_status     SMALLINT NOT NULL DEFAULT 1,
  rec_order      INTEGER,
  rec_notes      TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.sys_cash_drawer_cnt_type_cd IS
  'CLF (ADR-057): cash count types. Counts are immutable snapshots; a correction is a RECOUNT, never an edit.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.code IS 'Count type code, mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_cash_drawer_cnt_type_cd.display_order IS 'UI ordering.';

INSERT INTO public.sys_cash_drawer_cnt_type_cd (code, name, name2, description, description2, display_order, created_by) VALUES
  ('OPENING', 'Opening count', 'جرد الافتتاح',
   'Optional count when a session opens; if entered, the session is measured from it.',
   'جرد اختياري عند فتح الجلسة؛ عند إدخاله تُحاسَب الجلسة بناءً عليه.', 1, 'migration_0523'),
  ('SPOT', 'Spot count', 'جرد مفاجئ',
   'Mid-session check; records a variance, never closes anything.',
   'جرد أثناء الجلسة؛ يسجّل الفرق ولا يغلق شيئاً.', 2, 'migration_0523'),
  ('CLOSING', 'Closing count', 'جرد الإغلاق',
   'Optional count at the close count step.',
   'جرد اختياري في خطوة جرد الإغلاق.', 3, 'migration_0523'),
  ('RECOUNT', 'Recount', 'إعادة جرد',
   'Supervisor recount that supersedes the closing count; the earlier count stays in history.',
   'إعادة جرد من المشرف تحل محل جرد الإغلاق؛ ويبقى الجرد السابق في السجل.', 4, 'migration_0523')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0523';

-- -----------------------------------------------------------------------------
-- 4. sys_cash_drawer_ses_disp_cd — close disposition (mandatory at close)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_ses_disp_cd (
  code                   TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  name2                  TEXT,
  description            TEXT,
  description2           TEXT,
  cash_move_mode         TEXT NOT NULL,
  dest_drawer_type_code  TEXT NULL REFERENCES public.sys_cash_drawer_type_cd(code),
  requires_notes         BOOLEAN NOT NULL DEFAULT FALSE,
  requires_kept_amount   BOOLEAN NOT NULL DEFAULT FALSE,
  is_selectable          BOOLEAN NOT NULL DEFAULT TRUE,
  display_order          INTEGER NOT NULL DEFAULT 0,

  created_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by             TEXT,
  created_info           TEXT,
  updated_at             TIMESTAMPTZ,
  updated_by             TEXT,
  updated_info           TEXT,
  rec_status             SMALLINT NOT NULL DEFAULT 1,
  rec_order              INTEGER,
  rec_notes              TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_scdsd_move_mode CHECK (cash_move_mode IN ('NONE', 'ALL', 'PART')),
  CONSTRAINT chk_scdsd_kept_part CHECK (requires_kept_amount = (cash_move_mode = 'PART')),
  CONSTRAINT chk_scdsd_none_dest CHECK (cash_move_mode <> 'NONE' OR dest_drawer_type_code IS NULL)
);

COMMENT ON TABLE public.sys_cash_drawer_ses_disp_cd IS
  'CLF (ADR-057): what happened to a session''s cash at close. Mandatory at finalize. Codes that move cash post a CLOSE_DISPOSITION drawer transaction to a named destination drawer.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.code IS 'Disposition code, mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.cash_move_mode IS 'NONE = cash stays; ALL = the full closing basis moves; PART = basis minus the user-typed kept amount moves.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.dest_drawer_type_code IS 'Required destination drawer type; NULL with PART means any drawer type with can_receive_disposition.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.requires_notes IS 'Notes mandatory for this code.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.requires_kept_amount IS 'User must type the amount kept in the drawer (never prefilled — no silent money mutation).';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.is_selectable IS 'FALSE for system-only codes (LEGACY backfill).';
COMMENT ON COLUMN public.sys_cash_drawer_ses_disp_cd.display_order IS 'UI ordering.';

INSERT INTO public.sys_cash_drawer_ses_disp_cd (
  code, name, name2, description, description2,
  cash_move_mode, dest_drawer_type_code, requires_notes, requires_kept_amount, is_selectable,
  display_order, created_by
) VALUES
  ('LEFT_IN_DRAWER', 'Left in drawer', 'تُركت في الدرج',
   'All cash stays in the drawer and carries into the next session.',
   'تبقى النقدية كاملة في الدرج وتُرحَّل إلى الجلسة التالية.',
   'NONE', NULL, FALSE, FALSE, TRUE, 1, 'migration_0523'),
  ('MOVED_TO_SAFE', 'Moved to safe', 'نُقلت إلى الخزنة',
   'All cash moved to the branch safe.',
   'نُقلت النقدية كاملة إلى خزنة الفرع.',
   'ALL', 'SAFE', FALSE, FALSE, TRUE, 2, 'migration_0523'),
  ('HANDED_TO_MANAGER', 'Handed to manager', 'سُلّمت للمدير',
   'All cash handed to the manager and held as pending deposit.',
   'سُلّمت النقدية كاملة للمدير وتُحفظ قيد الإيداع.',
   'ALL', 'PENDING_DEPOSIT', FALSE, FALSE, TRUE, 3, 'migration_0523'),
  ('PREPARED_FOR_DEPOSIT', 'Prepared for deposit', 'جُهّزت للإيداع',
   'All cash bagged for bank deposit.',
   'جُهّزت النقدية كاملة للإيداع في البنك.',
   'ALL', 'PENDING_DEPOSIT', FALSE, FALSE, TRUE, 4, 'migration_0523'),
  ('PARTIAL_REMOVED', 'Partly removed', 'سُحب جزء منها',
   'Part of the cash moved out; the rest stays in the drawer.',
   'سُحب جزء من النقدية وبقي الباقي في الدرج.',
   'PART', NULL, TRUE, TRUE, TRUE, 5, 'migration_0523'),
  ('OTHER', 'Other', 'أخرى',
   'Anything else; explain in the notes.',
   'أي حالة أخرى؛ يُشرح في الملاحظات.',
   'NONE', NULL, TRUE, FALSE, TRUE, 6, 'migration_0523'),
  ('LEGACY', 'Legacy close', 'إغلاق قديم',
   'System only: sessions closed before the cash ledger existed.',
   'نظامي فقط: جلسات أُغلقت قبل تفعيل دفتر النقدية الجديد.',
   'NONE', NULL, FALSE, FALSE, FALSE, 99, 'migration_0523')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  cash_move_mode = EXCLUDED.cash_move_mode,
  dest_drawer_type_code = EXCLUDED.dest_drawer_type_code,
  requires_notes = EXCLUDED.requires_notes,
  requires_kept_amount = EXCLUDED.requires_kept_amount,
  is_selectable = EXCLUDED.is_selectable,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0523';

-- -----------------------------------------------------------------------------
-- 5. sys_cash_drawer_ses_post_cd — after-close follow-up (optional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_ses_post_cd (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name2           TEXT,
  description     TEXT,
  description2    TEXT,
  requires_notes  BOOLEAN NOT NULL DEFAULT FALSE,
  display_order   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by      TEXT,
  created_info    TEXT,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT,
  updated_info    TEXT,
  rec_status      SMALLINT NOT NULL DEFAULT 1,
  rec_order       INTEGER,
  rec_notes       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.sys_cash_drawer_ses_post_cd IS
  'CLF (ADR-057): optional after-close follow-up status of a session''s cash (e.g. deposited next day). A label only in this phase — no ledger effect.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.code IS 'Status code, mirrored in lib/constants/cash-drawer.ts.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.name IS 'English name.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.name2 IS 'Arabic name.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.description IS 'English description.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.requires_notes IS 'Notes mandatory for this status.';
COMMENT ON COLUMN public.sys_cash_drawer_ses_post_cd.display_order IS 'UI ordering.';

INSERT INTO public.sys_cash_drawer_ses_post_cd (code, name, name2, description, description2, requires_notes, display_order, created_by) VALUES
  ('IN_TRANSIT', 'In transit', 'في الطريق',
   'Cash is on its way to the bank or head office.',
   'النقدية في طريقها إلى البنك أو الإدارة الرئيسية.', FALSE, 1, 'migration_0523'),
  ('DEPOSITED_TO_BANK', 'Deposited to bank', 'أُودعت في البنك',
   'Cash deposited in the bank.',
   'أُودعت النقدية في البنك.', FALSE, 2, 'migration_0523'),
  ('HANDED_TO_HQ', 'Handed to head office', 'سُلّمت للإدارة الرئيسية',
   'Cash handed to head office.',
   'سُلّمت النقدية للإدارة الرئيسية.', FALSE, 3, 'migration_0523'),
  ('OTHER', 'Other', 'أخرى',
   'Anything else; explain in the notes.',
   'أي حالة أخرى؛ يُشرح في الملاحظات.', TRUE, 4, 'migration_0523')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  requires_notes = EXCLUDED.requires_notes,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'migration_0523';

-- -----------------------------------------------------------------------------
-- Catalog access: read-only through the API for signed-in users
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sys_cash_drawer_type_cd', 'sys_cash_drawer_trx_type_cd', 'sys_cash_drawer_cnt_type_cd',
    'sys_cash_drawer_ses_disp_cd', 'sys_cash_drawer_ses_post_cd'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS sys_read_authenticated ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY sys_read_authenticated ON public.%I FOR SELECT TO authenticated USING (TRUE)', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. CLOSING session status (two-step close: count → finalize)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_cash_drawer_session_status_cd
  (code, name, name2, description, description2, is_final, display_order, is_active, rec_status)
VALUES
  ('CLOSING', 'Closing', 'قيد الإغلاق',
   'Count step done and the cut is frozen; waiting for the close disposition. Interactive cash is refused on this drawer.',
   'تم جرد الإغلاق وتثبيت نقطة القطع؛ بانتظار اختيار التصرف في النقدية. تُرفض النقدية المباشرة على هذا الدرج.',
   FALSE, 5, TRUE, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  is_final = EXCLUDED.is_final, display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 7a. Drawer type: CHECK → FK to the catalog
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_cash_drawers_mst DROP CONSTRAINT IF EXISTS chk_org_cash_drawers_type;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ocd_drawer_type') THEN
    ALTER TABLE public.org_cash_drawers_mst
      ADD CONSTRAINT fk_ocd_drawer_type
      FOREIGN KEY (drawer_type) REFERENCES public.sys_cash_drawer_type_cd(code);
  END IF;
END $$;

COMMENT ON COLUMN public.org_cash_drawers_mst.drawer_type IS
  'Drawer type → sys_cash_drawer_type_cd (CLF, replaces the old CHECK). Capabilities come from the catalog.';

-- -----------------------------------------------------------------------------
-- 7b. PENDING_DEPOSIT: exactly one active per branch
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocd_branch_pending_dep
  ON public.org_cash_drawers_mst (tenant_org_id, branch_id)
  WHERE drawer_type = 'PENDING_DEPOSIT' AND is_active;

COMMENT ON INDEX public.uq_ocd_branch_pending_dep IS
  'CLF: at most one active PENDING_DEPOSIT drawer per branch; also the ON CONFLICT target of ensure_branch_pd_drawer().';

-- -----------------------------------------------------------------------------
-- 7c. ensure_branch_pd_drawer — idempotent, safe under concurrency
-- -----------------------------------------------------------------------------
-- SQLSTATE CMX01 = tenant currency not configured. The branch trigger downgrades
-- it to a WARNING so branch creation never fails; app callers surface it.
CREATE OR REPLACE FUNCTION public.ensure_branch_pd_drawer(
  p_tenant_org_id  UUID,
  p_branch_id      UUID,
  p_currency_code  TEXT DEFAULT NULL,
  p_actor          TEXT DEFAULT NULL
)
RETURNS TABLE (drawer_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
    RAISE EXCEPTION 'ensure_branch_pd_drawer: tenant and branch are required';
  END IF;

  SELECT COALESCE(b.name, b.branch_name), COALESCE(b.name2, b.name, b.branch_name)
    INTO v_name, v_name2
    FROM org_branches_mst b
   WHERE b.id = p_branch_id AND b.tenant_org_id = p_tenant_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ensure_branch_pd_drawer: branch % not found for tenant %', p_branch_id, p_tenant_org_id;
  END IF;

  SELECT d.id INTO v_id
    FROM org_cash_drawers_mst d
   WHERE d.tenant_org_id = p_tenant_org_id AND d.branch_id = p_branch_id
     AND d.drawer_type = 'PENDING_DEPOSIT' AND d.is_active;
  IF FOUND THEN
    RETURN QUERY SELECT v_id, FALSE;
    RETURN;
  END IF;

  v_currency := NULLIF(TRIM(p_currency_code), '');
  IF v_currency IS NULL THEN
    SELECT NULLIF(TRIM(t.currency), '') INTO v_currency
      FROM org_tenants_mst t WHERE t.id = p_tenant_org_id;
  END IF;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'CMX01',
      MESSAGE = 'CASH_DRAWER_CURRENCY_NOT_CONFIGURED: tenant has no currency; pending-deposit drawer not created';
  END IF;

  -- Code derived from the branch id (branches have no code column); suffixed if
  -- an older inactive drawer already holds it.
  v_code_base := 'PD-' || UPPER(LEFT(REPLACE(p_branch_id::TEXT, '-', ''), 8));
  v_code := v_code_base;
  WHILE EXISTS (SELECT 1 FROM org_cash_drawers_mst
                 WHERE tenant_org_id = p_tenant_org_id AND drawer_code = v_code) LOOP
    v_suffix := v_suffix + 1;
    v_code := v_code_base || '-' || v_suffix;
  END LOOP;

  INSERT INTO org_cash_drawers_mst (
    tenant_org_id, branch_id, drawer_code, drawer_name, drawer_name2,
    drawer_type, currency_code, requires_session, opening_float_required,
    created_by, created_info, is_active, rec_status, metadata
  ) VALUES (
    p_tenant_org_id, p_branch_id, v_code,
    'Pending deposit' || COALESCE(' - ' || v_name, ''),
    'قيد الإيداع' || COALESCE(' - ' || v_name2, ''),
    'PENDING_DEPOSIT', v_currency, FALSE, FALSE,
    COALESCE(p_actor, 'system'), 'ensure_branch_pd_drawer', TRUE, 1,
    jsonb_build_object('system_drawer', TRUE)
  )
  ON CONFLICT (tenant_org_id, branch_id) WHERE drawer_type = 'PENDING_DEPOSIT' AND is_active
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
     AND d.drawer_type = 'PENDING_DEPOSIT' AND d.is_active;
  RETURN QUERY SELECT v_id, FALSE;
END;
$$;

COMMENT ON FUNCTION public.ensure_branch_pd_drawer(UUID, UUID, TEXT, TEXT) IS
  'CLF: creates the branch PENDING_DEPOSIT drawer only if missing; returns (drawer_id, created). Currency = argument, else org_tenants_mst.currency, else SQLSTATE CMX01. Called by the branch insert trigger, the HQ tenant-maintenance action and POST /api/v1/cash-drawers/pending-deposit/ensure.';

-- Not callable through the public API: callers pass a tenant id.
REVOKE ALL ON FUNCTION public.ensure_branch_pd_drawer(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_branch_pd_drawer(UUID, UUID, TEXT, TEXT) TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 7d. Branch insert trigger
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so the trigger can call the revoked function whatever role
-- inserts the branch; it only acts on the NEW row's own tenant and branch.
CREATE OR REPLACE FUNCTION public.trg_fn_branch_pd_drawer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.ensure_branch_pd_drawer(NEW.tenant_org_id, NEW.id, NULL, NEW.created_by);
  EXCEPTION WHEN SQLSTATE 'CMX01' THEN
    RAISE WARNING 'Pending-deposit drawer not created for branch % (tenant % has no currency)',
      NEW.id, NEW.tenant_org_id;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_fn_branch_pd_drawer() IS
  'CLF: AFTER INSERT on org_branches_mst — ensures the branch PENDING_DEPOSIT drawer. A missing tenant currency only warns, so branch creation never fails; the ensure button fixes it later.';

REVOKE ALL ON FUNCTION public.trg_fn_branch_pd_drawer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_branch_pd_drawer ON public.org_branches_mst;
CREATE TRIGGER trg_branch_pd_drawer
  AFTER INSERT ON public.org_branches_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_branch_pd_drawer();

-- -----------------------------------------------------------------------------
-- 7e. Provision existing active branches (tenants without a currency are skipped
--     with a NOTICE; the ensure button creates theirs once a currency is set)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT b.tenant_org_id, b.id FROM org_branches_mst b WHERE b.is_active
  LOOP
    BEGIN
      PERFORM public.ensure_branch_pd_drawer(r.tenant_org_id, r.id, NULL, 'migration_0523');
    EXCEPTION WHEN SQLSTATE 'CMX01' THEN
      RAISE NOTICE 'Skipped branch % (tenant % has no currency)', r.id, r.tenant_org_id;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM sys_cash_drawer_type_cd) <> 5 THEN
    RAISE EXCEPTION 'sys_cash_drawer_type_cd seed incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM sys_cash_drawer_trx_type_cd) <> 7 THEN
    RAISE EXCEPTION 'sys_cash_drawer_trx_type_cd seed incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM sys_cash_drawer_cnt_type_cd) <> 4 THEN
    RAISE EXCEPTION 'sys_cash_drawer_cnt_type_cd seed incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM sys_cash_drawer_ses_disp_cd) <> 7 THEN
    RAISE EXCEPTION 'sys_cash_drawer_ses_disp_cd seed incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM sys_cash_drawer_ses_post_cd) <> 4 THEN
    RAISE EXCEPTION 'sys_cash_drawer_ses_post_cd seed incomplete';
  END IF;

  -- Every type code named in a trx-type array must exist in the type catalog.
  SELECT string_agg(DISTINCT x, ', ') INTO v_bad
    FROM sys_cash_drawer_trx_type_cd t,
         LATERAL unnest(t.allowed_src_types || t.allowed_dest_types) AS x
   WHERE NOT EXISTS (SELECT 1 FROM sys_cash_drawer_type_cd d WHERE d.code = x);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown drawer type codes in sys_cash_drawer_trx_type_cd: %', v_bad;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sys_cash_drawer_session_status_cd WHERE code = 'CLOSING') THEN
    RAISE EXCEPTION 'CLOSING status missing';
  END IF;
END $$;

COMMIT;
