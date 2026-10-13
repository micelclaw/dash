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
import { Plus, Trash2, FolderOpen, Search, RefreshCw, HardDrive, Link2, Share2, KeyRound, ChevronDown, Pencil } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SharedFolderCreateDialog } from './SharedFolderCreateDialog';
import { SharedFolderEditDialog } from './SharedFolderEditDialog';
import {
  listSharedFolders, deleteSharedFolder, reindexSharedFolder, updateSharedFolder,
  getSshKeys, setSshKeys, type SharedFolder,
} from '@/services/shared-folders.service';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'pendiente', cls: 'text-[var(--text-dim)]' },
  indexing: { label: 'indexando…', cls: 'text-[var(--info)]' },
  active: { label: 'activa', cls: 'text-[var(--success)]' },
  error: { label: 'error', cls: 'text-[var(--error)]' },
};

export function SharedFoldersSection() {
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<SharedFolder | null>(null);
  const [editTab, setEditTab] = useState('general');
  const [confirmDel, setConfirmDel] = useState<SharedFolder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sshOpen, setSshOpen] = useState(false);
  const [sshKeys, setSshKeysState] = useState<string[]>([]);
  const [sshDraft, setSshDraft] = useState('');
  const [sshSaving, setSshSaving] = useState(false);

  useEffect(() => { getSshKeys().then(setSshKeysState).catch(() => {}); }, []);

  const addKey = async () => {
    if (!sshDraft.trim()) return;
    setSshSaving(true);
    try {
      const saved = await setSshKeys([...sshKeys, sshDraft.trim()]);
      setSshKeysState(saved); setSshDraft('');
      toast.success('Clave añadida');
    } catch (e) { toast.error((e as Error).message); }
    setSshSaving(false);
  };
  const removeKey = async (idx: number) => {
    try { setSshKeysState(await setSshKeys(sshKeys.filter((_, i) => i !== idx))); }
    catch (e) { toast.error((e as Error).message); }
  };

  const reindex = async (f: SharedFolder) => {
    setBusyId(f.id);
    try {
      const r = await reindexSharedFolder(f.id);
      if ('skipped' in r) toast.info('Carpeta fuera del Drive (index_in_drive desactivado)');
      else toast.success(`"${f.name}" reindexada: ${r.created} nuevos, ${r.removed} quitados (${r.total} en disco)`);
      load();
    } catch (e) { toast.error((e as Error).message); }
    setBusyId(null);
  };

  const load = () => {
    setLoading(true);
    listSharedFolders().then(setFolders).catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDrive = async (folder: SharedFolder) => {
    setBusyId(folder.id);
    try {
      const enabled = !folder.index_in_drive;
      await updateSharedFolder(folder.id, { index_in_drive: enabled });
      toast.success(enabled ? `«${folder.name}» ya aparece en Drive` : `«${folder.name}» se ha retirado de Drive`);
      load();
    } catch (error) {
      toast.error((error as Error).message || 'No se pudo cambiar la visibilidad en Drive');
    } finally { setBusyId(null); }
  };

  // Mantener el diálogo de edición sincronizado con la fila recargada.
  useEffect(() => {
    if (!editFolder) return;
    const fresh = folders.find((f) => f.id === editFolder.id);
    if (fresh && fresh !== editFolder) setEditFolder(fresh);
  }, [folders, editFolder]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return folders;
    return folders.filter((f) => `${f.name} ${f.description ?? ''} ${f.slug}`.toLowerCase().includes(s));
  }, [folders, q]);

  const openEdit = (f: SharedFolder, tab = 'general') => { setEditTab(tab); setEditFolder(f); };

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
    {
      key: 'backend', header: 'Origen', align: 'center',
      render: (f) => f.backend === 'host_bind'
        ? <span title={f.host_path ?? ''} className="inline-flex items-center gap-1 text-xs text-[var(--warning)]"><Link2 className="h-3 w-3" /> host{f.read_only ? ' (RO)' : ''}</span>
        : <span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]"><HardDrive className="h-3 w-3" /> gestionada</span>,
    },
    {
      key: 'index_in_drive', header: 'Drive', align: 'center',
      render: (f) => (
        <div className="flex flex-col items-center gap-1">
          <span className={`text-xs ${f.index_in_drive ? 'text-[var(--success)]' : 'text-[var(--text-dim)]'}`}>
            {f.index_in_drive ? 'Habilitada' : 'No habilitada'}
          </span>
          <Button
            variant="outline" size="sm" className="h-7 px-2 text-xs"
            disabled={busyId === f.id}
            onClick={(event) => { event.stopPropagation(); void toggleDrive(f); }}
          >
            {f.index_in_drive ? 'Deshabilitar' : 'Habilitar'}
          </Button>
        </div>
      ),
    },
    {
      key: 'status', header: 'Estado', align: 'center',
      render: (f) => {
        const m = STATUS_META[f.status] ?? STATUS_META['active'] ?? { label: f.status, cls: 'text-[var(--text-dim)]' };
        return <span title={f.last_error ?? undefined} className={`text-xs ${m.cls}`}>{m.label}</span>;
      },
    },
    {
      key: '_protocols', header: 'Compartir', align: 'center',
      render: (f) => {
        const active = Object.entries(f.protocols ?? {}).filter(([, v]) => v?.enabled).map(([k]) => k.toUpperCase());
        return (
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
            onClick={(e) => { e.stopPropagation(); openEdit(f, 'red'); }}
            title="Compartir por red (SMB, WebDAV, SFTP, NFS, rsync)"
          >
            <Share2 className="h-3.5 w-3.5" /> {active.length ? active.join(' · ') : 'Ninguno'}
          </button>
        );
      },
    },
    {
      key: '_actions', header: '', width: '80px',
      render: (f) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(f, 'general')}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reindexar en Drive" disabled={!f.index_in_drive || busyId === f.id} onClick={() => void reindex(f)}>
            <RefreshCw className={`h-4 w-4 ${busyId === f.id ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--error)]" title="Eliminar" onClick={() => setConfirmDel(f)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <SettingSection
      title="Carpetas compartidas"
      description="Carpetas accesibles por varios usuarios. Edita una para renombrarla, ajustar sus opciones, asignar permisos por usuario/grupo (Sin acceso / Solo lectura / Lectura-escritura) y compartirla por red."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nueva carpeta</Button>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" className="h-8 w-56 pl-8" />
          </div>
        </div>

        <DataTable<SharedFolder>
          columns={columns} rows={rows} getRowKey={(f) => f.id} loading={loading}
          initialSort={{ key: 'name', dir: 'asc' }} empty="Aún no hay carpetas compartidas."
          onRowClick={(f) => openEdit(f, 'general')}
        />
      </div>

      <div className="mt-3 rounded-md border border-[var(--border)]">
        <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text)]" onClick={() => setSshOpen((v) => !v)}>
          <KeyRound className="h-4 w-4 text-[var(--amber)]" /> Claves SSH (para SFTP y rsync)
          <span className="ml-1 text-xs text-[var(--text-dim)]">{sshKeys.length} clave(s)</span>
          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${sshOpen ? 'rotate-180' : ''}`} />
        </button>
        {sshOpen && (
          <div className="space-y-2 border-t border-[var(--border)] p-3">
            {sshKeys.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs text-[var(--text-dim)]">{k}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--error)]" onClick={() => void removeKey(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {sshKeys.length === 0 && <div className="text-xs text-[var(--text-dim)]">Pega tu clave pública (ssh-ed25519 …) para acceder por SFTP/rsync.</div>}
            <div className="flex gap-2">
              <Input value={sshDraft} onChange={(e) => setSshDraft(e.target.value)} placeholder="ssh-ed25519 AAAA… tu@equipo" className="h-8 font-mono text-xs" />
              <Button onClick={() => void addKey()} disabled={sshSaving || !sshDraft.trim()}>Añadir</Button>
            </div>
          </div>
        )}
      </div>

      <SharedFolderCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => load()} />
      {editFolder && (
        <SharedFolderEditDialog
          folder={editFolder} open onOpenChange={(o) => { if (!o) setEditFolder(null); }}
          onSaved={load} initialTab={editTab}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={handleDelete}
        title="Eliminar carpeta compartida"
        description={confirmDel ? `Se eliminará la carpeta compartida "${confirmDel.name}". Los datos en disco se conservan.` : ''}
        confirmLabel="Eliminar" cancelLabel="Cancelar" variant="danger"
      />
    </SettingSection>
  );
}
