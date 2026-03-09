// ─── Signatures List ─────────────────────────────────────────────────
// Lists DocuSeal signature submissions with status badges.

import { useEffect, useState } from 'react';
import { Loader2, FileText, Download, Eye, RefreshCw } from 'lucide-react';
import { useOfficeStore, type SignatureSubmission } from '@/stores/office.store';
import { SignatureStatus } from './SignatureStatus';

export function SignaturesList() {
  const { submissions, signatureLoading, fetchSubmissions, downloadSignedPdf } = useOfficeStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleDownload = async (id: number) => {
    setDownloading(id);
    try {
      await downloadSignedPdf(id);
    } catch { /* error handled in store */ }
    setDownloading(null);
  };

  if (selectedId) {
    const sub = submissions.find((s) => s.id === selectedId);
    if (sub) {
      return <SignatureStatus submission={sub} onBack={() => setSelectedId(null)} />;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', margin: 0 }}>Signature Requests</h3>
        <button
          onClick={() => fetchSubmissions()}
          disabled={signatureLoading}
          style={refreshBtnStyle}
        >
          <RefreshCw size={12} style={signatureLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
          Refresh
        </button>
      </div>

      {signatureLoading && submissions.length === 0 ? (
        <div style={emptyStyle}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div style={emptyStyle}>
          <FileText size={32} strokeWidth={1} />
          <span>No signature requests yet</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Send a document for signature from Drive or PDF Viewer
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {submissions.map((sub) => (
            <div
              key={sub.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              }}
            >
              <FileText size={18} style={{ color: 'var(--mod-office)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.source || `Submission #${sub.id}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {sub.submitters?.length || 0} signer{(sub.submitters?.length || 0) !== 1 ? 's' : ''}
                  {' · '}
                  {new Date(sub.created_at).toLocaleDateString()}
                </div>
              </div>
              <StatusBadge status={sub.status} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setSelectedId(sub.id)} style={actionBtnStyle} title="View details">
                  <Eye size={14} />
                </button>
                {sub.status === 'completed' && (
                  <button
                    onClick={() => handleDownload(sub.id)}
                    disabled={downloading === sub.id}
                    style={actionBtnStyle}
                    title="Download signed PDF"
                  >
                    {downloading === sub.id
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Download size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
    completed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    expired: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  };
  const c = colors[status] || colors.pending!;
  return (
    <span style={{
      padding: '2px 8px', fontSize: 11, fontWeight: 500,
      borderRadius: 'var(--radius-sm)', background: c.bg, color: c.text,
    }}>
      {status}
    </span>
  );
}

const emptyStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 8, padding: '48px 0',
  color: 'var(--text-dim)', fontSize: 14,
};

const refreshBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: 11, background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)', cursor: 'pointer',
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center', padding: 4,
};
