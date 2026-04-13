/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Globe, Cpu, RefreshCw, Mail, Image, Palette, Shield, CreditCard,
  Search as SearchIcon, Newspaper, HardDrive, Users, Network, Zap,
  Bell, Calendar, Keyboard, Rss, Server, Database,
  Mic, Radio, Key, UserCircle, Copy, Brain, History, Link2,
  Container, Globe2, Terminal, Lock, Eye, AppWindow, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import { useSecurityStore } from '@/stores/security.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { GeneralSection } from '@/components/settings/sections/GeneralSection';
import { AISection } from '@/components/settings/sections/AISection';
import { SyncSection } from '@/components/settings/sections/SyncSection';
import { MailSection } from '@/components/settings/sections/MailSection';
import { PhotosSection } from '@/components/settings/sections/PhotosSection';
import { DashSection } from '@/components/settings/sections/DashSection';
import { StorageSection } from '@/components/settings/sections/StorageSection';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { LicenseSection } from '@/components/settings/sections/LicenseSection';
import { DigestSection } from '@/components/settings/sections/DigestSection';
import { SearchSection } from '@/components/settings/sections/SearchSection';
import { UsersSection } from '@/components/settings/sections/UsersSection';
import { NetworkSection } from '@/components/settings/sections/NetworkSection';
import { EnergySection } from '@/components/settings/sections/EnergySection';
import { NotificationsSection } from '@/components/settings/sections/NotificationsSection';
import { CalendarSection } from '@/components/settings/sections/CalendarSection';
import { ShortcutsSection } from '@/components/settings/sections/ShortcutsSection';
import { FeedsSection } from '@/components/settings/sections/FeedsSection';
import { ChannelObserversSection } from '@/components/settings/sections/ChannelObserversSection';
import { ServicesSection } from '@/components/settings/sections/ServicesSection';
import { DatabaseSection } from '@/components/settings/sections/DatabaseSection';
import { VoiceSection } from '@/components/settings/sections/VoiceSection';
import { SensorFusionSection } from '@/components/settings/sections/SensorFusionSection';
import { PermissionsSection } from '@/components/settings/sections/PermissionsSection';
import { AgentTokensSection } from '@/components/settings/sections/AgentTokensSection';
import { AccountSection } from '@/components/settings/sections/AccountSection';
import { DuplicatesSection } from '@/components/settings/sections/DuplicatesSection';
import { PreferencesSection } from '@/components/settings/sections/PreferencesSection';
import { ApprovalsHistorySection } from '@/components/settings/sections/ApprovalsHistorySection';
import { MyApiKeysSection } from '@/components/settings/sections/MyApiKeysSection';
import { ChannelBindingsSection } from '@/components/settings/sections/ChannelBindingsSection';
import { ToolAccessDefaultsSection } from '@/components/settings/sections/ToolAccessDefaultsSection';
import { SandboxSection } from '@/components/settings/sections/SandboxSection';
import { BrowserConfigSection } from '@/components/settings/sections/BrowserConfigSection';
import { GatewayAuthSection } from '@/components/settings/sections/GatewayAuthSection';
import { DevicesSection } from '@/components/settings/sections/DevicesSection';
import { ApprovalsForwardingSection } from '@/components/settings/sections/ApprovalsForwardingSection';
import { MemorySearchSection } from '@/components/settings/sections/MemorySearchSection';
import { SessionSection } from '@/components/settings/sections/SessionSection';
import { CronConfigSection } from '@/components/settings/sections/CronConfigSection';
import { HooksSection } from '@/components/settings/sections/HooksSection';
import { CommandsSection } from '@/components/settings/sections/CommandsSection';
import { LoggingSection } from '@/components/settings/sections/LoggingSection';
import { TelemetrySection } from '@/components/settings/sections/TelemetrySection';
import { EnvSection } from '@/components/settings/sections/EnvSection';
import { SecretsSection } from '@/components/settings/sections/SecretsSection';
import { AutomationSection } from '@/components/settings/sections/AutomationSection';
import { ObservabilitySection } from '@/components/settings/sections/ObservabilitySection';
import { SettingsSidebarGroup } from '@/components/settings/SettingsSidebarGroup';
import { SettingsSidebarSearch } from '@/components/settings/SettingsSidebarSearch';
import { SettingsLanding, type LandingGroup } from './SettingsLanding';
import { searchSettings } from './settings-search-index';

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /**
   * Distinct accent color for this group's icon. Used in BOTH the
   * sidebar group header and the landing card so the user gets a
   * consistent visual mapping (sky = Cuenta everywhere).
   */
  color: string;
  sections: SidebarItem[];
}

