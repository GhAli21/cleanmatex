/** File Util — public entry for features that attach files to their records. */
export { FileAttachments, type FileAttachmentsProps } from './ui/file-attachments';
export { PendingFilesPicker, type PendingFilesPickerProps } from './ui/pending-files-picker';
export { useFileAttachments, type UseFileAttachmentsOptions, type UploadOptions } from './hooks/use-file-attachments';
export { FileUtilApiError, uploadFile, uploadFilesToRecord, fetchFileConfig, type UploadFileParams } from './api/file-util-api';
export type { FileView, FileCategoryConfig, FileUploadItem } from './model/file-util-types';
