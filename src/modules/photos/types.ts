import type { Photo } from '@/types/files';

export type PhotosView = 'timeline' | 'albums';

export interface PhotoGroup {
  label: string;       // "February 2026"
  key: string;         // "2026-02"
  photos: Photo[];
}
