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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs } from '@/components/shared/Tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OPT_IN_APPS } from '@/config/app-catalog';
import { listUsers } from '@/services/users.service';
import type { AdminUser } from '@/types/users';
import type { FolderPermission, UserFolderPerm } from '@/services/shared-folders.service';
import {
  updateGroup, getGroupMembers, patchGroupMembers, getGroupAppAccess, patchGroupAppAccess,
  getGroupFolderAccess, patchGroupFolderAccess, getGroupQuota, patchGroupQuota,
  getGroupSpeedLimits, patchGroupSpeedLimits, type Group,
} from '@/services/groups.service';

const FOLDER_PERMS: { v: FolderPermission; label: string }[] = [
  { v: 'none', label: 'Sin acceso' }, { v: 'rw', label: 'Lectura-Escritura' }, { v: 'ro', label: 'Solo lectura' },
];
const label = 'block text-xs text-[var(--text-dim)] mb-1';

export function GroupEditDialog({ group, open, onOpenChange, onSaved }: {
  group: Group; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState('info');
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [appAllow, setAppAllow] = useState<Record<string, boolean>>({});
  const [folders, setFolders] = useState<UserFolderPerm[]>([]);
  const [folderPerm, setFolderPerm] = useState<Record<string, FolderPermission>>({});
  const [quotaGb, setQuotaGb] = useState('0');
  const [sDown, setSDown] = useState('0');
  const [sUp, setSUp] = useState('0');
  const [sMedia, setSMedia] = useState('0');

  useEffect(() => {
    if (!open) return;
    setState('loading');
    Promise.allSettled([
      listUsers(), getGroupMembers(group.id), getGroupAppAccess(group.id), getGroupFolderAccess(group.id),
      getGroupQuota(group.id), getGroupSpeedLimits(group.id),
    ]).then(([u, m, a, f, q, s]) => {
      if (u.status === 'fulfilled') setUsers(u.value);
      if (m.status === 'fulfilled') setMember(Object.fromEntries(m.value.map((id) => [id, true])));
      if (a.status === 'fulfilled') setAppAllow(Object.fromEntries(a.value.map((x) => [x.key, x.allowed])));
      if (f.status === 'fulfilled') { setFolders(f.value); setFolderPerm(Object.fromEntries(f.value.map((x) => [x.id, x.permission]))); }
      if (q.status === 'fulfilled') setQuotaGb(String((q.value.quota_bytes || 0) / 1e9));
      if (s.status === 'fulfilled') { setSDown(String(s.value.down_kbps || 0)); setSUp(String(s.value.up_kbps || 0)); setSMedia(String(s.value.media_down_kbps || 0)); }
      setState('ready');
    });
  }, [open, group.id]);

  const save = async () => {
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      if (name.trim() !== group.name || (description.trim() || null) !== (group.description ?? null)) {
        ops.push(updateGroup(group.id, { name: name.trim(), description: description.trim() }));
      }
      ops.push(patchGroupMembers(group.id, member));
      ops.push(patchGroupAppAccess(group.id, appAllow));
      ops.push(patchGroupFolderAccess(group.id, folderPerm));
      ops.push(patchGroupQuota(group.id, Math.round(Number(quotaGb) * 1e9)));
      ops.push(patchGroupSpeedLimits(group.id, Math.round(Number(sUp)), Math.round(Number(sDown)), Math.round(Number(sMedia))));
      await Promise.all(ops);
      toast.success('Grupo actualizado');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message || 'No se pudo guardar'); } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'info', label: 'Información' }, { id: 'members', label: 'Miembros' }, { id: 'permisos', label: 'Permisos' },
    { id: 'cuota', label: 'Cuota' }, { id: 'apps', label: 'Aplicaciones' }, { id: 'velocidad', label: 'Velocidad' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{group.name}{group.is_system && <span className="ml-2 text-xs text-[var(--text-dim)]">sistema</span>}</DialogTitle>
        <div className="mt-2"><Tabs tabs={tabs} activeTab={tab} onChange={setTab} /></div>
        <div className="mt-4 min-h-[280px] max-h-[55vh] overflow-auto pr-1">
          {state === 'loading' && <div className="py-10 text-center text-sm text-[var(--text-dim)]">Cargando…</div>}
          {state === 'ready' && (<>
            {tab === 'info' && (
              <div className="flex flex-col gap-3 max-w-sm">
                <div><label className={label}>Nombre</label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={group.is_system} /></div>
                <div><label className={label}>Descripción</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              </div>
            )}
            {tab === 'members' && (
              <div className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)]">
                    <Checkbox checked={!!member[u.id]} onCheckedChange={(c) => setMember((p) => ({ ...p, [u.id]: !!c }))} />
                    <span className="text-sm text-[var(--text)]">{u.display_name}</span>
                    <span className="ml-auto text-xs text-[var(--text-dim)]">{u.email}</span>
                  </label>
                ))}
              </div>
            )}
            {tab === 'permisos' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[var(--text-dim)]">Heredado por los miembros. Precedencia <strong className="text-[var(--text)]">Sin acceso &gt; Lectura-Escritura &gt; Solo lectura</strong>.</p>
                {folders.length === 0 ? <p className="text-xs text-[var(--text-dim)]">No hay carpetas compartidas.</p> : folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2">
                    <span className="text-sm text-[var(--text)]">{f.name}</span>
                    <RadioGroup value={folderPerm[f.id] ?? 'none'} onValueChange={(v) => setFolderPerm((p) => ({ ...p, [f.id]: v as FolderPermission }))} className="flex gap-3">
                      {FOLDER_PERMS.map((o) => (
                        <label key={o.v} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] cursor-pointer"><RadioGroupItem value={o.v} /> {o.label}</label>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            )}
            {tab === 'cuota' && (
              <div className="flex flex-col gap-2 max-w-sm">
                <p className="text-xs text-[var(--text-dim)]">Cuota heredada por los miembros (el override del usuario gana). 0 = ilimitado.</p>
                <div><label className={label}>Cuota de grupo (GB)</label><Input type="number" min={0} step={0.5} value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} /></div>
              </div>
            )}
            {tab === 'apps' && (
              <div className="flex flex-col gap-1.5">
                {OPT_IN_APPS.map((a) => (
                  <label key={a.key} className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)]">
                    <Checkbox checked={!!appAllow[a.key]} onCheckedChange={(c) => setAppAllow((p) => ({ ...p, [a.key]: !!c }))} />
                    <span className="text-sm text-[var(--text)]">{a.label}</span>
                  </label>
                ))}
              </div>
            )}
            {tab === 'velocidad' && (
              <div className="flex flex-col gap-3 max-w-sm">
                <p className="text-xs text-[var(--text-dim)]">Heredado por los miembros (más restrictivo entre grupos; override del usuario gana). 0 = ilimitado.</p>
                <div><label className={label}>Archivos — bajada (KB/s)</label><Input type="number" min={0} step={64} value={sDown} onChange={(e) => setSDown(e.target.value)} /></div>
                <div><label className={label}>Archivos — subida (KB/s)</label><Input type="number" min={0} step={64} value={sUp} onChange={(e) => setSUp(e.target.value)} /></div>
                <div><label className={label}>Media — bajada (KB/s)</label><Input type="number" min={0} step={64} value={sMedia} onChange={(e) => setSMedia(e.target.value)} /></div>
              </div>
            )}
          </>)}
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || state !== 'ready'}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
