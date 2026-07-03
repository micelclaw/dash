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
  Globe, Palette, Shield, Search as SearchIcon, HardDrive, Network,
  UserCircle, Brain, Terminal, Lock, AppWindow, Code,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import { useSecurityStore } from '@/stores/security.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  SECTION_REGISTRY,
  KNOWN_SECTION_IDS,
  type SettingsGroupId,
} from '@/components/settings/sections';
import { NotFoundSection } from '@/components/settings/sections/NotFoundSection';
import { SettingsSidebarGroup } from '@/components/settings/SettingsSidebarGroup';
import { SettingsSidebarSearch } from '@/components/settings/SettingsSidebarSearch';
import { SettingsLanding, type LandingGroup } from './SettingsLanding';
import { searchSettings, validateSearchIndex } from './settings-search-index';

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
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
  dev: '#94a3b8',           // slate-400 — muted, not a user-facing group
};

// Items del sidebar de un grupo, derivados del registro de secciones
// (el orden visible = orden de inserción en SECTION_REGISTRY).
function sectionsForGroup(groupId: SettingsGroupId): SidebarItem[] {
  return Object.entries(SECTION_REGISTRY)
    .filter(([, entry]) => entry.meta.group === groupId)
    .map(([id, entry]) => ({ id, label: entry.meta.label, icon: entry.meta.icon ?? SearchIcon }));
}

