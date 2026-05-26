/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — top-level page. Synology Log Center-inspired
 * layout: left sidebar with the 5 tabs, top header (histogram +
 * filters), bottom table with row→drawer detail.
 *
 * Each tab provides an Adapter<Row> (see adapters/types.ts). The shell
 * just orchestrates: load stats, run the active adapter's
 * fetchSnapshot, pipe filters/search/pause state down.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity as ActivityIcon, Bell, Radio, Container, Cpu, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { ActivityHeader } from './ActivityHeader';
import { ActivityTable } from './ActivityTable';
import type { Adapter } from './adapters/types';
import { buildPlaceholderAdapter } from './adapters/placeholder.adapter';
import { getActivityStats } from '@/services/activity.service';
import type { ActivityStats } from '@/services/activity.service';

type TabKey = Adapter<never>['tabKey'];

interface TabDescriptor {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  bucket: 'events' | 'gateway' | 'containers' | 'core' | null;
}

const TABS: TabDescriptor[] = [
  { key: 'events',        label: 'Events',         icon: ActivityIcon, bucket: 'events' },
  { key: 'notifications', label: 'Notifications',  icon: Bell,         bucket: null },
  { key: 'gateway',       label: 'Gateway logs',   icon: Radio,        bucket: 'gateway' },
  { key: 'containers',    label: 'Containers',     icon: Container,    bucket: 'containers' },
  { key: 'core',          label: 'System (Core)',  icon: Cpu,          bucket: 'core' },
];

const STATS_POLL_MS = 30_000;

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickAdapter(key: TabKey): Adapter<{ id: string }> {
  // Sessions 6 + 7 replace these placeholders with the real adapters.
  return buildPlaceholderAdapter(key, TABS.find((t) => t.key === key)?.label ?? key);
}

export function Component() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // ?tab=events|notifications|gateway|containers|core
  const queryTab = (search.get('tab') ?? 'events') as TabKey;
  const initialTab: TabKey = TABS.some((t) => t.key === queryTab) ? queryTab : 'events';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [paused, setPaused] = useState(false);

  const adapter = useMemo(() => pickAdapter(activeTab), [activeTab]);

  // Fetch + poll stats (header histogram + bucket sizes for sidebar badges)
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function load() {
      try {
        const s = await getActivityStats(24);
        if (!cancelled) setStats(s);
      } catch {
        // best-effort — leave previous snapshot
      }
    }
    void load();
    const id = setInterval(load, STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin]);

  // Reset filters when the tab changes — facets differ.
  useEffect(() => {
    setFilters({});
    setSearchText('');
  }, [activeTab]);

  // Sync ?tab= when activeTab changes
  useEffect(() => {
    const current = search.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(search);
      next.set('tab', activeTab);
      navigate({ search: `?${next.toString()}` }, { replace: true });
    }
  }, [activeTab, navigate, search]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-[var(--text-muted)]">
        Esta página requiere rol de administrador.
      </div>
    );
  }

  const bucketSizeFor = (bucket: TabDescriptor['bucket']) => {
    if (!bucket || !stats) return null;
    return stats.buckets.find((b) => b.bucket === bucket) ?? null;
  };

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-base)]">
      {/* Left sidebar — 5 tabs */}
      <aside className="w-[208px] shrink-0 border-r border-[var(--border-base)] flex flex-col">
        <header className="px-3 py-3 border-b border-[var(--border-base)] flex items-center justify-between">
          <span className="text-sm font-medium">Activity</span>
          <button
            onClick={() => navigate('/activity?settings=open')}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon size={14} />
          </button>
        </header>
        <nav className="flex-1 py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const bucket = bucketSizeFor(tab.bucket);
            const usage = bucket && bucket.cap_bytes > 0
              ? Math.min(100, Math.round((bucket.bytes / bucket.cap_bytes) * 100))
              : null;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] ${
                  isActive ? 'bg-[var(--bg-hover)] border-l-2 border-[var(--accent)]' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </span>
                {usage !== null && (
                  <span
                    className="text-[10px] text-[var(--text-muted)]"
                    title={bucket ? `${formatMB(bucket.bytes)} / ${formatMB(bucket.cap_bytes)}` : ''}
                  >
                    {usage}%
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        {stats && (
          <footer className="px-3 py-2 border-t border-[var(--border-base)] text-[10px] text-[var(--text-muted)]">
            Budget total: {stats.budget.budget_mb} MB
          </footer>
        )}
      </aside>

      {/* Main column — header (graph + filters) + table */}
      <section className="flex-1 flex flex-col min-h-0">
        <ActivityHeader
          adapter={adapter}
          stats={stats}
          filters={filters}
          onFilterChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
          search={searchText}
          onSearchChange={setSearchText}
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
        />
        <ActivityTable<{ id: string }>
          adapter={adapter}
          rows={[]}
          loading={false}
          emptyMessage="Este tab se cablea en la próxima sesión."
        />
      </section>
    </div>
  );
}

export default Component;