// Per-group accent palette. Picked to be distinct in dark mode and
// to leave the dash's main amber for active/dirty/save UI affordances.
const GROUP_COLORS = {
  account: '#38bdf8',       // sky-400
  appearance: '#f472b6',    // pink-400
  aiAgents: '#a78bfa',      // violet-400
  apps: '#34d399',          // emerald-400
  connectivity: '#22d3ee',  // cyan-400
  system: '#fb923c',        // orange-400
  security: '#f87171',      // red-400
  admin: '#facc15',         // yellow-400
};

function buildGroups(isAdmin: boolean): SidebarGroup[] {
  const groups: SidebarGroup[] = [
    {
      id: 'account',
      label: 'Account',
      icon: UserCircle,
      color: GROUP_COLORS.account,
      description: 'Your profile, agent tokens, permissions, license and approvals history.',
      sections: [
        { id: 'account', label: 'Account', icon: UserCircle },
        { id: 'agent-tokens', label: 'Agent Tokens', icon: Key },
        { id: 'permissions', label: 'Permissions', icon: Shield },
        { id: 'license', label: 'License', icon: CreditCard },
        { id: 'approvals-history', label: 'Approvals History', icon: History },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      color: GROUP_COLORS.appearance,
      description: 'Theme, colors, language, keyboard shortcuts and dash notifications.',
      sections: [
        { id: 'dash', label: 'Dash', icon: Palette },
        { id: 'general', label: 'General', icon: Globe },
        { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      id: 'ai-agents',
      label: 'AI & Agents',
      icon: Brain,
      color: GROUP_COLORS.aiAgents,
      description: 'AI models, voice, tools, memory, sessions and how agents respond on channels.',
      sections: [
        { id: 'ai', label: 'AI & Intelligence', icon: Cpu },
        { id: 'voice', label: 'Voice', icon: Mic },
        { id: 'tool-access-defaults', label: 'Tool Access', icon: Wrench },
        { id: 'memory-search', label: 'Memory', icon: Brain },
        { id: 'sessions', label: 'Sessions', icon: History },
        { id: 'channel-bindings', label: 'Channel Bindings', icon: Link2 },
      ],
    },
    {
      id: 'apps',
      label: 'Apps',
      icon: AppWindow,
      color: GROUP_COLORS.apps,
      description: 'Mail, calendar, photos, feeds, search, digest and learned data.',
      sections: [
        { id: 'mail', label: 'Mail', icon: Mail },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'photos', label: 'Photos', icon: Image },
        { id: 'feeds', label: 'Feeds', icon: Rss },
        { id: 'search', label: 'Search', icon: SearchIcon },
        { id: 'digest', label: 'Digest', icon: Newspaper },
        { id: 'duplicates', label: 'Duplicates', icon: Copy },
        { id: 'preferences', label: 'Learned Preferences', icon: Brain },
      ],
    },
    {
      id: 'connectivity',
      label: 'Connectivity',
      icon: Network,
      color: GROUP_COLORS.connectivity,
      description: 'Sync with external services, local network and OpenClaw Gateway configuration.',
      sections: [
        { id: 'sync', label: 'Sync', icon: RefreshCw },
        { id: 'network', label: 'Red', icon: Network },
        { id: 'gateway-auth', label: 'Gateway', icon: Radio },
      ],
    },
    {
      id: 'system',
      label: 'System',
      icon: HardDrive,
      color: GROUP_COLORS.system,
      description: 'Storage, database, energy, services, sensors and automation.',
      sections: [
        { id: 'storage', label: 'Storage', icon: HardDrive },
        { id: 'database', label: 'Database', icon: Database },
        { id: 'energy', label: 'Energia', icon: Zap },
        { id: 'services', label: 'Services', icon: Server },
        { id: 'sensor-fusion', label: 'Sensor Fusion', icon: Radio },
        { id: 'automation', label: 'Automation', icon: Zap },
      ],
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      color: GROUP_COLORS.security,
      description: 'PIN, approval levels, agent sandbox, browser and shell commands.',
      sections: [
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'sandbox', label: 'Sandbox', icon: Container },
        { id: 'browser-config', label: 'Browser', icon: Globe2 },
        { id: 'commands', label: 'Commands', icon: Terminal },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      id: 'admin',
      label: 'Administration',
      icon: Lock,
      color: GROUP_COLORS.admin,
      description: 'Users, observability (logs/telemetry/env), secrets and raw JSON editor.',
      sections: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'observability', label: 'Observability', icon: Eye },
        { id: 'secrets', label: 'Secrets', icon: Lock },
        { id: 'raw', label: 'Raw JSON', icon: Terminal },
      ],
    });
  }
  return groups;
}

