export interface FileRecord {
  id: string;
  filename: string;
  filepath: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  source: string;
  source_id: string | null;
  parent_folder: string;
  is_directory: boolean;
  metadata: Record<string, unknown> | null;
  tags: string[];
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
  heat_score?: number;
}

export interface Photo extends FileRecord {
  taken_at: string | null;
  thumbnail_url: string;
  metadata: {
    width?: number;
    height?: number;
    camera?: string;
    gps?: { latitude: number; longitude: number };
    ai_description?: string;
    ai_aesthetic_score?: number;
    ai_processed_at?: string;
    faces_detected?: number;
  } | null;
}

export interface Album {
  id: string;
  name: string;
  description: string | null;
  cover_photo_id: string | null;
  cover_mode: 'first' | 'custom';
  album_type: 'manual' | 'conditional';
  filters: Record<string, unknown> | null;
  photo_count: number;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
