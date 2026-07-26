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

import { getAgentColor } from '@/modules/agents/agent-colors';

/**
 * Canonical read-only agent avatar: emoji on a subtle circle tinted with the
 * agent's color. Display-only counterpart of EmojiAvatarPicker (which is an
 * editor and always renders a clickable button).
 *
 * New surfaces should use this instead of re-inlining `{agent.avatar || '🤖'}`
 * (~15 legacy call-sites pending migration — see pending-debt).
 */
export function AgentAvatar({ avatar, name, color, size = 20, title }: {
  /** Emoji del agente (o null → fallback 🤖). */
  avatar: string | null;
  /** Nombre del agente — semilla del color por hash + tooltip por defecto. */
  name: string;
  /** Color custom del agente (agent.color); si falta se deriva del nombre. */
  color?: string;
  /** Diámetro en px. */
  size?: number;
  /** Tooltip; por defecto el nombre. */
  title?: string;
}) {
  const accent = getAgentColor(name, color || undefined);
  return (
    <span
      title={title ?? name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${accent}20`,
        border: `1px solid ${accent}40`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.6),
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {avatar || '🤖'}
    </span>
  );
}
