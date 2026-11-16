/**
 * File Util client types. Shapes come from the server service (type-only import, erased at
 * build), so client and server never drift.
 */
export type {
  FileCategoryConfig,
  FileView,
  InitFileUploadResult,
} from '@/lib/services/file-util/file-util.service';
export type { FileCategoryCode, FileRefTypeCode, FileSourceCode } from '@/lib/constants/file-util';

/** One purpose of a category as the upload UI shows it. */
export type FilePurposeConfig = import('@/lib/services/file-util/file-util.service').FileCategoryConfig['purposes'][number];

/** Client-side state of one upload in the queue. */
export interface FileUploadItem {
  /** Local id (not the server file id). */
  key: string;
  name: string;
  sizeBytes: number;
  status: 'preparing' | 'uploading' | 'verifying' | 'done' | 'error';
  /** 0–100 while uploading. */
  progress: number;
  /** Server error code (`fileUtil.errors.<code>`) when status is `error`. */
  errorCode?: string;
}
