-- ==================================================================
-- 0259_org_order_piece_hist_tr.sql
-- Purpose: Audit trail rows for order item piece field changes (tenant-scoped).
-- Populated from web-admin OrderPieceService.updatePiece (not duplicated by DB trigger).
-- Depends: org_order_item_pieces_dtl (0073), org_tenants_mst, current_tenant_id() (RLS helper).
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS org_order_piece_hist_tr (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id    UUID NOT NULL,
  order_id         UUID NOT NULL,
  order_item_id    UUID NOT NULL,
  piece_seq        INTEGER ,
  order_piece_id   UUID NOT NULL,
  action_code      VARCHAR(30) NOT NULL,
  from_value       TEXT,
  to_value         TEXT,
  done_by          TEXT,
  done_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT PK_org_order_piece_hist_tr PRIMARY KEY (id),
  CONSTRAINT FK_piece_hist_piece
    FOREIGN KEY (order_piece_id)
    REFERENCES org_order_item_pieces_dtl (id)
    ON DELETE CASCADE,
  CONSTRAINT FK_piece_hist_order_item
    FOREIGN KEY (order_item_id)
    REFERENCES org_order_items_dtl (id)
    ON DELETE CASCADE,
  CONSTRAINT FK_piece_hist_piece_seq
    FOREIGN KEY (tenant_org_id, order_id, order_item_id, piece_seq)
    REFERENCES org_order_item_pieces_dtl (tenant_org_id, order_id, order_item_id, piece_seq)
    ON DELETE CASCADE,
  CONSTRAINT FK_piece_hist_order
    FOREIGN KEY (order_id)
    REFERENCES org_orders_mst (id)
    ON DELETE CASCADE,
  CONSTRAINT FK_piece_hist_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst (id)
    ON DELETE CASCADE
);

COMMENT ON TABLE org_order_piece_hist_tr IS
  'Piece-level audit: records field transitions from OrderPieceService.updatePiece.';

CREATE INDEX IF NOT EXISTS idx_piece_hist_tnt_piece
  ON org_order_piece_hist_tr (tenant_org_id, order_piece_id);

CREATE INDEX IF NOT EXISTS idx_piece_hist_piece_done
  ON org_order_piece_hist_tr (order_piece_id, done_at DESC);

ALTER TABLE org_order_piece_hist_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_order_piece_hist_tr ON org_order_piece_hist_tr;
CREATE POLICY tenant_isolation_org_order_piece_hist_tr
  ON org_order_piece_hist_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_order_piece_hist_tr ON org_order_piece_hist_tr IS
  'Tenant users see only their tenant piece history rows.';

DROP POLICY IF EXISTS service_role_org_order_piece_hist_tr ON org_order_piece_hist_tr;
CREATE POLICY service_role_org_order_piece_hist_tr
  ON org_order_piece_hist_tr
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON POLICY service_role_org_order_piece_hist_tr ON org_order_piece_hist_tr IS
  'Service role bypass for admin jobs.';

COMMIT;
