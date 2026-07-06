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
import { FolderCog, Users, Share2, HardDrive, Link2, Gauge, ShieldOff, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs } from '@/components/shared/Tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NetworkSharingPanel } from './NetworkSharingModal';
import {
  createSharedFolder, updateSharedFolder, getFolderAccess, getFolderSubjects, setFolderAcl,
  getFolderUsage, emptyRecycleBin, updateSharedFolderProtocols,
  type SharedFolder, type FolderPermission, type FolderAccess,
} from '@/services/shared-folders.service';

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function quotaToBytes(gbStr: string): number | null {
  const gb = parseFloat(gbStr.replace(',', '.'));
  return gbStr.trim() === '' || !Number.isFinite(gb) || gb <= 0 ? null : Math.round(gb * 1e9);
}

const FOLDER_PERMS: { v: FolderPermission; label: string }[] = [
  { v: 'none', label: 'Sin acceso' }, { v: 'rw', label: 'Lectura-Escritura' }, { v: 'ro', label: 'Solo lectura' },
];

/**
 * Diálogo ÚNICO de carpeta compartida — crea Y edita con EL MISMO menú completo de 5
 * pestañas. `folder === null` → CREAR: se muestran las 5 pestañas desde el principio;
 * Permisos/Compartir-por-red/cuota/permisos-avanzados se editan en BORRADOR y se aplican
 * al pulsar "Crear" (POST + ACL + protocolos). `folder` dado → EDITAR (guardado directo).
 * Reutilizable desde Settings y desde el "+" del File Explorer.
 */
