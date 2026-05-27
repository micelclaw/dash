/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — top-level page. Synology Log Center-inspired
 * layout: left sidebar with the 5 tabs, top header (histogram +
 * filters), bottom table with row→drawer detail.
 *
 * The shell owns: stats polling for sidebar badges, ?tab= sync,
 * filters/search/pause state. The active tab component receives that
 * state and runs its own data fetching via the adapter contract.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Activity as ActivityIcon, Bell, Radio, Container, Cpu, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import type { Adapter } from './adapters/types';
import { EventsTab } from './tabs/EventsTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { GatewayLogsTab } from './tabs/GatewayLogsTab';
import { CoreLogsTab } from './tabs/CoreLogsTab';
import { ContainersLogsTab } from './tabs/ContainersLogsTab';
import { ActivitySettingsModal } from './settings/ActivitySettingsModal';
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

export function Component() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const queryTab = (search.get('tab') ?? 'events') as TabKey;
  const initialTab: TabKey = TABS.some((t) => t.key === queryTab) ? queryTab : 'events';
  const initialSettingsOpen = search.get('settings') === 'open';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);

  // Reset filters when the tab ACTUALLY changes — facets differ per
  // adapter. Skip the initial mount: filters already start empty, and
  // firing setFilters({}) there churns a fresh {} object that races
  // the first user filter selection (live WS rows could slip in during
  // the window where filters momentarily looks empty).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setFilters({});
    setSearchText('');
  }, [activeTab]);

  // Fetch + poll stats (header histogram + bucket sizes for sidebar badges)
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function load() {
      try {
        const s = await getActivityStats(24);
        if (!cancelled) setStats(s);
      } catch {
        // best-effort
      }
    }
    void load();
    const id = setInterval(load, STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin]);

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

  const sharedProps = {
    stats,
    filters,
    onFilterChange: (k: string, v: string) =>
      setFilters((prev) => ({ ...prev, [k]: v })),
    search: searchText,
    onSearchChange: setSearchText,
    paused,
    onTogglePause: () => setPaused((p) => !p),
  };

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      {/* Left sidebar — 5 tabs */}
      <aside className="w-[208px] shrink-0 border-r border-[var(--border)] flex flex-col">
        <header className="px-3 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-sm font-medium">Activity</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1 rounded hover:bg-[var(--surface-hover)]"
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
                className={`w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)] ${
                  isActive ? 'bg-[var(--surface-hover)] border-l-2 border-[var(--primary)]' : ''
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
          <footer className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
            Budget total: {stats.budget.budget_mb} MB
          </footer>
        )}
      </aside>

      {/* Main column — dispatch by active tab */}
      <section className="flex-1 flex flex-col min-h-0">
        {activeTab === 'events' && <EventsTab {...sharedProps} />}
        {activeTab === 'notifications' && <NotificationsTab {...sharedProps} />}
        {activeTab === 'gateway' && <GatewayLogsTab {...sharedProps} />}
        {activeTab === 'containers' && <ContainersLogsTab {...sharedProps} />}
        {activeTab === 'core' && <CoreLogsTab {...sharedProps} />}
      </section>

      <ActivitySettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default Component;
