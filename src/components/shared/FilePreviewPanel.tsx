import { useState } from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { RelatedItemsPanel } from './RelatedItemsPanel';
import { SimilarContentPanel } from './SimilarContentPanel';
import { GraphProximityPanel } from './GraphProximityPanel';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { formatFileSize, isImageMime, getMimeLabel, getPreviewUrl } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import { formatRelative } from '@/lib/date-helpers';
import type { FileRecord } from '@/types/files';
import type { LinkedRecord } from '@/types/links';

interface FilePreviewPanelProps {
  file: FileRecord;
  onClose: () => void;
  onDelete?: (id: string) => void;
  showRelated?: boolean;
  linkedRecords?: LinkedRecord[];
  linkedRecordsLoading?: boolean;
}

export function FilePreviewPanel({
  file, onClose, onDelete, showRelated = true,
  linkedRecords = [], linkedRecordsLoading = false,
}: FilePreviewPanelProps) {
  useCoNavigation('file', file.id);
  const isImage = isImageMime(file.mime_type);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        fontFamily: 'var(--font-sans)',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 16, padding: 16 }}>
        {/* Preview area */}
        <div
          style={{
            width: 200,
            height: 160,
            flexShrink: 0,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isImage && !imgError ? (
            <img
              src={getPreviewUrl(file.id)}
              alt={file.filename}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="lg" />
          )}
        </div>

        {/* Metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{
              margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {file.filename}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', padding: 2, flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {!file.is_directory && <span>{formatFileSize(file.size_bytes)}</span>}
            <span>{getMimeLabel(file.mime_type)}</span>
            <span>Modified {formatRelative(new Date(file.updated_at))}</span>
          </div>

          {(file.tags?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {(file.tags ?? []).map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: '0.625rem',
                    padding: '2px 8px',
                    background: 'var(--surface-hover)',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--text-dim)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {showRelated && (
            <RelatedItemsPanel links={linkedRecords} loading={linkedRecordsLoading} />
          )}

          <SimilarContentPanel sourceType="file" sourceId={file.id} />
          <GraphProximityPanel sourceType="file" sourceId={file.id} />

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <PreviewAction icon={Download} label="Download" onClick={() => { void downloadFile(file.id, file.is_directory ? `${file.filename}.zip` : file.filename); }} />
            {onDelete && (
              <PreviewAction icon={Trash2} label="Delete" onClick={() => onDelete(file.id)} variant="danger" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewAction({ icon: Icon, label, onClick, disabled, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
