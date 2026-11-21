import type { FileRecord } from '@/types/files';
import {officeFileTarget} from '@/modules/office/office-file-target';

/** Core's filtered module list is the only UI availability signal. */
export function documentsEditorPath(file: Pick<FileRecord, 'id' | 'filename' | 'is_directory'>): string | null {
  return officeFileTarget(file);
}
