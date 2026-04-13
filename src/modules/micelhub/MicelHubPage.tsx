/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, X, Puzzle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppsStore } from '@/stores/apps.store';
import { AppCard } from './AppCard';
import { AppDetail } from './AppDetail';
import { AppEditor } from './AppEditor';
import { Badge } from '@/components/ui/badge';
import { AssignAppsModal as SharedAssignAppsModal } from '@/components/shared/AssignAppsModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/use-media-query';
import { RegistryBrowser } from './RegistryBrowser';
import { api } from '@/services/api';
import * as gwService from '@/services/gateway.service';
import { getInstalledApps } from '@/services/apps.service';
import type { InstalledApp } from '@/types/apps';

type Tab = 'available' | 'installed' | 'adapted' | 'registry';

// Origin tag colors — Micelclaw = cian (official), OpenClaw = granate (bundled)
const ORIGIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Micelclaw: { bg: '#06b6d412', border: '#06b6d430', text: '#06b6d4' },
  OpenClaw:  { bg: '#9f123912', border: '#9f123930', text: '#9f1239' },
  Registry:  { bg: '#8b5cf612', border: '#8b5cf630', text: '#8b5cf6' },
  Verified:  { bg: '#22c55e12', border: '#22c55e30', text: '#22c55e' },
  Community: { bg: '#64748b12', border: '#64748b30', text: '#64748b' },
};

// Level tag colors
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  L1: { bg: '#64748b18', border: '#64748b40', text: 'var(--text-dim)' },
  L2: { bg: '#3b82f618', border: '#3b82f640', text: '#3b82f6' },
  L3: { bg: '#a855f718', border: '#a855f740', text: '#a855f7' },
};

// Tier tag colors
const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Free:    { bg: '#22c55e12', border: '#22c55e30', text: '#22c55e' },
  Plus:    { bg: '#3b82f612', border: '#3b82f630', text: '#3b82f6' },
  Pro:     { bg: '#d4a01712', border: '#d4a01730', text: 'var(--amber)' },
};

// Status tag colors
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Verified: { bg: '#22c55e12', border: '#22c55e30', text: '#22c55e' },
  Featured:   { bg: '#f59e0b12', border: '#f59e0b30', text: '#f59e0b' },
};

