import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { prepareImage } from '../model/prepare-image';
import type { FileCategoryCode, FileCategoryConfig, FileRefTypeCode, FileSourceCode, FileView, InitFileUploadResult } from '../model/file-util-types';

const BASE = '/api/v1/file-util';

/** A refused File Util request; `code` selects the message (`fileUtil.errors.<code>`). */
export class FileUtilApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  const body = (await response.json().catch(() => null)) as { success?: boolean; data?: T; code?: string } | null;
  if (!response.ok || !body?.success) throw new FileUtilApiError(body?.code || 'FILE_UTIL_FAILED');
  return body.data as T;
}

const send = <T>(url: string, method: string, csrfToken: string | null, payload?: unknown) =>
  request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

/**
 * Purposes, limits and allowed types of a category.
 * @param category file category
 * @param signal cancels a superseded request
 */
export const fetchFileConfig = (category: FileCategoryCode, signal?: AbortSignal) =>
  request<FileCategoryConfig>(`${BASE}/config?category=${category}`, { signal });

/**
 * READY files of one or many records, with fresh URLs.
 * @param category file category
 * @param entityIds owning records
 * @param purposes only these purposes (all when omitted)
 * @param signal cancels a superseded request
 */
export const fetchFiles = (category: FileCategoryCode, entityIds: string[], purposes?: string[], signal?: AbortSignal) => {
  const query = new URLSearchParams({ category, entityIds: entityIds.join(',') });
  if (purposes?.length) query.set('purposes', purposes.join(','));
  return request<FileView[]>(`${BASE}?${query}`, { signal });
};

/** Upload request body (mirrors the route schema). */
export interface InitUploadInput {
  category: FileCategoryCode;
  purpose?: string;
  entityId: string;
  refType?: FileRefTypeCode;
  refId?: string;
  source: FileSourceCode;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  thumbSizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  notes?: string;
}

/**
 * Reserves an upload and returns signed upload targets.
 * @param input upload request
 * @param csrfToken CSRF token
 */
export const initUpload = (input: InitUploadInput, csrfToken: string | null) =>
  send<InitFileUploadResult>(BASE, 'POST', csrfToken, input);

/**
 * Verifies the uploaded bytes and makes the file visible.
 * @param category file category
 * @param fileId reserved file
 * @param csrfToken CSRF token
 */
export const completeUpload = (category: FileCategoryCode, fileId: string, csrfToken: string | null) =>
  send<FileView>(`${BASE}/${fileId}/complete`, 'POST', csrfToken, { category });

/**
 * Changes purpose, note or display order.
 * @param category file category
 * @param fileId file
 * @param patch fields to change
 * @param csrfToken CSRF token
 */
export const updateFileMeta = (
  category: FileCategoryCode,
  fileId: string,
  patch: { purpose?: string; notes?: string | null; sortOrder?: number },
  csrfToken: string | null,
) => send<FileView>(`${BASE}/${fileId}`, 'PATCH', csrfToken, { category, ...patch });

/**
 * Deletes a file (soft delete; storage purged later by HQ).
 * @param category file category
 * @param fileId file
 * @param csrfToken CSRF token
 */
export const deleteFileById = (category: FileCategoryCode, fileId: string, csrfToken: string | null) =>
  send<void>(`${BASE}/${fileId}?category=${category}`, 'DELETE', csrfToken);

/**
 * PUTs bytes to a signed storage upload URL with progress. XHR, because fetch has no upload
 * progress events.
 * @param signedUrl one-time upload URL from `initUpload`
 * @param body file or thumbnail bytes
 * @param onProgress percent 0–100
 * @param signal aborts the upload
 */
export function putToSignedUrl(signedUrl: string, body: Blob, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new FileUtilApiError('STORAGE_FAILED')));
    xhr.onerror = () => reject(new FileUtilApiError('NETWORK_ERROR'));
    xhr.onabort = () => reject(new FileUtilApiError('UPLOAD_CANCELLED'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** One file to upload into a record, plus the category rules needed to prepare it. */
export interface UploadFileParams extends Omit<InitUploadInput, 'fileName' | 'mimeType' | 'sizeBytes' | 'thumbSizeBytes' | 'width' | 'height'> {
  file: File;
  /** Category longest-side limit for browser downscaling; null = keep size. */
  imageMaxDimension: number | null;
  csrfToken: string | null;
  onProgress?: (percent: number) => void;
  /** Called when bytes are sent and the server starts verifying. */
  onVerifying?: () => void;
  signal?: AbortSignal;
}

/**
 * Full upload of one file: downscale + thumbnail in the browser, reserve, PUT bytes straight to
 * storage, then server verification. Usable outside React (e.g. after an order is created).
 * @param params file, target record and rules
 * @returns the READY file
 * @throws {FileUtilApiError} with the server or transport error code
 */
export async function uploadFile(params: UploadFileParams): Promise<FileView> {
  const { file, imageMaxDimension, csrfToken, onProgress, onVerifying, signal, ...target } = params;
  const prepared = await prepareImage(file, imageMaxDimension);
  const reserved = await initUpload(
    {
      ...target,
      notes: target.notes?.trim() || undefined,
      fileName: prepared.file.name,
      mimeType: prepared.file.type,
      sizeBytes: prepared.file.size,
      thumbSizeBytes: prepared.thumb?.size,
      width: prepared.width,
      height: prepared.height,
    },
    csrfToken,
  );
  await putToSignedUrl(reserved.upload.signedUrl, prepared.file, onProgress, signal);
  if (reserved.thumbUpload && prepared.thumb) {
    // A failed thumbnail is not fatal: the server drops it and galleries show the full image.
    await putToSignedUrl(reserved.thumbUpload.signedUrl, prepared.thumb, undefined, signal).catch(() => undefined);
  }
  onVerifying?.();
  return completeUpload(target.category, reserved.fileId, csrfToken);
}
