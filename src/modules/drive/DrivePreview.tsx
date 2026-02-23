import { FilePreviewPanel } from '@/components/shared/FilePreviewPanel';
import type { FileRecord } from '@/types/files';

interface DrivePreviewProps {
  file: FileRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
  isMobile?: boolean;
}

export function DrivePreview({ file, onClose, onDelete, isMobile }: DrivePreviewProps) {
  if (isMobile) {
    // Fullscreen overlay on mobile
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
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

  // Desktop: bottom panel
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
