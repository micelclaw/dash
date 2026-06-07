/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * GoalChip (U1, OpenClaw 6.1) — el objetivo de sesión se GESTIONA desde aquí, no
 * se escribe como comando. Un chip en el toolbar del chat abre un popover:
 *   - sin objetivo  → compositor (escribe el objetivo + Crear)
 *   - con objetivo  → estado + acciones (Pausar/Reanudar/Completar/Bloquear/Borrar)
 *
 * El usuario NUNCA escribe `/goal …`. El chip dispara los comandos por su cuenta
 * (vía `sendMessage`), y los mensajes `/goal …` se OCULTAN del historial
 * (ChatMessage.tsx) para que no aparezcan como texto crudo. El estado se deriva
 * (read-only) de esos mensajes en el store del chat.
 */
import { useMemo, useState } from 'react';
import { Target, Pause, Play, AlertTriangle, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatStore } from '@/stores/chat.store';
import type { Message } from '@/types/chat';

type GoalState = 'active' | 'paused' | 'blocked' | 'complete';
interface Goal { text: string; state: GoalState; }

// `/goal <sub> <resto>` — sub y resto opcionales.
const GOAL_RE = /^\s*\/goal(?:\s+(\S+))?(?:\s+([\s\S]*?))?\s*$/i;

/** Reduce los mensajes `/goal` del usuario (en orden) a un estado de goal. */
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

const chipBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  maxWidth: 220, padding: '4px 8px',
  borderRadius: 'var(--radius-md)', background: 'transparent',
  fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
  whiteSpace: 'nowrap', overflow: 'hidden',
  transition: 'border-color var(--transition-fast), color var(--transition-fast)',
};

const actBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  flex: 1, padding: '6px 8px', fontSize: '0.75rem',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
};

export function GoalChip() {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => (activeConvId ? s.messages.get(activeConvId) : undefined));
  const sendMessage = useChatStore((s) => s.sendMessage);

  const goal = useMemo(() => deriveGoal(messages), [messages]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Despacha un comando /goal sin que el usuario lo escriba. ChatMessage.tsx
  // oculta estos mensajes del historial.
  const run = (cmd: string) => { sendMessage(cmd); setOpen(false); setDraft(''); };
  const create = () => { const t = draft.trim(); if (t) run(`/goal start ${t}`); };

  const pres = goal ? PRESENTATION[goal.state] : null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(goal?.text ?? ''); }}>
      <PopoverTrigger asChild>
        {goal && pres ? (
          <button
            style={{ ...chipBase, border: `1px solid ${pres.color}`, color: pres.color, opacity: goal.state === 'complete' ? 0.7 : 1 }}
            title={`Objetivo de la sesión (${pres.label})`}
            aria-label={`Objetivo: ${goal.text} (${pres.label})`}
          >
            <pres.Icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.text}</span>
          </button>
        ) : (
          <button
            style={{ ...chipBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}
            title="Definir el objetivo de la sesión"
            aria-label="Definir objetivo de la sesión"
          >
            <Plus size={14} style={{ flexShrink: 0 }} />
            <span>Objetivo</span>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} style={{ width: 320, padding: 12 }}>
        {!goal ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Objetivo de la sesión</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>¿Qué quieres lograr en este chat?</div>
            <input
              autoFocus value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
              placeholder="p. ej. Implementar el login con OAuth"
              style={{
                padding: '6px 8px', fontSize: '0.8125rem', width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={() => setOpen(false)} style={{ ...actBtn, flex: 'none', padding: '6px 12px' }}>Cancelar</button>
              <button onClick={create} disabled={!draft.trim()}
                style={{ ...actBtn, flex: 'none', padding: '6px 12px', background: '#3b82f6', color: '#fff', borderColor: '#3b82f6', opacity: draft.trim() ? 1 : 0.5 }}>
                Crear
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {pres && <pres.Icon size={15} color={pres.color} />}
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.text}</span>
              <span style={{ fontSize: '0.6875rem', color: pres?.color }}>{pres?.label}</span>
            </div>
            {/* Editar objetivo (re-start) */}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim() && draft.trim() !== goal.text) { e.preventDefault(); run(`/goal start ${draft.trim()}`); } }}
              style={{
                padding: '6px 8px', fontSize: '0.8125rem', width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {goal.state === 'paused'
                ? <button onClick={() => run('/goal resume')} style={actBtn}><Play size={13} />Reanudar</button>
                : <button onClick={() => run('/goal pause')} style={actBtn}><Pause size={13} />Pausar</button>}
              <button onClick={() => run('/goal complete')} style={actBtn}><CheckCircle2 size={13} />Completar</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => run('/goal block')} style={actBtn}><AlertTriangle size={13} />Bloquear</button>
              <button onClick={() => run('/goal clear')} style={{ ...actBtn, color: '#ef4444', borderColor: '#ef4444' }}><Trash2 size={13} />Borrar</button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
