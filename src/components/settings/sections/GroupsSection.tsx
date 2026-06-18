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
import { toast } from 'sonner';
import { Plus, Trash2, Users, Settings2, X } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import {
  listGroups, createGroup, deleteGroup, getGroupMembers, patchGroupMembers,
  getGroupAppAccess, patchGroupAppAccess, getGroupFolderAccess, patchGroupFolderAccess, type Group,
} from '@/services/groups.service';
import { listUsers } from '@/services/users.service';
import type { AdminUser } from '@/types/users';
import { OPT_IN_APPS } from '@/config/app-catalog';
import type { FolderPermission, UserFolderPerm } from '@/services/shared-folders.service';

const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.8125rem', background: 'var(--bg-input, var(--bg))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' };
const select: React.CSSProperties = { ...input, width: 160 };
const btnPrimary: React.CSSProperties = { padding: '7px 14px', fontSize: '0.8125rem', fontWeight: 500, background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '6px 10px', fontSize: '0.8125rem', background: 'none', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };

function ManageModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [tab, setTab] = useState<'members' | 'apps' | 'folders'>('members');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [appAllow, setAppAllow] = useState<Record<string, boolean>>({});
  const [folders, setFolders] = useState<UserFolderPerm[]>([]);
  const [folderPerm, setFolderPerm] = useState<Record<string, FolderPermission>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listUsers().then(setUsers).catch(() => {});
    getGroupMembers(group.id).then((ids) => { const m: Record<string, boolean> = {}; ids.forEach((id) => { m[id] = true; }); setMember(m); }).catch(() => {});
    getGroupAppAccess(group.id).then((a) => { const m: Record<string, boolean> = {}; a.forEach((x) => { m[x.key] = x.allowed; }); setAppAllow(m); }).catch(() => {});
    getGroupFolderAccess(group.id).then((rows) => { setFolders(rows); const m: Record<string, FolderPermission> = {}; rows.forEach((f) => { m[f.id] = f.permission; }); setFolderPerm(m); }).catch(() => {});
  }, [group.id]);

  const save = async () => {
    setSaving(true);
    try {
      if (tab === 'members') await patchGroupMembers(group.id, member);
      else if (tab === 'apps') await patchGroupAppAccess(group.id, appAllow);
      else await patchGroupFolderAccess(group.id, folderPerm);
      toast.success('Grupo actualizado');
      onClose();
    } catch (e) { toast.error((e as Error).message || 'Error'); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-elevated, var(--bg))', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, width: 460, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ color: 'var(--text)' }}>{group.name}</strong>
          <button style={{ ...btnGhost, padding: 4 }} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          {([['members', 'Miembros'], ['apps', 'Aplicaciones'], ['folders', 'Carpetas']] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? 'var(--amber)' : 'transparent'}`, color: tab === t ? 'var(--text)' : 'var(--text-dim)' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ maxHeight: 340, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tab === 'members' && users.map((u) => (
            <label key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!member[u.id]} onChange={() => setMember((p) => ({ ...p, [u.id]: !p[u.id] }))} style={{ accentColor: 'var(--amber)' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{u.display_name}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{u.email}</span>
            </label>
          ))}
          {tab === 'apps' && OPT_IN_APPS.map((a) => (
            <label key={a.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!appAllow[a.key]} onChange={() => setAppAllow((p) => ({ ...p, [a.key]: !p[a.key] }))} style={{ accentColor: 'var(--amber)' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{a.label}</span>
            </label>
          ))}
          {tab === 'folders' && (folders.length === 0
            ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No hay carpetas compartidas.</div>
            : folders.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)', flex: 1 }}>{f.name}</span>
                <select style={select} value={folderPerm[f.id] ?? 'none'} onChange={(e) => setFolderPerm((p) => ({ ...p, [f.id]: e.target.value as FolderPermission }))}>
                  <option value="none">Sin acceso</option><option value="ro">Solo lectura</option><option value="rw">Lectura/escritura</option>
                </select>
              </div>
            )))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button style={btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

export function GroupsSection() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [manage, setManage] = useState<Group | null>(null);

  const load = () => { setLoading(true); listGroups().then(setGroups).catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try { await createGroup({ name: name.trim() }); toast.success(`Grupo "${name}" creado`); setName(''); setCreating(false); load(); }
    catch (e) { toast.error((e as Error).message || 'No se pudo crear'); } finally { setSaving(false); }
  };
  const handleDelete = async (g: Group) => {
    if (!confirm(`¿Eliminar el grupo "${g.name}"?`)) return;
    try { await deleteGroup(g.id); toast.success('Grupo eliminado'); load(); } catch (e) { toast.error((e as Error).message || 'No se pudo eliminar'); }
  };

  return (
    <SettingSection title="Grupos de usuarios" description="Los miembros heredan los permisos del grupo (apps, carpetas).">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!creating && <button style={{ ...btnPrimary, alignSelf: 'flex-start', display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setCreating(true)}><Plus size={15} /> Nuevo grupo</button>}
        {creating && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} placeholder="Nombre del grupo" value={name} onChange={(e) => setName(e.target.value)} />
            <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleCreate} disabled={saving}>Crear</button>
            <button style={btnGhost} onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        )}
        {loading && <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Cargando…</div>}
        {!loading && groups.map((g) => (
          <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <Users size={16} style={{ color: 'var(--amber)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{g.name} {g.is_system && <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>(sistema)</span>}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{g.member_count} miembro(s)</div>
            </div>
            <button style={{ ...btnGhost, padding: 6 }} title="Gestionar" onClick={() => setManage(g)}><Settings2 size={15} /></button>
            {!g.is_system && <button style={{ ...btnGhost, padding: 6 }} title="Eliminar" onClick={() => handleDelete(g)}><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>
      {manage && <ManageModal group={manage} onClose={() => { setManage(null); load(); }} />}
    </SettingSection>
  );
}
