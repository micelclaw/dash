import { useEffect, useState } from 'react';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useSecurityStore } from '@/stores/security.store';
import type { ApprovalRequest } from '@/types/settings';

// ─── Helpers ─────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m left`;
}

const LEVEL_LABELS: Record<number, { text: string; color: string }> = {
  0: { text: 'Auto', color: '#6b7280' },
  1: { text: 'Logged', color: '#3b82f6' },
  2: { text: 'Confirm', color: '#f59e0b' },
  3: { text: 'Secure', color: '#ef4444' },
};

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  approved: { icon: CheckCircle2, color: '#22c55e' },
  rejected: { icon: XCircle, color: '#ef4444' },
  expired: { icon: Timer, color: '#6b7280' },
  pending: { icon: Clock, color: '#f59e0b' },
};

// ─── PIN Verify Modal ────────────────────────────────────

function PinVerifyModal({ onConfirm, onCancel }: { onConfirm: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 340, width: '90%' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
          PIN Verification
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
          This Level 3 operation requires your security PIN.
        </div>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && pin.length >= 4) onConfirm(pin); }}
          style={{ width: '100%', height: 36, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '1.125rem', fontFamily: 'var(--font-sans)', outline: 'none', letterSpacing: 6, textAlign: 'center', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ height: 32, padding: '0 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => pin.length >= 4 && onConfirm(pin)}
            disabled={pin.length < 4}
            style={{ height: 32, padding: '0 16px', background: pin.length >= 4 ? 'var(--amber)' : 'var(--surface)', color: pin.length >= 4 ? '#06060a' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: pin.length >= 4 ? 'pointer' : 'not-allowed' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Card ───────────────────────────────────────

function ApprovalCard({ approval, onApprove, onReject }: {
  approval: ApprovalRequest;
  onApprove: (id: string, level: number) => void;
  onReject: (id: string) => void;
}) {
  const levelInfo = LEVEL_LABELS[approval.level] || LEVEL_LABELS[2];

  return (
    <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ShieldCheck size={16} color={levelInfo.color} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', flex: 1 }}>
          {approval.summary}
        </span>
        <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: `${levelInfo.color}20`, color: levelInfo.color, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          L{approval.level} {levelInfo.text}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 12 }}>
        <span>By: {approval.requested_by}</span>
        <span>{timeAgo(approval.created_at)}</span>
        <span style={{ color: '#f59e0b' }}>{expiresIn(approval.expires_at)}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onApprove(approval.id, approval.level)}
          style={{ height: 30, padding: '0 16px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
        >
          Approve
        </button>
        <button
          onClick={() => onReject(approval.id)}
          style={{ height: 30, padding: '0 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── History Row ─────────────────────────────────────────

function HistoryRow({ approval }: { approval: ApprovalRequest }) {
  const statusInfo = STATUS_ICONS[approval.status] || STATUS_ICONS.pending;
  const Icon = statusInfo.icon;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <Icon size={16} color={statusInfo.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {approval.summary}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
          {approval.requested_by} &middot; {timeAgo(approval.created_at)}
        </div>
      </div>
      <span style={{ fontSize: '0.6875rem', color: statusInfo.color, fontWeight: 500, fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}>
        {approval.status}
      </span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export function Component() {
  const approvals = useSecurityStore((s) => s.approvals);
  const fetchApprovals = useSecurityStore((s) => s.fetchApprovals);
  const approveApproval = useSecurityStore((s) => s.approveApproval);
  const rejectApproval = useSecurityStore((s) => s.rejectApproval);

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [history, setHistory] = useState<ApprovalRequest[]>([]);
  const [pinModalId, setPinModalId] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals('pending');
    const iv = setInterval(() => fetchApprovals('pending'), 15000);
    return () => clearInterval(iv);
  }, [fetchApprovals]);

  useEffect(() => {
    if (tab === 'history') {
      fetchApprovals().then(() => {
        setHistory(useSecurityStore.getState().approvals);
      });
    }
  }, [tab, fetchApprovals]);

  const handleApprove = async (id: string, level: number) => {
    if (level === 3) {
      setPinModalId(id);
      return;
    }
    try {
      await approveApproval(id);
      toast.success('Approval granted');
    } catch {
      toast.error('Failed to approve');
    }
  };

  const handlePinConfirm = async (pin: string) => {
    if (!pinModalId) return;
    try {
      await approveApproval(pinModalId, pin);
      toast.success('Approval granted (PIN verified)');
      setPinModalId(null);
    } catch {
      toast.error('Failed to approve — check your PIN');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectApproval(id);
      toast.success('Approval rejected');
    } catch {
      toast.error('Failed to reject');
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <ShieldCheck size={20} color="var(--amber)" />
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Approvals
        </h1>
        {pendingApprovals.length > 0 && (
          <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 10, background: 'var(--amber)', color: '#06060a', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            {pendingApprovals.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['pending', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, height: 40, background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid var(--amber)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {t === 'pending' ? `Pending (${pendingApprovals.length})` : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {tab === 'pending' ? (
          pendingApprovals.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <ShieldCheck size={48} strokeWidth={1} />
              <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>No pending approvals</div>
            </div>
          ) : (
            pendingApprovals.map((a) => (
              <ApprovalCard
                key={a.id}
                approval={a}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )
        ) : (
          history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <Clock size={48} strokeWidth={1} />
              <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>No approval history</div>
            </div>
          ) : (
            history.map((a) => <HistoryRow key={a.id} approval={a} />)
          )
        )}
      </div>

      {/* PIN Modal */}
      {pinModalId && (
        <PinVerifyModal
          onConfirm={handlePinConfirm}
          onCancel={() => setPinModalId(null)}
        />
      )}
    </div>
  );
}