function TagButton({ label, active, colors, onClick }: {
  label: string;
  active: boolean;
  colors: { bg: string; border: string; text: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: '0.6875rem',
        fontWeight: active ? 600 : 400,
        background: active ? colors.bg : 'transparent',
        border: `1px solid ${active ? colors.border : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: active ? colors.text : 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'var(--transition-fast)',
      }}
    >
      {label}
    </button>
  );
}

export function Component() {
  const {
    installedApps, meta, loading, error,
    fetchInstalledApps, restartRequired, clearRestart,
  } = useAppsStore();

  const [tab, setTab] = useState<Tab>('available');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [editingApp, setEditingApp] = useState<InstalledApp | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Clickable tag filters
  const [originFilters, setOriginFilters] = useState<Set<string>>(new Set(['Micelclaw', 'OpenClaw', 'Verified', 'Community']));
  const [levelFilters, setLevelFilters] = useState<Set<string>>(new Set(['L1', 'L2', 'L3']));
  const [tierFilters, setTierFilters] = useState<Set<string>>(new Set(['Free', 'Plus', 'Pro']));
  const [adaptedCount, setAdaptedCount] = useState(0);

  // Available tab: merged MicelclawOS skills + OpenClaw bundled skills
  const [availableApps, setAvailableApps] = useState<InstalledApp[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);

  // Installed tab: agents with their skills
  const [agentsWithSkills, setAgentsWithSkills] = useState<Array<{
    id: string; name: string; display_name: string; avatar: string | null;
    skills: Array<{ id: string; name: string; icon: string }>;
  }>>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  // Fetch available apps: SINGLE SOURCE via skills.status RPC
  const fetchAvailable = useCallback(async () => {
    setAvailableLoading(true);
    try {
      const skills = await gwService.getSkillsStatus().catch(() => []);

      // Convert skills.status data to InstalledApp shape for unified rendering
      const allApps: InstalledApp[] = skills.map((s) => {
        // Determine origin: openclaw-extra = Micelclaw, openclaw-bundled = OpenClaw
        const source = s.source === 'openclaw-extra' ? 'micelhub' as const
          : s.source === 'openclaw-bundled' ? 'openclaw' as const
          : 'local' as const;
        const author = source === 'micelhub' ? 'Micelclaw' : source === 'openclaw' ? 'OpenClaw' : 'Community';

        // Determine app state for UI
        const hasOsIssue = (s.missing?.os?.length ?? 0) > 0;
        const needsEnvOrConfig = !s.eligible && (s.missing?.env?.length ?? 0) + (s.missing?.config?.length ?? 0) > 0 && (s.install?.length ?? 0) === 0;
        const status: 'active' | 'disabled' = s.eligible ? 'active' : 'disabled';

        // Determine level: L1 = no external deps, L2 = has deps/install/external env/config
        const hasBins = (s.requirements?.bins?.length ?? 0) > 0 || (s.requirements?.any_bins?.length ?? 0) > 0;
        const hasExternalEnv = (s.requirements?.env ?? []).filter((e: string) => e !== 'CLAW_API_KEY' && e !== 'CLAW_CORE_TOKEN').length > 0;
        const hasConfig = (s.requirements?.config?.length ?? 0) > 0;
        const hasInstall = (s.install?.length ?? 0) > 0;
        const appLevel = (hasBins || hasExternalEnv || hasConfig || hasInstall) ? 2 : 1;

        return {
          id: `${source}-${s.skill_key ?? s.name}`,
          app_name: s.name,
          version: '0.0.0',
          app_level: appLevel,
          status,
          source,
          install_path: null,
          manifest: {
            name: s.name,
            version: '0.0.0',
            app_level: appLevel as 1 | 2 | 3,
            min_core_version: '0.0.0',
            skill: '',
            description: s.description || '',
            author,
            icon: s.emoji || '🔧',
            tier_required: 'free' as const,
            permissions: [],
            tags: [
              // Status tags
              ...(s.eligible ? ['ready'] : []),
              ...((s.install?.length ?? 0) > 0 && !s.eligible && !hasOsIssue ? ['installable'] : []),
              ...(needsEnvOrConfig ? ['needs-setup'] : []),
              ...(hasOsIssue ? ['unsupported'] : []),
              // All current apps are verified and free
              'verified',
              'free',
            ],
          },
          forked_from: null,
          installed_by: null,
          installed_at: '',
          updated_at: '',
        } as InstalledApp;
      });

      setAvailableApps(allApps);
    } catch { /* silent */ }
    finally { setAvailableLoading(false); }
  }, []);

  // Fetch agents with skills for Installed tab
  const fetchInstalled = useCallback(async () => {
    setInstalledLoading(true);
    try {
      const res = await api.get<{ data: typeof agentsWithSkills }>('/managed-agents');
      setAgentsWithSkills(res.data);
    } catch { /* silent */ }
    finally { setInstalledLoading(false); }
  }, []);

  // Preload all data sources on mount for accurate tab counts
  useEffect(() => {
    fetchAvailable();
    fetchInstalled();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch adapted count on mount (for tab badge)
  useEffect(() => {
    getInstalledApps({ source: 'adapted' }).then(res => setAdaptedCount(res.meta.total)).catch(() => {});
  }, []);

  // Reload data when tab changes
  useEffect(() => {
    if (tab === 'available') fetchAvailable();
    else if (tab === 'installed') fetchInstalled();
    else if (tab === 'adapted') {
      fetchInstalledApps({ source: 'adapted' });
      getInstalledApps({ source: 'adapted' }).then(res => setAdaptedCount(res.meta.total)).catch(() => {});
    }
  }, [tab, fetchAvailable, fetchInstalled, fetchInstalledApps]);

  // Assign/unassign skills to agents (Installed tab)
  const [assigningAgent, setAssigningAgent] = useState<string | null>(null);

  const handleAssignSkill = async (agentId: string, skillId: string) => {
    const agent = agentsWithSkills.find(a => a.id === agentId);
    if (!agent) return;
    // Use skill_id (original skill ID like "claw-notes"), not id (like "sk-1")
    const currentSkills = agent.skills.map((s: Record<string, unknown>) => (s.skill_id ?? s.id) as string);
    if (currentSkills.includes(skillId)) return;
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: [...currentSkills, skillId] });
      // Check if the app has missing deps — the backend auto-installs in background
      const appInfo = availableApps.find(a => a.app_name === skillId);
      const hasInstallableDeps = appInfo?.manifest?.tags?.includes('installable');
      if (hasInstallableDeps) {
        toast('App assigned — installing dependencies in background...', { duration: 10000 });
      } else {
        toast.success('App assigned');
      }
      fetchInstalled();
      // Refresh available after a delay (deps may have been installed)
      if (hasInstallableDeps) {
        setTimeout(() => fetchAvailable(), 15000);
      }
    } catch { toast.error('Failed to assign app'); }
  };

  const handleUnassignSkill = async (agentId: string, skillId: string) => {
    const agent = agentsWithSkills.find(a => a.id === agentId);
    if (!agent) return;
    // Use skill_id (original skill ID), filter out the one to remove
    const currentSkills = agent.skills
      .map((s: Record<string, unknown>) => (s.skill_id ?? s.id) as string)
      .filter(id => id !== skillId);
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: currentSkills });
      toast.success('App removed');
      fetchInstalled();
    } catch { toast.error('Failed to remove app'); }
  };

  // Available skills for the assign dropdown
  const allAvailableSkillIds = availableApps.map(a => a.app_name);

  const handleRefresh = useCallback(() => {
    if (tab === 'available') fetchAvailable();
    else if (tab === 'installed') fetchInstalled();
    else if (tab === 'adapted') fetchInstalledApps({ source: 'adapted' });
  }, [tab, fetchAvailable, fetchInstalled, fetchInstalledApps]);

  // Get origin label for an app
  const getOrigin = (app: InstalledApp): string => {
    if (app.source === 'openclaw') return 'OpenClaw';
    if (app.source === 'micelhub') return 'Micelclaw';
    if (app.source === 'registry') return 'Registry';
    if (app.source === 'adapted') return 'Micelclaw';
    if (app.source === 'local') return 'Micelclaw';
    return 'Community';
  };

  // Filter apps based on active tag filters + search
  // Tag filters only apply to the Available tab; Adapted only uses search
  const filterApps = (apps: InstalledApp[]): InstalledApp[] => {
    return apps.filter(app => {
      // Search (all tabs)
      if (search) {
        const q = search.toLowerCase();
        const name = (app.manifest?.name ?? app.app_name ?? '').toLowerCase();
        const desc = (app.manifest?.description ?? '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      // Tag filters only for Available tab
      if (tab !== 'available') return true;
      // Origin filter
      const origin = getOrigin(app);
      if (originFilters.size > 0 && !originFilters.has(origin)) return false;
      // Level filter
      const level = `L${app.app_level}`;
      if (levelFilters.size > 0 && !levelFilters.has(level)) return false;
      // Tier filter
      const tierReq = app.manifest?.tier_required ?? 'free';
      const tier = tierReq === 'pro' ? 'Pro' : tierReq === 'plus' ? 'Plus' : 'Free';
      if (tierFilters.size > 0 && !tierFilters.has(tier)) return false;
      // Verified filter (if active, only show verified apps)
      if (originFilters.has('Verified') && !(app.manifest?.tags ?? []).includes('verified')) return false;
      // Featured filter (hide featured apps unless Featured tag is active)
      const isFeatured = (app.manifest?.tags ?? []).includes('featured');
      if (isFeatured && !originFilters.has('Featured')) return false;
      return true;
    });
  };

  const currentApps = tab === 'available' ? availableApps : tab === 'adapted' ? installedApps : [];
  const filtered = filterApps(currentApps);
  const isLoading = tab === 'available' ? availableLoading : tab === 'installed' ? installedLoading : loading;

  // Mobile: push to detail
  if (isMobile && selectedApp) {
    return <AppDetail app={selectedApp} onBack={() => setSelectedApp(null)} onRefresh={handleRefresh} onEditFiles={selectedApp.source === 'adapted' ? () => setEditingApp(selectedApp) : undefined} />;
  }

  const needsRestart = restartRequired.openclaw || restartRequired.core;

  // Full-screen editor for adapted apps
  if (editingApp) {
    return (
      <div style={{ height: '100%', fontFamily: 'var(--font-sans)' }}>
        <AppEditor app={editingApp} onBack={() => { setEditingApp(null); handleRefresh(); }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Restart banner */}
          {needsRestart && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--warning)',
            }}>
              <AlertTriangle size={14} />
              <span style={{ flex: 1 }}>
                Restart required — {restartRequired.reason || 'An app was modified.'}
                {restartRequired.openclaw && ' OpenClaw needs to restart.'}
                {restartRequired.core && ' Claw Core needs to restart.'}
              </span>
              <button onClick={() => { if (restartRequired.openclaw) clearRestart('openclaw'); if (restartRequired.core) clearRestart('core'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '4px 10px', minWidth: 200,
            }}>
              <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search apps..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.8125rem', width: '100%', fontFamily: 'var(--font-sans)' }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {(['available', 'installed', 'adapted', 'registry'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 12px',
                background: tab === t ? 'var(--surface-hover)' : 'transparent',
                border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)',
                color: tab === t ? 'var(--text)' : 'var(--text-dim)',
                fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                fontWeight: tab === t ? 500 : 400,
              }}>
                {t === 'available' && `Available${availableApps.length > 0 ? ` (${availableApps.length})` : ''}`}
                {t === 'installed' && `Installed${agentsWithSkills.length > 0 ? ` (${agentsWithSkills.filter(a => a.skills.length > 0).length})` : ''}`}
                {t === 'adapted' && `Adapted${adaptedCount > 0 ? ` (${adaptedCount})` : ''}`}
                {t === 'registry' && 'Registry'}
              </button>
            ))}
          </div>

          {/* Clickable tag filters */}
          {tab === 'available' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Origin tags */}
              {['Micelclaw', 'OpenClaw', 'Community', 'Registry'].map(origin => (
                <TagButton key={origin} label={origin} active={originFilters.has(origin)}
                  colors={ORIGIN_COLORS[origin] ?? ORIGIN_COLORS.Community}
                  onClick={() => toggleFilter(originFilters, origin, setOriginFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Level tags */}
              {['L1', 'L2', 'L3'].map(level => (
                <TagButton key={level} label={level} active={levelFilters.has(level)}
                  colors={LEVEL_COLORS[level]!}
                  onClick={() => toggleFilter(levelFilters, level, setLevelFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Tier tags */}
              {['Free', 'Plus', 'Pro'].map(tier => (
                <TagButton key={tier} label={tier} active={tierFilters.has(tier)}
                  colors={TIER_COLORS[tier]!}
                  onClick={() => toggleFilter(tierFilters, tier, setTierFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Status tags */}
              {['Verified', 'Featured'].map(st => (
                <TagButton key={st} label={st === 'Verified' ? '✓ Verified' : st} active={originFilters.has(st)}
                  colors={STATUS_COLORS[st]!}
                  onClick={() => toggleFilter(originFilters, st, setOriginFilters)} />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {tab === 'registry' ? (
            <RegistryBrowser />
          ) : tab === 'installed' ? (
            /* Installed: view by agent */
            installedLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 80, background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 8, animation: 'pulse 2s infinite' }} />)}
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {agentsWithSkills.filter(a => a.name !== '_system' || a.skills.length > 0).map(agent => (
                  <div key={agent.id}
                    onClick={() => setAssigningAgent(agent.id)}
                    style={{ background: 'var(--card)', border: assigningAgent === agent.id ? '1px solid var(--amber-dim)' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer', transition: 'var(--transition-fast)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.125rem' }}>{agent.avatar ?? '🤖'}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{agent.display_name}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {agent.skills.length} app{agent.skills.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {agent.skills.map(s => (
                        <span key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', fontSize: '0.6875rem',
                          background: '#06b6d412', border: '1px solid #06b6d430',
                          borderRadius: 'var(--radius-sm)', color: '#06b6d4',
                        }}>
                          {s.icon ?? '📦'} {s.name}
                          <button onClick={(e) => { e.stopPropagation(); handleUnassignSkill(agent.id, (s as Record<string, unknown>).skill_id as string ?? (s as Record<string, unknown>).skillId as string ?? s.id); }}
                            title={`Remove ${s.name}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', marginLeft: 2 }}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {agent.skills.length === 0 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>No apps assigned</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setAssigningAgent(agent.id); }} title="Assign apps"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {agentsWithSkills.length === 0 && (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <Puzzle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: 0 }}>No agents found</p>
                  </div>
                )}
              </div>
            )
          ) : isLoading ? (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ height: 140, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--error)', fontSize: '0.875rem' }}>
              {error}<br />
              <button onClick={handleRefresh} style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Puzzle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: 0 }}>
                {search ? 'No apps match your search.' : 'No apps found with current filters.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
              {filtered.map((app) => (
                <AppCard key={app.id} app={app} origin={getOrigin(app)}
                  selected={selectedApp?.id === app.id}
                  onClick={() => setSelectedApp(app)}
                  onRefresh={handleRefresh} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail panel (desktop) */}
      {!isMobile && selectedApp && (
        <div style={{ width: 400, minWidth: 400, borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <AppDetail app={selectedApp} onBack={() => setSelectedApp(null)} onRefresh={handleRefresh} onEditFiles={selectedApp.source === 'adapted' ? () => setEditingApp(selectedApp) : undefined} />
        </div>
      )}

      {/* Assign Apps Modal (Installed tab) — shared component */}
      {assigningAgent && (() => {
        const agent = agentsWithSkills.find(a => a.id === assigningAgent);
        if (!agent) return null;
        const currentIds = agent.skills.map((s: Record<string, unknown>) => (s.skill_id ?? s.id) as string);
        return (
          <SharedAssignAppsModal
            agentId={agent.id}
            agentName={agent.display_name}
            agentAvatar={agent.avatar ?? undefined}
            currentSkillIds={currentIds}
            open={true}
            onClose={() => setAssigningAgent(null)}
            onSaved={() => { fetchInstalled(); setAssigningAgent(null); }}
          />
        );
      })()}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

