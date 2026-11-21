/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { useI18n } from '@/i18n';
import { useWebSocket } from '@/hooks/use-websocket';
import { useSecurityStore } from '@/stores/security.store';
import type { ApprovalDecision } from '@/services/approvals.service';
import type { ApprovalRequest } from '@/types/settings';

interface ApprovalInboxProps {
  embedded?: boolean;
  defaultTab?: 'pending' | 'history';
}

const RISK_STYLES: Record<string, { key: string; color: string }> = {
  low: { key: 'approvals.riskLow', color: '#22c55e' },
  medium: { key: 'approvals.riskMedium', color: '#f59e0b' },
  high: { key: 'approvals.riskHigh', color: '#f97316' },
  critical: { key: 'approvals.riskCritical', color: '#ef4444' },
};

const AUTHORITY_KEYS: Record<string, string> = {
  core_action: 'approvals.authorityCore', openclaw_exec: 'approvals.authorityHost',
  openclaw_plugin: 'approvals.authorityRuntime', runtime_native: 'approvals.authorityApproval',
  external_mcp: 'approvals.authorityMcp',
};

const STATUS_META: Record<string, { key: string; color: string; icon: typeof Clock }> = {
  pending: { key: 'approvals.statusPending', color: '#f59e0b', icon: Clock },
  approved: { key: 'approvals.statusAllowed', color: '#22c55e', icon: CheckCircle2 },
  rejected: { key: 'approvals.statusDenied', color: '#ef4444', icon: XCircle },
  expired: { key: 'approvals.statusExpired', color: '#6b7280', icon: Timer },
  resolved_elsewhere: { key: 'approvals.statusResolvedElsewhere', color: '#60a5fa', icon: CheckCircle2 },
  interrupted: { key: 'approvals.statusInterrupted', color: '#6b7280', icon: Timer },
  provider_removed: { key: 'approvals.statusProviderRemoved', color: '#6b7280', icon: Timer },
  blocked_by_policy: { key: 'approvals.statusBlocked', color: '#ef4444', icon: XCircle },
  executed: { key: 'approvals.statusExecuted', color: '#22c55e', icon: CheckCircle2 },
};

const PAGE_SIZE = 50;

