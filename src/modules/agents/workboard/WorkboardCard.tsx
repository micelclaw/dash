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

import { Activity, ShieldCheck, AlertTriangle, RotateCcw, Cpu, Archive } from 'lucide-react';
import { TagChip } from '@/components/shared/TagChip';
import { formatRelativeTime } from '../shared/format';
import { PRIORITY_COLOR, PRIORITY_LABEL } from './lanes';
import type { WorkboardCard as Card } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  card: Card;
  agents: ManagedAgent[];
}

const epochToIso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);

const chip = {
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 5,
  fontSize: '0.625rem', fontWeight: 600, lineHeight: 1.5,
} as const;

export function WorkboardCardView({ card, agents }: Props) {
  const agent = card.agent_id ? agents.find((a) => a.name === card.agent_id || a.id === card.agent_id) : undefined;
  const claimed = Boolean(card.claim?.owner_id);
  const heartbeatIso = epochToIso(card.claim?.last_heartbeat_at);
  const hasProof = (card.proof?.length ?? 0) > 0;
  const stale = Boolean(card.metadata?.stale);
  const failures = card.metadata?.failure_count ?? 0;
  const archived = Boolean(card.metadata?.archived_at);
  const running = card.status === 'running' && card.execution?.status === 'running';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'left',
        padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
        opacity: archived ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span title={`prioridad ${PRIORITY_LABEL[card.priority]}`} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[card.priority], flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.title}
        </span>
        {hasProof && <ShieldCheck size={13} style={{ color: 'var(--green, #10b981)', flexShrink: 0 }} />}
      </div>

      {(stale || failures > 0 || running || archived) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {archived && <span style={{ ...chip, color: 'var(--text-muted)', background: 'var(--bg-subtle, rgba(127,127,127,0.14))' }}><Archive size={10} /> archivada</span>}
          {stale && <span style={{ ...chip, color: 'var(--amber)', background: 'rgba(245,158,11,0.12)' }}><AlertTriangle size={10} /> obsoleta</span>}
          {failures > 0 && <span style={{ ...chip, color: 'var(--red, #ef4444)', background: 'rgba(239,68,68,0.12)' }}><RotateCcw size={10} /> {failures} {failures === 1 ? 'fallo' : 'fallos'}</span>}
          {running && <span style={{ ...chip, color: 'var(--blue, #3b82f6)', background: 'rgba(59,130,246,0.12)' }}><Cpu size={10} /> {card.execution?.engine || 'run'}</span>}
        </div>
      )}

      {card.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.labels.slice(0, 4).map((l) => <TagChip key={l} tag={l} size="sm" />)}
          {card.labels.length > 4 && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>+{card.labels.length - 4}</span>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
        {agent && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span>{agent.avatar || '🤖'}</span>{agent.display_name}
          </span>
        )}
        {claimed && (
          <span title={heartbeatIso ? `heartbeat ${formatRelativeTime(heartbeatIso)}` : 'reclamada'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--green, #10b981)' }}>
            <Activity size={11} />{heartbeatIso ? formatRelativeTime(heartbeatIso) : 'viva'}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>{formatRelativeTime(epochToIso(card.updated_at))}</span>
      </div>
    </div>
  );
}
