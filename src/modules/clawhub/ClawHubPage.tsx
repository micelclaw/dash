import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, X } from 'lucide-react';
import { useAppsStore } from '@/stores/apps.store';
import { AppCard } from './AppCard';
import { AppDetail } from './AppDetail';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { InstalledApp } from '@/types/apps';

type Tab = 'installed' | 'available' | 'adapted';

export function Component() {
  const {
    installedApps, meta, loading, error,
    fetchInstalledApps, restartRequired, clearRestart,
  } = useAppsStore();

  const [tab, setTab] = useState<Tab>('installed');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (tab === 'adapted') {
      fetchInstalledApps({ source: 'adapted' });
    } else if (tab === 'installed') {
      fetchInstalledApps();
    }
  }, [tab, fetchInstalledApps]);

  const handleRefresh = useCallback(() => {
    const filters: Record<string, string> = {};
    if (levelFilter) filters.level = levelFilter;
    if (statusFilter) filters.status = statusFilter;
    if (tab === 'adapted') filters.source = 'adapted';
    fetchInstalledApps(Object.keys(filters).length > 0 ? filters : undefined);
  }, [fetchInstalledApps, levelFilter, statusFilter, tab]);

  useEffect(() => {
    handleRefresh();
  }, [levelFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = installedApps.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = app.appName?.toLowerCase() ?? '';
    const desc = (app.manifest?.description ?? '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  // Mobile: push to detail
  if (isMobile && selectedApp) {
    return (
      <AppDetail
        app={selectedApp}
        onBack={() => setSelectedApp(null)}
        onRefresh={handleRefresh}
      />
    );
  }

  const needsRestart = restartRequired.openclaw || restartRequired.core;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Restart banner */}
          {needsRestart && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              color: 'var(--warning)',
            }}>
              <AlertTriangle size={14} />
              <span style={{ flex: 1 }}>
                Restart required — {restartRequired.reason || 'An app was modified.'}
                {restartRequired.openclaw && ' OpenClaw needs to restart.'}
                {restartRequired.core && ' Claw Core needs to restart.'}
              </span>
              <button
                onClick={() => {
                  if (restartRequired.openclaw) clearRestart('openclaw');
                  if (restartRequired.core) clearRestart('core');
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', padding: 2, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Title + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              ClawHub
            </h1>
            <div style={{ flex: 1 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '4px 10px',
              minWidth: 200,
            }}>
              <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: '0.8125rem', width: '100%',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['installed', 'available', 'adapted'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 12px',
                  background: tab === t ? 'var(--surface-hover)' : 'transparent',
                  border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  color: tab === t ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: tab === t ? 500 : 400,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t === 'installed' && `Installed${meta ? ` (${meta.total})` : ''}`}
                {t === 'available' && 'Available'}
                {t === 'adapted' && `Adapted${tab === 'adapted' && meta ? ` (${meta.total})` : ''}`}
              </button>
            ))}
          </div>

          {/* Filters (installed + adapted) */}
          {tab !== 'available' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '4px 8px',
                  color: 'var(--text)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                <option value="">All levels</option>
                <option value="L1">L1 — Skill</option>
                <option value="L2">L2 — API</option>
                <option value="L3">L3 — Docker</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '4px 8px',
                  color: 'var(--text)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="error">Error</option>
              </select>
              {meta && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                  L1: {meta.by_level.L1} · L2: {meta.by_level.L2} · L3: {meta.by_level.L3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {tab === 'available' ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', minHeight: 300,
              gap: 12, padding: 32, textAlign: 'center',
            }}>
              <Badge variant="outline">Coming soon</Badge>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: 0, maxWidth: 360 }}>
                ClawHub cloud registry coming soon. You'll be able to browse and install community apps here.
              </p>
            </div>
          ) : loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  height: 120, background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                }} />
              ))}
            </div>
          ) : error ? (
            <div style={{
              padding: 32, textAlign: 'center',
              color: 'var(--error)', fontSize: '0.875rem',
            }}>
              {error}
              <br />
              <button
                onClick={handleRefresh}
                style={{
                  marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '6px 12px',
                  color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center',
              color: 'var(--text-dim)', fontSize: '0.875rem',
            }}>
              {search ? 'No apps match your search.' : 'No apps installed yet.'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12, padding: 16,
            }}>
              {filtered.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  selected={selectedApp?.id === app.id}
                  onClick={() => setSelectedApp(app)}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail panel (desktop) */}
      {!isMobile && selectedApp && (
        <div style={{
          width: 400, minWidth: 400,
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <AppDetail
            app={selectedApp}
            onBack={() => setSelectedApp(null)}
            onRefresh={handleRefresh}
          />
        </div>
      )}
    </div>
  );
}
