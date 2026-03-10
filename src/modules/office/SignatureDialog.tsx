// ─── Signature Dialog ────────────────────────────────────────────────
// Modal for sending a document for digital signature via DocuSeal.

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { useOfficeStore } from '@/stores/office.store';

interface SignatureDialogProps {
  fileId: string;
  filename: string;
  open: boolean;
  onClose: () => void;
}

interface SignerEntry {
  name: string;
  email: string;
}

export function SignatureDialog({ fileId, filename, open, onClose }: SignatureDialogProps) {
  const [signers, setSigners] = useState<SignerEntry[]>([{ name: '', email: '' }]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { sendForSignature, signatureLoading } = useOfficeStore();

  const addSigner = useCallback(() => {
    setSigners((prev) => [...prev, { name: '', email: '' }]);
  }, []);

  const removeSigner = useCallback((index: number) => {
    setSigners((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSigner = useCallback((index: number, field: 'name' | 'email', value: string) => {
    setSigners((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  const handleSend = useCallback(async () => {
    setError(null);

    const validSigners = signers.filter((s) => s.name.trim() && s.email.trim());
    if (validSigners.length === 0) {
      setError('Add at least one signer with name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmail = validSigners.find((s) => !emailRegex.test(s.email));
    if (invalidEmail) {
      setError(`Invalid email: ${invalidEmail.email}`);
      return;
    }

    try {
      await sendForSignature(fileId, validSigners, message || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for signature');
    }
  }, [fileId, signers, message, sendForSignature]);

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={backdropStyle} />
      <div style={dialogStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Send for Signature</h3>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>

        {success ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#9989;</div>
            <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Document sent for signature!</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signers will receive an email with the signing link.</p>
            <button onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 16 }}>Close</button>
          </div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* File info */}
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Document: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{filename}</span>
            </div>

            {/* Signers */}
            <div>
              <label style={labelStyle}>Signers</label>
              {signers.map((signer, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Name"
                    value={signer.name}
                    onChange={(e) => updateSigner(i, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={signer.email}
                    onChange={(e) => updateSigner(i, 'email', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {signers.length > 1 && (
                    <button onClick={() => removeSigner(i)} style={iconBtnStyle} title="Remove signer">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addSigner} style={addBtnStyle}>
                <Plus size={12} /> Add signer
              </button>
            </div>

            {/* Message */}
            <div>
              <label style={labelStyle}>Message (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please review and sign this document."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', padding: '8px 12px', background: 'var(--error-bg, rgba(239,68,68,0.1))', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
              <button onClick={handleSend} disabled={signatureLoading} style={primaryBtnStyle}>
                {signatureLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                Send
              </button>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>,
    document.body,
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
};

const dialogStyle: React.CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  zIndex: 1001, width: '100%', maxWidth: 520,
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center', padding: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--text-dim)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)',
  fontFamily: 'var(--font-sans)', outline: 'none',
};

const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: 12, color: 'var(--mod-office)',
  background: 'none', border: '1px dashed var(--border)',
  borderRadius: 'var(--radius-md)', cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 20px', fontSize: 13, fontWeight: 500,
  background: 'var(--mod-office)', border: 'none',
  borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
};
