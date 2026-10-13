/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2, Users, Eye, Pencil, X } from 'lucide-react';
import { api } from '@/services/api';
import { useWebSocketStore } from '@/stores/websocket.store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Person = { user_id: string; display_name: string; avatar_url?: string | null };
type Member = Person & { role: 'viewer' | 'participant'; added_by: string; created_at: string };
type Collaboration = {
  conversation_id: string;
  access: 'owner' | 'viewer' | 'participant' | 'admin';
  can_manage: boolean;
  owner: Person | null;
  members: Member[];
};

export function ConversationCollaboration({ conversationId, compact = false }: { conversationId: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Collaboration | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'participant'>('viewer');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  // Abrir el drawer puede coincidir con la carga automática inicial. Sin una
  // generación, una respuesta antigua (sin el miembro recién añadido) puede
  // llegar la última y sobrescribir el estado fresco de `mutate`.
  const loadGeneration = useRef(0);
  const wsSend = useWebSocketStore((state) => state.send);
  // Conservamos el último evento también en Zustand. Así una señal que llegue
  // durante la reconexión no depende de que el efecto local ya haya registrado
  // su listener en ese mismo socket.
  const lastWsEvent = useWebSocketStore((state) => state.lastEvent);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!conversationId) { setData(null); return; }
    try {
      const [collaboration, candidates] = await Promise.all([
        api.get<{ data: Collaboration }>(`/conversations/${conversationId}/collaboration`),
        api.get<{ data: Person[] }>('/conversations/collaborators'),
      ]);
      if (generation !== loadGeneration.current) return;
      setData(collaboration.data);
      setPeople(candidates.data ?? []);
      setError('');
    } catch {
      if (generation !== loadGeneration.current) return;
      setError('No se pudo cargar la colaboración de esta conversación.');
    }
  }, [conversationId]);

  // The compact header is itself a collaboration surface (participants and
  // presence), so load on conversation change as well as when its drawer opens.
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOpen(false); setData(null); }, [conversationId]);
  useEffect(() => {
    if (!conversationId) return;
    const join = () => wsSend('chat.presence.join', { conversation_id: conversationId });
    join();
    const heartbeat = window.setInterval(join, 20_000);
    return () => { window.clearInterval(heartbeat); wsSend('chat.presence.leave', { conversation_id: conversationId }); };
  }, [conversationId, wsSend]);
  useEffect(() => {
    if (!lastWsEvent || lastWsEvent.data.conversation_id !== conversationId) return;
    const userIds = lastWsEvent.data.user_ids;
    const ids = Array.isArray(userIds) ? userIds.filter((value): value is string => typeof value === 'string') : [];
    if (lastWsEvent.event === 'chat.presence.changed') setPresentUserIds(ids);
    if (lastWsEvent.event === 'chat.typing.changed') setTypingUserIds(ids);
  }, [lastWsEvent, conversationId]);

  const mutate = async <T,>(action: () => Promise<T>, reconcile?: (result: T) => void) => {
    setPending(true); setError('');
    try {
      const result = await action();
      // La mutación ya fue confirmada por Core: reflejarla de inmediato. La
      // reconciliación puede tardar (incluye el directorio de colaboradores),
      // pero una persona no debe desaparecer mientras ésta termina.
      reconcile?.(result);
      await load();
    }
    catch { setError('No se pudo guardar el cambio de acceso.'); }
    finally { setPending(false); }
  };

  const unassigned = people.filter((person) => person.user_id !== data?.owner?.user_id && !data?.members.some((member) => member.user_id === person.user_id));
  const participants = data?.members.filter((member) => member.role === 'participant').length ?? 0;
  const visiblePeople = [data?.owner, ...(data?.members ?? [])].filter((person): person is Person => Boolean(person));
  // `collaborators` es el directorio autorizado del sistema. Usarlo como
  // respaldo evita perder una señal efímera si la carga de membresías aún está
  // terminando tras abrir o reconectar una conversación compartida.
  const peopleById = new Map([...people, ...visiblePeople].map((person) => [person.user_id, person]));
  const presentNames = presentUserIds.map((id) => peopleById.get(id)?.display_name).filter(Boolean);
  const typingNames = typingUserIds.map((id) => peopleById.get(id)?.display_name).filter(Boolean);
  const typingLabel = typingNames.length === 0
    ? null
    : typingNames.length === 1
      ? `${typingNames[0]} está escribiendo…`
      : `${typingNames.slice(0, 2).join(' y ')} están escribiendo…`;

  if (!conversationId) return null;
  return <>
    <button
      onClick={() => setOpen(true)}
      title="Compartir conversación"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: compact ? '4px 6px' : '4px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}
    >
      <Share2 size={14} />{!compact && (typingLabel ?? (presentNames.length > 1 ? `${presentNames.length} viendo` : 'Compartir'))}{(data?.members.length ?? 0) > 0 && <span style={{ color: typingLabel ? 'var(--success)' : 'var(--amber)' }}>{participants > 0 ? participants : data?.members.length}</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px]" style={{ maxHeight: '80dvh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Compartir conversación</DialogTitle>
          <DialogDescription>Las personas añadidas podrán acceder al historial completo existente de esta conversación.</DialogDescription>
        </DialogHeader>
        {error && <p style={{ margin: 0, color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        {data && <section style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 9, border: '1px solid var(--border)', borderRadius: 8 }}>
            <Users size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ flex: 1 }}><strong>{data.owner?.display_name ?? 'Propietario'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>Propietario</small></span>
          </div>
          {data.can_manage && <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
            <label htmlFor="conversation-collaborator" style={{ display: 'grid', gap: 4, flex: '1 1 180px', fontSize: 12 }}>Persona
              <select id="conversation-collaborator" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Selecciona una persona…</option>{unassigned.map((person) => <option key={person.user_id} value={person.user_id}>{person.display_name}</option>)}</select>
            </label>
            <label htmlFor="conversation-collaborator-access" style={{ display: 'grid', gap: 4, fontSize: 12 }}>Acceso
              <select id="conversation-collaborator-access" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as 'viewer' | 'participant')}><option value="viewer">Solo lectura</option><option value="participant">Participar</option></select>
            </label>
            <Button disabled={!selectedUserId || pending} onClick={() => {
              const memberUserId = selectedUserId;
              const role = selectedRole;
              const person = people.find((candidate) => candidate.user_id === memberUserId);
              void mutate(
                () => api.post(`/conversations/${conversationId}/members`, { user_id: memberUserId, role }),
                () => {
                  setSelectedUserId('');
                  if (!person) return;
                  setData((current) => current ? {
                    ...current,
                    members: [...current.members.filter((member) => member.user_id !== memberUserId), {
                      ...person,
                      role,
                      added_by: current.owner?.user_id ?? '',
                      created_at: new Date().toISOString(),
                    }],
                  } : current);
                },
              );
            }}>Añadir</Button>
          </div>}
          <div style={{ display: 'grid', gap: 7 }}>
            {data.members.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Aún no hay personas invitadas.</p>}
            {data.members.map((member) => <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid var(--border)' }}>
              {member.role === 'viewer' ? <Eye size={15} /> : <Pencil size={15} />}
              <span style={{ flex: 1 }}>{member.display_name}</span>
              {data.can_manage ? <select aria-label={`Acceso de ${member.display_name}`} value={member.role} disabled={pending} onChange={(event) => { const role = event.target.value as Member['role']; void mutate(() => api.patch(`/conversations/${conversationId}/members/${member.user_id}`, { role }), () => setData((current) => current ? { ...current, members: current.members.map((item) => item.user_id === member.user_id ? { ...item, role } : item) } : current)); }}><option value="viewer">Solo lectura</option><option value="participant">Participar</option></select> : <small style={{ color: 'var(--text-muted)' }}>{member.role === 'viewer' ? 'Solo lectura' : 'Participar'}</small>}
              {data.can_manage && <button aria-label={`Revocar acceso de ${member.display_name}`} disabled={pending} onClick={() => void mutate(() => api.delete(`/conversations/${conversationId}/members/${member.user_id}`), () => setData((current) => current ? { ...current, members: current.members.filter((item) => item.user_id !== member.user_id) } : current))} style={{ color: 'var(--red)', background: 'transparent', border: 0, cursor: 'pointer' }}><X size={16} /></button>}
            </div>)}
          </div>
        </section>}
        <DialogFooter>{data && !data.can_manage && data.access !== 'owner' && <Button variant="outline" disabled={pending} onClick={() => void mutate(() => api.post(`/conversations/${conversationId}/leave`))}>Abandonar conversación</Button>}<Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
