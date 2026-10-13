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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
import { TagInput } from '@/components/shared/TagInput';
import { workboardApi } from './workboard.service';
import { PRIORITY_LABEL } from './lanes';
import type { WorkboardPriority } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  agents: ManagedAgent[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITIES: WorkboardPriority[] = ['low', 'normal', 'high', 'urgent'];

export function NewCardModal({ agents, open, onClose, onCreated }: Props) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<WorkboardPriority>('normal');
  const [notes, setNotes] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setTitle(''); setPriority('normal'); setNotes(''); setLabels([]); setAgentId(''); };
  const close = () => { reset(); onClose(); };

  const create = async () => {
    if (!title.trim()) { toast.error('La tarea necesita un título'); return; }
    setBusy(true);
    try {
      await workboardApi.createCard({ title: title.trim(), priority, notes: notes.trim() || undefined, labels, agent_id: agentId || undefined });
      toast.success('Tarea creada');
      onCreated();
      close();
    } catch {
      toast.error('No se pudo crear la tarea');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: '100%', fontSize: '0.8125rem', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' } as const;

  const content = (
    <>
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus={!isMobile} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la tarea" style={inputStyle} />
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkboardPriority)} style={{ ...inputStyle, flex: 1 }}>
              {PRIORITIES.map((p) => <option key={p} value={p}>Prioridad: {PRIORITY_LABEL[p]}</option>)}
            </select>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Sin asignar</option>
              {agents.map((a) => <option key={a.id} value={a.name}>{a.avatar || '🤖'} {a.display_name}</option>)}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 4 }}>Etiquetas</div>
            <TagInput tags={labels} onChange={setLabels} placeholder="etiqueta" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={close} disabled={busy} style={{ padding: '9px 16px', minHeight: isMobile ? 44 : undefined, borderRadius: 8, fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={create} disabled={busy} style={{ padding: '9px 16px', minHeight: isMobile ? 44 : undefined, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, border: 'none', background: 'var(--amber)', color: '#1a1205', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>
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
      <DialogContent style={{ maxWidth: 480, width: '92vw' }}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
