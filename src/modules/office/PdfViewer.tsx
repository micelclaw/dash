// ─── PDF Viewer ──────────────────────────────────────────────────────
// Lightweight PDF viewer using an iframe with blob URL for auth.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Loader2, AlertTriangle, Wrench, PenTool } from 'lucide-react';
import { SignatureDialog } from './SignatureDialog';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7200';
const API_PREFIX = '/api/v1';

async function fetchWithAuth(path: string): Promise<Response> {
  const url = `${API_BASE}${API_PREFIX}${path}`;
  const token = useAuthStore.getState().tokens?.accessToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(url, { headers });

  if (res.status === 401) {
    try {
      await useAuthStore.getState().refresh();
      const newToken = useAuthStore.getState().tokens?.accessToken;
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { headers });
    } catch {
      throw new Error('Session expired');
    }
  }

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res;
}

interface FileInfo {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export function Component() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<FileInfo | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;

    (async () => {
      try {
        // Fetch file metadata
        const res = await api.get<{ data: FileInfo }>(`/files/${fileId}`);
        if (cancelled) return;
        setFile(res.data);

        // Fetch the binary PDF with auth + token refresh
        const resp = await fetchWithAuth(`/files/${fileId}/download`);
        if (cancelled) return;

        const arrayBuf = await resp.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [fileId]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Loading PDF...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !file || !blobUrl) {
    return (
      <div style={centerStyle}>
        <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
        <span style={{ fontSize: 14 }}>Failed to load PDF</span>
        {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
        <button onClick={() => navigate('/office')} style={btnStyle}>Back to Office</button>
      </div>
    );
  }

  const handleDownload = async () => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.filename;
    a.click();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ─── Toolbar ──────────────────────────────────── */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        padding: '0 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', gap: 8, fontSize: 12,
        color: 'var(--text-dim)', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/office')} style={iconBtnStyle} title="Back">
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
          {file.filename}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleDownload} style={iconBtnStyle} title="Download">
          <Download size={14} />
        </button>
        <button onClick={() => setSignOpen(true)} style={signBtn} title="Firmar con DocuSeal">
          <PenTool size={14} />
          <span>Firmar con DocuSeal</span>
        </button>
        <button onClick={() => navigate('/office/pdf/tools')} style={iconBtnStyle} title="Open in PDF Tools">
          <Wrench size={14} />
        </button>
      </div>

      {/* ─── Signature dialog ────────────────────────── */}
      <SignatureDialog fileId={fileId!} filename={file.filename} open={signOpen} onClose={() => setSignOpen(false)} />

      {/* ─── PDF embed ────────────────────────────────── */}
      <object
        data={`${blobUrl}#toolbar=1`}
        type="application/pdf"
        title={file.filename}
        style={{ flex: 1, border: 'none', background: '#525659' }}
      >
        <embed
          src={`${blobUrl}#toolbar=1`}
          type="application/pdf"
          style={{ width: '100%', height: '100%' }}
        />
      </object>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 12, color: 'var(--text-dim)', background: 'var(--bg)',
};

const btnStyle: React.CSSProperties = {
  marginTop: 8, padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
};

const signBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '4px 12px',
  background: '#7c3aed',
  border: 'none', borderRadius: 'var(--radius-md)',
  color: '#fff', cursor: 'pointer', fontSize: 12,
  fontWeight: 500, whiteSpace: 'nowrap',
};