function buildGroups(isAdmin: boolean): SidebarGroup[] {
  const groups: SidebarGroup[] = [
    {
      id: 'account',
      label: 'Account',
      icon: UserCircle,
      color: GROUP_COLORS.account,
      description: 'Your profile, permissions, license and approvals history.',
      sections: sectionsForGroup('account'),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      color: GROUP_COLORS.appearance,
      description: 'Theme, colors, language, keyboard shortcuts and dash notifications.',
      sections: sectionsForGroup('appearance'),
    },
    {
      id: 'ai-agents',
      label: 'AI & Agents',
      icon: Brain,
      color: GROUP_COLORS.aiAgents,
      description: 'AI models, voice, tools, memory, sessions, learned preferences and channel behavior.',
      sections: sectionsForGroup('ai-agents'),
    },
    {
      id: 'apps',
      label: 'Apps',
      icon: AppWindow,
      color: GROUP_COLORS.apps,
      description: 'Mail, calendar, photos, feeds, search, digest and duplicates.',
      sections: sectionsForGroup('apps'),
    },
    {
      id: 'connectivity',
      label: 'Connectivity',
      icon: Network,
      color: GROUP_COLORS.connectivity,
      description: 'Sync with external services, local network and OpenClaw Gateway configuration.',
      sections: sectionsForGroup('connectivity'),
    },
    {
      id: 'system',
      label: 'System',
      icon: HardDrive,
      color: GROUP_COLORS.system,
      description: 'Storage, database, energy, services, sensors and automation.',
      sections: sectionsForGroup('system'),
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      color: GROUP_COLORS.security,
      description: 'PIN, approval levels, agent sandbox, browser and shell commands.',
      sections: sectionsForGroup('security'),
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
        ...sectionsForGroup('admin'),
        // 'raw' es la página standalone /settings/raw (no vive en el
        // registro de secciones) — su item de sidebar se añade aquí.
        { id: 'raw', label: 'Raw JSON', icon: Terminal },
      ],
    });
  }
  // Dev group — only visible in development builds (not shipped in
  // production). Contains internal/debugging tools that would confuse
  // end-users. Gated by Vite's import.meta.env.DEV (true when running
  // `pnpm dev`, false after `pnpm build`).
  if (import.meta.env.DEV) {
    groups.push({
      id: 'dev',
      label: 'Dev',
      icon: Code,
      color: GROUP_COLORS.dev,
      description: 'Developer tools. Not visible in production builds.',
      sections: sectionsForGroup('dev'),
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

// La fuente de verdad de los IDs de sección y sus componentes es el
// registro `SECTION_REGISTRY` en components/settings/sections/index.ts —
// añadir una sección = una entrada allí (component + meta).

function renderSection(section: string) {
  const Entry = SECTION_REGISTRY[section]?.component;
  if (Entry) return <Entry />;
  // Unknown ID → explicit NotFound with suggestions, instead of
  // silently rendering General (which used to mask URL typos).
  return <NotFoundSection requestedId={section} knownIds={KNOWN_SECTION_IDS} />;
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
    return isAdmin ? results : results.filter((r) => r.entry.groupId !== 'admin');
  }, [searchQuery, isAdmin]);

  useEffect(() => {
    fetchSettings();
    fetchConfig();
  }, [fetchSettings, fetchConfig]);

  // Dev-only: warn on console if the search index has drifted from the
  // section registry. Keeps drift detectable without a test runner.
  useEffect(() => {
    // 'raw' no está en SECTION_REGISTRY (es una página standalone a la que se
    // redirige, ver useEffect de redirectedSection), pero SÍ es un destino de
    // búsqueda válido; lo incluimos para que el checker no lo marque fantasma.
    if (import.meta.env.DEV) validateSearchIndex([...KNOWN_SECTION_IDS, 'raw']);
  }, []);

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

  // Mobile: search input + flat dropdown grouped by category. When the
  // search has text we replace the dropdown with a result list so the
  // user can tap directly — typing on a long `<select optgroup>` is
  // unusable on small screens.
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
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ position: 'relative' }}>
            <SearchIcon
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings…"
              autoComplete="off"
              style={{
                width: '100%',
                height: 36,
                padding: '0 30px 0 32px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          {!searchQuery.trim() && (
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
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {searchQuery.trim() ? (
            searchResults.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '12px 0' }}>
                No results for «{searchQuery}»
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchResults.map((r) => {
                  const group = GROUPS.find((g) => g.id === r.entry.groupId);
                  const item = group?.sections.find((s) => s.id === r.entry.sectionId);
                  const Icon = item?.icon ?? SearchIcon;
                  const matchHint =
                    r.match.field === 'label'
                      ? group?.label
                      : `${group?.label ?? ''} · matches: ${r.match.term}`;
                  return (
                    <button
                      key={r.entry.sectionId}
                      type="button"
                      onClick={() => {
                        navigate(`/settings/${r.entry.sectionId}`, { replace: true });
                        setSearchQuery('');
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text)',
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={14} />
                        <span>{item?.label ?? r.entry.label}</span>
                      </span>
                      {matchHint && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: r.match.field === 'label' ? 'var(--text-muted)' : 'var(--amber)',
                            marginLeft: 22,
                          }}
                        >
                          {matchHint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : activeSection ? (
            renderSection(activeSection)
          ) : (
            <SettingsLanding groups={landingGroups} />
          )}
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
                const group = GROUPS.find((g) => g.id === r.entry.groupId);
                const item = group?.sections.find((s) => s.id === r.entry.sectionId);
                const Icon = item?.icon ?? SearchIcon;
                const isActive = activeSection === r.entry.sectionId;
                // When the match was a tag/setting (not the section
                // label itself), show "Group · matches: <term>" so the
                // user understands *why* this section showed up.
                const matchHint =
                  r.match.field === 'label'
                    ? group?.label
                    : `${group?.label ?? ''} · matches: ${r.match.term}`;
                return (
                  <button
                    key={r.entry.sectionId}
                    type="button"
                    onClick={() => {
                      navigate(`/settings/${r.entry.sectionId}`, { replace: true });
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
                      <span>{item?.label ?? r.entry.label}</span>
                    </span>
                    {matchHint && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: r.match.field === 'label' ? 'var(--text-muted)' : 'var(--amber)',
                          marginLeft: 22,
                        }}
                      >
                        {matchHint}
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
