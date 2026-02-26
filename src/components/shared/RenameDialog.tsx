import { useEffect, useRef, useState } from 'react';

interface RenameDialogProps {
  open: boolean;
  currentName: string;
  title?: string;
  confirmLabel?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function RenameDialog({
  open,
  currentName,
  title = 'New name:',
  confirmLabel = 'Accept',
  onConfirm,
  onClose,
}: RenameDialogProps) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentName]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      onConfirm(trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          maxWidth: 400,
          width: '90vw',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          {title}
        </label>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg)',
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--amber)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-dim)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              border: 'none',
              background: 'var(--amber)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
