-- Purpose: establish tenant-private, durable storage references for staff proof of delivery.
-- Path convention: {tenant_org_id}/delivery/{stop_id}/{evidence_id}.{ext}
-- Existing URL columns remain readable for legacy evidence; new completion flows must persist object keys.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-pod-evidence',
  'delivery-pod-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.org_dlv_pod_tr
  ADD COLUMN IF NOT EXISTS pod_notes TEXT,
  ADD COLUMN IF NOT EXISTS signature_object_key TEXT,
  ADD COLUMN IF NOT EXISTS photo_object_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.org_dlv_pod_tr
  ADD CONSTRAINT ck_dlv_pod_photo_keys
  CHECK (
    jsonb_typeof(photo_object_keys) = 'array'
    AND jsonb_array_length(photo_object_keys) <= 10
  );

COMMENT ON COLUMN public.org_dlv_pod_tr.signature_object_key
  IS 'Private storage object key for signature evidence; never persist signed URLs.';
COMMENT ON COLUMN public.org_dlv_pod_tr.photo_object_keys
  IS 'Private storage object keys for photo evidence; never persist signed URLs.';

CREATE POLICY dlv_pod_evidence_select
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-pod-evidence'
  AND (storage.foldername(name))[1] = current_tenant_id()::TEXT
);

CREATE POLICY dlv_pod_evidence_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-pod-evidence'
  AND (storage.foldername(name))[1] = current_tenant_id()::TEXT
);

CREATE POLICY dlv_pod_evidence_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-pod-evidence'
  AND (storage.foldername(name))[1] = current_tenant_id()::TEXT
)
WITH CHECK (
  bucket_id = 'delivery-pod-evidence'
  AND (storage.foldername(name))[1] = current_tenant_id()::TEXT
);

CREATE POLICY dlv_pod_evidence_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-pod-evidence'
  AND (storage.foldername(name))[1] = current_tenant_id()::TEXT
);

COMMIT;
