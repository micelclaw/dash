/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * GoalChip (U1, OpenClaw 6.1) — chip en el toolbar del chat que muestra el
 * "objetivo de sesión" activo de la conversación.
 *
 * OpenClaw 6.1 añade Session goals (`/goal`, tools get/create/update_goal). El
 * comando `/goal` es pass-through: Core NO lo intercepta y OpenClaw lo procesa
 * nativamente. Como 6.1 NO emite un evento WS `goal.*`, el chip DERIVA el estado
 * (read-only) de los propios mensajes `/goal` del usuario en el store del chat —
 * instantáneo, robusto y sin tocar `chat.store`. (Limitación conocida: si el
 * AGENTE cambia el goal vía update_goal, el chip no lo refleja hasta el próximo
 * `/goal` del usuario.)
 */
import { useMemo } from 'react';
import { Target, Pause, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import type { Message } from '@/types/chat';

type GoalState = 'active' | 'paused' | 'blocked' | 'complete';
interface Goal { text: string; state: GoalState; }

// `/goal <sub> <resto>` — sub y resto opcionales.
const GOAL_RE = /^\s*\/goal(?:\s+(\S+))?(?:\s+([\s\S]*?))?\s*$/i;

/**
 * Reduce los mensajes `/goal` del usuario (en orden) a un estado de goal.
 * `start|set|create <texto>` fija el objetivo; `pause|resume|complete|block`
 * cambian el estado; `clear` lo borra; `status`/sin-sub no cambian nada.
 */
export function deriveGoal(messages: Message[] | undefined): Goal | null {
  if (!messages?.length) return null;
  let goal: Goal | null = null;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const match = GOAL_RE.exec(m.content ?? '');
    if (!match) continue;
    const sub = (match[1] ?? 'status').toLowerCase();
    const rest = (match[2] ?? '').trim();
    switch (sub) {
      case 'start': case 'set': case 'create':
        goal = { text: rest || goal?.text || 'Objetivo', state: 'active' };
        break;
      case 'pause':    if (goal) goal = { ...goal, state: 'paused' }; break;
      case 'resume':   if (goal) goal = { ...goal, state: 'active' }; break;
      case 'complete': case 'done':    if (goal) goal = { ...goal, state: 'complete' }; break;
      case 'block':    case 'blocked': if (goal) goal = { ...goal, state: 'blocked' }; break;
      case 'clear':    goal = null; break;
      default: break; // status / desconocido → sin cambio
    }
  }
  return goal;
}

const PRESENTATION: Record<GoalState, { Icon: typeof Target; color: string; label: string }> = {
  active:   { Icon: Target,        color: '#3b82f6', label: 'activo' },
  paused:   { Icon: Pause,         color: '#eab308', label: 'pausado' },
  blocked:  { Icon: AlertTriangle, color: '#ef4444', label: 'bloqueado' },
  complete: { Icon: CheckCircle2,  color: '#22c55e', label: 'completado' },
};

export function GoalChip() {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => (activeConvId ? s.messages.get(activeConvId) : undefined));
  const sendMessage = useChatStore((s) => s.sendMessage);

  const goal = useMemo(() => deriveGoal(messages), [messages]);
  if (!goal) return null;

  const { Icon, color, label } = PRESENTATION[goal.state];
  return (
    <button
      onClick={() => sendMessage('/goal status')}
      title={`Objetivo de la sesión (${label}) — clic para ver el estado`}
      aria-label={`Objetivo de la sesión: ${goal.text} (${label})`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: 220,
        padding: '4px 8px',
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        color,
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        opacity: goal.state === 'complete' ? 0.7 : 1,
        transition: 'border-color var(--transition-fast), color var(--transition-fast)',
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.text}</span>
    </button>
  );
}
