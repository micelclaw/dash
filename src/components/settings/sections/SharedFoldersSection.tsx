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
import { Plus, Trash2, FolderOpen, Search } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  listSharedFolders, createSharedFolder, deleteSharedFolder, type SharedFolder,
} from '@/services/shared-folders.service';

export function SharedFoldersSection() {
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recycle, setRecycle] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<SharedFolder | null>(null);

  const load = () => {
    setLoading(true);
    listSharedFolders().then(setFolders).catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return folders;
    return folders.filter((f) => `${f.name} ${f.description ?? ''} ${f.slug}`.toLowerCase().includes(s));
  }, [folders, q]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await createSharedFolder({ name: name.trim(), description: description.trim() || undefined, recycle_bin: recycle });
      toast.success(`Carpeta "${name}" creada`);
      setName(''); setDescription(''); setRecycle(true); setCreating(false);
      load();
    } catch (e) { toast.error((e as Error).message || 'No se pudo crear'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try { await deleteSharedFolder(confirmDel.id); toast.success('Carpeta eliminada'); load(); }
    catch (e) { toast.error((e as Error).message || 'No se pudo eliminar'); }
  };

  const columns: DataColumn<SharedFolder>[] = [
    {
      key: 'name', header: 'Nombre', sortable: true,
      render: (f) => (
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-4 w-4 shrink-0 text-[var(--amber)]" />
          <div className="min-w-0">
            <div className="text-[var(--text)]">{f.name}</div>
            {f.description && <div className="text-xs text-[var(--text-dim)] truncate">{f.description}</div>}
          </div>
        </div>
      ),
    },
    { key: 'slug', header: 'Ruta de red', sortable: true, render: (f) => <code className="text-xs text-[var(--text-dim)]">{`\\\\host\\${f.slug}`}</code> },
    { key: 'recycle_bin', header: 'Papelera', align: 'center', render: (f) => <span className="text-xs text-[var(--text-dim)]">{f.recycle_bin ? 'Sí' : '—'}</span> },
    {
      key: '_actions', header: '', width: '40px',
      render: (f) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--error)]" title="Eliminar" onClick={() => setConfirmDel(f)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <SettingSection
      title="Carpetas compartidas"
      description="Carpetas accesibles por varios usuarios. Los permisos por usuario (Sin acceso / Solo lectura / Lectura-escritura) se asignan en Usuarios y grupos → Editar → Permisos."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="h-4 w-4" /> Nueva carpeta</Button>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" className="h-8 w-56 pl-8" />
          </div>
        </div>

        {creating && (
          <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-3">
            <Input placeholder="Nombre (p.ej. Documentos)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--text-dim)]">
              <Checkbox checked={recycle} onCheckedChange={(c) => setRecycle(!!c)} /> Habilitar papelera de reciclaje
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
            </div>
          </div>
        )}

        <DataTable<SharedFolder>
          columns={columns} rows={rows} getRowKey={(f) => f.id} loading={loading}
          initialSort={{ key: 'name', dir: 'asc' }} empty="Aún no hay carpetas compartidas."
        />
      </div>

      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={handleDelete}
        title="Eliminar carpeta compartida"
        description={confirmDel ? `Se eliminará la carpeta compartida "${confirmDel.name}". Los datos en disco se conservan.` : ''}
        confirmLabel="Eliminar" cancelLabel="Cancelar" variant="danger"
      />
    </SettingSection>
  );
}
