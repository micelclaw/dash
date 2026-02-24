import { useState, useEffect } from 'react';
import { ArrowLeft, Shield, ShieldAlert, Download, Power, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getApp, scanApp, exportApp, updateAppStatus, uninstallApp,
} from '@/services/apps.service';
import { useAppsStore } from '@/stores/apps.store';
import type { InstalledApp, ScanResult, AppManifest, AppRuntimeStatus } from '@/types/apps';

interface AppDetailProps {
  app: InstalledApp;
  onBack: () => void;
  onRefresh: () => void;
}

type DetailTab = 'readme' | 'skill' | 'scan';

const LEVEL_STYLES: Record<string, { border: string; color: string }> = {
  '1': { border: 'var(--text-dim)', color: 'var(--text-dim)' },
  '2': { border: '#3b82f6', color: '#3b82f6' },
  '3': { border: '#a855f7', color: '#a855f7' },
};

export function AppDetail({ app, onBack, onRefresh }: AppDetailProps) {
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);

  const [activeTab, setActiveTab] = useState<DetailTab>('readme');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manifest, setManifest] = useState<AppManifest>(app.manifest);
  const [runtime, setRuntime] = useState<AppRuntimeStatus | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [purgeDialog, setPurgeDialog] = useState(false);

  // Fetch full detail
  useEffect(() => {
    getApp(app.appName)
      .then((detail) => {
        setManifest(detail.manifest);
        setRuntime(detail.runtime);
      })
      .catch(() => { /* use existing manifest */ });
  }, [app.appName]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanApp(app.appName);
      setScanResult(result);
      setActiveTab('scan');
    } catch {
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportApp(app.appName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.appName}-${app.version}.claw`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAppStatus(app.appName, newStatus);
      if (app.appLevel === 1) {
        setRestartRequired('openclaw', `${app.appName} was ${newStatus}`);
      }
      onRefresh();
      toast.success(`App ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleUninstall = async () => {
    try {
      const result = await uninstallApp(app.appName);
      if (result.requires_restart) {
        setRestartRequired(
          app.appLevel === 1 ? 'openclaw' : 'core',
          `${app.appName} was uninstalled`,
        );
      }
      toast.success('App archived');
      onBack();
      onRefresh();
    } catch {
      toast.error('Failed to uninstall');
    }
    setDeleteDialog(false);
  };

  const handlePurge = async () => {
    try {
      await uninstallApp(app.appName, true);
      toast.success('App permanently deleted');
      onBack();
      onRefresh();
    } catch {
      toast.error('Failed to purge');
    }
    setPurgeDialog(false);
  };

  const levelStyle = LEVEL_STYLES[String(app.appLevel)] ?? LEVEL_STYLES['1'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 2, display: 'flex',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 18 }}>{manifest?.ui?.module?.icon || '📦'}</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
            {manifest?.name || app.appName}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: levelStyle.border, color: levelStyle.color }}
          >
            L{app.appLevel}
          </Badge>
        </div>

        {/* Meta */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {manifest?.author && <span>Author: {manifest.author}</span>}
          <span>·</span>
          <span>v{app.version}</span>
          {manifest?.tier_required === 'pro' && (
            <>
              <span>·</span>
              <Badge className="text-[10px] px-1.5 py-0">Pro</Badge>
            </>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {manifest?.permissions?.slice(0, 6).map((perm) => (
            <Badge key={perm} variant="secondary" className="text-[10px] px-1.5 py-0">
              {perm}
            </Badge>
          ))}
          {app.source === 'adapted' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: '#14b8a6', color: '#14b8a6' }}>
              Adapted
            </Badge>
          )}
          {app.source === 'clawhub' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
              <Shield size={8} style={{ marginRight: 2 }} /> Verified
            </Badge>
          )}
          {app.source === 'local' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <ShieldAlert size={8} style={{ marginRight: 2 }} /> Community
            </Badge>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {(['readme', 'skill', 'scan'] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === 'scan' && !scanResult) handleScan();
              else setActiveTab(t);
            }}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === t ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === t ? 'var(--text)' : 'var(--text-dim)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: activeTab === t ? 500 : 400,
            }}
          >
            {t === 'readme' && 'README'}
            {t === 'skill' && 'SKILL.md'}
            {t === 'scan' && (scanning ? 'Scanning…' : 'Scan Results')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        <div style={{ padding: 16 }}>
          {activeTab === 'readme' && (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {manifest?.description || `# ${manifest?.name || app.appName}\n\nNo README available.`}
              </ReactMarkdown>
            </div>
          )}

          {activeTab === 'skill' && (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {manifest?.skill
                  ? `Skill file: \`${manifest.skill}\`\n\n_SKILL.md content is loaded at runtime by OpenClaw._`
                  : '_No skill file defined in manifest._'}
              </ReactMarkdown>
            </div>
          )}

          {activeTab === 'scan' && scanResult && (
            <ScanResultsView result={scanResult} />
          )}
        </div>

        {/* Permissions section */}
        {manifest?.permissions && manifest.permissions.length > 0 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
          }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Required Permissions
            </h4>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {manifest.permissions.map((p) => (
                <span key={p} style={{
                  fontSize: '0.6875rem', padding: '2px 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)', color: 'var(--text-dim)',
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Runtime status */}
        {runtime && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            fontSize: '0.6875rem', color: 'var(--text-dim)',
            display: 'flex', gap: 12,
          }}>
            <span>Status: <strong style={{ color: runtime.status === 'loaded' ? 'var(--success)' : 'var(--error)' }}>{runtime.status}</strong></span>
            <span>Routes: {runtime.routesRegistered}</span>
            <span>Tables: {runtime.tablesCreated}</span>
            {runtime.containersRunning !== undefined && <span>Containers: {runtime.containersRunning}</span>}
          </div>
        )}
      </ScrollArea>

      {/* Actions footer */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 6, justifyContent: 'flex-end',
      }}>
        <FooterButton
          icon={<Power size={13} />}
          label={app.status === 'active' ? 'Disable' : 'Enable'}
          onClick={handleToggleStatus}
        />
        <FooterButton
          icon={<Download size={13} />}
          label="Export .claw"
          onClick={handleExport}
        />
        <FooterButton
          icon={<Trash2 size={13} />}
          label="Uninstall"
          onClick={() => setDeleteDialog(true)}
          danger
        />
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={handleUninstall}
        title={`Uninstall ${app.appName}?`}
        description="The app will be archived. You can purge it permanently later."
        confirmLabel="Uninstall"
        variant="danger"
      />

      <ConfirmDialog
        open={purgeDialog}
        onClose={() => setPurgeDialog(false)}
        onConfirm={handlePurge}
        title={`Permanently delete ${app.appName}?`}
        description="This will remove all data, schemas, and files. This cannot be undone."
        confirmLabel="Purge"
        variant="danger"
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function ScanResultsView({ result }: { result: ScanResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 'var(--radius-md)',
        background: result.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        border: `1px solid ${result.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: result.passed ? 'var(--success)' : 'var(--error)' }}>
          {result.passed ? '✓ Scan passed' : '✕ Scan failed'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Level: {result.level} · {new Date(result.scanned_at).toLocaleString()}
        </span>
      </div>

      {result.errors.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--error)', margin: '0 0 6px' }}>
            Errors ({result.errors.length})
          </h4>
          {result.errors.map((err, i) => (
            <div key={i} style={{
              padding: '6px 10px', marginBottom: 4,
              background: 'rgba(244, 63, 94, 0.05)',
              border: '1px solid rgba(244, 63, 94, 0.15)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
            }}>
              <span style={{ fontWeight: 500, color: 'var(--error)' }}>{err.code}</span>
              <span style={{ color: 'var(--text-dim)' }}> — {err.message}</span>
              {err.detail && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {err.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)', margin: '0 0 6px' }}>
            Warnings ({result.warnings.length})
          </h4>
          {result.warnings.map((warn, i) => (
            <div key={i} style={{
              padding: '6px 10px', marginBottom: 4,
              background: 'rgba(249, 115, 22, 0.05)',
              border: '1px solid rgba(249, 115, 22, 0.15)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
            }}>
              <span style={{ fontWeight: 500, color: 'var(--warning)' }}>{warn.code}</span>
              <span style={{ color: 'var(--text-dim)' }}> — {warn.message}</span>
              {warn.detail && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {warn.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.errors.length === 0 && result.warnings.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: 0 }}>
          No issues found.
        </p>
      )}
    </div>
  );
}

function FooterButton({ icon, label, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '6px 12px',
        color: danger ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.8125rem', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'border-color var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {icon}
      {label}
    </button>
  );
}
