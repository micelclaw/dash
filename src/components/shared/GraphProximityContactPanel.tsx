import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  User, Briefcase, MapPin, Hash, Network,
  StickyNote, Calendar, Mail, BookOpen, FolderOpen,
} from 'lucide-react';
import { IntelligencePanelHeader } from '@/components/shared/IntelligencePanelHeader';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import type { LucideIcon } from 'lucide-react';

interface GraphProximityContactPanelProps {
  contactId: string;
  onOpenGraph?: (entityId: string) => void;
}

interface MentionCount {
  domain: string;
  count: number;
}

interface ConnectedEntity {
  id: string;
  name: string;
  entity_type: string;
  confidence: number | null;
  target_name?: string;
  target_entity_type?: string;
}

const TYPE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  person: { icon: User, color: '#60a5fa' },
  project: { icon: Briefcase, color: '#a78bfa' },
  location: { icon: MapPin, color: '#34d399' },
  topic: { icon: Hash, color: '#fbbf24' },
};

const DOMAIN_ICONS: Record<string, { icon: LucideIcon; color: string; route: string }> = {
  note: { icon: StickyNote, color: 'var(--mod-notes)', route: '/notes' },
  event: { icon: Calendar, color: 'var(--mod-calendar)', route: '/calendar' },
  email: { icon: Mail, color: 'var(--mod-mail)', route: '/mail' },
  diary: { icon: BookOpen, color: 'var(--mod-diary)', route: '/diary' },
  file: { icon: FolderOpen, color: 'var(--mod-drive)', route: '/drive' },
};

export function GraphProximityContactPanel({ contactId, onOpenGraph }: GraphProximityContactPanelProps) {
  const navigate = useNavigate();
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const [mentions, setMentions] = useState<MentionCount[]>([]);
  const [entities, setEntities] = useState<ConnectedEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPro || !contactId) return;

    setLoading(true);
    api.get<{ data: any }>(`/links?source_type=contact&source_id=${contactId}&limit=50`)
      .then(res => {
        const links = (res as any).data ?? [];

        // Count mentions by domain (links FROM other domains TO this contact's graph entity)
        const domainCounts = new Map<string, number>();
        const graphEntities: ConnectedEntity[] = [];

        for (const link of links) {
          if (link.target_type === 'graph_entity') {
            graphEntities.push(link);
          } else {
            const d = link.target_type;
            domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
          }
        }

        setMentions(Array.from(domainCounts.entries()).map(([domain, count]) => ({ domain, count })));
        setEntities(graphEntities);
      })
      .catch(() => {
        setMentions([]);
        setEntities([]);
      })
      .finally(() => setLoading(false));
  }, [contactId, isPro]);

  if (!isPro) {
    return (
      <IntelligencePanelHeader title="Graph" storageKey="graph-contact">
        <ProUpsellPanel
          feature="Knowledge Graph"
          description="See entities and connections discovered by AI across your records."
        />
      </IntelligencePanelHeader>
    );
  }

  if (loading) {
    return (
      <IntelligencePanelHeader title="Graph" storageKey="graph-contact" defaultCollapsed={false}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 24, background: 'var(--surface)', borderRadius: 4, marginBottom: 4,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </IntelligencePanelHeader>
    );
  }

  if (mentions.length === 0 && entities.length === 0) return null;

  return (
    <IntelligencePanelHeader title="Graph" storageKey="graph-contact" defaultCollapsed={false}>
      {/* Mentioned in */}
      {mentions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
          }}>
            Mentioned in
          </div>
          {mentions.map(m => {
            const domainInfo = DOMAIN_ICONS[m.domain];
            if (!domainInfo) return null;
            const Icon = domainInfo.icon;
            return (
              <div
                key={m.domain}
                onClick={() => navigate(`${domainInfo.route}?mention=${contactId}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 0', fontSize: '0.8125rem', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
              >
                <Icon size={13} style={{ color: domainInfo.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'inherit' }}>{m.count} {m.domain}s</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>View →</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Connected entities */}
      {entities.length > 0 && (
        <div>
          <div style={{
            fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
          }}>
            Connected entities
          </div>
          {entities.map(entity => {
            const typeInfo = TYPE_ICONS[entity.target_entity_type ?? entity.entity_type] ?? TYPE_ICONS.topic;
            const Icon = typeInfo.icon;
            return (
              <div
                key={entity.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 0', fontSize: '0.8125rem',
                }}
              >
                <Icon size={13} style={{ color: typeInfo.color, flexShrink: 0 }} />
                <span style={{
                  flex: 1, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {entity.target_name ?? entity.name}
                </span>
                {entity.confidence != null && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {(entity.confidence * 100).toFixed(0)}%
                  </span>
                )}
                {onOpenGraph && (
                  <button
                    onClick={() => onOpenGraph(entity.id)}
                    title="View in graph"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                    }}
                  >
                    <Network size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </IntelligencePanelHeader>
  );
}
