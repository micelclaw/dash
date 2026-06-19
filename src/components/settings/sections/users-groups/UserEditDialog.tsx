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
import { ShieldCheck, ShieldOff, LogOut } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs } from '@/components/shared/Tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useUsersStore } from '@/stores/users.store';
import type { AdminUser, UserRole } from '@/types/users';
import { OPT_IN_APPS } from '@/config/app-catalog';
import { getUserAppAccess, patchUserAppAccess } from '@/services/app-access.service';
import { getUserFolderAccess, patchUserFolderAccess, type FolderPermission, type UserFolderPerm } from '@/services/shared-folders.service';
import { getUserGroups, patchUserGroups, type UserGroup } from '@/services/groups.service';
import { getUserQuota, patchUserQuota, type UserQuota } from '@/services/quotas.service';
import { getUserSpeedLimits, patchUserSpeedLimits, type UserSpeedLimit } from '@/services/speed-limits.service';

const gb = (b: number) => (b > 0 ? `${(b / 1e9).toFixed(2)} GB` : 'Sin límite');
const FOLDER_PERMS: { v: FolderPermission; label: string }[] = [
  { v: 'none', label: 'Sin acceso' }, { v: 'rw', label: 'Lectura-Escritura' }, { v: 'ro', label: 'Solo lectura' },
];

