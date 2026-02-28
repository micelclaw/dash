import { User, Briefcase, MapPin, Hash } from 'lucide-react';
import { HeatBadge } from '@/components/shared/HeatBadge';
import type { GraphNode } from '@/types/intelligence';
import type { LucideIcon } from 'lucide-react';

interface GraphNodeTooltipProps {
  node: GraphNode | null;
  position: { x: number; y: number } | null;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  person: User,
  project: Briefcase,
  location: MapPin,
  topic: Hash,
};

export function GraphNodeTooltip({ node, position }: GraphNodeTooltipProps) {
  if (!node || !position) return null;

  const Icon = TYPE_ICONS[node.entity_type] ?? Hash;

  return (
    <div style={{
      position: 'fixed',
      left: position.x + 12,
      top: position.y - 10,
      zIndex: 500,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontFamily: 'var(--font-sans)',
      pointerEvents: 'none',
      maxWidth: 240,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
        <HeatBadge score={node.heat_score} size={6} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2,
      }}>
        <span style={{ textTransform: 'capitalize' }}>{node.entity_type}</span>
        <span>{node.mention_count} mention{node.mention_count !== 1 ? 's' : ''}</span>
        {node.heat_score > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            heat: {(node.heat_score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
