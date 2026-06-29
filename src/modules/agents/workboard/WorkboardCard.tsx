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

import { Activity, ShieldCheck } from 'lucide-react';
import { TagChip } from '@/components/shared/TagChip';
import { formatRelativeTime } from '../shared/format';
import { PRIORITY_COLOR, PRIORITY_LABEL } from './lanes';
import type { WorkboardCard as Card } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  card: Card;
  agents: ManagedAgent[];
  onClick: () => void;
}

const epochToIso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);

export function WorkboardCardView({ card, agents, onClick }: Props) {
  const agent = card.agent_id ? agents.find((a) => a.name === card.agent_id || a.id === card.agent_id) : undefined;
  const claimed = Boolean(card.claim?.owner_id);
  const heartbeatIso = epochToIso(card.claim?.last_heartbeat_at);
  const hasProof = (card.proof?.length ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span title={`prioridad ${PRIORITY_LABEL[card.priority]}`} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[card.priority], flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.title}
        </span>
        {hasProof && <ShieldCheck size={13} style={{ color: 'var(--green, #10b981)', flexShrink: 0 }} />}
      </div>

      {card.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.labels.slice(0, 4).map((l) => <TagChip key={l} tag={l} size="sm" />)}
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
    </button>
  );
}