export function SharedFolderEditDialog({ folder, open, onOpenChange, onSaved, onCreated, initialTab = 'general' }: {
  folder: SharedFolder | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  onCreated?: (folder: SharedFolder) => void;
  initialTab?: string;
}) {
  const isCreate = folder === null;
  const [tab, setTab] = useState(initialTab);
  // General
  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [hidden, setHidden] = useState(folder?.hidden ?? false);
  const [readOnly, setReadOnly] = useState(folder?.read_only ?? false);
  const [indexInDrive, setIndexInDrive] = useState(folder?.index_in_drive ?? true);
  const [recycle, setRecycle] = useState(folder?.recycle_bin ?? true);
  const [abe, setAbe] = useState(folder?.access_based_enum ?? false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  // Crear: ubicación (solo al crear; en edición el backend es inmutable)
  const [backend, setBackend] = useState<'managed' | 'host_bind'>('managed');
  const [hostPath, setHostPath] = useState('');
  // Avanzada (cuota)
  const [quotaGb, setQuotaGb] = useState(folder?.quota_bytes != null ? String(Math.round(folder.quota_bytes / 1e9 * 100) / 100) : '');
  const [usage, setUsage] = useState<{ used_bytes: number; quota_bytes: number | null } | null>(null);
  const [savingQuota, setSavingQuota] = useState(false);
  const [emptying, setEmptying] = useState(false);
  // Permisos avanzados
  const [denyBrowse, setDenyBrowse] = useState(folder?.deny_browse ?? false);
  const [denyModify, setDenyModify] = useState(folder?.deny_modify ?? false);
  const [denyDownload, setDenyDownload] = useState(folder?.deny_download ?? false);
  // Permisos (ACL) — en crear es BORRADOR (se aplica al crear)
  const [access, setAccess] = useState<FolderAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  // Compartir por red — en crear es BORRADOR
  const [draftProtocols, setDraftProtocols] = useState<SharedFolder['protocols']>({});

  useEffect(() => { setTab(initialTab); }, [initialTab, folder?.id]);
  // Re-sembrar el formulario al cambiar de carpeta (o al abrir en modo crear).
  useEffect(() => {
    setName(folder?.name ?? ''); setDescription(folder?.description ?? ''); setHidden(folder?.hidden ?? false);
    setReadOnly(folder?.read_only ?? false); setIndexInDrive(folder?.index_in_drive ?? true); setRecycle(folder?.recycle_bin ?? true);
    setAbe(folder?.access_based_enum ?? false);
    setBackend('managed'); setHostPath('');
    setQuotaGb(folder?.quota_bytes != null ? String(Math.round(folder.quota_bytes / 1e9 * 100) / 100) : '');
    setDenyBrowse(folder?.deny_browse ?? false); setDenyModify(folder?.deny_modify ?? false); setDenyDownload(folder?.deny_download ?? false);
    setAccess(null); setUsage(null); setDraftProtocols({});
  }, [folder]);

  // Permisos: en edición carga el ACL de la carpeta; en creación, la lista de sujetos (todos 'none').
  useEffect(() => {
    if (!open || tab !== 'permisos' || access) return;
    setAccessLoading(true);
    (isCreate ? getFolderSubjects() : getFolderAccess(folder!.id))
      .then(setAccess).catch((e) => toast.error((e as Error).message)).finally(() => setAccessLoading(false));
  }, [open, isCreate, tab, folder, access]);

  useEffect(() => {
    if (!open || isCreate || !folder || tab !== 'avanzada' || usage) return;
    getFolderUsage(folder.id).then(setUsage).catch(() => {});
  }, [open, isCreate, tab, folder, usage]);

  const createFolder = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (backend === 'host_bind' && !hostPath.trim()) { toast.error('Indica la ruta del servidor'); return; }
    setSavingGeneral(true);
    try {
      const created = await createSharedFolder({
        name: name.trim(), description: description.trim() || undefined,
        backend, host_path: backend === 'host_bind' ? hostPath.trim() : undefined,
        read_only: readOnly, hidden, access_based_enum: abe, recycle_bin: recycle, index_in_drive: indexInDrive,
        quota_bytes: quotaToBytes(quotaGb),
        deny_browse: denyBrowse, deny_modify: denyModify, deny_download: denyDownload,
      });
      // Aplicar los BORRADORES (permisos + protocolos) sobre la carpeta ya creada.
      const acl = [
        ...(access?.users ?? []).map((u) => ['user', u.id, u.permission] as const),
        ...(access?.groups ?? []).map((g) => ['group', g.id, g.permission] as const),
      ].filter(([, , p]) => p !== 'none');
      for (const [type, sid, perm] of acl) {
        await setFolderAcl(created.id, { subject_type: type, subject_id: sid, permission: perm }).catch(() => {});
      }
      if (Object.keys(draftProtocols).length) {
        await updateSharedFolderProtocols(created.id, draftProtocols).catch(() => {});
      }
      toast.success(`Carpeta "${created.name}" creada`);
      onOpenChange(false);
      onCreated?.(created);
      onSaved();
    } catch (e) { toast.error((e as Error).message || 'No se pudo crear'); }
    finally { setSavingGeneral(false); }
  };

  const saveGeneral = async () => {
    if (!folder) return;
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSavingGeneral(true);
    try {
      await updateSharedFolder(folder.id, {
        name: name.trim(), description: description.trim(), hidden, read_only: readOnly,
        index_in_drive: indexInDrive, recycle_bin: recycle, access_based_enum: abe,
      });
      toast.success('Carpeta actualizada'); onSaved();
    } catch (e) { toast.error((e as Error).message || 'No se pudo guardar'); }
    finally { setSavingGeneral(false); }
  };

  const saveQuota = async () => {
    if (!folder) return;
    setSavingQuota(true);
    try {
      await updateSharedFolder(folder.id, { quota_bytes: quotaToBytes(quotaGb) });
      toast.success(quotaToBytes(quotaGb) == null ? 'Cuota desactivada' : 'Cuota guardada');
      setUsage(null); onSaved();
    } catch (e) { toast.error((e as Error).message || 'No se pudo guardar la cuota'); }
    finally { setSavingQuota(false); }
  };

  const toggleDeny = async (key: 'deny_browse' | 'deny_modify' | 'deny_download', val: boolean) => {
    const set = { deny_browse: setDenyBrowse, deny_modify: setDenyModify, deny_download: setDenyDownload }[key];
    set(val);
    if (isCreate || !folder) return; // borrador → se envía en el POST de crear
    try { await updateSharedFolder(folder.id, { [key]: val }); onSaved(); }
    catch (e) { toast.error((e as Error).message); set(!val); }
  };

  const doEmptyRecycle = async () => {
    if (!folder) return;
    setEmptying(true);
    try { await emptyRecycleBin(folder.id); toast.success('Papelera vaciada'); setUsage(null); }
    catch (e) { toast.error((e as Error).message); }
    finally { setEmptying(false); }
  };

  const changeAcl = async (type: 'user' | 'group', subjectId: string, permission: FolderPermission) => {
    setAccess((a) => a && {
      users: type === 'user' ? a.users.map((u) => (u.id === subjectId ? { ...u, permission } : u)) : a.users,
      groups: type === 'group' ? a.groups.map((g) => (g.id === subjectId ? { ...g, permission } : g)) : a.groups,
    });
    if (isCreate || !folder) return; // borrador → se aplica al crear
    try { await setFolderAcl(folder.id, { subject_type: type, subject_id: subjectId, permission }); onSaved(); }
    catch (e) { toast.error((e as Error).message); getFolderAccess(folder.id).then(setAccess).catch(() => {}); }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: FolderCog },
    { id: 'avanzada', label: 'Avanzada', icon: Gauge },
    { id: 'permisos', label: 'Permisos', icon: Users },
    { id: 'perm-avanzados', label: 'Permisos avanzados', icon: ShieldOff },
    { id: 'red', label: 'Compartir por red', icon: Share2 },
  ];

  const label = 'text-[0.7rem] font-semibold uppercase text-[var(--text-dim)]';

  // Carpeta sintética para el panel de red en modo borrador (sin id/slug todavía).
  const draftFolder = { id: '', slug: '', name, backend, host_path: backend === 'host_bind' ? hostPath : null, protocols: draftProtocols } as SharedFolder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{isCreate ? 'Nueva carpeta compartida' : `Editar «${folder!.name}»`}</DialogTitle>
        <div className="mt-2"><Tabs tabs={tabs} activeTab={tab} onChange={setTab} /></div>
        <div className="mt-4 min-h-[300px] max-h-[55vh] overflow-auto pr-1">
          {tab === 'general' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1"><span className={label}>Nombre</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isCreate ? 'p.ej. Documentos' : undefined} autoFocus={isCreate} /></div>
              <div className="flex flex-col gap-1"><span className={label}>Descripción</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="(opcional)" /></div>

              {isCreate ? (
                <div className="flex flex-col gap-1">
                  <span className={label}>Ubicación</span>
                  <div className="flex gap-2 text-sm">
                    <button type="button" onClick={() => setBackend('managed')}
                      className={`flex-1 rounded-md border p-2 text-left ${backend === 'managed' ? 'border-[var(--amber)] bg-[var(--amber)]/10' : 'border-[var(--border)]'}`}>
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text)]"><HardDrive className="h-3.5 w-3.5" /> Gestionada</div>
                      <div className="text-xs text-[var(--text-dim)]">Carpeta nueva del sistema (recomendado)</div>
                    </button>
                    <button type="button" onClick={() => setBackend('host_bind')}
                      className={`flex-1 rounded-md border p-2 text-left ${backend === 'host_bind' ? 'border-[var(--amber)] bg-[var(--amber)]/10' : 'border-[var(--border)]'}`}>
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text)]"><Link2 className="h-3.5 w-3.5" /> Enlazar del servidor</div>
                      <div className="text-xs text-[var(--text-dim)]">Un directorio EXISTENTE del host</div>
                    </button>
                  </div>
                  {backend === 'host_bind' && (
                    <>
                      <Input className="mt-1" placeholder="Ruta absoluta del servidor (p.ej. /srv/biblioteca)" value={hostPath} onChange={(e) => setHostPath(e.target.value)} />
                      <span className="text-xs text-[var(--text-muted)]">No se admiten raíces del sistema (/, /home…) ni el directorio de datos. v1: se comparte por Drive/Explorador/WebDAV (SMB no).</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className={label}>Ubicación</span>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                    {folder!.backend === 'host_bind'
                      ? <><Link2 className="h-3.5 w-3.5" /> Enlazada del servidor: <code className="text-xs">{folder!.host_path}</code></>
                      : <><HardDrive className="h-3.5 w-3.5" /> Gestionada (data/shared/{folder!.slug})</>}
                  </div>
                </div>
              )}

              <ToggleRow label="Ocultar en la red" desc="No aparece al explorar la red (sí es accesible si conoces la ruta)." checked={hidden} onChange={setHidden} />
              <ToggleRow label="Ocultar subcarpetas y archivos sin permiso" desc="Cada usuario solo ve lo que puede abrir (Access-Based Enumeration)." checked={abe} onChange={setAbe} />
              <ToggleRow label="Solo lectura" desc="Nadie escribe en la carpeta, ni con permiso de Lectura-Escritura." checked={readOnly} onChange={setReadOnly} />
              <ToggleRow label="Papelera de reciclaje" desc="Conserva los archivos borrados para poder restaurarlos." checked={recycle} onChange={setRecycle} />
              <ToggleRow label="Indexar en el Drive" desc="Los archivos aparecen y se buscan desde el módulo Drive." checked={indexInDrive} onChange={setIndexInDrive} />

              {!isCreate && (
                <div className="flex justify-end"><Button onClick={() => void saveGeneral()} disabled={savingGeneral}>{savingGeneral ? 'Guardando…' : 'Guardar'}</Button></div>
              )}
            </div>
          )}

          {tab === 'avanzada' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className={label}>Cuota de la carpeta</span>
                {usage && (
                  <div className="text-xs text-[var(--text-dim)]">
                    Usado: <strong className="text-[var(--text)]">{fmtBytes(usage.used_bytes)}</strong>
                    {usage.quota_bytes != null && <> de {fmtBytes(usage.quota_bytes)} ({Math.min(100, Math.round(usage.used_bytes / usage.quota_bytes * 100))}%)</>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" step="0.1" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} placeholder="Sin límite" className="w-40" />
                  <span className="text-sm text-[var(--text-dim)]">GB</span>
                  {!isCreate && <Button size="sm" onClick={() => void saveQuota()} disabled={savingQuota}>{savingQuota ? '…' : 'Guardar'}</Button>}
                </div>
                <span className="text-xs text-[var(--text-muted)]">Vacío o 0 = sin límite. Contable a nivel de app (Drive/WebDAV); en un servidor con ZFS se aplica de forma nativa.{isCreate ? ' Se aplica al crear la carpeta.' : ''}</span>
              </div>
              {!isCreate && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2.5">
                  <div className="min-w-0"><div className="text-sm text-[var(--text)]">Papelera de reciclaje</div><div className="text-xs text-[var(--text-muted)]">Vaciar borra definitivamente lo que hay en la papelera de esta carpeta.</div></div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-[var(--error)]" onClick={() => void doEmptyRecycle()} disabled={emptying}><Trash2 className="h-3.5 w-3.5" /> {emptying ? 'Vaciando…' : 'Vaciar'}</Button>
                </div>
              )}
            </div>
          )}

          {tab === 'perm-avanzados' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-[var(--text-dim)]">Restricciones adicionales al acceder por File Explorer o WebDAV (además de los permisos por usuario).{isCreate ? ' Se aplican al crear.' : ' Se guardan al instante.'}</p>
              <ToggleRow label="Deshabilitar navegación de directorios" desc="Los usuarios no pueden listar el contenido de la carpeta." checked={denyBrowse} onChange={(v) => void toggleDeny('deny_browse', v)} />
              <ToggleRow label="Deshabilitar modificación de archivos existentes" desc="No se pueden editar ni sobrescribir archivos ya presentes." checked={denyModify} onChange={(v) => void toggleDeny('deny_modify', v)} />
              <ToggleRow label="Deshabilitar descarga de archivos" desc="Los usuarios pueden ver la lista pero no descargar el contenido." checked={denyDownload} onChange={(v) => void toggleDeny('deny_download', v)} />
            </div>
          )}

          {tab === 'permisos' && (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-[var(--text-dim)]">Permiso de cada usuario/grupo sobre esta carpeta (aplica a <strong className="text-[var(--text)]">toda</strong> la carpeta y sus subcarpetas). Precedencia: <strong className="text-[var(--text)]">Sin acceso &gt; Lectura-Escritura &gt; Solo lectura</strong>.{isCreate ? ' Se aplican al crear.' : ' Se guarda al instante.'}</p>
              {accessLoading && <div className="py-8 text-center text-sm text-[var(--text-dim)]">Cargando…</div>}
              {access && (<>
                <div className={label}>Usuarios</div>
                {access.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2.5">
                    <span className="text-sm text-[var(--text)]">{u.name}{u.is_admin && <span className="ml-2 text-xs text-[var(--text-dim)]">admin</span>}</span>
                    {u.is_admin && !isCreate
                      ? <span className="text-xs text-[var(--text-dim)]">Acceso total</span>
                      : <PermRadio value={u.permission} onChange={(v) => void changeAcl('user', u.id, v)} />}
                  </div>
                ))}
                {access.groups.length > 0 && <div className={label}>Grupos</div>}
                {access.groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2.5">
                    <span className="text-sm text-[var(--text)]">{g.name}</span>
                    <PermRadio value={g.permission} onChange={(v) => void changeAcl('group', g.id, v)} />
                  </div>
                ))}
              </>)}
            </div>
          )}

          {tab === 'red' && (
            isCreate
              ? <NetworkSharingPanel folder={draftFolder} draft onDraftChange={setDraftProtocols} />
              : <NetworkSharingPanel folder={folder!} onSaved={onSaved} />
          )}
        </div>

        {isCreate && (
          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => void createFolder()} disabled={savingGeneral}>{savingGeneral ? 'Creando…' : 'Crear carpeta'}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2.5">
      <div className="min-w-0"><div className="text-sm text-[var(--text)]">{label}</div><div className="text-xs text-[var(--text-muted)]">{desc}</div></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PermRadio({ value, onChange }: { value: FolderPermission; onChange: (v: FolderPermission) => void }) {
  return (
    <RadioGroup value={value === 'custom' ? 'rw' : value} onValueChange={(v) => onChange(v as FolderPermission)} className="flex gap-3">
      {FOLDER_PERMS.map((o) => (
        <label key={o.v} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] cursor-pointer"><RadioGroupItem value={o.v} /> {o.label}</label>
      ))}
    </RadioGroup>
  );
}
