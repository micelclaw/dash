import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  StickyNote, Calendar, Users, Mail, FolderOpen, BookOpen, Link2,
} from 'lucide-react';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { IntelligencePanelHeader } from '@/components/shared/IntelligencePanelHeader';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { useAuthStore } from '@/stores/auth.store';
import { api, ApiError } from '@/services/api';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import type { SimilarItem } from '@/types/intelligence';

interface SimilarContentPanelProps {
  sourceType: string;
  sourceId: string;
}

const DOMAIN_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  note:          { icon: StickyNote, color: 'var(--mod-notes)' },
  notes:         { icon: StickyNote, color: 'var(--mod-notes)' },
  event:         { icon: Calendar,   color: 'var(--mod-calendar)' },
  events:        { icon: Calendar,   color: 'var(--mod-calendar)' },
  contact:       { icon: Users,      color: 'var(--mod-contacts)' },
  contacts:      { icon: Users,      color: 'var(--mod-contacts)' },
  email:         { icon: Mail,       color: 'var(--mod-mail)' },
  emails:        { icon: Mail,       color: 'var(--mod-mail)' },
  file:          { icon: FolderOpen, color: 'var(--mod-drive)' },
  files:         { icon: FolderOpen, color: 'var(--mod-drive)' },
  diary:         { icon: BookOpen,   color: 'var(--mod-diary)' },
  diary_entries: { icon: BookOpen,   color: 'var(--mod-diary)' },
};

const DOMAIN_ROUTES: Record<string, string> = {
  note:          '/notes',
  notes:         '/notes',
  event:         '/calendar',
  events:        '/calendar',
  contact:       '/contacts',
  contacts:      '/contacts',
  email:         '/mail',
  emails:        '/mail',
  file:          '/drive',
  files:         '/drive',
  diary:         '/diary',
  diary_entries: '/diary',
};

export function SimilarContentPanel({ sourceType, sourceId }: SimilarContentPanelProps) {
  const navigate = useNavigate();
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const fetchSimilar = useIntelligenceStore(s => s.fetchSimilar);
  const [items, setItems] = useState<SimilarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandLoading, setExpandLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isPro || !sourceId) return;
    let cancelled = false;

    setLoading(true);
    setExpanded(false);

    fetchSimilar(sourceType, sourceId, 3).then(results => {
      if (!cancelled) {
        setItems(results);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [sourceType, sourceId, isPro, fetchSimilar]);

  const handleShowMore = async () => {
    setExpandLoading(true);
    const results = await fetchSimilar(sourceType, sourceId, 10);
    setItems(results);
    setExpanded(true);
    setExpandLoading(false);
  };

  if (!isPro) {
    return (
      <IntelligencePanelHeader title="Similar Semantic" storageKey="similar">
        <ProUpsellPanel
          feature="Similar Content"
          description="See semantically similar records across your knowledge base using AI embeddings."
        />
      </IntelligencePanelHeader>
    );
  }

  if (loading) {
    return (
      <IntelligencePanelHeader title="Similar Semantic" storageKey="similar" defaultCollapsed={false}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 28, background: 'var(--surface)', borderRadius: 4, marginBottom: 4,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </IntelligencePanelHeader>
    );
  }

  if (items.length === 0) {
    return (
      <IntelligencePanelHeader title="Similar Semantic" storageKey="similar">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No similar items found
        </span>
      </IntelligencePanelHeader>
    );
  }

  const visible = expanded ? items : items.slice(0, 3);

  const handleLink = async (item: SimilarItem) => {
    try {
      await api.post('/links', {
        source_type: sourceType,
        source_id: sourceId,
        target_type: item.domain,
        target_id: item.record_id,
      });
      toast.success('Linked');
      window.dispatchEvent(new CustomEvent('links-changed'));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('Already linked');
      } else {
        toast.error('Failed to link');
      }
    }
  };

  return (
    <IntelligencePanelHeader title="Similar Semantic" storageKey="similar" defaultCollapsed={false}>
      {visible.map(item => {
        const domainInfo = DOMAIN_ICONS[item.domain];
        const Icon = domainInfo?.icon ?? StickyNote;
        const color = domainInfo?.color ?? 'var(--text-dim)';

        return (
          <div
            key={`${item.domain}:${item.record_id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0', cursor: 'pointer', fontSize: '0.8125rem',
            }}
            onClick={() => navigate(`${DOMAIN_ROUTES[item.domain] ?? '/'}?id=${item.record_id}`)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={14} style={{ color, flexShrink: 0 }} />
            <span style={{
              flex: 1, color: 'var(--text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {item.title || 'Untitled'}
            </span>
            <HeatBadge score={item.heat_score} />
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {(item.similarity * 100).toFixed(0)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleLink(item); }}
              title="Create link"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--amber)', padding: 2, flexShrink: 0,
              }}
            >
              <Link2 size={12} />
            </button>
          </div>
        );
      })}
      {!expanded && items.length >= 3 && (
        <button
          onClick={handleShowMore}
          disabled={expandLoading}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', color: 'var(--amber)', fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {expandLoading ? 'Loading...' : 'Show more...'}
        </button>
      )}
      {expanded && items.length > 3 && (
        <button
          onClick={() => { setExpanded(false); setItems(prev => prev.slice(0, 3)); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', color: 'var(--amber)', fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Show less
        </button>
      )}
    </IntelligencePanelHeader>
  );
}