function timeAgo(iso: string, t: ReturnType<typeof useI18n>['t'], locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t('approvals.unknownTime');
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return t('approvals.justNow');
  if (minutes < 60) return t('approvals.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('approvals.hoursAgo', { count: hours });
  return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
}

function expiryLabel(iso: string, t: ReturnType<typeof useI18n>['t']): string {
  const milliseconds = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return t('approvals.statusExpired');
  const minutes = Math.max(1, Math.floor(milliseconds / 60_000));
  if (minutes < 60) return t('approvals.minutesLeft', { count: minutes });
  const hours = Math.floor(minutes / 60);
  return t('approvals.hoursMinutesLeft', { hours, minutes: minutes % 60 });
}

function authorityLabel(authority: string, t: ReturnType<typeof useI18n>['t']): string {
  const key = AUTHORITY_KEYS[authority];
  return key ? t(key) : authority;
}

function authorityFor(approval: ApprovalRequest): ApprovalRequest['authority'] {
  if (approval.authority) return approval.authority;
  if (approval.source === 'openclaw_exec') return 'openclaw_exec';
  if (approval.source === 'openclaw_plugin') return 'openclaw_plugin';
  if (approval.source === 'runtime_native') return 'runtime_native';
  if (approval.source === 'external_mcp') return 'external_mcp';
  return 'core_action';
}

function decisionsFor(approval: ApprovalRequest, t: ReturnType<typeof useI18n>['t']): Array<{ decision: ApprovalDecision; label: string }> {
  const authority = authorityFor(approval);
  const offered = new Set(approval.allowed_decisions ?? []);
  const decisions: Array<{ decision: ApprovalDecision; label: string }> = [];

  // Core approvals predate `allowed_decisions`; their stable compatibility
  // contract is allow-once/deny. Provider-owned requests advertise choices.
  if (authority === 'core_action' || offered.has('allow-once')) {
    decisions.push({ decision: 'allow_once', label: t('approvals.allowOnce') });
  }
  if (offered.has('allow-always')) {
    decisions.push(authority === 'openclaw_exec'
      ? { decision: 'allow_persistent_rule', label: t('approvals.createPersistentRule') }
      : { decision: 'allow_session', label: t('approvals.allowSession') });
  }
  if (authority === 'core_action' || offered.has('deny')) {
    decisions.push({ decision: 'deny', label: t('approvals.deny') });
  }
  return decisions;
}

function presentationFacts(approval: ApprovalRequest, t: ReturnType<typeof useI18n>['t']): Array<[string, string]> {
  const facts: Array<[string, string]> = [];
  if (approval.subject_type) facts.push([t('approvals.subject'), approval.subject_type]);
  if (approval.subject_ref) facts.push([t('approvals.target'), approval.subject_ref]);
  const visibleKeys: Array<[string, string]> = [
    ['command', 'approvals.command'], ['cwd', 'approvals.workingDirectory'], ['target', 'approvals.target'],
    ['resource', 'approvals.resource'], ['scope', 'approvals.scope'], ['description', 'approvals.description'],
  ];
  for (const [key, labelKey] of visibleKeys) {
    const value = approval.presentation?.[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      facts.push([t(labelKey), String(value)]);
    }
  }
  return facts.slice(0, 5);
}

function DecisionDialog({
  approval,
  decision,
  loading,
  onClose,
  onConfirm,
}: {
  approval: ApprovalRequest | null;
  decision: ApprovalDecision | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (credential?: string) => void;
}) {
  const { t } = useI18n();
  const [credential, setCredential] = useState('');
  const requiresCredential = Boolean(
    approval && decision !== 'deny' && (approval.core_level === 3 || approval.level === 3),
  );
  const isPersistent = decision === 'allow_persistent_rule';
  const open = Boolean(approval && decision && (requiresCredential || isPersistent));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !loading) onClose(); }}>
      <DialogContent aria-describedby="approval-decision-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--text)]">
            <KeyRound size={18} className="text-[var(--amber)]" />
            {isPersistent ? t('approvals.confirmPersistentTitle') : t('approvals.confirmProtectedTitle')}
          </DialogTitle>
          <DialogDescription id="approval-decision-description">
            {isPersistent
              ? t('approvals.persistentDescription')
              : t('approvals.credentialDescription')}
          </DialogDescription>
        </DialogHeader>
        {approval && (
          <div className="my-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">
            <div className="font-medium">{approval.summary}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {authorityLabel(authorityFor(approval), t)}
            </div>
          </div>
        )}
        {requiresCredential && (
          <label className="block text-xs font-medium text-[var(--text-dim)]">
            {t('approvals.pinPassword')}
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && credential && !loading) onConfirm(credential);
              }}
              className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--amber)]"
            />
          </label>
        )}
        <DialogFooter className="mt-5 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('approvals.cancel')}</Button>
          <Button
            type="button"
            onClick={() => onConfirm(requiresCredential ? credential : undefined)}
            disabled={loading || (requiresCredential && !credential)}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {t('approvals.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalCard({
  approval,
  resolving,
  onDecision,
}: {
  approval: ApprovalRequest;
  resolving: boolean;
  onDecision: (approval: ApprovalRequest, decision: ApprovalDecision) => void;
}) {
  const { t, locale } = useI18n();
  const risk = RISK_STYLES[approval.risk] ?? RISK_STYLES.medium!;
  const authority = authorityFor(approval);
  const facts = presentationFacts(approval, t);

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby={`approval-${approval.id}`}>
      <div className="flex flex-wrap items-start gap-2">
        <ShieldCheck size={18} style={{ color: risk.color }} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 id={`approval-${approval.id}`} className="m-0 text-sm font-semibold text-[var(--text)]">
            {approval.summary}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{approval.operation}</p>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ color: risk.color, borderColor: `${risk.color}66`, background: `${risk.color}12` }}
        >
          {t(risk.key)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>{authorityLabel(authority, t)}</span>
        <span>{t('approvals.requestedBy', { name: approval.requested_by })}</span>
        <span>{timeAgo(approval.created_at, t, locale)}</span>
        <span className="text-[var(--amber)]">{expiryLabel(approval.expires_at, t)}</span>
      </div>

      {facts.length > 0 && (
        <dl className="mt-3 grid gap-2 rounded-[var(--radius-sm)] bg-[var(--card)] p-3 text-xs sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={`${label}-${value}`} className="min-w-0">
              <dt className="text-[var(--text-muted)]">{label}</dt>
              <dd className="m-0 mt-0.5 break-words font-mono text-[var(--text-dim)]">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {decisionsFor(approval, t).map(({ decision, label }) => (
          <Button
            key={decision}
            type="button"
            size="sm"
            variant={decision === 'deny' ? 'outline' : decision === 'allow_once' ? 'default' : 'secondary'}
            className={decision === 'deny' ? 'text-[var(--error)]' : undefined}
            disabled={resolving}
            onClick={() => onDecision(approval, decision)}
          >
            {resolving && <Loader2 size={13} className="animate-spin" />}
            {label}
          </Button>
        ))}
      </div>
    </article>
  );
}

function HistoryRow({ approval }: { approval: ApprovalRequest }) {
  const { t, locale } = useI18n();
  const status = STATUS_META[approval.status];
  const Icon = status?.icon ?? Timer;
  const resolution = status ? t(status.key) : (approval.resolution?.replaceAll('_', ' ') ?? approval.status);
  return (
    <div className="flex items-start gap-3 border-b border-[var(--border)] py-3 last:border-0">
      <Icon size={16} style={{ color: status?.color ?? '#6b7280' }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-[var(--text)]">{approval.summary}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--text-muted)]">
          <span>{authorityLabel(authorityFor(approval), t)}</span>
          <span>{approval.requested_by}</span>
          <span>{timeAgo(approval.created_at, t, locale)}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs capitalize" style={{ color: status?.color ?? '#6b7280' }}>{resolution}</span>
    </div>
  );
}

export function ApprovalInbox({ embedded = false, defaultTab = 'pending' }: ApprovalInboxProps) {
  const { t } = useI18n();
  const approvals = useSecurityStore((state) => state.approvals);
  const history = useSecurityStore((state) => state.approvalHistory);
  const loading = useSecurityStore((state) => state.approvalsLoading);
  const error = useSecurityStore((state) => state.approvalsError);
  const approvalTotal = useSecurityStore((state) => state.approvalTotal);
  const historyTotal = useSecurityStore((state) => state.historyTotal);
  const fetchApprovals = useSecurityStore((state) => state.fetchApprovals);
  const fetchHistory = useSecurityStore((state) => state.fetchApprovalHistory);
  const resolveApproval = useSecurityStore((state) => state.resolveApproval);
  const [tab, setTab] = useState<'pending' | 'history'>(defaultTab);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [dialogApproval, setDialogApproval] = useState<ApprovalRequest | null>(null);
  const [dialogDecision, setDialogDecision] = useState<ApprovalDecision | null>(null);
  const [pendingOffset, setPendingOffset] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const approvalEvent = useWebSocket('approval.*');

  const pending = useMemo(() => approvals.filter((approval) => approval.status === 'pending'), [approvals]);
  const historyItems = useMemo(
    () => history.filter((approval) => approval.status !== 'pending'),
    [history],
  );

  const load = useCallback(() => tab === 'pending'
    ? fetchApprovals('pending', PAGE_SIZE, pendingOffset)
    : fetchHistory(PAGE_SIZE, historyOffset), [fetchApprovals, fetchHistory, historyOffset, pendingOffset, tab]);

  useEffect(() => {
    void load();
    if (tab !== 'pending') return;
    // WebSocket events refresh immediately (effect below). Polling remains a
    // bounded recovery path for dropped frames and reconnects.
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [load, tab]);

  useEffect(() => {
    if (!approvalEvent) return;
    void load();
  }, [approvalEvent, load]);

  const runDecision = async (
    approval: ApprovalRequest,
    decision: ApprovalDecision,
    credential?: string,
  ) => {
    setResolvingId(approval.id);
    try {
      await resolveApproval(approval.id, decision, credential);
      toast.success(decision === 'deny' ? t('approvals.approvalDenied') : t('approvals.approvalResolved'));
      setDialogApproval(null);
      setDialogDecision(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('approvals.resolveFailed'));
    } finally {
      setResolvingId(null);
    }
  };

  const requestDecision = (approval: ApprovalRequest, decision: ApprovalDecision) => {
    const requiresCredential = decision !== 'deny' && (approval.core_level === 3 || approval.level === 3);
    if (requiresCredential || decision === 'allow_persistent_rule') {
      setDialogApproval(approval);
      setDialogDecision(decision);
      return;
    }
    void runDecision(approval, decision);
  };

  const activeOffset = tab === 'pending' ? pendingOffset : historyOffset;
  const activeTotal = tab === 'pending' ? approvalTotal : historyTotal;
  const activeItems = tab === 'pending' ? pending : historyItems;
  const pageStart = activeTotal === 0 ? 0 : activeOffset + 1;
  const pageEnd = Math.min(activeOffset + activeItems.length, activeTotal);
  const setActiveOffset = (next: number) => {
    const normalized = Math.max(0, next);
    if (tab === 'pending') setPendingOffset(normalized);
    else setHistoryOffset(normalized);
  };

  return (
    <section
      className={embedded ? '' : 'flex h-full flex-col overflow-hidden'}
      aria-labelledby={embedded ? undefined : 'approval-inbox-title'}
      aria-label={embedded ? t('approvals.title') : undefined}
      aria-busy={loading && pending.length === 0 && history.length === 0}
    >
      {!embedded && (
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-6 py-4">
          <ShieldCheck size={20} className="text-[var(--amber)]" />
          <h1 id="approval-inbox-title" className="m-0 text-lg font-semibold text-[var(--text)]">{t('approvals.title')}</h1>
          {approvalTotal > 0 && (
            <span className="rounded-full bg-[var(--amber)] px-2 py-0.5 text-xs font-semibold text-[#06060a]">{approvalTotal}</span>
          )}
        </header>
      )}

      <div className="flex shrink-0 items-center border-b border-[var(--border)]" role="tablist" aria-label={t('approvals.views')}>
        {(['pending', 'history'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`approvals-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`approvals-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            className={`h-10 flex-1 border-0 border-b-2 bg-transparent px-4 text-sm transition-colors ${
              tab === value
                ? 'border-[var(--amber)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
          >
            {value === 'pending' ? t('approvals.pending', { count: approvalTotal }) : t('approvals.history')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          aria-label={t('approvals.refresh')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div
        id={`approvals-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`approvals-tab-${tab}`}
        className={embedded ? 'pt-4' : 'flex-1 overflow-y-auto p-4 sm:px-6'}
      >
        {error && (
          <RetryBanner severity="error" title={t('approvals.unavailable')} message={error} onRetry={() => void load()} loading={loading} />
        )}

        {loading && (tab === 'pending' ? pending.length === 0 : history.length === 0) ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin" /> {t('approvals.loading')}
          </div>
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-[var(--text-muted)]">
              <ShieldCheck size={42} strokeWidth={1.2} />
              <div>{t('approvals.nonePending')}</div>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {pending.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  resolving={resolvingId === approval.id}
                  onDecision={requestDecision}
                />
              ))}
            </div>
          )
        ) : historyItems.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-[var(--text-muted)]">
            <Clock size={42} strokeWidth={1.2} />
              <div>{t('approvals.noneHistory')}</div>
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4">
            {historyItems.map((approval) => <HistoryRow key={approval.id} approval={approval} />)}
          </div>
        )}

        {!error && pending.some((approval) => decisionsFor(approval, t).length === 0) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--amber)]">
            <AlertTriangle size={13} /> {t('approvals.providerWarning')}
          </div>
        )}

        {!error && activeTotal > 0 && (
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3" aria-label={tab === 'pending' ? t('approvals.pendingPages') : t('approvals.historyPages')}>
            <span className="text-xs text-[var(--text-muted)]" aria-live="polite">
              {t('approvals.showing', { start: pageStart, end: pageEnd, total: activeTotal })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveOffset(activeOffset - PAGE_SIZE)}
                disabled={loading || activeOffset === 0}
              >
                {t('approvals.previous')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveOffset(activeOffset + PAGE_SIZE)}
                disabled={loading || activeOffset + activeItems.length >= activeTotal}
              >
                {t('approvals.next')}
              </Button>
            </div>
          </nav>
        )}
      </div>

      <DecisionDialog
        key={dialogApproval?.id ?? 'closed'}
        approval={dialogApproval}
        decision={dialogDecision}
        loading={Boolean(resolvingId)}
        onClose={() => { setDialogApproval(null); setDialogDecision(null); }}
        onConfirm={(credential) => {
          if (dialogApproval && dialogDecision) void runDecision(dialogApproval, dialogDecision, credential);
        }}
      />
    </section>
  );
}
