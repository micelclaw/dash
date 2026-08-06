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

/**
 * Zona izquierda de la pantalla de entrada: las tareas SIN TABLERO.
 *
 * Viven en un tablero real ("Personal", `is_default`) que se filtra de la rejilla
 * para que no se vean dos veces. `board_id`/`column_id` siguen siendo NOT NULL:
 * ningún sistema del mercado permite una tarea sin contenedor (Google Tasks tiene
 * `@default`, Microsoft To Do `defaultList`, Todoist `inbox_project_id`).
 *
 * Se arrastran a una baldosa de tablero para sacarlas de aquí.
 */

import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Paperclip, CheckSquare } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { TagChip } from '@/components/shared/TagChip';
import { api } from '@/services/api';
import { getPreviewUrl } from '@/lib/file-utils';
import type { Card, ChecklistItem } from '../types';

function esVencida(c: Card): boolean {
  return !!c.due_date && !c.completed_at && new Date(c.due_date) < new Date(new Date().toDateString());
}

/** Colores de prioridad, alineados con el punto que ya usa el tablero. */
const PRIORIDAD: Record<string, { color: string; label: string }> = {
  urgent: { color: 'var(--red, #e5484d)', label: 'urgente' },
  high:   { color: 'var(--orange, #f5a524)', label: 'alta' },
  medium: { color: 'var(--amber)', label: 'media' },
  low:    { color: 'var(--green, #46a758)', label: 'baja' },
};

/** El checklist EMBEBIDO viaja en el listado (`[{id,text,checked}]`): "0/3" sale gratis. */
function progresoChecklist(c: Card): { hechos: number; total: number } | null {
  const items = c.checklist as ChecklistItem[] | null;
  if (!Array.isArray(items) || items.length === 0) return null;
  return { hechos: items.filter((i) => i.checked).length, total: items.length };
}

/** Iniciales para el chip de asignado; si no hay nombre, las del email. */
function iniciales(nombre: string): string {
  const limpio = nombre.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date(new Date().toDateString());
  const dia = new Date(new Date(iso).toDateString());
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function InboxZone({
  selectedTaskId,
  onSelectTask,
}: {
  selectedTaskId: string | null;
  onSelectTask: (cardId: string) => void;
}) {
  const cards = useProjectsStore((s) => s.inboxCards);
  const loading = useProjectsStore((s) => s.inboxLoading);
  const total = useProjectsStore((s) => s.inboxTotal);
  const quickAdd = useProjectsStore((s) => s.quickAddTask);
  const toggle = useProjectsStore((s) => s.toggleTaskComplete);

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Nombres de los asignados. Una sola petición para toda la lista, no una por fila.
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await api.get<{ data: Array<{ id: string; email?: string; display_name?: string }> }>('/projects/users');
        if (cancelado) return;
        const mapa: Record<string, string> = {};
        for (const u of res.data ?? []) mapa[u.id] = u.display_name || u.email || u.id;
        setUsuarios(mapa);
      } catch { /* sin nombres: se cae a las iniciales del id */ }
    })();
    return () => { cancelado = true; };
  }, []);

  async function submit() {
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    // Se limpia YA: escribir tres seguidas no debe esperar al servidor.
    setDraft('');
    await quickAdd(title);
    setSaving(false);
  }

  return (
    <div
      style={{
        // 40 % para la bandeja, 60 % para los tableros (la zona derecha es flex:1).
        // El minWidth evita que en pantalla estrecha la bandeja se estrangule.
        flex: '0 0 40%',
        minWidth: 320,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Sin tablero
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{total}</span>
      </div>

      {/* Captura rápida: la razón de ser de esta zona. */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', background: 'var(--card)' }}>
          <Plus size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
            placeholder="Añadir tarea…"
            aria-label="Añadir tarea"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        {loading && cards.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</div>
        ) : cards.length === 0 ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
            Nada suelto. Lo que apuntes aquí —o lo que te apunte el agente— aparece en esta lista.
          </div>
        ) : (
          cards.map((c) => {
            const vencida = esVencida(c);
            const seleccionada = c.id === selectedTaskId;

            // Solo lo que la tarea TIENE. Todo sale del listado: cero peticiones por fila.
            const prio = c.priority && c.priority !== 'medium' ? PRIORIDAD[c.priority] : null;
            const check = progresoChecklist(c);
            const adjuntos = c.attachment_ids?.length ?? 0;
            const señales: React.ReactNode[] = [];
            if (prio) señales.push(
              <span key="p" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: prio.color, display: 'inline-block' }} />
                {prio.label}
              </span>);
            if (check) señales.push(
              <span key="c" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: check.hechos === check.total ? 'var(--green, #46a758)' : undefined }}>
                <CheckSquare size={11} />{check.hechos}/{check.total}
              </span>);
            if (adjuntos > 0) señales.push(
              <span key="a" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Paperclip size={11} />{adjuntos}
              </span>);
            for (const t of (c.tags ?? []).slice(0, 3)) señales.push(<TagChip key={`t-${t}`} tag={t} size="xs" />);
            for (const id of (c.assignee_ids ?? []).slice(0, 3)) señales.push(
              <span key={`u-${id}`} title={usuarios[id] ?? id}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 999, background: 'var(--border)', color: 'var(--text)', fontSize: 9, fontWeight: 600 }}>
                {iniciales(usuarios[id] ?? id)}
              </span>);

            return (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/x-claw-task', c.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onSelectTask(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTask(c.id); } }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '7px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  cursor: 'grab',
                  background: seleccionada ? 'var(--card-hover, var(--card))' : 'transparent',
                  borderLeft: seleccionada ? '2px solid var(--amber)' : '2px solid transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!c.completed_at}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => void toggle(c.id, e.target.checked)}
                  aria-label={`Marcar "${c.title}" como hecha`}
                  style={{ marginTop: 3, accentColor: 'var(--amber)', cursor: 'pointer', flexShrink: 0 }}
                />

                {/* Miniatura de portada, solo si la tarea tiene una. */}
                {c.cover_image_id && (
                  <img
                    src={getPreviewUrl(c.cover_image_id, 96)}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0, marginTop: 1 }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}

                {/* La fila CRECE solo con lo que la tarea tiene: una tarea de una
                    palabra sigue ocupando una línea. */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 13, lineHeight: 1.35, wordBreak: 'break-word', textDecoration: c.completed_at ? 'line-through' : undefined, opacity: c.completed_at ? 0.55 : 1 }}>
                      {vencida && <AlertTriangle size={12} style={{ color: 'var(--red, #e5484d)', marginRight: 4, verticalAlign: -1 }} />}
                      {c.title}
                    </span>
                    {c.due_date && (
                      <span style={{ color: vencida ? 'var(--red, #e5484d)' : 'var(--text-dim)', fontSize: 11, flexShrink: 0 }}>
                        {fechaCorta(c.due_date)}
                      </span>
                    )}
                  </div>

                  {c.description && (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.description.split('\n')[0]}
                    </span>
                  )}

                  {señales.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                      {señales}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
