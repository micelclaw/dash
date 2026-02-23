import { FilePreviewPanel } from '@/components/shared/FilePreviewPanel';
import type { FileRecord } from '@/types/files';

interface DrivePreviewProps {
  file: FileRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function DrivePreview({ file, onClose, onDelete }: DrivePreviewProps) {
  return (
    <div style={{ height: 200, flexShrink: 0 }}>
      <FilePreviewPanel
        file={file}
        onClose={onClose}
        onDelete={onDelete}
        showRelated
        linkedRecords={[]}
        linkedRecordsLoading={false}
      />
    </div>
  );
}
