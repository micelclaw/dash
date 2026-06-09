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

// Anillo de % de contexto en la toolbar del chat. Lee `sessions.describe`
// (vía /conversations/threads/:id/context) → totalTokens / contextTokens.
// Cambia de color según se llena (verde→ámbar→rojo) para avisar antes de que
// la auto-compactación de OpenClaw salte a mitad de un turno. Se oculta si no
// hay sesión todavía (pct null). Refetch: montaje + cambio de conversación +
// fin de turno (el contexto solo crece al cerrarse un turno).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { getConversationContext, type SessionContext } from '@/services/gateway.service';

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function ringColor(pct: number): string {
  if (pct >= 90) return 'var(--error)';
  if (pct >= 70) return 'var(--amber)';
  return 'var(--success)';
}

export function ContextRing() {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const [ctx, setCtx] = useState<SessionContext | null>(null);

  const refetch = useCallback(() => {
    if (!activeConvId) {
      setCtx(null);
      return;
    }
    getConversationContext(activeConvId)
      .then(setCtx)
      .catch(() => { /* silencioso — el anillo se oculta si falla */ });
  }, [activeConvId]);

  // Montaje + cambio de conversación.
  useEffect(() => { refetch(); }, [refetch]);

  // Fin de turno: streamingMessage no-null → null = el contexto acaba de crecer.
  const prevStreaming = useRef(!!streamingMessage);
  useEffect(() => {
    const was = prevStreaming.current;
    prevStreaming.current = !!streamingMessage;
    if (was && !streamingMessage) refetch();
  }, [streamingMessage, refetch]);

  if (!ctx || ctx.pct == null || ctx.window == null) return null;

  const pct = Math.min(100, ctx.pct);
  const color = ringColor(pct);
  const R = 8;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);
  const title = `Contexto: ${fmtK(ctx.used)} / ${fmtK(ctx.window)} (${ctx.pct}%)`;

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={refetch}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        lineHeight: 0,
      }}
    >
      <svg width={22} height={22} viewBox="0 0 20 20">
        <circle cx={10} cy={10} r={R} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle
          cx={10}
          cy={10}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 10 10)"
          style={{ transition: 'stroke-dashoffset 400ms ease, stroke 400ms ease' }}
        />
        <text
          x={10}
          y={10}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={ctx.pct >= 100 ? 5.5 : 7}
          fontWeight={700}
          fill="var(--text-dim)"
        >
          {ctx.pct}
        </text>
      </svg>
    </button>
  );
}
