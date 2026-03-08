import { useState, useEffect, useCallback } from 'react';
import { X, Search, Link, Check, FileText, Calendar, Mail, User, Bookmark, File } from 'lucide-react';
import { api } from '@/services/api';
import type { SearchResult } from '@/types/search';

interface EntityLinkData {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
  created_at: string;
}

const DOMAIN_TABS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes', icon: FileText },
  { id: 'event', label: 'Events', icon: Calendar },
  { id: 'email', label: 'Emails', icon: Mail },
  { id: 'contact', label: 'Contacts', icon: User },
  { id: 'file', label: 'Files', icon: File },
];

const DOMAIN_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  event: Calendar,
  email: Mail,
  contact: User,
  file: File,
  bookmark: Bookmark,
};

function getResultTitle(result: SearchResult): string {
  const r = result.record;
  if (!r) return result.snippet?.split('\n')[0]?.slice(0, 60) || result.domain || 'Unknown';
  switch (result.domain) {
    case 'note': return String(r.title || 'Untitled');
    case 'event': return String(r.title || 'Untitled event');
    case 'contact': return String(r.display_name || 'Unknown');
    case 'email': return String(r.subject || '(no subject)');
    case 'file': return String(r.filename || 'Untitled');
    case 'diary': return String(r.entry_date || 'Diary entry');
    default: return String(r.title || r.name || 'Unknown');
  }
}

export function EntityLinkPicker({ boardId, cardId, onClose, onLinksChanged }: {
  boardId: string;
  cardId: string;
  onClose: () => void;
  onLinksChanged?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [linkIdMap, setLinkIdMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load current links
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: EntityLinkData[] }>(`/projects/boards/${boardId}/cards/${cardId}/links`);
        setLinkedIds(new Set(res.data.map(l => l.target_id)));
        const idMap = new Map<string, string>();
        for (const l of res.data) {
          idMap.set(l.target_id, l.id);
        }
        setLinkIdMap(idMap);
      } catch {
        // ignore
      }
    })();
  }, [boardId, cardId]);

  // Search
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { q: search, limit: '20' };
        if (tab !== 'all') params.domains = tab;
        const res = await api.get<{ data: SearchResult[] }>('/search', params);
        setResults(res.data);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, tab]);

  const toggleLink = useCallback(async (result: SearchResult) => {
    const entityId = result.record_id;
    const isLinked = linkedIds.has(entityId);
    try {
      if (isLinked) {
        const linkId = linkIdMap.get(entityId);
        if (linkId) {
          await api.delete(`/projects/boards/${boardId}/cards/${cardId}/links/${linkId}`);
          setLinkedIds(prev => { const next = new Set(prev); next.delete(entityId); return next; });
          setLinkIdMap(prev => { const next = new Map(prev); next.delete(entityId); return next; });
          onLinksChanged?.();
        }
      } else {
        const res = await api.post<{ data: EntityLinkData }>(`/projects/boards/${boardId}/cards/${cardId}/links`, {
          target_type: result.domain,
          target_id: entityId,
          relationship: 'related_to',
        });
        setLinkedIds(prev => new Set(prev).add(entityId));
        setLinkIdMap(prev => new Map(prev).set(entityId, res.data.id));
        onLinksChanged?.();
      }
    } catch {
      // ignore
    }
  }, [boardId, cardId, linkedIds, linkIdMap, onLinksChanged]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(24px)' }} onClick={onClose} />
      <div style={{
        position: 'relative',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 500,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
            <Link size={14} />
            Link Entity
          </span>
          <button onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              autoFocus
              placeholder="Search notes, events, contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        </div>

        {/* Domain tabs */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: '6px 16px',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
        }}>
          {DOMAIN_TABS.map((dt) => (
            <button
              key={dt.id}
              onClick={() => setTab(dt.id)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: 'none',
                background: tab === dt.id ? 'var(--amber-dim)' : 'transparent',
                color: tab === dt.id ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {dt.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Searching...
            </div>
          )}

          {!loading && search.length >= 2 && results.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No results found
            </div>
          )}

          {!loading && search.length < 2 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Type at least 2 characters to search
            </div>
          )}

          {results.map((result) => {
            const entityId = result.record_id;
            const isLinked = linkedIds.has(entityId);
            const Icon = DOMAIN_ICONS[result.domain] ?? FileText;
            const title = getResultTitle(result);
            return (
              <div
                key={entityId}
                onClick={() => toggleLink(result)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>
                  {result.snippet && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.snippet.slice(0, 80)}
                    </div>
                  )}
                </div>
                {isLinked && <Check size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
};
