-- Purpose: track private delivery evidence before an atomic completion consumes it.
-- This prevents unverified object keys from being attached to another tenant or stop.

BEGIN;

CREATE TABLE public.org_dlv_ev_uploads_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  stop_id UUID NOT NULL,
  evidence_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  sha256_hex TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  consumed_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT,
  updated_info TEXT,
  CONSTRAINT fk_dlv_ev_upload_stop
    FOREIGN KEY (stop_id, tenant_org_id)
    REFERENCES public.org_dlv_stops_dtl (id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_dlv_ev_upload_type
    CHECK (evidence_type IN ('signature', 'photo')),
  CONSTRAINT ck_dlv_ev_upload_status
    CHECK (upload_status IN ('uploaded', 'consumed', 'purged', 'rejected')),
  CONSTRAINT ck_dlv_ev_upload_size
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  CONSTRAINT ck_dlv_ev_upload_hash
    CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  CONSTRAINT uq_dlv_ev_upload_key
    UNIQUE (tenant_org_id, object_key)
);

CREATE INDEX idx_dlv_ev_up_stop
  ON public.org_dlv_ev_uploads_tr (tenant_org_id, stop_id, upload_status);
CREATE INDEX idx_dlv_ev_up_expiry
  ON public.org_dlv_ev_uploads_tr (tenant_org_id, expires_at)
  WHERE upload_status = 'uploaded';

ALTER TABLE public.org_dlv_ev_uploads_tr ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlv_ev_upload_tenant
ON public.org_dlv_ev_uploads_tr
FOR ALL
USING (tenant_org_id = current_tenant_id())
WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON TABLE public.org_dlv_ev_uploads_tr
  IS 'Tenant-scoped private POD uploads awaiting atomic delivery completion or purge.';
COMMENT ON COLUMN public.org_dlv_ev_uploads_tr.object_key
  IS 'Private delivery-pod-evidence storage key; signed URLs are generated on read and never stored.';

COMMIT;
