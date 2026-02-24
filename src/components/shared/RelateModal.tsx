import { useState, useEffect } from 'react';
import {
  X, StickyNote, Calendar, Users, Mail, FolderOpen, BookOpen, Link2, Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores/notification.store';
import { toast } from 'sonner';

interface RelateModalProps {
  open: boolean;
  sourceType: string;
  sourceId: string;
  onClose: () => void;
  onLinked?: () => void;
}

interface SearchResult {
  id: string;
  domain: string;
  title: string;
  subtitle?: string;
}

const DOMAINS: { value: string; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'note', label: 'Notes', icon: StickyNote, color: 'var(--mod-notes)' },
  { value: 'event', label: 'Events', icon: Calendar, color: 'var(--mod-calendar)' },
  { value: 'contact', label: 'Contacts', icon: Users, color: 'var(--mod-contacts)' },
  { value: 'email', label: 'Emails', icon: Mail, color: 'var(--mod-mail)' },
  { value: 'file', label: 'Files', icon: FolderOpen, color: 'var(--mod-drive)' },
  { value: 'diary', label: 'Diary', icon: BookOpen, color: 'var(--mod-diary)' },
];

export function RelateModal({ open, sourceType, sourceId, onClose, onLinked }: RelateModalProps) {
  const addNotification = useNotificationStore(s => s.addNotification);
  const [targetDomain, setTargetDomain] = useState(DOMAINS[0]!.value);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  // Search when query or domain changes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ data: SearchResult[] }>(
          `/search?q=${encodeURIComponent(query)}&domain=${targetDomain}&limit=10`
        );
        setResults(res.data);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, targetDomain]);

  const handleLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    try {
      await api.post('/links', {
        source_type: sourceType,
        source_id: sourceId,
        target_type: targetDomain,
        target_id: selectedId,
        link_type: 'manual',
        created_by: 'user',
      });
      toast.success('Relation created');
      onLinked?.();
      onClose();
    } catch {
      addNotification({ type: 'system', title: 'Error', body: 'Failed to create relation' });
    }
    setLinking(false);
  };

  if (!open) return null;

  const domainConfig = DOMAINS.find(d => d.value === targetDomain) ?? DOMAINS[0]!;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 480,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Relate with...
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' }}>
          {/* Domain selector */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DOMAINS.map(d => {
              const Icon = d.icon;
              const active = targetDomain === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => { setTargetDomain(d.value); setSelectedId(null); setResults([]); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: active ? `color-mix(in srgb, ${d.color} 15%, transparent)` : 'transparent',
                    border: active ? `1px solid ${d.color}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)',
                    color: active ? d.color : 'var(--text-dim)',
                    fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Icon size={12} />
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedId(null); }}
              placeholder={`Search ${domainConfig.label.toLowerCase()}...`}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px 8px 30px',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Results */}
          <div style={{
            flex: 1, overflowY: 'auto',
            border: results.length > 0 ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 240,
          }}>
            {searching && (
              <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Searching...
              </div>
            )}
            {!searching && query.length >= 2 && results.length === 0 && (
              <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                No results found
              </div>
            )}
            {results.map(r => {
              const isSelected = selectedId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(isSelected ? null : r.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    width: '100%', padding: '10px 12px',
                    background: isSelected ? 'var(--amber-dim)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    border: 'none',
                    borderBottomStyle: 'solid',
                    borderBottomWidth: 1,
                    borderBottomColor: 'var(--border)',
                    cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)', fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontWeight: 500 }}>{r.title}</span>
                  {r.subtitle && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {r.subtitle}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedId || linking}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: (!selectedId || linking) ? 'var(--surface)' : 'var(--amber)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: (!selectedId || linking) ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: (!selectedId || linking) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Link2 size={14} />
            {linking ? 'Linking...' : 'Create relation'}
          </button>
        </div>
      </div>
    </div>
  );
}
