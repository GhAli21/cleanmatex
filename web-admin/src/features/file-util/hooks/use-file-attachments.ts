'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { deleteFileById, fetchFileConfig, fetchFiles, FileUtilApiError, updateFileMeta, uploadFile } from '../api/file-util-api';
import type { FileCategoryCode, FileRefTypeCode, FileSourceCode, FileUploadItem } from '../model/file-util-types';

/** Uploads running at once; more would compete for the same connection. */
const MAX_PARALLEL_UPLOADS = 3;
/** Category rules change only through HQ; one read per visit is enough. */
const CONFIG_STALE_MS = 10 * 60 * 1000;
/** Signed links live 5 minutes; refetch before they expire. */
const FILES_STALE_MS = 4 * 60 * 1000;

/** Where the attached files belong and where they come from. */
export interface UseFileAttachmentsOptions {
  category: FileCategoryCode;
  entityId: string;
  /** Show and accept only these purposes (all when omitted). */
  purposes?: string[];
  source: FileSourceCode;
  refType?: FileRefTypeCode;
  refId?: string;
  /** False pauses both queries (e.g. record not saved yet). */
  enabled?: boolean;
}

/** Options of one upload batch. */
export interface UploadOptions {
  purpose?: string;
  notes?: string;
}

/**
 * Files of one record: category config, the READY file list (fresh URLs), and an upload queue
 * with per-file progress, cancel and retry. Scoped to the authenticated tenant: the tenant id is
 * part of every cache key and the server resolves it from the session.
 *
 * @returns config, files, upload queue state and actions
 * @example
 * const fa = useFileAttachments({ category: 'ORDER_FILE', entityId: orderId, source: 'ORDER_DETAIL' });
 * fa.upload([file], { purpose: 'DAMAGE', notes: 'Torn sleeve' });
 */
export function useFileAttachments(opts: UseFileAttachmentsOptions) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const { token: csrfToken } = useCSRFToken();
  const queryClient = useQueryClient();
  const enabled = (opts.enabled ?? true) && !!tenantId && !!opts.entityId;
  const ref = opts.refType && opts.refId ? { refType: opts.refType, refId: opts.refId } : undefined;
  const filesKey = ['file-util', 'files', tenantId, opts.category, opts.entityId, opts.purposes ?? null, ref ?? null];

  const config = useQuery({
    queryKey: ['file-util', 'config', tenantId, opts.category],
    queryFn: ({ signal }) => fetchFileConfig(opts.category, signal),
    // Prevent the query before the tenant is confirmed.
    enabled: !!tenantId,
    staleTime: CONFIG_STALE_MS,
  });

  const files = useQuery({
    queryKey: filesKey,
    queryFn: ({ signal }) => fetchFiles(opts.category, [opts.entityId], opts.purposes, signal, ref),
    enabled,
    staleTime: FILES_STALE_MS,
    refetchInterval: FILES_STALE_MS,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['file-util', 'files', tenantId, opts.category, opts.entityId] }),
    [queryClient, tenantId, opts.category, opts.entityId],
  );

  // ─── Upload queue ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const pending = useRef<{ key: string; file: File; options: UploadOptions }[]>([]);
  const running = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const sources = useRef(new Map<string, { file: File; options: UploadOptions }>());

  const patch = useCallback((key: string, change: Partial<FileUploadItem>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }, []);

  const runOne = useCallback(
    async (key: string, file: File, options: UploadOptions) => {
      const controller = new AbortController();
      controllers.current.set(key, controller);
      try {
        const purpose = config.data?.purposes.find((p) => p.purposeCode === options.purpose) ?? config.data?.purposes.find((p) => p.isDefault);
        patch(key, { status: 'uploading' });
        await uploadFile({
          file,
          imageMaxDimension: config.data?.imageMaxDimension ?? null,
          csrfToken,
          category: opts.category,
          purpose: purpose?.purposeCode,
          entityId: opts.entityId,
          refType: opts.refType,
          refId: opts.refId,
          source: opts.source,
          notes: options.notes,
          onProgress: (p) => patch(key, { progress: p }),
          onVerifying: () => patch(key, { status: 'verifying', progress: 100 }),
          signal: controller.signal,
        });
        patch(key, { status: 'done' });
        sources.current.delete(key);
        void refresh();
      } catch (error) {
        patch(key, { status: 'error', errorCode: error instanceof FileUtilApiError ? error.code : 'FILE_UTIL_FAILED' });
      } finally {
        controllers.current.delete(key);
      }
    },
    [config.data, csrfToken, opts.category, opts.entityId, opts.refId, opts.refType, opts.source, patch, refresh],
  );

  const pump = useCallback(() => {
    while (running.current < MAX_PARALLEL_UPLOADS && pending.current.length > 0) {
      const next = pending.current.shift()!;
      running.current += 1;
      void runOne(next.key, next.file, next.options).finally(() => {
        running.current -= 1;
        pump();
      });
    }
  }, [runOne]);

  /** Queues files for upload (prepared, sent, verified). */
  const upload = useCallback(
    (picked: File[], options: UploadOptions = {}) => {
      const added = picked.map((file) => {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sources.current.set(key, { file, options });
        pending.current.push({ key, file, options });
        return { key, name: file.name, sizeBytes: file.size, status: 'preparing' as const, progress: 0 };
      });
      setItems((list) => [...list, ...added]);
      pump();
    },
    [pump],
  );

  /** Re-queues a failed upload with its original file and options. */
  const retry = useCallback(
    (key: string) => {
      const source = sources.current.get(key);
      if (!source) return;
      patch(key, { status: 'preparing', progress: 0, errorCode: undefined });
      pending.current.push({ key, ...source });
      pump();
    },
    [patch, pump],
  );

  /** Cancels a queued or running upload and removes it from the list. */
  const cancel = useCallback((key: string) => {
    pending.current = pending.current.filter((p) => p.key !== key);
    controllers.current.get(key)?.abort();
    sources.current.delete(key);
    setItems((list) => list.filter((i) => i.key !== key));
  }, []);

  /** Clears finished uploads from the queue display. */
  const clearDone = useCallback(() => setItems((list) => list.filter((i) => i.status !== 'done')), []);

  const remove = useMutation({
    mutationFn: (fileId: string) => deleteFileById(opts.category, fileId, csrfToken),
    onSuccess: () => void refresh(),
  });

  const update = useMutation({
    mutationFn: ({ fileId, ...change }: { fileId: string; purpose?: string; notes?: string | null; sortOrder?: number }) =>
      updateFileMeta(opts.category, fileId, change, csrfToken),
    onSuccess: () => void refresh(),
  });

  return {
    config: config.data,
    configLoading: config.isLoading,
    files: files.data ?? [],
    filesLoading: files.isLoading,
    filesError: files.error instanceof FileUtilApiError ? files.error.code : files.error ? 'FILE_UTIL_FAILED' : null,
    reload: refresh,
    uploads: items,
    upload,
    retry,
    cancel,
    clearDone,
    remove,
    update,
    ready: !!config.data && !!csrfToken,
  };
}
