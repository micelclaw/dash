// ─── Signature Status ────────────────────────────────────────────────
// Detail view for a single DocuSeal submission with per-signer status.

import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react';
import { useState } from 'react';
import type { SignatureSubmission } from '@/stores/office.store';
import { useOfficeStore } from '@/stores/office.store';

interface SignatureStatusProps {
  submission: SignatureSubmission;
  onBack: () => void;
}

export function SignatureStatus({ submission, onBack }: SignatureStatusProps) {
  const { downloadSignedPdf } = useOfficeStore();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSignedPdf(submission.id);
    } catch { /* handled */ }
    setDownloading(false);
  };

  const allCompleted = submission.submitters?.every((s) => s.status === 'completed');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={16} /></button>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {submission.source || `Submission #${submission.id}`}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Created {new Date(submission.created_at).toLocaleString()}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <OverallBadge status={submission.status} />
      </div>

      {/* Signers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {submission.submitters?.map((signer) => (
          <div
            key={signer.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            }}
          >
            <SignerIcon status={signer.status} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                {signer.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {signer.email}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <SignerStatusBadge status={signer.status} />
              {signer.completed_at && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(signer.completed_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Download button */}
      {allCompleted && (
        <button onClick={handleDownload} disabled={downloading} style={downloadBtnStyle}>
          {downloading
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Download size={14} />}
          Download Signed PDF
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SignerIcon({ status }: { status: string }) {
  const color = status === 'completed' ? '#22c55e' : status === 'declined' ? '#ef4444' : 'var(--text-muted)';
  return <FileText size={16} style={{ color, flexShrink: 0 }} />;
}

function OverallBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Pending' },
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Completed' },
    expired: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Expired' },
  };
  const c = map[status] || map.pending!;
  return (
    <span style={{
      padding: '4px 12px', fontSize: 12, fontWeight: 500,
      borderRadius: 'var(--radius-md)', background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

function SignerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: string; color: string }> = {
    pending: { icon: '\u23f3', color: 'var(--text-muted)' },
    sent: { icon: '\u2709\ufe0f', color: '#3b82f6' },
    opened: { icon: '\ud83d\udc41\ufe0f', color: '#8b5cf6' },
    completed: { icon: '\u2705', color: '#22c55e' },
    declined: { icon: '\u274c', color: '#ef4444' },
  };
  const c = map[status] || map.pending!;
  return (
    <span style={{ fontSize: 12, color: c.color }}>
      {c.icon} {status}
    </span>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center', padding: 4,
};

const downloadBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 20px', fontSize: 13, fontWeight: 500,
  background: 'var(--mod-office)', border: 'none',
  borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
};
