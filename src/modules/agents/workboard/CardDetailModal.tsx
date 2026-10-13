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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  CheckCircle2, Hand, Trash2, ShieldCheck, Pencil, Ban, Unlock, ArrowUpCircle,
  RefreshCcw, Archive, ArchiveRestore, MessageSquare, AlertTriangle, History, Play, MessagesSquare,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
import { TagChip } from '@/components/shared/TagChip';
import { TagInput } from '@/components/shared/TagInput';
import { formatRelativeTime } from '../shared/format';
import { workboardApi, type WorkboardCardConversation } from './workboard.service';
import { ApiError } from '@/services/api';
import { STATUS_COLUMNS, PRIORITY_COLOR, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, laneOf, canManualMove, friendlyMove } from './lanes';
import type { WorkboardCard, WorkboardPriority, WorkboardDiagnostic, WorkboardRunAttempt } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  card: WorkboardCard | null;
  agents: ManagedAgent[];
  diagnostics: WorkboardDiagnostic[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const DIAG_LABEL: Record<string, string> = {
  stranded_ready: 'lista sin reclamar', running_without_heartbeat: 'en ejecución sin heartbeat',
  blocked_too_long: 'bloqueada demasiado tiempo', repeated_failures: 'fallos repetidos',
  missing_proof: 'falta proof', orphaned_session: 'sesión huérfana',
};

const epochIso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);
const sectionTitle = { fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 } as const;
const inputStyle = { width: '100%', fontSize: '0.8125rem', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' } as const;
const actBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' } as const;

export function CardDetailModal({ card, agents, diagnostics, open, onClose, onChanged }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [proofNote, setProofNote] = useState('');
  const [proofStatus, setProofStatus] = useState<'passed' | 'failed' | 'skipped'>('passed');
  const [comment, setComment] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  // Edición
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eNotes, setENotes] = useState('');
  const [ePriority, setEPriority] = useState<WorkboardPriority>('normal');
  const [eLabels, setELabels] = useState<string[]>([]);
  // Historial de intentos
  const [attempts, setAttempts] = useState<WorkboardRunAttempt[] | null>(null);
  // Conversaciones de trabajo (despachador local) enlazadas a la card.
  const [workConvs, setWorkConvs] = useState<WorkboardCardConversation[]>([]);

  useEffect(() => {
    // Reset por cambio de card / cierre
    setEditing(false); setConfirmDel(false); setBlocking(false); setBlockReason('');
    setProofNote(''); setComment(''); setAttempts(null); setWorkConvs([]);
    if (card) { setETitle(card.title); setENotes(card.notes ?? ''); setEPriority(card.priority); setELabels(card.labels ?? []); }
    if (card && open) workboardApi.cardConversations(card.id).then(setWorkConvs).catch(() => setWorkConvs([]));
  }, [card?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;
  const agent = card.agent_id ? agents.find((a) => a.name === card.agent_id || a.id === card.agent_id) : undefined;
  const claimed = Boolean(card.claim?.owner_id);
  const archived = Boolean(card.metadata?.archived_at);
  const comments = card.metadata?.comments ?? [];
  const metaAttempts = card.metadata?.attempts ?? [];
  const cardDiags = diagnostics.filter((d) => d.card_id === card.id);
  const events = (card.events ?? []).slice(-6).reverse();

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string, after?: () => void) => {
    setBusy(key);
    try { await fn(); toast.success(okMsg); after?.(); onChanged(); }
    catch { toast.error('La operación falló'); }
    finally { setBusy(null); }
  };

  const close = () => { onClose(); };

  const saveEdit = () => {
    if (!eTitle.trim()) { toast.error('El título no puede estar vacío'); return; }
    run('edit', () => workboardApi.update(card.id, {
      title: eTitle.trim(), notes: eNotes.trim() || undefined, priority: ePriority, labels: eLabels,
    }), 'Tarea actualizada', () => setEditing(false));
  };

  const loadRuns = () => {
    setBusy('runs');
    workboardApi.runs(card.id).then(setAttempts).catch(() => setAttempts([])).finally(() => setBusy(null));
  };

  const diagAction = (kind: string) => {
    if (kind === 'unblock') return run('diag', () => workboardApi.unblock(card.id), 'Desbloqueada');
    if (kind === 'promote') return run('diag', () => workboardApi.promote(card.id), 'Promovida');
    if (kind === 'reclaim') return run('diag', () => workboardApi.reclaim(card.id), 'Claim recuperado');
    if (kind === 'claim') return run('diag', () => workboardApi.claim(card.id, card.agent_id || 'operator'), 'Reclamada');
  };

  // Abre la conversación de trabajo en el módulo AI Chat (deep-link `/chat?conversation=<id>`), no
  // en el tab analítico Conversations del módulo Agents. Es una tarea que el agente completa solo →
  // el chat será de solo-lectura (ver ChatInput).
  const goToChat = (convId: string) => {
    navigate(`/chat?conversation=${convId}`);
    onClose();
  };

  // Despachador LOCAL: el agente asignado trabaja la tarjeta en su modelo local (visible en Conversations).
  const canWork = Boolean(card.agent_id) && card.status !== 'running' && card.status !== 'done';
  const startWork = () => {
    setBusy('work');
    workboardApi.work(card.id)
      .then((r) => {
        toast.success(`«${agent?.display_name ?? r.agent}» está trabajando la tarea`, {
          action: { label: 'Ver', onClick: () => goToChat(r.conversation_id) },
        });
        onChanged();
        return workboardApi.cardConversations(card.id).then(setWorkConvs).catch(() => {});
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo despachar la tarea'))
      .finally(() => setBusy(null));
  };

  const content = (
    <>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: isMobile ? 22 : undefined }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: PRIORITY_COLOR[card.priority] }} />
            <span style={{ flex: 1 }}>{card.title}</span>
            {!editing && (
              <button onClick={() => setEditing(true)} title="Editar" style={{ ...actBtn, padding: '4px 8px' }}><Pencil size={13} /></button>
            )}
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Título" style={inputStyle} />
            <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notas" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <select value={ePriority} onChange={(e) => setEPriority(e.target.value as WorkboardPriority)} style={inputStyle}>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>Prioridad: {PRIORITY_LABEL[p]}</option>)}
            </select>
            <div><div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 4 }}>Etiquetas</div><TagInput tags={eLabels} onChange={setELabels} placeholder="etiqueta" /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditing(false)} disabled={busy !== null} style={{ ...actBtn }}>Cancelar</button>
              <button onClick={saveEdit} disabled={busy !== null} style={{ ...actBtn, border: 'none', background: 'var(--amber)', color: '#1a1205', fontWeight: 600 }}>Guardar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))' }}>{STATUS_LABEL[card.status]} · {laneOf(card.status).label}</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))' }}>prioridad {PRIORITY_LABEL[card.priority]}</span>
              {agent && <span>{agent.avatar || '🤖'} {agent.display_name}</span>}
              {archived && <span style={{ color: 'var(--text-muted)' }}><Archive size={11} style={{ verticalAlign: '-1px' }} /> archivada</span>}
              {(card.metadata?.failure_count ?? 0) > 0 && <span style={{ color: 'var(--red, #ef4444)' }}>{card.metadata?.failure_count} fallos</span>}
              {card.metadata?.stale && <span style={{ color: 'var(--amber)' }}>obsoleta</span>}
            </div>
            {card.notes && <p style={{ fontSize: '0.8125rem', color: 'var(--text)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{card.notes}</p>}
            {card.labels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>{card.labels.map((l) => <TagChip key={l} tag={l} size="sm" />)}</div>
            )}
          </>
        )}

        {/* Diagnósticos de esta tarjeta */}
        {cardDiags.length > 0 && (
          <div style={{ marginTop: 12, borderRadius: 8, border: '1px solid var(--amber)', background: 'rgba(245,158,11,0.06)', padding: 10 }}>
            {cardDiags.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text)', marginBottom: i < cardDiags.length - 1 ? 6 : 0 }}>
                <AlertTriangle size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.title || DIAG_LABEL[d.kind] || d.kind}{d.detail ? ` — ${d.detail}` : ''}</span>
                {(d.actions ?? []).filter((a) => ['unblock', 'promote', 'reclaim', 'claim'].includes(a.kind)).map((a) => (
                  <button key={a.kind} onClick={() => diagAction(a.kind)} disabled={busy !== null} style={{ ...actBtn, padding: '3px 8px' }}>{a.label || a.kind}</button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Mover a (9 fases) */}
        <div style={{ marginTop: 14 }}>
          <div style={sectionTitle}>Mover a</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_COLUMNS.map((col) => {
              const here = card.status === col.status;
              // El plugin gobierna algunas transiciones (scheduled aparcada) → no ofrecerlas.
              const blocked = !here && !canManualMove(card.status, col.status);
              const disabled = here || blocked || busy !== null;
              return (
                <button key={col.status} disabled={disabled}
                  title={blocked ? (card.status === 'scheduled' ? 'Está programada; el sistema la moverá a «Listo» sola' : '«Programado» se gestiona solo, no a mano') : undefined}
                  onClick={() => {
                    setBusy('move');
                    workboardApi.move(card.id, col.status, card.position)
                      .then(() => { toast.success(`Movida a ${col.label}`); onChanged(); })
                      .catch((e) => toast.error(e instanceof ApiError ? friendlyMove(e.message) : 'No se pudo mover'))
                      .finally(() => setBusy(null));
                  }}
                  style={{ padding: '4px 9px', borderRadius: 7, fontSize: '0.6875rem', cursor: disabled ? 'default' : 'pointer', border: `1px solid ${here ? col.accent : 'var(--border)'}`, background: here ? 'var(--bg-subtle, rgba(127,127,127,0.12))' : 'transparent', color: here ? col.accent : blocked ? 'var(--text-muted)' : 'var(--text-dim)', fontWeight: here ? 600 : 400, opacity: (busy || blocked) ? 0.5 : 1 }}>
                  {col.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asignación */}
        <div style={{ marginTop: 14 }}>
          <div style={sectionTitle}>Asignar a</div>
          <select value={card.agent_id ?? ''} onChange={(e) => run('reassign', () => workboardApi.reassign(card.id, e.target.value), 'Reasignada')} disabled={busy !== null} style={{ ...inputStyle, maxWidth: 260 }}>
            <option value="">Sin asignar</option>
            {agents.map((a) => <option key={a.id} value={a.name}>{a.avatar || '🤖'} {a.display_name}</option>)}
          </select>
        </div>

        {/* Despachador LOCAL: poner al agente a trabajar la tarjeta en su modelo local */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={startWork}
            disabled={!canWork || busy !== null}
            title={!card.agent_id ? 'Asigna un agente primero' : card.status === 'running' ? 'Ya está en curso' : card.status === 'done' ? 'Ya está hecha' : `Que ${agent?.display_name ?? 'el agente'} trabaje esta tarea en local`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
              fontSize: '0.8125rem', fontWeight: 600, border: 'none',
              background: canWork ? 'var(--amber)' : 'var(--border)',
              color: canWork ? '#1a1205' : 'var(--text-muted)',
              cursor: canWork && busy === null ? 'pointer' : 'default', opacity: busy === 'work' ? 0.6 : 1,
            }}
          >
            <Play size={14} /> {busy === 'work' ? 'Despachando…' : 'Trabajar ahora'}
          </button>
          {!card.agent_id && (
            <span style={{ marginLeft: 10, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Asigna un agente para poder trabajarla.</span>
          )}
        </div>

        {/* Acciones de ciclo de vida */}
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {claimed ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--green, #10b981)' }}>
              <Hand size={13} /> Reclamada por {card.claim?.owner_id}
              <button onClick={() => run('release', () => workboardApi.release(card.id), 'Liberada')} disabled={busy !== null} style={{ marginLeft: 4, fontSize: '0.6875rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>liberar</button>
            </span>
          ) : (
            <button onClick={() => run('claim', () => workboardApi.claim(card.id, card.agent_id || 'operator'), 'Reclamada')} disabled={busy !== null} style={actBtn}><Hand size={13} /> Reclamar</button>
          )}
          <button onClick={() => run('complete', () => workboardApi.complete(card.id), 'Completada')} disabled={busy !== null} style={{ ...actBtn, color: 'var(--green, #10b981)' }}><CheckCircle2 size={13} /> Completar</button>

          {card.status === 'blocked' ? (
            <button onClick={() => run('unblock', () => workboardApi.unblock(card.id), 'Desbloqueada')} disabled={busy !== null} style={actBtn}><Unlock size={13} /> Desbloquear</button>
          ) : blocking ? (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="motivo" style={{ ...inputStyle, width: 140, padding: '4px 8px', fontSize: '0.75rem' }} />
              <button onClick={() => run('block', () => workboardApi.block(card.id, blockReason || undefined), 'Bloqueada', () => setBlocking(false))} disabled={busy !== null} style={{ ...actBtn, color: 'var(--red, #ef4444)' }}>Bloquear</button>
              <button onClick={() => setBlocking(false)} style={{ ...actBtn, border: 'none' }}>Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setBlocking(true)} disabled={busy !== null} style={actBtn}><Ban size={13} /> Bloquear</button>
          )}

          <button onClick={() => run('promote', () => workboardApi.promote(card.id), 'Promovida a lista')} disabled={busy !== null} style={actBtn}><ArrowUpCircle size={13} /> Promover</button>
          {claimed && <button onClick={() => run('reclaim', () => workboardApi.reclaim(card.id), 'Claim recuperado')} disabled={busy !== null} style={actBtn}><RefreshCcw size={13} /> Reclamar de nuevo</button>}
          <button onClick={() => run('archive', () => workboardApi.archive(card.id, !archived), archived ? 'Restaurada' : 'Archivada')} disabled={busy !== null} style={actBtn}>
            {archived ? <><ArchiveRestore size={13} /> Restaurar</> : <><Archive size={13} /> Archivar</>}
          </button>

          {confirmDel ? (
            <span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
              <button onClick={() => run('del', () => workboardApi.remove(card.id), 'Tarea borrada', close)} disabled={busy !== null} style={{ fontSize: '0.75rem', color: 'var(--red, #ef4444)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
              <button onClick={() => setConfirmDel(false)} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} title="Borrar tarea" style={{ marginLeft: 'auto', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></button>
          )}
        </div>

        {/* Proof */}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={sectionTitle}>Proof</div>
          {(card.proof ?? []).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text)', marginBottom: 3 }}>
              <ShieldCheck size={12} style={{ color: p.status === 'passed' ? 'var(--green, #10b981)' : p.status === 'failed' ? 'var(--red, #ef4444)' : 'var(--text-dim)' }} />
              {p.label || p.note || p.status} <span style={{ color: 'var(--text-dim)' }}>({p.status})</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={proofStatus} onChange={(e) => setProofStatus(e.target.value as typeof proofStatus)} style={{ fontSize: '0.75rem', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="passed">passed</option><option value="failed">failed</option><option value="skipped">skipped</option>
            </select>
            <input value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="nota / etiqueta del proof" style={{ flex: 1, fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={() => run('proof', () => workboardApi.proof(card.id, { status: proofStatus, note: proofNote || undefined, label: proofNote || undefined }), 'Proof añadido', () => setProofNote(''))} disabled={busy !== null} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--amber)', color: '#1a1205', fontWeight: 600, cursor: 'pointer' }}>Añadir</button>
          </div>
        </div>

        {/* Comentarios / traspaso */}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={sectionTitle}><MessageSquare size={11} style={{ verticalAlign: '-1px' }} /> Comentarios</div>
          {comments.map((c) => (
            <div key={c.id} style={{ fontSize: '0.75rem', color: 'var(--text)', marginBottom: 5 }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{c.body}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(epochIso(c.created_at))}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Añadir nota de traspaso…" style={{ flex: 1, fontSize: '0.75rem', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={() => comment.trim() && run('comment', () => workboardApi.comment(card.id, comment.trim()), 'Comentario añadido', () => setComment(''))} disabled={busy !== null || !comment.trim()} style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>Comentar</button>
          </div>
        </div>

        {/* Trabajos: conversaciones donde un agente trabaja/trabajó esta tarjeta (despachador local) */}
        {workConvs.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={sectionTitle}><MessagesSquare size={11} style={{ verticalAlign: '-1px' }} /> Trabajos</div>
            {workConvs.map((w) => (
              <button
                key={w.conversation_id}
                onClick={() => goToChat(w.conversation_id)}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text)', marginBottom: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
              >
                <MessagesSquare size={12} style={{ color: 'var(--blue, #3b82f6)' }} />
                <span>Trabajo de <strong>{w.agent}</strong></span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{formatRelativeTime(w.started_at)} · Ver →</span>
              </button>
            ))}
          </div>
        )}

        {/* Historial de intentos */}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}><History size={11} style={{ verticalAlign: '-1px' }} /> Intentos</div>
            <button onClick={loadRuns} disabled={busy === 'runs'} style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>{busy === 'runs' ? 'cargando…' : 'actualizar'}</button>
          </div>
          {(attempts ?? metaAttempts).length === 0 ? (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>Sin intentos registrados.</div>
          ) : (
            <div style={{ marginTop: 4 }}>
              {(attempts ?? metaAttempts).map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 3 }}>
                  <span style={{ color: a.status === 'succeeded' ? 'var(--green, #10b981)' : a.status === 'failed' ? 'var(--red, #ef4444)' : 'var(--text-dim)', fontWeight: 600 }}>{a.status}</span>
                  {a.engine && <span>{a.engine}</span>}
                  {a.model && <span style={{ color: 'var(--text-muted)' }}>{a.model}</span>}
                  <span style={{ marginLeft: 'auto' }}>{formatRelativeTime(epochIso(a.started_at))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        {events.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={sectionTitle}>Actividad</div>
            {events.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 2 }}>
                <span>{ev.kind}{ev.to_status ? ` → ${STATUS_LABEL[ev.to_status]}` : ''}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{formatRelativeTime(epochIso(ev.at))}</span>
              </div>
            ))}
          </div>
        )}
    </>
  );

  return isMobile ? (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="bottom" style={{ maxHeight: '90dvh', overflowY: 'auto', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {content}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent style={{ maxWidth: 620, width: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
