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

import { useState, useEffect } from 'react';
import { User, Briefcase, MapPin, Hash } from 'lucide-react';
import { IntelligencePanelHeader } from '@/components/shared/IntelligencePanelHeader';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { useAuthStore } from '@/stores/auth.store';
import type { LucideIcon } from 'lucide-react';
import type { GraphProximityItem } from '@/types/intelligence';

interface GraphProximityPanelProps {
  sourceType: string;
  sourceId: string;
  onOpenGraph?: (entityId: string) => void;
}

const TYPE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  person: { icon: User, color: '#60a5fa' },
  project: { icon: Briefcase, color: '#a78bfa' },
  location: { icon: MapPin, color: '#34d399' },
  topic: { icon: Hash, color: '#fbbf24' },
};

const MAX_VISIBLE = 3;

export function GraphProximityPanel({ sourceType, sourceId, onOpenGraph }: GraphProximityPanelProps) {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const fetchGraphProximity = useIntelligenceStore(s => s.fetchGraphProximity);
  const [entities, setEntities] = useState<GraphProximityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isPro || !sourceId) return;

    setLoading(true);
    setExpanded(false);
    fetchGraphProximity(sourceType, sourceId)
      .then(items => setEntities(items))
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, [sourceType, sourceId, isPro, fetchGraphProximity]);

  const handleOpenGraph = (entityId: string) => {
    if (onOpenGraph) {
      onOpenGraph(entityId);
    } else {
      window.dispatchEvent(new CustomEvent('open-graph', { detail: { entityId } }));
    }
  };

  if (!isPro) {
    return (
      <IntelligencePanelHeader title="Graph Proximity" storageKey="graph-proximity">
        <ProUpsellPanel
          feature="Knowledge Graph"
          description="See entities and connections discovered by AI across your records."
        />
      </IntelligencePanelHeader>
    );
  }

  if (loading) {
    return (
      <IntelligencePanelHeader title="Graph Proximity" storageKey="graph-proximity" defaultCollapsed={false}>
        {[1, 2].map(i => (
          <div key={i} style={{
            height: 24, background: 'var(--surface)', borderRadius: 4, marginBottom: 4,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </IntelligencePanelHeader>
    );
  }

  if (entities.length === 0) {
    return (
      <IntelligencePanelHeader title="Graph Proximity" storageKey="graph-proximity">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '2px 0' }}>
          No graph connections yet
        </div>
      </IntelligencePanelHeader>
    );
  }

  const visible = expanded ? entities : entities.slice(0, MAX_VISIBLE);
  const remaining = entities.length - MAX_VISIBLE;

  return (
    <IntelligencePanelHeader title="Graph Proximity" storageKey="graph-proximity" defaultCollapsed={false}>
      {visible.map(entity => {
        const typeInfo = TYPE_ICONS[entity.entity_type] ?? TYPE_ICONS.topic;
        const Icon = typeInfo.icon;

        return (
          <div
            key={entity.id}
            onClick={() => handleOpenGraph(entity.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 0', fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={13} style={{ color: typeInfo.color, flexShrink: 0 }} />
            <span style={{
              flex: 1, color: 'var(--text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {entity.name}
            </span>
            {entity.confidence != null && (
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {(entity.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
      {remaining > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', color: 'var(--amber)', fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Show {remaining} more...
        </button>
      )}
      {expanded && entities.length > MAX_VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
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
