import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import {
  MessageSquare, StickyNote, Calendar, Mail, Users, BookOpen,
  FolderOpen, Image, Bot, Settings, Plus, PanelLeft, Moon,
  Search, ArrowRight, Type, Brain, Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULES } from '@/config/modules';
import { useSidebarStore } from '@/stores/sidebar.store';
import { api } from '@/services/api';
import type { SearchResult } from '@/types/search';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type PaletteMode = 'search' | 'commands' | 'domain';

const DOMAIN_MAP: Record<string, string> = {
  notes: 'notes',
  mail: 'emails',
  calendar: 'events',
  contacts: 'contacts',
  drive: 'files',
  diary: 'diary',
  chat: 'conversations',
};

const DOMAIN_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  notes: { icon: StickyNote, color: 'var(--mod-notes)' },
  note: { icon: StickyNote, color: 'var(--mod-notes)' },
  events: { icon: Calendar, color: 'var(--mod-calendar)' },
  event: { icon: Calendar, color: 'var(--mod-calendar)' },
  emails: { icon: Mail, color: 'var(--mod-mail)' },
  email: { icon: Mail, color: 'var(--mod-mail)' },
  contacts: { icon: Users, color: 'var(--mod-contacts)' },
  contact: { icon: Users, color: 'var(--mod-contacts)' },
  files: { icon: FolderOpen, color: 'var(--mod-drive)' },
  file: { icon: FolderOpen, color: 'var(--mod-drive)' },
  diary: { icon: BookOpen, color: 'var(--mod-diary)' },
  conversations: { icon: MessageSquare, color: 'var(--mod-chat)' },
  conversation: { icon: MessageSquare, color: 'var(--mod-chat)' },
};

const DOMAIN_LABELS: Record<string, string> = {
  notes: 'Notes',
  note: 'Notes',
  events: 'Events',
  event: 'Events',
  emails: 'Mail',
  email: 'Mail',
  contacts: 'Contacts',
  contact: 'Contacts',
  files: 'Files',
  file: 'Files',
  diary: 'Diary',
  conversations: 'Conversations',
  conversation: 'Conversations',
};

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: 'Navigation' | 'Actions' | 'UI';
  action: () => void;
}

const ROUTE_MAP: Record<string, string> = {
  note: '/notes', event: '/calendar', contact: '/contacts',
  email: '/mail', file: '/drive', diary: '/diary', conversation: '/chat',
};

function getResultTitle(result: SearchResult): string {
  const r = result.record;
  switch (result.domain) {
    case 'note': return String(r.title || 'Untitled');
    case 'event': return String(r.title || 'Untitled event');
    case 'contact': return String(r.display_name || 'Unknown');
    case 'email': return String(r.subject || '(no subject)');
    case 'file': return String(r.filename || 'Untitled');
    case 'diary': return String(r.entry_date || 'Diary entry');
    case 'conversation': return String(r.first_message || 'Conversation');
    default: return 'Unknown';
  }
}

