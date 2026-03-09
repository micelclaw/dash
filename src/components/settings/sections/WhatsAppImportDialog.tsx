import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface WhatsAppImportDialogProps {
  onClose: () => void;
  onImported: () => void;
}

interface PreviewResult {
  message_count: number;
  participants: string[];
  chat_name: string;
  date_range: { earliest: string; latest: string } | null;
}

type Step = 'pick' | 'preview' | 'importing' | 'done';

export function WhatsAppImportDialog({ onClose, onImported }: WhatsAppImportDialogProps) {
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [imported, setImported] = useState(0);
  const [ownName, setOwnName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (ownName) formData.append('own_name', ownName);

      const res = await api.upload<{ data: PreviewResult }>(
        '/sync/import/whatsapp?preview=true',
        formData,
      );
      setPreview(res.data);
      setStep('preview');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStep('importing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (ownName) formData.append('own_name', ownName);

      const res = await api.upload<{ data: { imported: number } }>(
        '/sync/import/whatsapp?commit=true',
        formData,
      );
      setImported(res.data.imported ?? 0);
      setStep('done');
      toast.success(`Imported ${res.data.imported ?? 0} messages`);
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
      setStep('preview');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxHeight: '80vh',
        background: 'rgba(17, 17, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Import WhatsApp Chat
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
          {step === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Export a WhatsApp chat (without media), then upload the .txt file here.
              </div>

              {/* Own name input */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  Your name in the chat (optional, for direction detection)
                </label>
                <input
                  type="text"
                  value={ownName}
                  onChange={e => setOwnName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Drop zone */}
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '32px 16px',
                  background: 'var(--surface)',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <Upload size={24} />
                <span>Click to select .txt file</span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".txt,.zip"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          )}

          {step === 'preview' && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
              }}>
                <FileText size={16} />
                {file?.name}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                <StatCard label="Messages" value={preview.message_count} />
                <StatCard label="Participants" value={preview.participants.length} />
              </div>

              {preview.date_range && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(preview.date_range.earliest).toLocaleDateString()} — {new Date(preview.date_range.latest).toLocaleDateString()}
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Chat: {preview.chat_name}
              </div>

              {preview.participants.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Participants: {preview.participants.join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setStep('pick'); setFile(null); setPreview(null); }}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-dim)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'var(--amber)', border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: '#000', cursor: 'pointer', fontWeight: 600,
                    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  }}
                >
                  Import {preview.message_count} messages
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '40px 0',
            }}>
              <Loader2 size={32} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Importing messages...
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '40px 0',
            }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {imported} messages imported successfully
              </div>
              <button
                onClick={onImported}
                style={{
                  padding: '8px 20px',
                  background: 'var(--amber)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#000', cursor: 'pointer', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