export function UserEditDialog({ user, open, onOpenChange, onSaved, isSelf }: {
  user: AdminUser; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; isSelf: boolean;
}) {
  const store = useUsersStore();
  const [tab, setTab] = useState('info');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);

  // Información
  const [displayName, setDisplayName] = useState(user.display_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  // Datos precargados + estado editable
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [groupMember, setGroupMember] = useState<Record<string, boolean>>({});
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [appAllow, setAppAllow] = useState<Record<string, boolean>>({});
  const [folders, setFolders] = useState<UserFolderPerm[]>([]);
  const [folderPerm, setFolderPerm] = useState<Record<string, FolderPermission>>({});
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [quotaGb, setQuotaGb] = useState('0');
  const [speed, setSpeed] = useState<UserSpeedLimit | null>(null);
  const [sDown, setSDown] = useState('0');
  const [sUp, setSUp] = useState('0');
  const [sMedia, setSMedia] = useState('0');

  // NAS-UI: precarga PARALELA de todas las pestañas al abrir (mata el "Cargando…"
  // en serie y el bug del JSON: un rechazo NO bloquea las demás pestañas).
  useEffect(() => {
    if (!open) return;
    setState('loading');
    Promise.allSettled([
      getUserGroups(user.id), getUserAppAccess(user.id), getUserFolderAccess(user.id),
      getUserQuota(user.id), getUserSpeedLimits(user.id),
    ]).then(([g, a, f, q, s]) => {
      if (g.status === 'fulfilled') {
        setGroups(g.value);
        setGroupMember(Object.fromEntries(g.value.map((x) => [x.id, x.member])));
      }
      if (a.status === 'fulfilled') {
        setIsAdminUser(a.value.is_admin);
        setAppAllow(Object.fromEntries(a.value.apps.map((x) => [x.key, x.allowed])));
      }
      if (f.status === 'fulfilled') {
        setFolders(f.value);
        setFolderPerm(Object.fromEntries(f.value.map((x) => [x.id, x.permission])));
      }
      if (q.status === 'fulfilled') { setQuota(q.value); setQuotaGb(String((q.value.quota_bytes || 0) / 1e9)); }
      if (s.status === 'fulfilled') { setSpeed(s.value); setSDown(String(s.value.down_kbps || 0)); setSUp(String(s.value.up_kbps || 0)); setSMedia(String(s.value.media_down_kbps || 0)); }
      setState('ready');
    });
  }, [open, user.id]);

  const save = async () => {
    setSaving(true);
    try {
      // Información (solo si cambió)
      const infoPatch: Record<string, string> = {};
      if (displayName !== user.display_name) infoPatch.display_name = displayName;
      if (email !== user.email) infoPatch.email = email;
      if (role !== user.role && !isSelf) infoPatch.role = role;
      const ops: Promise<unknown>[] = [];
      if (Object.keys(infoPatch).length) ops.push(store.updateUser(user.id, infoPatch));
      ops.push(patchUserGroups(user.id, groupMember));
      if (!isAdminUser) ops.push(patchUserAppAccess(user.id, appAllow));
      ops.push(patchUserFolderAccess(user.id, folderPerm));
      ops.push(patchUserQuota(user.id, Math.round(Number(quotaGb) * 1e9)));
      ops.push(patchUserSpeedLimits(user.id, Math.round(Number(sUp)), Math.round(Number(sDown)), Math.round(Number(sMedia))));
      await Promise.all(ops);
      toast.success('Usuario actualizado');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const revoke = async () => {
    try { await store.revokeAllSessions(user.id); toast.success('Sesiones cerradas'); }
    catch (e) { toast.error((e as Error).message || 'Error'); }
  };

  const tabs = [
    { id: 'info', label: 'Información' }, { id: 'grupos', label: 'Grupos de usuarios' },
    { id: 'permisos', label: 'Permisos' }, { id: 'cuota', label: 'Cuota' },
    { id: 'apps', label: 'Aplicaciones' }, { id: 'velocidad', label: 'Límite de velocidad' },
  ];
  const label = 'block text-xs text-[var(--text-dim)] mb-1';
  const note = 'text-xs text-[var(--text-dim)]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{user.display_name}{isSelf && <span className="ml-2 text-xs text-[var(--text-dim)]">(tú)</span>}</DialogTitle>
        <div className="mt-2"><Tabs tabs={tabs} activeTab={tab} onChange={setTab} /></div>

        <div className="mt-4 min-h-[300px] max-h-[55vh] overflow-auto pr-1">
          {state === 'loading' && <div className="py-10 text-center text-sm text-[var(--text-dim)]">Cargando…</div>}
          {state === 'ready' && (<>
            {tab === 'info' && (
              <div className="flex flex-col gap-3">
                <div><label className={label}>Nombre</label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <div><label className={label}>Correo electrónico</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div>
                  <label className={label}>Rol</label>
                  <select disabled={isSelf} value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                    className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm text-[var(--text)] disabled:opacity-50">
                    <option value="user">Usuario</option><option value="admin">Administrador</option>
                    {role === 'owner' && <option value="owner">Propietario</option>}
                  </select>
                  {isSelf && <p className={`${note} mt-1`}>No puedes cambiar tu propio rol.</p>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {user.two_factor_enabled
                    ? <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3 text-[var(--green,#22c55e)]" /> 2FA activado</Badge>
                    : <Badge variant="secondary" className="gap-1"><ShieldOff className="h-3 w-3" /> 2FA desactivado</Badge>}
                  <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>{user.status === 'active' ? 'Activo' : 'Suspendido'}</Badge>
                </div>
                <div className="border-t border-[var(--border)] pt-3 mt-1">
                  <Button variant="outline" size="sm" onClick={revoke} className="gap-2"><LogOut className="h-3.5 w-3.5" /> Cerrar sesión en otros dispositivos</Button>
                  <p className={`${note} mt-2`}>Más opciones de cuenta (descripción, desactivación programada, bloqueo de cambio de contraseña) llegan en la siguiente entrega.</p>
                </div>
              </div>
            )}

            {tab === 'grupos' && (
              <div className="flex flex-col gap-1.5">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)]">
                    <Checkbox checked={!!groupMember[g.id]} onCheckedChange={(c) => setGroupMember((p) => ({ ...p, [g.id]: !!c }))} />
                    <span className="text-sm text-[var(--text)]">{g.name}</span>
                    {g.is_system && <span className="ml-auto text-[0.65rem] uppercase text-[var(--text-dim)]">sistema</span>}
                  </label>
                ))}
              </div>
            )}

            {tab === 'permisos' && (isAdminUser ? <p className={note}>Este usuario es administrador: acceso total a las carpetas.</p> : (
              <div className="flex flex-col gap-3">
                <p className={note}>Precedencia: <strong className="text-[var(--text)]">Sin acceso &gt; Lectura-Escritura &gt; Solo lectura</strong>.</p>
                {folders.length === 0 ? <p className={note}>No hay carpetas compartidas.</p> : folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2">
                    <span className="text-sm text-[var(--text)]">{f.name}</span>
                    <RadioGroup value={folderPerm[f.id] ?? 'none'} onValueChange={(v) => setFolderPerm((p) => ({ ...p, [f.id]: v as FolderPermission }))} className="flex gap-3">
                      {FOLDER_PERMS.map((o) => (
                        <label key={o.v} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] cursor-pointer">
                          <RadioGroupItem value={o.v} /> {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            ))}

            {tab === 'cuota' && (
              <div className="flex flex-col gap-3 max-w-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border border-[var(--border)] p-2"><div className={note}>Efectiva</div><div className="text-[var(--text)] font-medium">{gb(quota?.effective_bytes ?? 0)}</div></div>
                  <div className="rounded-md border border-[var(--border)] p-2"><div className={note}>De grupo</div><div className="text-[var(--text)] font-medium">{gb(quota?.group_bytes ?? 0)}</div></div>
                  <div className="rounded-md border border-[var(--border)] p-2"><div className={note}>En uso</div><div className="text-[var(--text)] font-medium">{((quota?.used_bytes ?? 0) / 1e9).toFixed(2)} GB</div></div>
                </div>
                <div><label className={label}>Cuota de usuario (GB) — 0 = ilimitado</label><Input type="number" min={0} step={0.5} value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} /></div>
              </div>
            )}

            {tab === 'apps' && (isAdminUser ? <p className={note}>Este usuario es administrador: ve todas las aplicaciones.</p> : (
              <div className="flex flex-col gap-1.5">
                <p className={note}>Precedencia: <strong className="text-[var(--text)]">Denegar &gt; Permitir</strong>.</p>
                {OPT_IN_APPS.map((a) => (
                  <label key={a.key} className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)]">
                    <Checkbox checked={!!appAllow[a.key]} onCheckedChange={(c) => setAppAllow((p) => ({ ...p, [a.key]: !!c }))} />
                    <span className="text-sm text-[var(--text)]">{a.label}</span>
                  </label>
                ))}
              </div>
            ))}

            {tab === 'velocidad' && (
              <div className="flex flex-col gap-3 max-w-sm">
                <div className="text-[0.7rem] font-semibold uppercase text-[var(--text-dim)]">Archivos (Drive)</div>
                <div><label className={label}>Bajada (KB/s) — 0 = ilimitado</label><Input type="number" min={0} step={64} value={sDown} onChange={(e) => setSDown(e.target.value)} /></div>
                <div><label className={label}>Subida (KB/s) — 0 = ilimitado</label><Input type="number" min={0} step={64} value={sUp} onChange={(e) => setSUp(e.target.value)} /></div>
                <div className="text-[0.7rem] font-semibold uppercase text-[var(--text-dim)] mt-1">Media (streaming)</div>
                <div><label className={label}>Bajada media (KB/s) — 0 = ilimitado</label><Input type="number" min={0} step={64} value={sMedia} onChange={(e) => setSMedia(e.target.value)} /></div>
                {speed && <p className={note}>Efectivo (usuario ∪ grupos): archivos ↓ {speed.effective_down_kbps || '∞'} ↑ {speed.effective_up_kbps || '∞'} · media ↓ {speed.effective_media_down_kbps || '∞'} KB/s</p>}
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