function getResultRoute(result: SearchResult): string {
  return `${ROUTE_MAP[result.domain] || '/'}?id=${result.record_id}`;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<PaletteMode>('search');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'auto' | 'fulltext' | 'semantic'>(() => {
    try { return (localStorage.getItem('claw-search-mode') as any) || 'auto'; } catch { return 'auto'; }
  });
  const [lastSearchType, setLastSearchType] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sidebarToggle = useSidebarStore((s) => s.toggle);

  const commands: CommandItem[] = useMemo(() => [
    { id: 'goto-chat', label: 'Go to AI Chat', icon: MessageSquare, group: 'Navigation', action: () => navigate('/chat') },
    { id: 'goto-notes', label: 'Go to Notes', icon: StickyNote, group: 'Navigation', action: () => navigate('/notes') },
    { id: 'goto-calendar', label: 'Go to Calendar', icon: Calendar, group: 'Navigation', action: () => navigate('/calendar') },
    { id: 'goto-mail', label: 'Go to Mail', icon: Mail, group: 'Navigation', action: () => navigate('/mail') },
    { id: 'goto-contacts', label: 'Go to Contacts', icon: Users, group: 'Navigation', action: () => navigate('/contacts') },
    { id: 'goto-diary', label: 'Go to Diary', icon: BookOpen, group: 'Navigation', action: () => navigate('/diary') },
    { id: 'goto-drive', label: 'Go to Drive', icon: FolderOpen, group: 'Navigation', action: () => navigate('/drive') },
    { id: 'goto-photos', label: 'Go to Photos', icon: Image, group: 'Navigation', action: () => navigate('/photos') },
    { id: 'goto-agents', label: 'Go to Agents', icon: Bot, group: 'Navigation', action: () => navigate('/agents') },
    { id: 'goto-settings', label: 'Go to Settings', icon: Settings, group: 'Navigation', action: () => navigate('/settings') },
    { id: 'create-note', label: 'Create new note', icon: Plus, group: 'Actions', action: () => navigate('/notes?action=new') },
    { id: 'create-event', label: 'Create new event', icon: Plus, group: 'Actions', action: () => navigate('/calendar?action=new') },
    { id: 'create-diary', label: 'Create diary entry', icon: Plus, group: 'Actions', action: () => navigate('/diary?action=new') },
    { id: 'toggle-sidebar', label: 'Toggle sidebar', icon: PanelLeft, group: 'UI', action: sidebarToggle },
    { id: 'toggle-theme', label: 'Toggle dark/light', icon: Moon, group: 'UI', action: () => {} },
  ], [navigate, sidebarToggle]);

  // Detect mode from input prefix
  useEffect(() => {
    if (inputValue.startsWith('>')) {
      setMode('commands');
      setSelectedDomain(null);
    } else if (inputValue.startsWith('@')) {
      setMode('domain');
    } else {
      setMode('search');
      setSelectedDomain(null);
    }
  }, [inputValue]);

  // Debounced search
  useEffect(() => {
    if (mode !== 'search' && !(mode === 'domain' && selectedDomain)) return;

    let query = inputValue;
    let domains: string | undefined;

    if (mode === 'domain' && selectedDomain) {
      const prefix = `@${selectedDomain} `;
      query = inputValue.slice(prefix.length);
      domains = DOMAIN_MAP[selectedDomain];
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params: Record<string, string | number> = {
          q: query.trim(),
          limit: 12,
        };
        if (domains) params.domains = domains;
        if (searchMode !== 'auto') params.mode = searchMode;
        const res = await api.get<{ data: SearchResult[]; meta?: { search_type?: string } }>('/search', params);
        setSearchResults(res.data);
        setLastSearchType((res as any).meta?.search_type || null);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, mode, selectedDomain, searchMode]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setInputValue('');
      setMode('search');
      setSelectedDomain(null);
      setSearchResults([]);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (inputValue) {
        setInputValue('');
      } else {
        onClose();
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Backspace' && !inputValue.slice(mode === 'commands' ? 1 : 0).trim()) {
      if (mode === 'commands' || (mode === 'domain' && !selectedDomain)) {
        setInputValue('');
        setMode('search');
        e.preventDefault();
      } else if (mode === 'domain' && selectedDomain) {
        setInputValue('@');
        setSelectedDomain(null);
        e.preventDefault();
      }
    }

    if (e.key === 'Tab' && mode === 'domain' && !selectedDomain) {
      e.preventDefault();
      const typed = inputValue.slice(1).toLowerCase();
      const match = Object.keys(DOMAIN_MAP).find((d) => d.startsWith(typed));
      if (match) {
        setSelectedDomain(match);
        setInputValue(`@${match} `);
      }
    }
  }, [inputValue, mode, selectedDomain, onClose]);

  const handleSelect = useCallback((route: string) => {
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  // Group search results by domain (max 3 per domain)
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const r of searchResults) {
      const existing = groups.get(r.domain) ?? [];
      groups.set(r.domain, [...existing, r]);
    }
    return groups;
  }, [searchResults]);

  const placeholder = mode === 'commands'
    ? 'Run a command...'
    : mode === 'domain' && selectedDomain
      ? `@${selectedDomain} Search in ${DOMAIN_LABELS[DOMAIN_MAP[selectedDomain] ?? ''] ?? selectedDomain}...`
      : mode === 'domain'
        ? '@domain query...'
        : 'Search across all domains...';

  if (!open) return null;

  const commandFilter = mode === 'commands' ? inputValue.slice(1).toLowerCase() : '';

  const domainSuggestions = mode === 'domain' && !selectedDomain
    ? Object.keys(DOMAIN_MAP).filter((d) => d.startsWith(inputValue.slice(1).toLowerCase()))
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--z-command-palette)',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      {/* Palette */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 'var(--z-command-palette)',
          width: '100%',
          maxWidth: 600,
          maxHeight: '70vh',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Command shouldFilter={mode === 'commands'} onKeyDown={handleKeyDown}>
          <Command.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={placeholder}
            autoFocus
            style={{
              width: '100%',
              height: 48,
              padding: '0 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <Command.List
            style={{
              maxHeight: 'calc(70vh - 48px)',
              overflowY: 'auto',
              padding: 8,
            }}
          >
            {/* --- SEARCH MODE --- */}
            {mode === 'search' && (
              <>
                {isSearching && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    Searching...
                  </div>
                )}
                {!isSearching && inputValue.trim() && searchResults.length === 0 && (
                  <Command.Empty style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                    No results found.
                  </Command.Empty>
                )}
                {!inputValue.trim() && (
                  <>
                    <div style={{ padding: '8px 12px', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Quick navigation
                    </div>
                    {MODULES.filter((m) => m.path).map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <Command.Item
                          key={mod.id}
                          value={mod.label}
                          onSelect={() => handleSelect(mod.path!)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            color: 'var(--text)',
                          }}
                          data-cmdk-item=""
                        >
                          <Icon size={18} style={{ color: mod.color }} />
                          <span>{mod.label}</span>
                        </Command.Item>
                      );
                    })}
                  </>
                )}
                {searchResults.length > 0 && Array.from(groupedResults.entries()).map(([domain, items]) => {
                  const domainInfo = DOMAIN_ICONS[domain];
                  const DomainIcon = domainInfo?.icon ?? Search;
                  const domainColor = domainInfo?.color ?? 'var(--text-dim)';
                  const label = DOMAIN_LABELS[domain] ?? domain;
                  const visibleItems = items.slice(0, 3);
                  const remaining = items.length - visibleItems.length;
                  const mod = MODULES.find((m) => m.path && DOMAIN_MAP[m.id] === domain);

                  return (
                    <Command.Group key={domain} heading="">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <DomainIcon size={12} style={{ color: domainColor }} />
                        {label}
                      </div>
                      {visibleItems.map((result) => {
                        const rInfo = DOMAIN_ICONS[domain];
                        const RIcon = rInfo?.icon ?? Search;
                        const rColor = rInfo?.color ?? 'var(--text-dim)';
                        return (
                          <Command.Item
                            key={result.record_id}
                            value={`${getResultTitle(result)} ${result.snippet}`}
                            onSelect={() => handleSelect(getResultRoute(result))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '6px 12px 6px 24px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.8125rem',
                            }}
                            data-cmdk-item=""
                          >
                            <RIcon size={14} style={{ color: rColor, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {getResultTitle(result)}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {result.snippet}
                              </div>
                            </div>
                            {result.score > 0 && (searchMode === 'semantic' || lastSearchType === 'hybrid_rrf') && (
                              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
                                {result.score.toFixed(2)}
                              </span>
                            )}
                          </Command.Item>
                        );
                      })}
                      {remaining > 0 && mod?.path && (
                        <Command.Item
                          value={`more ${label}`}
                          onSelect={() => handleSelect(`${mod.path}?q=${encodeURIComponent(inputValue)}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                            padding: '4px 12px 4px 24px',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            color: 'var(--amber)',
                          }}
                          data-cmdk-item=""
                        >
                          {remaining} more results
                          <ArrowRight size={12} />
                        </Command.Item>
                      )}
                    </Command.Group>
                  );
                })}
              </>
            )}

            {/* --- COMMANDS MODE --- */}
            {mode === 'commands' && (
              <>
                <Command.Empty style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                  No commands found.
                </Command.Empty>
                {(['Navigation', 'Actions', 'UI'] as const).map((group) => {
                  const groupCommands = commands.filter((c) => {
                    if (c.group !== group) return false;
                    if (!commandFilter) return true;
                    return c.label.toLowerCase().includes(commandFilter);
                  });
                  if (groupCommands.length === 0) return null;
                  return (
                    <Command.Group key={group} heading="">
                      <div style={{ padding: '8px 12px 4px', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {group}
                      </div>
                      {groupCommands.map((cmd) => {
                        const Icon = cmd.icon;
                        return (
                          <Command.Item
                            key={cmd.id}
                            value={cmd.label}
                            onSelect={() => {
                              cmd.action();
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.875rem',
                              color: 'var(--text)',
                            }}
                            data-cmdk-item=""
                          >
                            <Icon size={16} style={{ color: 'var(--text-dim)' }} />
                            <span>{cmd.label}</span>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  );
                })}
              </>
            )}

            {/* --- DOMAIN FILTER MODE --- */}
            {mode === 'domain' && !selectedDomain && (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Filter by domain
                </div>
                {domainSuggestions.map((d) => {
                  const apiDomain = DOMAIN_MAP[d]!;
                  const info = DOMAIN_ICONS[apiDomain];
                  const DIcon = info?.icon ?? Search;
                  return (
                    <Command.Item
                      key={d}
                      value={d}
                      onSelect={() => {
                        setSelectedDomain(d);
                        setInputValue(`@${d} `);
                        inputRef.current?.focus();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        color: 'var(--text)',
                      }}
                      data-cmdk-item=""
                    >
                      <DIcon size={16} style={{ color: info?.color ?? 'var(--text-dim)' }} />
                      <span>@{d}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                        Search in {DOMAIN_LABELS[apiDomain] ?? d}
                      </span>
                    </Command.Item>
                  );
                })}
              </>
            )}

            {mode === 'domain' && selectedDomain && (
              <>
                {isSearching && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    Searching in {selectedDomain}...
                  </div>
                )}
                {!isSearching && inputValue.slice(`@${selectedDomain} `.length).trim() && searchResults.length === 0 && (
                  <Command.Empty style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                    No results in {selectedDomain}.
                  </Command.Empty>
                )}
                {searchResults.map((result) => {
                  const dInfo = selectedDomain ? DOMAIN_ICONS[DOMAIN_MAP[selectedDomain] ?? ''] : undefined;
                  const DResultIcon = dInfo?.icon ?? Search;
                  const dResultColor = dInfo?.color ?? 'var(--text-dim)';
                  return (
                    <Command.Item
                      key={result.record_id}
                      value={`${getResultTitle(result)} ${result.snippet}`}
                      onSelect={() => handleSelect(getResultRoute(result))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8125rem',
                      }}
                      data-cmdk-item=""
                    >
                      <DResultIcon size={14} style={{ color: dResultColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getResultTitle(result)}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {result.snippet}
                        </div>
                      </div>
                    </Command.Item>
                  );
                })}
              </>
            )}
          </Command.List>
        </Command>

        {/* Search mode toggle */}
        {(mode === 'search' || (mode === 'domain' && selectedDomain)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 16px',
              borderTop: '1px solid var(--border)',
            }}
          >
            {(['fulltext', 'semantic'] as const).map((sm) => {
              const isActive = searchMode === sm || (searchMode === 'auto' && sm === 'fulltext');
              const isPro = sm === 'semantic';
              return (
                <button
                  key={sm}
                  onClick={() => {
                    const next = sm === searchMode ? 'auto' : sm;
                    setSearchMode(next);
                    try { localStorage.setItem('claw-search-mode', next); } catch { /* */ }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 24,
                    padding: '0 10px',
                    background: searchMode === sm ? 'var(--amber)' : 'var(--surface)',
                    color: searchMode === sm ? '#06060a' : 'var(--text-muted)',
                    border: searchMode === sm ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    fontWeight: searchMode === sm ? 600 : 400,
                  }}
                >
                  {sm === 'fulltext' ? <Type size={10} /> : <Brain size={10} />}
                  {sm === 'fulltext' ? 'Keywords' : 'Semantic'}
                  {isPro && searchMode !== 'semantic' && <Lock size={8} style={{ opacity: 0.6 }} />}
                </button>
              );
            })}
            {lastSearchType === 'hybrid_rrf' && searchMode === 'auto' && searchResults.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: '0.625rem', color: 'var(--amber)', fontFamily: 'var(--font-sans)' }}>
                semantic
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {searchMode === 'auto' ? 'Auto' : searchMode === 'fulltext' ? 'Keywords' : 'Semantic'}
            </span>
          </div>
        )}

        {/* Footer hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          <span><kbd style={kbdStyle}>↑↓</kbd> Navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> Select</span>
          <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
          {mode === 'search' && <span style={{ marginLeft: 'auto' }}><kbd style={kbdStyle}>&gt;</kbd> Commands <kbd style={kbdStyle}>@</kbd> Domain filter</span>}
        </div>
      </div>

      {/* cmdk item hover styles */}
      <style>{`
        [data-cmdk-item][data-selected="true"] {
          background: var(--surface-hover);
        }
        [data-cmdk-item]:hover {
          background: var(--surface-hover);
        }
      `}</style>
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: '0.625rem',
  padding: '1px 4px',
  background: 'var(--surface)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};