// ── Section ID redirects (back-compat for bookmarks) ─────────────
//
// After the Ola 9 reorganization, some sections were folded into
// fused parents. We do NOT redirect their URLs — instead the legacy
// IDs still render the standalone component (see `renderSection`),
// and the sidebar shows them grouped under the fused parent. This
// keeps existing bookmarks AND contract tests working: the contract
// tests navigate to /settings/<id> and expect the standalone
// component to mount and fetch. If we redirected, the fused parent
// would render the children as collapsed blocks that don't mount
// until the user expands them, breaking the tests.
//
// The sidebar entry for these legacy IDs is hidden (they live as
// blocks inside the fused parent), but the URLs remain valid.
const SECTION_REDIRECTS: Record<string, string> = {
  // empty — see comment above. Keep the constant so future redirects
  // are easy to add if a section is truly removed (not just folded).
};

function renderSection(section: string) {
  switch (section) {
    case 'account': return <AccountSection />;
    case 'general': return <GeneralSection />;
    case 'ai': return <AISection />;
    case 'voice': return <VoiceSection />;
    case 'sync': return <SyncSection />;
    case 'mail': return <MailSection />;
    case 'photos': return <PhotosSection />;
    case 'storage': return <StorageSection />;
    case 'network': return <NetworkSection />;
    case 'energy': return <EnergySection />;
    case 'dash': return <DashSection />;
    case 'users': return <UsersSection />;
    case 'database': return <DatabaseSection />;
    case 'security': return <SecuritySection />;
    case 'license': return <LicenseSection />;
    case 'notifications': return <NotificationsSection />;
    case 'calendar': return <CalendarSection />;
    case 'shortcuts': return <ShortcutsSection />;
    case 'search': return <SearchSection />;
    case 'digest': return <DigestSection />;
    case 'feeds': return <FeedsSection />;
    case 'observers': return <ChannelObserversSection />;
    case 'channel-bindings': return <ChannelBindingsSection />;
    case 'tool-access-defaults': return <ToolAccessDefaultsSection />;
    case 'sandbox': return <SandboxSection />;
    case 'browser-config': return <BrowserConfigSection />;
    case 'gateway-auth': return <GatewayAuthSection />;
    case 'devices': return <DevicesSection />;
    case 'approvals-forwarding': return <ApprovalsForwardingSection />;
    case 'memory-search': return <MemorySearchSection />;
    case 'sessions': return <SessionSection />;
    case 'cron-config': return <CronConfigSection />;
    case 'hooks': return <HooksSection />;
    case 'commands': return <CommandsSection />;
    case 'logging': return <LoggingSection />;
    case 'telemetry': return <TelemetrySection />;
    case 'env': return <EnvSection />;
    case 'secrets': return <SecretsSection />;
    case 'services': return <ServicesSection />;
    case 'sensor-fusion': return <SensorFusionSection />;
    case 'permissions': return <PermissionsSection />;
    case 'agent-tokens': return <AgentTokensSection />;
    case 'duplicates': return <DuplicatesSection />;
    case 'preferences': return <PreferencesSection />;
    case 'approvals-history': return <ApprovalsHistorySection />;
    case 'my-api-keys': return <MyApiKeysSection />;
    case 'automation': return <AutomationSection />;
    case 'observability': return <ObservabilitySection />;
    default: return <GeneralSection />;
  }
}

