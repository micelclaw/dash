import { useAuthStore } from '@/stores/auth.store';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i > 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

export function isVideoMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('video/');
}

export function isPreviewable(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return isImageMime(mime) || mime === 'application/pdf' || mime.startsWith('text/');
}

export function getMimeLabel(mime: string | null | undefined): string {
  if (!mime) return 'File';
  if (mime === 'inode/directory') return 'Folder';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('spreadsheet')) return 'Spreadsheet';
  if (mime.includes('wordprocessing')) return 'Document';
  if (mime.includes('presentation')) return 'Presentation';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return 'Archive';
  if (mime === 'text/markdown') return 'Markdown';
  if (mime.startsWith('text/')) return 'Text';
  return 'File';
}

/** Build an authenticated preview URL for use in <img src>. */
export function getPreviewUrl(fileId: string, width?: number): string {
  const token = useAuthStore.getState().tokens?.accessToken;
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (width) params.set('width', String(width));
  return `/api/v1/files/${fileId}/preview?${params.toString()}`;
}

/** Simple numeric hash from a string (for gradient placeholders) */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
