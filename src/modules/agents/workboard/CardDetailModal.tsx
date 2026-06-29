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

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Hand, Trash2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagChip } from '@/components/shared/TagChip';
import { workboardApi } from './workboard.service';
import { LANES, PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL, laneOf } from './lanes';
import type { WorkboardCard } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  card: WorkboardCard | null;
  agents: ManagedAgent[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function CardDetailModal({ card, agents, open, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [proofNote, setProofNote] = useState('');
  const [proofStatus, setProofStatus] = useState<'passed' | 'failed' | 'skipped'>('passed');

  if (!card) return null;
  const agent = card.agent_id ? agents.find((a) => a.name === card.agent_id || a.id === card.agent_id) : undefined;
  const claimed = Boolean(card.claim?.owner_id);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string, after?: () => void) => {
    setBusy(key);
    try { await fn(); toast.success(okMsg); after?.(); onChanged(); }
    catch { toast.error('La operación falló'); }
    finally { setBusy(null); }
  };

  const close = () => { setConfirmDel(false); setProofNote(''); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent style={{ maxWidth: 560, width: '92vw' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: PRIORITY_COLOR[card.priority] }} />
            {card.title}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))' }}>
            {STATUS_LABEL[card.status]} · {laneOf(card.status).label}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))' }}>
            prioridad {PRIORITY_LABEL[card.priority]}
          </span>
          {agent && <span>{agent.avatar || '🤖'} {agent.display_name}</span>}
        </div>

        {card.notes && <p style={{ fontSize: '0.8125rem', color: 'var(--text)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{card.notes}</p>}

        {card.labels.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {card.labels.map((l) => <TagChip key={l} tag={l} size="sm" />)}
          </div>
        )}

        {/* Mover entre carriles */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Mover a</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LANES.map((lane) => {
              const here = lane.statuses.includes(card.status);
              return (
                <button
                  key={lane.key}
                  disabled={here || busy !== null}
                  onClick={() => run('move', () => workboardApi.move(card.id, lane.moveTo, card.position), `Movida a ${lane.label}`)}
                  style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: '0.75rem', cursor: here ? 'default' : 'pointer',
                    border: `1px solid ${here ? lane.accent : 'var(--border)'}`,
                    background: here ? 'var(--bg-subtle, rgba(127,127,127,0.12))' : 'transparent',
                    color: here ? lane.accent : 'var(--text-dim)', fontWeight: here ? 600 : 400, opacity: busy ? 0.6 : 1,
                  }}
                >{lane.label}</button>
              );
            })}
          </div>
        </div>

        {/* Claim / Proof / acciones */}
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {claimed ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--green, #10b981)' }}>
              <Hand size={13} /> Reclamada por {card.claim?.owner_id}
              <button onClick={() => run('release', () => workboardApi.release(card.id), 'Liberada')} disabled={busy !== null}
                style={{ marginLeft: 4, fontSize: '0.6875rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>liberar</button>
            </span>
          ) : (
            <button onClick={() => run('claim', () => workboardApi.claim(card.id, card.agent_id || 'operator'), 'Reclamada')} disabled={busy !== null}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <Hand size={13} /> Reclamar
            </button>
          )}
          <button onClick={() => run('complete', () => workboardApi.complete(card.id), 'Completada')} disabled={busy !== null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--green, #10b981)', cursor: 'pointer' }}>
            <CheckCircle2 size={13} /> Completar
          </button>
          {confirmDel ? (
            <span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
              <button onClick={() => run('del', () => workboardApi.remove(card.id), 'Card borrada', close)} disabled={busy !== null}
                style={{ fontSize: '0.75rem', color: 'var(--red, #ef4444)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
              <button onClick={() => setConfirmDel(false)} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} title="Borrar card" style={{ marginLeft: 'auto', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Proof */}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Proof</div>
          {(card.proof ?? []).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text)', marginBottom: 3 }}>
              <ShieldCheck size={12} style={{ color: p.status === 'passed' ? 'var(--green, #10b981)' : 'var(--text-dim)' }} />
              {p.label || p.note || p.status} <span style={{ color: 'var(--text-dim)' }}>({p.status})</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={proofStatus} onChange={(e) => setProofStatus(e.target.value as typeof proofStatus)}
              style={{ fontSize: '0.75rem', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="passed">passed</option><option value="failed">failed</option><option value="skipped">skipped</option>
            </select>
            <input value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="nota / etiqueta del proof"
              style={{ flex: 1, fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={() => run('proof', () => workboardApi.proof(card.id, { status: proofStatus, note: proofNote || undefined, label: proofNote || undefined }), 'Proof añadido', () => setProofNote(''))}
              disabled={busy !== null} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--amber)', color: '#1a1205', fontWeight: 600, cursor: 'pointer' }}>Añadir</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
