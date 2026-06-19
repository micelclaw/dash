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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, MoreVertical, Users } from 'lucide-react';
import { listGroups, deleteGroup, type Group } from '@/services/groups.service';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { GroupEditDialog } from './GroupEditDialog';
import { CreateGroupDialog } from './dialogs';

export function GroupsListView() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<Group | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try { setGroups(await listGroups()); }
    catch (e) { toast.error((e as Error).message || 'No se pudieron cargar los grupos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups.filter((g) => `${g.name} ${g.description ?? ''}`.toLowerCase().includes(s));
  }, [groups, q]);

  const selectedGroups = groups.filter((g) => selected.has(g.id));

  const runDelete = async () => {
    if (!confirm) return;
    try { await deleteGroup(confirm.id); toast.success('Grupo eliminado'); fetchGroups(); }
    catch (e) { toast.error((e as Error).message || 'Error'); }
  };

  const columns: DataColumn<Group>[] = [
    {
      key: 'name', header: 'Nombre', sortable: true,
      render: (g) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-dim)]"><Users className="h-3.5 w-3.5" /></span>
          <span className="text-[var(--text)]">{g.name}</span>
          {g.is_system && <Badge variant="secondary" className="text-[0.65rem]">sistema</Badge>}
        </div>
      ),
    },
    { key: 'description', header: 'Descripción', sortable: true, render: (g) => <span className="text-[var(--text-dim)]">{g.description || '—'}</span> },
    { key: 'member_count', header: 'Miembros', sortable: true, align: 'right', render: (g) => <span className="text-[var(--text)]">{g.member_count}</span> },
    {
      key: '_actions', header: '', width: '40px',
      render: (g) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(g)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={g.is_system} onClick={() => setConfirm(g)} className="text-[var(--error)]"><Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
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
        <Button variant="outline" disabled={selectedGroups.length !== 1} onClick={() => setEditing(selectedGroups[0])} className="gap-1.5"><Pencil className="h-4 w-4" /> Editar</Button>
        <Button variant="outline" disabled={selectedGroups.length !== 1 || selectedGroups[0]?.is_system} onClick={() => selectedGroups.length === 1 && setConfirm(selectedGroups[0])} className="gap-1.5"><Trash2 className="h-4 w-4" /> Eliminar</Button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" className="h-8 w-56 pl-8" />
        </div>
      </div>

      <DataTable<Group>
        columns={columns} rows={rows} getRowKey={(g) => g.id} loading={loading}
        selectable selectedKeys={selected} onSelectionChange={setSelected}
        onRowClick={(g) => setEditing(g)} initialSort={{ key: 'name', dir: 'asc' }}
        empty="No hay grupos"
      />
      <div className="text-xs text-[var(--text-dim)]">{rows.length} grupo(s)</div>

      {editing && <GroupEditDialog group={editing} open onOpenChange={(o) => !o && setEditing(null)} onSaved={fetchGroups} />}
      <CreateGroupDialog open={creating} onOpenChange={setCreating} onCreated={fetchGroups} />
      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={runDelete}
        title="Eliminar grupo"
        description={confirm ? `Se eliminará el grupo "${confirm.name}". Los miembros perderán los permisos heredados de él.` : ''}
        confirmLabel="Eliminar" cancelLabel="Cancelar" variant="danger"
      />
    </div>
  );
}