// ── Sidebar group expanded state — persisted in localStorage ─────
//
// Keyed per-user via the prefix below. Default state expands only
// the group containing the active section.

const STORAGE_KEY = 'settings-sidebar-groups';

function loadExpandedState(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return null;
  }
}

function saveExpandedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function findGroupForSection(groups: SidebarGroup[], sectionId: string): string | null {
  for (const g of groups) {
    if (g.sections.some((s) => s.id === sectionId)) return g.id;
  }
  return null;
}

export function Component() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const fetchConfig = useSecurityStore((s) => s.fetchConfig);
  const loading = useSettingsStore((s) => s.loading);
  const settings = useSettingsStore((s) => s.settings);
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const GROUPS = useMemo(() => buildGroups(isAdmin), [isAdmin]);

  // Effective active section: undefined → landing. Apply any redirect
  // (currently empty — see SECTION_REDIRECTS comment above).
  const rawSection = section;
  const redirectedSection =
    rawSection && SECTION_REDIRECTS[rawSection] ? SECTION_REDIRECTS[rawSection] : rawSection;

  useEffect(() => {
    if (rawSection && SECTION_REDIRECTS[rawSection]) {
      navigate(`/settings/${SECTION_REDIRECTS[rawSection]}`, { replace: true });
    }
  }, [rawSection, navigate]);

  // Raw editor lives at /settings/raw and renders a standalone page —
  // when someone navigates to it from the sidebar we just route there.
  useEffect(() => {
    if (redirectedSection === 'raw') {
      navigate('/settings/raw', { replace: false });
    }
  }, [redirectedSection, navigate]);

  const activeSection = redirectedSection;

  // Sidebar group expanded state — accordion: at most one open.
  // Stored as a record so existing localStorage entries (which had
  // multiple `true` values) still parse; we just collapse to the
  // first true on load.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const stored = loadExpandedState();
    if (stored) {
      // Migration from pre-accordion: keep only the first true.
      const firstOpen = Object.entries(stored).find(([, v]) => v)?.[0];
      const init: Record<string, boolean> = {};
      for (const g of GROUPS) init[g.id] = g.id === firstOpen;
      return init;
    }
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) init[g.id] = false;
    return init;
  });

  // Helper: produce a record with only `groupId` open (or all closed
  // if `groupId` is null). Accordion behavior.
  const singleExpanded = useCallback(
    (groupId: string | null): Record<string, boolean> => {
      const next: Record<string, boolean> = {};
      for (const g of GROUPS) next[g.id] = g.id === groupId;
      return next;
    },
    [GROUPS],
  );

  // Auto-expand the group containing the active section whenever it
  // changes (e.g. on initial mount or after a redirect). Closes any
  // previously open group.
  useEffect(() => {
    if (!activeSection) return;
    const groupId = findGroupForSection(GROUPS, activeSection);
    if (!groupId) return;
    setExpandedGroups((prev) => {
      if (prev[groupId]) return prev;
      const next = singleExpanded(groupId);
      saveExpandedState(next);
      return next;
    });
  }, [activeSection, GROUPS, singleExpanded]);

  const toggleGroup = useCallback(
    (groupId: string) => {
      setExpandedGroups((prev) => {
        // If clicking the already-open group, close it. Otherwise
        // open this one and close every other.
        const next = prev[groupId] ? singleExpanded(null) : singleExpanded(groupId);
        saveExpandedState(next);
        return next;
      });
    },
    [singleExpanded],
  );

  // Search state.
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const results = searchSettings(searchQuery);
    // Filter out admin-only results when not admin.
    return isAdmin ? results : results.filter((r) => r.groupId !== 'admin');
  }, [searchQuery, isAdmin]);

  useEffect(() => {
    fetchSettings();
    fetchConfig();
  }, [fetchSettings, fetchConfig]);

  if (loading && !settings) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
        }}
      >
        Loading settings...
      </div>
    );
  }

  // Build the LandingGroup[] for the cards view.
  const landingGroups: LandingGroup[] = GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    icon: g.icon,
    description: g.description,
    firstSectionId: g.sections[0]?.id ?? 'general',
    sectionCount: g.sections.length,
    color: g.color,
  }));

  // Mobile: simple flat dropdown grouped by category.
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 16px',
          }}
        >
          <select
            value={activeSection ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) navigate(`/settings/${v}`, { replace: true });
              else navigate('/settings', { replace: true });
            }}
            style={{
              width: '100%',
              height: 36,
              padding: '0 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          >
            <option value="">— Home —</option>
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {activeSection ? renderSection(activeSection) : <SettingsLanding groups={landingGroups} />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '14px 8px',
          overflowY: 'auto',
        }}
      >
        <SettingsSidebarSearch query={searchQuery} onQueryChange={setSearchQuery} />

        {searchQuery.trim() ? (
          /* ── Flat search results view ── */
          <div>
            {searchResults.length === 0 ? (
              <div
                style={{
                  padding: '12px 8px',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No results for «{searchQuery}»
              </div>
            ) : (
              searchResults.map((r) => {
                const group = GROUPS.find((g) => g.id === r.groupId);
                const item = group?.sections.find((s) => s.id === r.sectionId);
                const Icon = item?.icon ?? SearchIcon;
                const isActive = activeSection === r.sectionId;
                return (
                  <button
                    key={r.sectionId}
                    type="button"
                    onClick={() => {
                      navigate(`/settings/${r.sectionId}`, { replace: true });
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      width: '100%',
                      padding: '8px 12px',
                      background: isActive ? 'var(--surface-hover)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--surface)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={14} />
                      <span>{item?.label ?? r.label}</span>
                    </span>
                    {group && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--text-muted)',
                          marginLeft: 22,
                        }}
                      >
                        {group.label}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* ── Grouped tree view ── */
          <>
            <button
              type="button"
              onClick={() => navigate('/settings', { replace: true })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                marginBottom: 6,
                background: !activeSection ? 'var(--surface-hover)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: !activeSection ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (activeSection) e.currentTarget.style.background = 'var(--surface)';
              }}
              onMouseLeave={(e) => {
                if (activeSection) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Globe size={14} />
              <span>Home</span>
            </button>

            {GROUPS.map((group) => (
              <SettingsSidebarGroup
                key={group.id}
                id={group.id}
                label={group.label}
                icon={group.icon}
                color={group.color}
                expanded={!!expandedGroups[group.id]}
                onToggle={() => toggleGroup(group.id)}
                count={group.sections.length}
              >
                {group.sections.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/settings/${item.id}`, { replace: true })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 10px',
                        background: isActive ? 'var(--surface-hover)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Icon size={13} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.soon && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </SettingsSidebarGroup>
            ))}
          </>
        )}
      </nav>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          position: 'relative',
        }}
      >
        {activeSection ? renderSection(activeSection) : <SettingsLanding groups={landingGroups} />}
      </div>
    </div>
  );
}
