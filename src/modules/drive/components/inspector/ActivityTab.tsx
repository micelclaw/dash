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

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity as ActivityIcon, RefreshCw, Download, Eye, Play, FileText, Pencil,
  Plus, Trash2, UserPlus, UserX, Link2, Unlink, Globe, User,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/services/api';
import type { LucideIcon } from 'lucide-react';

interface ActivityActor {
  kind: 'user' | 'agent' | 'public';
  name?: string;
  avatar?: string;
  color?: string;
}

interface ActivityItem {
  ts: string;
  type: string;
  actor: ActivityActor;
  source: 'change' | 'access' | 'share' | 'link';
  detail: Record<string, unknown>;
}

interface ActivityTabProps {
  fileId: string;
}

const TYPE_META: Record<string, { icon: LucideIcon; verb: string }> = {
  'change.create': { icon: Plus, verb: 'created this file' },
  'change.insert': { icon: Plus, verb: 'created this file' },
  'change.update': { icon: Pencil, verb: 'edited this file' },
  'change.delete': { icon: Trash2, verb: 'deleted this file' },
  'access.download': { icon: Download, verb: 'downloaded this file' },
  'access.preview': { icon: Eye, verb: 'previewed this file' },
  'access.stream': { icon: Play, verb: 'streamed this file' },
  'access.content': { icon: FileText, verb: 'read the content' },
  'share.granted': { icon: UserPlus, verb: 'shared this file' },
  'share.revoked': { icon: UserX, verb: 'revoked a share' },
  'link.created': { icon: Link2, verb: 'created a public link' },
  'link.revoked': { icon: Unlink, verb: 'revoked a public link' },
  'link.downloads': { icon: Globe, verb: 'downloads via public link' },
};

function dayLabel(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function describe(item: ActivityItem): string {
  const meta = TYPE_META[item.type];
  const base = meta?.verb ?? item.type;
  if (item.type === 'share.granted' && item.detail.shared_with) {
    return `shared this file with ${String(item.detail.shared_with)}${item.detail.permission ? ` (${String(item.detail.permission)})` : ''}`;
  }
  if (item.type === 'share.revoked' && item.detail.shared_with) {
    return `revoked the share for ${String(item.detail.shared_with)}`;
  }
  if (item.type === 'link.downloads' && item.detail.download_count) {
    return `${String(item.detail.download_count)} download${Number(item.detail.download_count) === 1 ? '' : 's'} via public link`;
  }
  if (item.type === 'change.update') {
    const cols = Array.isArray(item.detail.affected_columns) ? item.detail.affected_columns as string[] : [];
    return cols.length > 0 ? `edited this file (${cols.join(', ')})` : base;
  }
  return base;
}

/**
 * Inspector → Activity: unified timeline from GET /files/:id/activity
 * (edits + accesses + shares + public links), grouped by day, with the actor
 * rendered as agent avatar (emoji + color), globe (public) or user.
 */
export function ActivityTab({ fileId }: ActivityTabProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { items: ActivityItem[]; limit: number } }>(
        `/files/${fileId}/activity`, { limit: 100 },
      );
      setItems(res.data.items ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [fileId]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of items) {
      const label = dayLabel(item.ts);
      const arr = map.get(label);
      if (arr) arr.push(item); else map.set(label, [item]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header row: count + refresh */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <ActivityIcon size={13} style={{ color: 'var(--mod-drive)' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {loading ? 'Loading…' : `${items.length} event${items.length === 1 ? '' : 's'}`}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { void load(); }}
          title="Refresh"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, display: 'flex',
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {!loading && items.length === 0 && (
        <div style={{ minHeight: 220 }}>
          <EmptyState
            icon={ActivityIcon}
            title="No activity yet"
            description="Edits, downloads, previews and shares of this file will show up here."
          />
        </div>
      )}

      <div style={{ padding: '6px 14px 14px' }}>
        {groups.map(([label, groupItems]) => (
          <div key={label}>
            <div style={{
              fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.04em', color: 'var(--text-muted)',
              padding: '10px 0 6px',
            }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groupItems.map((item, i) => (
                <ActivityRow key={`${item.ts}-${item.type}-${i}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta?.icon ?? ActivityIcon;
  const time = new Date(item.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
    }}>
      <Icon size={13} style={{ color: 'var(--mod-drive)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ActorChip actor={item.actor} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{describe(item)}</span>
        </div>
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
        {time}
      </span>
    </div>
  );
}

function ActorChip({ actor }: { actor: ActivityActor }) {
  if (actor.kind === 'agent') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: '50%',
            background: actor.color ? `${actor.color}33` : 'var(--surface-hover)',
            border: `1px solid ${actor.color ?? 'var(--border)'}`,
            fontSize: '0.625rem', lineHeight: 1, flexShrink: 0,
          }}
        >
          {actor.avatar || '🤖'}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: actor.color ?? 'var(--text)' }}>
          {actor.name ?? 'Agent'}
        </span>
      </span>
    );
  }
  if (actor.kind === 'public') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Globe size={13} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>Public</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%',
        background: 'var(--surface-hover)', border: '1px solid var(--border)', flexShrink: 0,
      }}>
        <User size={10} style={{ color: 'var(--text-dim)' }} />
      </span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>You</span>
    </span>
  );
}
