import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Plus, RefreshCw, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { workshopService as service, type LibraryAction, type OwnConversation, type PersonalSkillDetail, type PersonalSkillEntry, type PersonalSkillFile } from './workshop.service';

const blank = () => ({ slug: '', content: '---\nname: mi-habilidad\ndescription: Cuándo utilizar esta habilidad\n---\n\n' });
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';
const denied = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0);

export function SkillLibraryPanel({ scope, onDirty, onTeach }: { scope: 'mine' | 'team'; onDirty(value: boolean): void; onTeach(): void }) {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const generation = useRef(0);
  const [entries, setEntries] = useState<PersonalSkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<PersonalSkillDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [files, setFiles] = useState<PersonalSkillFile[]>([]);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('SKILL.md');
  const [newFilePath, setNewFilePath] = useState('');
  const [tab, setTab] = useState<'content' | 'files' | 'versions'>('content');
  const [dirty, setDirty] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<PersonalSkillEntry | 'new' | 'close' | null>(null);
  const [conflict, setConflict] = useState(false);
  const [comparison, setComparison] = useState<PersonalSkillDetail | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSlug, setImportSlug] = useState('');
  const [sourceSlug, setSourceSlug] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [conversations, setConversations] = useState<OwnConversation[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const markDirty = (value: boolean) => { setDirty(value); onDirty(value); };
  const clear = useCallback(() => {
    generation.current++; setDetail(null); setEditing(false); setDraft(blank()); setFiles([]); setRemovedFiles([]);
    setDirty(false); onDirty(false); setConflict(false); setComparison(null); setPendingOpen(null); setRemoveConfirm(false); setConversations(null);
    setBusy(false); setLoading(false);
  }, [onDirty]);
  const fail = (cause: unknown) => { if (denied(cause)) { clear(); setEntries([]); } setError(message(cause)); toast.error(message(cause)); };
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = generation.current; setLoading(true); setError('');
    try { const result = await service.library(scope, signal); if (generation.current === request && !signal?.aborted) setEntries(result.entries.filter((item) => !item.removed)); }
    catch (cause) { if (generation.current === request && !signal?.aborted) { if (denied(cause)) { clear(); setEntries([]); } setError(message(cause)); } }
    finally { if (generation.current === request && !signal?.aborted) setLoading(false); }
  }, [scope, clear]);
  useEffect(() => { clear(); setEntries([]); const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); generation.current++; }; }, [scope, userId, clear, load]);

  async function openEntry(entry: PersonalSkillEntry | 'new' | 'close', discard = false) {
    if (dirty && !discard) { setPendingOpen(entry); return; }
    clear(); setError(''); setTab('content'); setSelectedFile('SKILL.md');
    if (entry === 'close') return;
    setEditing(true);
    if (entry === 'new') return;
    const request = generation.current; setBusy(true);
    try {
      const data = await service.read(entry.skill_id);
      if (request !== generation.current) return;
      setDetail(data); setDraft({ slug: data.entry.slug, content: data.content }); setFiles(data.files);
    } catch (cause) { if (request === generation.current) fail(cause); }
    finally { if (request === generation.current) setBusy(false); }
  }
  async function save() {
    const request = generation.current; setBusy(true); setError('');
    try {
      const result = await service.save({ slug: draft.slug, content: draft.content, expected_revision: detail?.entry.revision ?? null, files, remove_files: removedFiles }, detail?.entry.skill_id);
      if (request !== generation.current) return;
      markDirty(false); setConflict(false); setComparison(null); toast.success(result.next_action || 'Habilidad guardada.');
      const current = await service.read(result.entry.skill_id);
      if (request !== generation.current) return;
      setDetail(current); setDraft({ slug: current.entry.slug, content: current.content }); setFiles(current.files); setRemovedFiles([]); await load();
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 409) setConflict(true);
      fail(cause);
    } finally { if (request === generation.current) setBusy(false); }
  }
  async function mutate(action: LibraryAction, revision?: string) {
    if (!detail || busy) return;
    if (dirty) { setError('Guarda o descarta el borrador antes de cambiar esta habilidad.'); return; }
    const request = generation.current; setBusy(true);
    try {
      const result = await service.mutate(detail.entry, action, revision);
      if (request !== generation.current) return;
      toast.success(result.next_action || 'Habilidad actualizada.');
      if (action === 'remove') clear();
      else { const current = await service.read(detail.entry.skill_id); if (request !== generation.current) return; setDetail(current); setDraft({ slug: current.entry.slug, content: current.content }); setFiles(current.files); }
      await load();
    } catch (cause) { if (request === generation.current) fail(cause); }
    finally { setBusy(false); }
  }
  async function importSkill(zip?: File) {
    if (!importSlug || busy) return; const request = generation.current; setBusy(true);
    try {
      const result = zip ? await service.importZip(importSlug, zip) : await service.importClawHub(importSlug, sourceSlug, sourceVersion || undefined);
      if (request !== generation.current) return;
      toast.success(result.next_action || 'Habilidad importada.'); setImporting(false); await load();
    } catch (cause) { if (request === generation.current) fail(cause); }
    finally { if (request === generation.current) setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  const canEdit = !detail || detail.entry.can_edit;
  const file = files.find((item) => item.path === selectedFile);
  const visible = entries.filter((entry) => `${entry.slug} ${entry.description} ${entry.owner_label}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4 text-sm leading-relaxed text-[var(--text-dim)]" data-testid="skill-library-panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold text-[var(--text)]">{scope === 'mine' ? 'Mi biblioteca' : 'Biblioteca del equipo'}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{scope === 'mine' ? 'Crea y organiza tus habilidades. Puedes compartirlas con el equipo o usarlas en tus conversaciones.' : 'Habilidades compartidas con el equipo. Abre una para consultar su contenido y sus permisos.'}</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void load()} aria-label="Actualizar biblioteca"><RefreshCw size={14} /></Button>{scope === 'mine' && <><Button variant="outline" size="sm" onClick={() => setImporting((value) => !value)}><Upload size={14} />Importar</Button><Button size="sm" onClick={() => void openEntry('new')}><Plus size={14} />Crear</Button></>}</div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {pendingOpen && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 p-3 text-sm"><span>Hay un borrador sin guardar.</span><Button variant="destructive" size="sm" onClick={() => void openEntry(pendingOpen, true)}>Descartar y continuar</Button><Button variant="outline" size="sm" onClick={() => setPendingOpen(null)}>Seguir editando</Button></div>}
    {importing && <section className="space-y-3 rounded-lg border p-4" aria-label="Importar habilidad"><h4 className="font-medium text-[var(--text)]">Importar a mi biblioteca</h4>
      <label className="block text-sm">Nombre en tu biblioteca<Input value={importSlug} onChange={(event) => setImportSlug(event.target.value)} placeholder="mi-habilidad" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Slug de ClawHub<Input value={sourceSlug} onChange={(event) => setSourceSlug(event.target.value)} /></label><label className="text-sm">Versión de ClawHub (opcional)<Input value={sourceVersion} onChange={(event) => setSourceVersion(event.target.value)} /></label></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !importSlug || !sourceSlug} onClick={() => void importSkill()}>Importar desde ClawHub</Button><Button variant="outline" disabled={busy || !importSlug} onClick={() => fileInput.current?.click()}>Subir ZIP (hasta 8 MiB)</Button><input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void importSkill(selected); }} /></div>
    </section>}
    <div className={editing ? "grid min-w-0 gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]" : "min-w-0"}>
    <div className="min-w-0 space-y-3">
    <Input aria-label="Buscar habilidad en biblioteca" placeholder="Buscar habilidad…" value={query} onChange={(event) => setQuery(event.target.value)} />
    {loading ? <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Cargando biblioteca…</p>
      : visible.length ? <div className="divide-y rounded-lg border border-[var(--border)] bg-[var(--surface)]">{visible.map((entry) => <div key={entry.skill_id} className="flex flex-wrap items-center gap-3 p-3"><FileText size={17} className="text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-[var(--text)]">{entry.slug}</p>{entry.description && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>}<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"><span>{entry.owner_label}</span><span className="rounded border border-[var(--border)] px-1.5">{entry.shared ? 'Compartida' : 'Privada'}</span><span style={{ color: entry.enabled ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}>{entry.enabled ? 'Activa' : 'Desactivada'}</span></div></div><SourceBadge source="Biblioteca OpenClaw" /><Button variant="outline" size="sm" disabled={busy} onClick={() => void openEntry(entry)}>Abrir</Button></div>)}</div>
        : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><p>{query ? 'No hay coincidencias.' : scope === 'mine' ? 'Tu biblioteca todavía está vacía. Crea una habilidad o enséñala en una conversación propia.' : 'No hay habilidades compartidas con el equipo.'}</p>{scope === 'mine' && <Button variant="link" onClick={onTeach}>Enseñar en un chat propio</Button>}</div>}
    </div>
    {editing && <section className="min-w-0 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Detalle de habilidad">
      <div className="flex items-start justify-between gap-2"><div><h4 className="font-semibold text-[var(--text)]">{detail ? detail.entry.slug : 'Nueva habilidad'}</h4><p className="text-xs text-muted-foreground">{detail ? `${detail.entry.owner_label} · revisión ${detail.entry.revision.slice(0, 12)}${canEdit ? '' : ' · Solo lectura'}` : 'Se guardará en tu biblioteca personal.'}</p></div><Button variant="ghost" size="sm" onClick={() => void openEntry('close')} aria-label="Cerrar habilidad"><X size={16} /></Button></div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contenido de habilidad">{(['content', 'files', 'versions'] as const).map((value) => <Button key={value} variant={tab === value ? 'secondary' : 'ghost'} size="sm" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'content' ? 'Contenido' : value === 'files' ? `Archivos (${files.length})` : 'Versiones'}</Button>)}</div>
      {tab === 'content' && <div className="space-y-3"><label className="block text-sm">Nombre corto<Input value={draft.slug} disabled={!canEdit || busy} onChange={(event) => { setDraft({ ...draft, slug: event.target.value }); markDirty(true); }} placeholder="mi-habilidad" /></label><label className="block text-sm">Instrucciones (SKILL.md)<textarea aria-label="Instrucciones de habilidad" rows={13} className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs" value={draft.content} disabled={!canEdit || busy} onChange={(event) => { setDraft({ ...draft, content: event.target.value }); markDirty(true); }} /></label></div>}
      {tab === 'files' && <div className="space-y-3"><p className="text-xs text-muted-foreground">Los archivos omitidos se conservan. Eliminar un archivo requiere esta acción explícita.</p>
        <div className="flex flex-wrap gap-2">{files.map((item) => <Button variant={selectedFile === item.path ? 'secondary' : 'outline'} size="sm" key={item.path} onClick={() => setSelectedFile(item.path)}>{item.path}{item.executable ? ' · ejecutable' : ''}</Button>)}</div>
        {file && <div className="space-y-2"><p className="break-all text-sm">{file.path}</p>{file.encoding === 'base64' ? <p className="text-sm text-muted-foreground">Archivo binario conservado íntegramente; no se edita como texto.</p> : <textarea aria-label={`Contenido de ${file.path}`} rows={10} className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs" value={file.content} disabled={!canEdit || busy} onChange={(event) => { setFiles(files.map((item) => item.path === file.path ? { ...item, content: event.target.value } : item)); markDirty(true); }} />}{canEdit && <Button variant="destructive" size="sm" disabled={busy} onClick={() => { setFiles(files.filter((item) => item.path !== file.path)); setRemovedFiles([...removedFiles, file.path]); setSelectedFile('SKILL.md'); markDirty(true); }}>Eliminar este archivo del borrador</Button>}</div>}
        {canEdit && <div className="flex flex-wrap gap-2"><Input className="min-w-0 flex-1" value={newFilePath} onChange={(event) => setNewFilePath(event.target.value)} aria-label="Ruta del archivo nuevo" placeholder="references/ejemplo.md" /><Button variant="outline" disabled={!newFilePath || files.some((item) => item.path === newFilePath) || busy} onClick={() => { setFiles([...files, { path: newFilePath, content: '', encoding: 'utf8' }]); setRemovedFiles(removedFiles.filter((name) => name !== newFilePath)); setSelectedFile(newFilePath); setNewFilePath(''); markDirty(true); }}>Añadir archivo</Button></div>}
      </div>}
      {tab === 'versions' && <div className="space-y-2">{detail?.revisions.map((item) => <div key={item.revision} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><code>{item.revision.slice(0, 16)}</code><span className="flex-1 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => { const request = generation.current; void service.read(detail.entry.skill_id, item.revision).then((data) => { if (request === generation.current) setComparison(data); }).catch(fail); }}>Ver contenido</Button>{canEdit && item.revision !== detail.entry.revision && <Button variant="outline" size="sm" disabled={busy || dirty} onClick={() => void mutate('rollback', item.revision)}>Volver a esta versión</Button>}</div>) ?? <p className="text-sm text-muted-foreground">Las versiones aparecerán después de guardar.</p>}</div>}
      {conflict && <div role="alert" className="space-y-2 rounded-lg border border-amber-500/40 p-3 text-sm"><p>Otra edición ha cambiado esta habilidad. Tu borrador sigue aquí.</p><Button variant="outline" size="sm" onClick={() => { if (detail) { const request = generation.current; void service.read(detail.entry.skill_id).then((data) => { if (request === generation.current) setComparison(data); }).catch(fail); } }}>Comparar revisión actual</Button></div>}
      {comparison && <div className="space-y-2 rounded-lg border p-3"><h5 className="text-sm font-medium text-[var(--text)]">Revisión consultada {comparison.entry.revision.slice(0, 12)}</h5><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">{comparison.content}</pre>{conflict && <Button variant="outline" size="sm" onClick={() => { setDetail(comparison); setDraft({ slug: comparison.entry.slug, content: comparison.content }); setFiles(comparison.files); setRemovedFiles([]); setConflict(false); setComparison(null); markDirty(false); }}>Descartar borrador y adoptar esta revisión</Button>}<Button variant="ghost" size="sm" onClick={() => setComparison(null)}>Cerrar comparación</Button></div>}
      <div className="flex flex-wrap gap-2">{canEdit && <Button disabled={busy || !draft.slug || !draft.content || !!detail && !dirty} onClick={() => void save()}><Save size={14} />{busy ? 'Guardando…' : 'Guardar'}</Button>}{detail && canEdit && <><Button variant="outline" disabled={busy || dirty} onClick={() => void mutate(detail.entry.shared ? 'unshare' : 'share')}>{detail.entry.shared ? 'Dejar de compartir' : 'Compartir con equipo'}</Button><Button variant="outline" disabled={busy || dirty} onClick={() => void mutate(detail.entry.enabled ? 'disable' : 'enable')}>{detail.entry.enabled ? 'Desactivar' : 'Activar'}</Button>{(role === 'owner' || role === 'admin') && detail.entry.owner_profile_id !== null && <Button variant="outline" disabled={busy || dirty} onClick={() => void mutate('transfer')}>Transferir al equipo</Button>}<Button variant="destructive" disabled={busy || dirty} onClick={() => setRemoveConfirm(true)}>Eliminar</Button></>}
        {detail && <Button variant="outline" disabled={busy} onClick={() => { const request = generation.current; void service.conversations().then((items) => { if (request === generation.current) setConversations(items); }).catch(fail); }}>Usar en conversación propia</Button>}<Button variant="ghost" onClick={onTeach}>Enseñar en chat propio</Button>
      </div>
      {removeConfirm && <div role="alert" className="space-y-2 rounded border border-destructive/40 p-3 text-sm"><p>Eliminar la habilidad no tiene deshacer público. Las revisiones ya fijadas en conversaciones pueden permanecer.</p><div className="flex gap-2"><Button variant="destructive" size="sm" onClick={() => void mutate('remove')}>Eliminar definitivamente</Button><Button variant="outline" size="sm" onClick={() => setRemoveConfirm(false)}>Cancelar</Button></div></div>}
      {conversations && <div className="space-y-2 rounded border p-3"><h5 className="text-sm font-medium text-[var(--text)]">Aplicar desde el siguiente turno</h5><p className="text-xs text-muted-foreground">Adjuntar, refrescar o retirar solo cambia la selección de la conversación elegida.</p>{conversations.length ? conversations.map((conversation) => <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm" key={conversation.conversation_id}><span className="min-w-0 flex-1 break-words">{conversation.first_message?.slice(0, 100) || 'Conversación propia'}</span>{(['attach', 'refresh', 'detach'] as const).map((action) => <Button key={action} size="sm" variant="outline" disabled={busy} onClick={() => { if (!detail) return; const request = generation.current; setBusy(true); void service.activate(conversation.conversation_id, detail.entry.skill_id, action, action === 'detach' ? undefined : detail.entry.revision).then(() => { if (request === generation.current) toast.success('Selección actualizada para el siguiente turno.'); }).catch(fail).finally(() => { if (request === generation.current) setBusy(false); }); }}>{action === 'attach' ? 'Adjuntar' : action === 'refresh' ? 'Refrescar' : 'Retirar'}</Button>)}</div>) : <p className="text-sm text-muted-foreground">No hay conversaciones propias disponibles. Abre primero un chat.</p>}</div>}
    </section>}
    </div>
  </div>;
}
