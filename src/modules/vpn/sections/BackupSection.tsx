import { useState, useRef } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface BackupSectionProps {
  onExport: () => Promise<string | null>;
  onImport: (content: string) => Promise<void>;
}

export function BackupSection({ onExport, onImport }: BackupSectionProps) {
  const [configPreview, setConfigPreview] = useState<string | null>(null);
  const [importContent, setImportContent] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    const config = await onExport();
    if (config) {
      setConfigPreview(config);
    }
    setExporting(false);
  };

  const handleDownload = () => {
    if (!configPreview) return;
    const blob = new Blob([configPreview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wg0-${new Date().toISOString().slice(0, 10)}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportContent(reader.result as string);
      setConfirmImport(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setConfirmImport(false);
    if (importContent) {
      await onImport(importContent);
      setImportContent(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
        Backup & Restore
      </h2>

      {/* Export */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        padding: 16,
        marginBottom: 20,
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>
          Export Configuration
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px', fontFamily: 'var(--font-sans)' }}>
          Download the current WireGuard server configuration file (wg0.conf).
        </p>

        {!configPreview ? (
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              height: 34, padding: '0 16px',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <FileText size={14} />
            {exporting ? 'Loading...' : 'Preview Config'}
          </button>
        ) : (
          <>
            <pre style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: 12,
              fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem',
              color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
              maxHeight: 300, overflow: 'auto', margin: '0 0 10px',
            }}>
              {configPreview}
            </pre>
            <button
              onClick={handleDownload}
              style={{
                height: 34, padding: '0 16px',
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--amber)', color: '#06060a',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <Download size={14} /> Download wg0.conf
            </button>
          </>
        )}
      </div>

      {/* Import */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        padding: 16,
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>
          Import Configuration
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px', fontFamily: 'var(--font-sans)' }}>
          Upload a WireGuard configuration file to replace the current server config. This will restart the VPN interface.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".conf,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', height: 80,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--bg)',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Upload size={20} />
          <span>Click to upload .conf file</span>
        </button>
      </div>

      {/* Import Confirmation */}
      <ConfirmDialog
        open={confirmImport}
        onClose={() => { setConfirmImport(false); setImportContent(null); }}
        onConfirm={handleImportConfirm}
        title="Import Configuration?"
        description="This will replace the current WireGuard configuration and restart the VPN interface. All connected peers will be temporarily disconnected."
        confirmLabel="Import & Restart"
        variant="danger"
      />
    </div>
  );
}
