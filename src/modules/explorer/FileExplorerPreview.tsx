import { FilePreviewPanel } from '@/components/shared/FilePreviewPanel';
import type { FileRecord } from '@/types/files';

interface FileExplorerPreviewProps {
  file: FileRecord;
  isWritable: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function FileExplorerPreview({ file, isWritable, onClose, onDelete }: FileExplorerPreviewProps) {
  return (
    <div style={{ flexShrink: 0 }}>
      <FilePreviewPanel
        file={file}
        onClose={onClose}
        onDelete={isWritable ? onDelete : undefined}
        showRelated={false}
      />
    </div>
  );
}
