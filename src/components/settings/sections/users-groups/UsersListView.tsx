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

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Download, Search, MoreVertical, KeyRound, Link2, Ban, RotateCcw, LogOut, ShieldCheck } from 'lucide-react';
import { useUsersStore } from '@/stores/users.store';
import { useAuthStore } from '@/stores/auth.store';
import type { AdminUser } from '@/types/users';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserEditDialog } from './UserEditDialog';
import { CreateUserDialog, SetPasswordDialog, ResetLinkDialog } from './dialogs';

const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
const ROLE_LABEL: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', user: 'Usuario' };

export function UsersListView() {
  const { users, loading, fetchUsers, suspendUser, reactivateUser, deleteUser } = useUsersStore();
  const selfId = useAuthStore((s) => s.user?.id);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [pwUser, setPwUser] = useState<AdminUser | null>(null);
  const [linkUser, setLinkUser] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'suspend' | 'reactivate'; user: AdminUser } | null>(null);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => `${u.display_name} ${u.email} ${u.description ?? ''}`.toLowerCase().includes(s));
  }, [users, q]);

  const selectedUsers = users.filter((u) => selected.has(u.id));

  const exportCsv = () => {
    const head = 'Nombre,Correo,Rol,Estado,2FA\n';
    const body = users.map((u) => [u.display_name, u.email, ROLE_LABEL[u.role] ?? u.role, u.status === 'active' ? 'Activo' : 'Suspendido', u.two_factor_enabled ? 'Sí' : 'No']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'usuarios.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    try {
      if (kind === 'delete') { await deleteUser(user.id); toast.success('Usuario eliminado'); }
      else if (kind === 'suspend') { await suspendUser(user.id); toast.success('Usuario suspendido'); }
      else { await reactivateUser(user.id); toast.success('Usuario reactivado'); }
    } catch (e) { toast.error((e as Error).message || 'Error'); }
  };

  const columns: DataColumn<AdminUser>[] = [
    {
      key: 'display_name', header: 'Nombre', sortable: true,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[0.65rem] font-semibold text-[var(--text-dim)]">{initials(u.display_name)}</span>
          <span className="text-[var(--text)]">{u.display_name}</span>
          {u.id === selfId && <span className="text-xs text-[var(--text-dim)]">(tú)</span>}
        </div>
      ),
    },
    { key: 'email', header: 'Correo electrónico', sortable: true, render: (u) => <span className="text-[var(--text-dim)]">{u.email}</span> },
    { key: 'description', header: 'Descripción', render: (u) => <span className="text-[var(--text-dim)]">{u.description ?? '—'}</span> },
    {
      key: 'two_factor_enabled', header: 'Estado 2FA', sortable: true,
      render: (u) => u.two_factor_enabled
        ? <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3 text-[var(--green,#22c55e)]" /> Activado</Badge>
        : <span className="text-xs text-[var(--text-dim)]">Desactivado</span>,
    },
    {
      key: 'status', header: 'Estado', sortable: true,
      render: (u) => u.status === 'active'
        ? <span className="text-[var(--text)]">Normal</span>
        : <Badge variant="destructive">Desactivado</Badge>,
    },
    {
      key: '_actions', header: '', width: '40px',
      render: (u) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(u)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPwUser(u)}><KeyRound className="mr-2 h-3.5 w-3.5" /> Cambiar contraseña</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkUser(u)}><Link2 className="mr-2 h-3.5 w-3.5" /> Enlace de restablecimiento</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { try { await useUsersStore.getState().revokeAllSessions(u.id); toast.success('Sesiones cerradas'); } catch (e) { toast.error((e as Error).message); } }}><LogOut className="mr-2 h-3.5 w-3.5" /> Cerrar todas las sesiones</DropdownMenuItem>
              <DropdownMenuSeparator />
              {u.status === 'active'
                ? <DropdownMenuItem disabled={u.id === selfId} onClick={() => setConfirm({ kind: 'suspend', user: u })}><Ban className="mr-2 h-3.5 w-3.5" /> Suspender</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => setConfirm({ kind: 'reactivate', user: u })}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Reactivar</DropdownMenuItem>}
              <DropdownMenuItem disabled={u.id === selfId} onClick={() => setConfirm({ kind: 'delete', user: u })} className="text-[var(--error)]"><Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Crear</Button>
        <Button variant="outline" disabled={selectedUsers.length !== 1} onClick={() => setEditing(selectedUsers[0])} className="gap-1.5"><Pencil className="h-4 w-4" /> Editar</Button>
        <Button variant="outline" disabled={selectedUsers.length === 0 || selectedUsers.some((u) => u.id === selfId)} onClick={() => selectedUsers.length === 1 && setConfirm({ kind: 'delete', user: selectedUsers[0] })} className="gap-1.5"><Trash2 className="h-4 w-4" /> Eliminar</Button>
        <Button variant="outline" onClick={exportCsv} className="gap-1.5"><Download className="h-4 w-4" /> Exportar</Button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" className="h-8 w-56 pl-8" />
        </div>
      </div>

      <DataTable<AdminUser>
        columns={columns} rows={rows} getRowKey={(u) => u.id} loading={loading}
        selectable selectedKeys={selected} onSelectionChange={setSelected}
        onRowClick={(u) => setEditing(u)} initialSort={{ key: 'display_name', dir: 'asc' }}
        empty="No hay usuarios"
      />
      <div className="text-xs text-[var(--text-dim)]">{rows.length} usuario(s)</div>

      {editing && <UserEditDialog user={editing} open onOpenChange={(o) => !o && setEditing(null)} onSaved={fetchUsers} isSelf={editing.id === selfId} />}
      <CreateUserDialog open={creating} onOpenChange={setCreating} onCreated={fetchUsers} />
      {pwUser && <SetPasswordDialog userId={pwUser.id} open onOpenChange={(o) => !o && setPwUser(null)} />}
      {linkUser && <ResetLinkDialog userId={linkUser.id} open onOpenChange={(o) => !o && setLinkUser(null)} />}
      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={runConfirm}
        title={confirm?.kind === 'delete' ? 'Eliminar usuario' : confirm?.kind === 'suspend' ? 'Suspender usuario' : 'Reactivar usuario'}
        description={confirm ? `${confirm.kind === 'delete' ? 'Se eliminará' : confirm.kind === 'suspend' ? 'Se suspenderá' : 'Se reactivará'} a "${confirm.user.display_name}".` : ''}
        confirmLabel={confirm?.kind === 'delete' ? 'Eliminar' : confirm?.kind === 'suspend' ? 'Suspender' : 'Reactivar'}
        cancelLabel="Cancelar"
        variant={confirm?.kind === 'reactivate' ? 'default' : 'danger'}
      />
    </div>
  );
}
