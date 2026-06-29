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

import { getAgentColor } from '../agent-colors';
import type { ManagedAgent } from '../types';

interface ParticipantPreviewProps {
  agents: ManagedAgent[];
  selectedIds: Set<string>;
  userParticipates: boolean;
}

/**
 * Fila visual de avatares de los participantes seleccionados (con borde de
 * color del agente) + el avatar "Tú" si el usuario participa. Vive sobre la
 * lista de checkboxes para dar feedback inmediato de quién asistirá.
 */
export function ParticipantPreview({ agents, selectedIds, userParticipates }: ParticipantPreviewProps) {
  const selected = agents.filter((a) => selectedIds.has(a.id));
  const total = selected.length + (userParticipates ? 1 : 0);

  if (total === 0) {
    return (
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 2px' }}>
        Selecciona al menos un participante.
      </div>
    );
  }

  const Avatar = ({ emoji, color, label }: { emoji: string; color: string; label: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 44 }}>
      <div
        title={label}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.05rem', background: 'var(--surface)',
          border: `2px solid ${color}`, boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 18%, transparent)`,
        }}
      >
        {emoji}
      </div>
      <span style={{ fontSize: '0.5625rem', color: 'var(--text-dim)', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start',
      padding: '10px 12px', marginBottom: 8,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    }}>
      {selected.map((a) => (
        <Avatar key={a.id} emoji={a.avatar ?? '🤖'} color={getAgentColor(a.name, a.color)} label={a.display_name} />
      ))}
      {userParticipates && <Avatar emoji="👤" color="var(--amber)" label="Tú" />}
    </div>
  );
}
