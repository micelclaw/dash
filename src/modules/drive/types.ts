export type { FileRecord, Photo, Album } from '@/types/files';

export type DriveView = 'grid' | 'list';

export type SortField = 'filename' | 'size_bytes' | 'updated_at' | 'mime_type';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}
