import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  StickyNote, Calendar, Users, Mail, FolderOpen, BookOpen, ArrowRight, Trash2,
} from 'lucide-react';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { LinkedRecord } from '@/types/links';

interface RelatedItemsPanelProps {
  links: LinkedRecord[];
  loading?: boolean;
  /** Called before navigating — use to close modals/panels */
  onNavigate?: () => void;
}

const DOMAIN_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  note: { icon: StickyNote, color: 'var(--mod-notes)' },
  event: { icon: Calendar, color: 'var(--mod-calendar)' },
  contact: { icon: Users, color: 'var(--mod-contacts)' },
  email: { icon: Mail, color: 'var(--mod-mail)' },
  file: { icon: FolderOpen, color: 'var(--mod-drive)' },
  diary: { icon: BookOpen, color: 'var(--mod-diary)' },
};

const MAX_VISIBLE = 8;

export function RelatedItemsPanel({ links, loading, onNavigate }: RelatedItemsPanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: '8px 16px' }}>
        <div style={headerStyle}>Related</div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 32, background: 'var(--surface)', borderRadius: 4, marginBottom: 4 }} />
        ))}
      </div>
    );
  }

  if (links.length === 0) return null;

  const visible = expanded ? links : links.slice(0, MAX_VISIBLE);
  const remaining = links.length - MAX_VISIBLE;

  return (
    <div style={{ padding: '8px 16px 12px' }}>
      <div style={headerStyle}>Related</div>
      {visible.map(rec => {
        const domainInfo = DOMAIN_ICONS[rec.domain];
        const Icon = domainInfo?.icon ?? StickyNote;
        const color = domainInfo?.color ?? 'var(--text-dim)';

        const contextItems: ContextMenuItem[] = [
          {
            label: 'Remove relation',
            icon: Trash2,
            variant: 'danger',
            onClick: async () => {
              try {
                await api.delete(`/links/${rec.link.id}`);
                toast.success('Relation removed');
                window.dispatchEvent(new CustomEvent('links-changed'));
              } catch {
                toast.error('Failed to remove relation');
              }
            },
          },
        ];

        return (
          <ContextMenu key={rec.link.id} trigger={
            <div
              onClick={() => { onNavigate?.(); navigate(rec.record.route); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0', cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon size={14} style={{ color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {rec.record.title}
              </span>
              {rec.record.subtitle && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                  {rec.record.subtitle}
                </span>
              )}
              <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          } items={contextItems} />
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
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
  paddingBottom: 4,
  borderBottom: '1px solid var(--border)',
};
