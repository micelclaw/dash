import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

const VARIANT_COLORS: Record<string, string> = {
  danger: 'var(--error)',
  warning: 'var(--warning)',
  default: 'var(--amber)',
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  const confirmColor = VARIANT_COLORS[variant] ?? 'var(--amber)';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent style={{ maxWidth: 400 }}>
        <div>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription style={{ marginTop: 8 }}>{description}</DialogDescription>}
        </div>
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
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              border: 'none',
              background: confirmColor,
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
