import { useState, useRef, type ReactNode } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  disabled?: boolean;
  children: ReactNode;
}

export function DropZone({ onFilesDropped, disabled, children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const counterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    counterRef.current++;
    if (counterRef.current === 1) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current--;
    if (counterRef.current === 0) setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current = 0;
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative', flex: 1, minHeight: 0 }}
    >
      {children}
      {dragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(212, 160, 23, 0.1)',
            border: '2px dashed var(--amber)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Upload size={32} style={{ color: 'var(--amber)' }} />
          <span style={{ color: 'var(--amber)', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            Drop files here to upload
          </span>
        </div>
      )}
    </div>
  );
}
