import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, LayoutDashboard, RefreshCw, Activity, Download, Users, UserPlus, X, PanelsTopLeft, Pencil } from 'lucide-react';
import { nativeCanvasService, type NativeCanvasActivity, type NativeCanvasBridgeCommand, type NativeCanvasDocument, type NativeCanvasGalleryItem, type NativeCanvasMember, type NativeCanvasWidgetView } from '@/services/native-canvas.service';
import { shouldFetchNativeCanvasBoard, useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';
import { useChatStore } from '@/stores/chat.store';
import { listShareRecipients, type ShareRecipient } from '@/services/shares.service';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import './native-canvas-board.css';

// Zustand selectors must return the same reference when the store did not
// change. Creating `[]` inside the selector made React see a new snapshot on
// every render for conversations without previews, producing the maximum
// update-depth error when Canvas was opened for the first time.
const EMPTY_NATIVE_CANVAS_PREVIEWS: readonly never[] = [];

export function NativeCanvasHub({ onSelectConversation }: { onSelectConversation: (conversationId: string) => void }) {
  const [view, setView] = useState<'content' | 'gallery' | 'activity'>('content');
  const tabs = [
    { key: 'content' as const, label: 'Contenido', Icon: LayoutDashboard },
    { key: 'gallery' as const, label: 'Galería', Icon: PanelsTopLeft },
    { key: 'activity' as const, label: 'Actividad', Icon: Activity },
  ];
  return <div style={{ minHeight: 260, padding: 14, color: 'var(--text-muted)' }}>
    <nav aria-label="Vistas de Canvas" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 18, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, Icon }) => {
        const active = view === key;
        return <button key={key} type="button" aria-pressed={active} onClick={() => setView(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: active ? '1px solid var(--amber)' : '1px solid var(--border)', background: active ? 'var(--amber-dim)' : 'var(--surface)', color: active ? 'var(--amber)' : 'var(--text-dim)', fontWeight: active ? 650 : 500, cursor: 'pointer', boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--amber) 15%, transparent)' : 'none', transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}><Icon size={15} />{label}</button>;
      })}
    </nav>
    {view === 'content' && <div style={emptyStyle}><LayoutDashboard size={22} /><strong style={{ color: 'var(--text)' }}>Elige o crea una conversación</strong><span>Cuando OpenClaw publique un dashboard, aparecerá aquí.</span><button type="button" onClick={() => setView('gallery')}><PanelsTopLeft size={14} /> Abrir galería</button></div>}
    {view === 'gallery' && <div style={{ display: 'grid', gap: 10 }}><p style={{ margin: 0 }}>Abre un dashboard al que ya tengas acceso. No cambia el chat actual.</p><NativeCanvasGallery activeConversationId={null} onSelectConversation={onSelectConversation} forceOpen /></div>}
    {view === 'activity' && <div style={emptyStyle}><Activity size={20} /><span>Selecciona un dashboard para consultar su actividad.</span></div>}
  </div>;
}

export function NativeCanvasBoardPanel({ conversationId, onSelectConversation }: { conversationId: string; onSelectConversation?: (conversationId: string) => void }) {
  const state = useNativeCanvasBoardStore((s) => s.byConversation.get(conversationId));
  const previews = useNativeCanvasBoardStore((s) => s.previews.get(conversationId) ?? EMPTY_NATIVE_CANVAS_PREVIEWS);
  const setLoading = useNativeCanvasBoardStore((s) => s.setLoading);
  const setBoard = useNativeCanvasBoardStore((s) => s.setBoard);
  const setError = useNativeCanvasBoardStore((s) => s.setError);
  const revoke = useNativeCanvasBoardStore((s) => s.revoke);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<NativeCanvasActivity[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [document, setDocument] = useState<NativeCanvasDocument | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [tabDialog, setTabDialog] = useState<{ mode: 'create' | 'rename'; tabId?: string } | null>(null);
  const [tabTitle, setTabTitle] = useState('');
  // Las acciones consecutivas pueden llegar antes del siguiente render. La
  // respuesta PATCH es la autoridad de la revisión siguiente, no el cierre
  // React que generó el botón anterior.
  const revisionRef = useRef<number | null>(state?.revision ?? null);
  revisionRef.current = state?.revision ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const load = async () => {
    setLoading(conversationId);
    try { setBoard(conversationId, await nativeCanvasService.board(conversationId)); }
    catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined;
      if (status === 403) revoke(conversationId);
      else setError(conversationId, error instanceof Error ? error.message : 'No se pudo cargar el dashboard');
    }
  };
  // `canvas.board_changed` intentionally carries no board data. It clears the
  // cached snapshot; this effect performs the next authorized fetch exactly
  // once instead of trusting an event payload or leaving a blank panel.
  useEffect(() => {
    if (shouldFetchNativeCanvasBoard(state)) void load();
  }, [conversationId, state?.board, state?.error, state?.loading]);
  if (state?.loading || !state) return <div style={emptyStyle}><NativeCanvasGallery activeConversationId={conversationId} onSelectConversation={onSelectConversation} />Cargando dashboard…</div>;
  if (state.error) return <div style={emptyStyle}><NativeCanvasGallery activeConversationId={conversationId} onSelectConversation={onSelectConversation} /><AlertTriangle size={16} /><span>{state.error}</span><button onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>;
  const widgets = Array.isArray(state.board?.widgets) ? state.board.widgets as Array<Record<string, unknown>> : [];
  const tabs = Array.isArray(state.board?.tabs) ? state.board.tabs.filter((tab): tab is Record<string, unknown> => !!tab && typeof tab === 'object') : [];
  const canManage = state.board?.can_manage === true;
  const canEdit = state.board?.can_edit === true;
  const activeTabId = selectedTabId && tabs.some((tab) => tab.tab_id === selectedTabId)
    ? selectedTabId
    : (typeof tabs[0]?.tab_id === 'string' ? tabs[0].tab_id : null);
  const visibleWidgets = (activeTabId ? widgets.filter((widget) => widget.tab_id === activeTabId) : widgets)
    .slice()
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0));
  const toggleActivity = async () => {
    if (activityOpen) { setActivityOpen(false); return; }
    setActivityOpen(true); setActivityError(null);
    try { setActivity(await nativeCanvasService.activity(conversationId)); }
    catch (error) { setActivityError(error instanceof Error ? error.message : 'No se pudo cargar la actividad'); }
  };
  const openPreview = async (documentId: string, title: string | null) => {
    setDocument(null); setDocumentId(null); setDocumentTitle(title); setDocumentError(null); setExportMessage(null);
    try { setDocument(await nativeCanvasService.document(conversationId, documentId)); setDocumentId(documentId); }
    catch (error) { setDocumentError(error instanceof Error ? error.message : 'No se pudo abrir el documento'); }
  };
  const exportDocument = async (format: 'html' | 'json' | 'pdf' | 'png' | 'svg' | 'report') => {
    if (!documentId) return;
    setExportMessage(null);
    try {
      if (format === 'pdf' || format === 'png') {
        setExportMessage('Iniciando Stirling PDF…');
        await nativeCanvasService.ensurePdfRenderer();
      }
      const result = await nativeCanvasService.exportDocument(conversationId, documentId, { format, title: documentTitle });
      setExportMessage(`Copia estática guardada en Mi Drive / Canvas: ${result.file.filename}`);
    } catch (error) { setExportMessage(error instanceof Error ? error.message : 'No se pudo exportar el documento'); }
  };
  const mutateBoard = async (op: Record<string, unknown>) => {
    if (!canEdit) { setMutationError('Solo tienes acceso de lectura a este Canvas.'); return; }
    let expectedRevision = revisionRef.current;
    setMutationError(null);
    try {
      // A board_changed event can invalidate the local snapshot between two
      // fast clicks. Keep the controls actionable by refreshing the server
      // revision instead of silently dropping the user's second operation.
      if (expectedRevision === null) {
        const freshBoard = await nativeCanvasService.board(conversationId);
        expectedRevision = typeof freshBoard.revision === 'number' ? freshBoard.revision : null;
        if (expectedRevision === null) {
          setMutationError('No se pudo confirmar la revisión actual del dashboard. Actualiza el panel e inténtalo de nuevo.');
          await load();
          return;
        }
        revisionRef.current = expectedRevision;
        setBoard(conversationId, freshBoard);
      }
      const board = await nativeCanvasService.updateBoard(conversationId, expectedRevision, [op]);
      revisionRef.current = typeof board.revision === 'number' ? board.revision : null;
      setBoard(conversationId, board);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined;
      if (status === 409) {
        setMutationError('El dashboard cambió en otra pantalla. Se ha recargado antes de aplicar tu cambio.');
        await load();
      } else setMutationError(error instanceof Error ? error.message : 'No se pudo guardar el dashboard');
    }
  };
  const saveTab = async () => {
    const title = tabTitle.trim().slice(0, 80);
    if (!title || !tabDialog) return;
    if (tabDialog.mode === 'create') {
      const tabId = crypto.randomUUID().slice(0, 36).toLowerCase();
      await mutateBoard({ kind: 'tab_create', tabId, title });
      setSelectedTabId(tabId);
    } else if (tabDialog.tabId) await mutateBoard({ kind: 'tab_update', tabId: tabDialog.tabId, title });
    setTabDialog(null); setTabTitle('');
  };
  const handleWidgetDrag = (event: DragEndEvent) => {
    const active = String(event.active.id); const over = event.over ? String(event.over.id) : null;
    if (!over || active === over) return;
    const source = visibleWidgets.findIndex((widget) => widget.name === active);
    const target = visibleWidgets.findIndex((widget) => widget.name === over);
    if (source < 0 || target < 0) return;
    void mutateBoard({ kind: 'widget_move', name: active, tabId: activeTabId ?? undefined, position: target });
  };
  return <div className="native-canvas-board-container" data-board-revision={state.revision ?? ''} style={{ padding: 14, overflow: 'auto' }}><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDrag}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}><span>DASHBOARD · ESTA CONVERSACIÓN</span><span style={{ display: 'flex', gap: 6 }}><NativeCanvasGallery activeConversationId={conversationId} onSelectConversation={onSelectConversation} />{canManage && <NativeCanvasMembers conversationId={conversationId} />}<button onClick={() => void toggleActivity()}><Activity size={13} /> Actividad</button></span></div>{tabs.length > 0 && <nav aria-label="Pestañas del dashboard" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>{tabs.map((tab, index) => { const tabId = typeof tab.tab_id === 'string' ? tab.tab_id : String(index); const title = typeof tab.title === 'string' ? tab.title : `Pestaña ${index + 1}`; return <span key={tabId} style={{ display: 'inline-flex', gap: 2 }}><button aria-pressed={tabId === activeTabId} onClick={() => setSelectedTabId(tabId)}>{title}</button><button type="button" aria-label={`Renombrar ${title}`} title="Renombrar pestaña" onClick={() => { setTabTitle(title); setTabDialog({ mode: 'rename', tabId }); }}><Pencil size={12} /></button></span>; })}<button type="button" onClick={() => { setTabTitle(''); setTabDialog({ mode: 'create' }); }}>+ Pestaña</button></nav>}<SortableContext items={visibleWidgets.map((widget) => String(widget.name ?? ''))} strategy={verticalListSortingStrategy}><div className="native-canvas-board-grid">
    {widgets.length === 0 && previews.length === 0 && <div style={{ ...emptyStyle, gridColumn: '1 / -1' }}><LayoutDashboard size={18} />Aún no hay dashboard. Pide un informe o fija un preview.</div>}{visibleWidgets.map((widget, index) => <SortableWidget key={String(widget.name ?? index)} id={String(widget.name ?? index)} sizeW={Number(widget.size_w ?? 12)}><section style={cardStyle} data-canvas-frame={canvasWidgetFrame(widget)} data-canvas-position={Number(widget.position ?? 0)} data-canvas-size-w={Number(widget.size_w ?? 4)}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="canvas-widget-drag-handle" title={canEdit ? 'Arrastra para reorganizar' : 'Solo lectura'}><GripVertical size={15} /></span><strong>{typeof widget.title === 'string' ? widget.title : typeof widget.name === 'string' ? widget.name : 'Widget'}</strong></div>{widget.plugin_kind === 'session:report' ? <NativeCanvasReport props={widget.props} /> : typeof widget.name === 'string' ? <NativeCanvasWidgetFrame conversationId={conversationId} name={widget.name} title={typeof widget.title === 'string' ? widget.title : widget.name} onPrompt={(text) => {
      if (activeConversationId !== conversationId) throw new Error('Abre esta conversación antes de enviar el prompt del widget');
      if (!window.confirm(`El widget quiere enviar este mensaje a la conversación:\n\n${text}`)) return false;
      return sendMessage(text).accepted;
    }} /> : <p style={hintStyle}>Widget sin nombre válido.</p>}{typeof widget.name === 'string' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{canEdit && <><button type="button" onClick={() => void mutateBoard({ kind: 'widget_move', name: widget.name, tabId: activeTabId ?? undefined, position: Math.max(0, index - 1) })} disabled={index === 0}>↑ Mover</button><button type="button" onClick={() => void mutateBoard({ kind: 'widget_move', name: widget.name, tabId: activeTabId ?? undefined, position: index + 1 })}>↓ Mover</button><button type="button" onClick={() => void mutateBoard({ kind: 'widget_resize', name: widget.name, sizeW: Math.min(12, Number(widget.size_w ?? 4) + 1), sizeH: Math.min(20, Number(widget.size_h ?? 3) + 1) })}>Ampliar</button><button type="button" onClick={() => void mutateBoard({ kind: 'widget_resize', name: widget.name, sizeW: Math.max(1, Number(widget.size_w ?? 4) - 1), sizeH: Math.max(1, Number(widget.size_h ?? 3) - 1) })}>Reducir</button><button type="button" onClick={() => void mutateBoard({ kind: 'widget_remove', name: widget.name })}>Quitar</button></>}<span style={hintStyle}>Los permisos del widget se revisan en el chat.</span></div>}</section></SortableWidget>)}
    {previews.map((preview) => <section key={preview.viewId} style={{ ...cardStyle, gridColumn: '1 / -1' }}><strong>{preview.title ?? 'Preview'}</strong><button type="button" onClick={() => void openPreview(preview.documentId, preview.title)} style={{ marginTop: 8 }}>Abrir preview</button></section>)}
  </div></SortableContext>{mutationError && <p style={hintStyle}>{mutationError}</p>}{documentError && <p style={hintStyle}>{documentError}</p>}{document && <><NativeCanvasDocumentFrame document={document} /><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}><button onClick={() => void exportDocument('html')}><Download size={14} /> HTML</button><button onClick={() => void exportDocument('pdf')}>PDF</button><button onClick={() => void exportDocument('png')}>PNG</button><button onClick={() => void exportDocument('svg')}>SVG</button><button onClick={() => void exportDocument('json')}>JSON</button><button onClick={() => void exportDocument('report')}>Informe</button></div>{exportMessage && <p style={hintStyle}>{exportMessage}</p>}</>}{activityOpen && <section style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}><strong style={{ fontSize: 12 }}>ACTIVIDAD</strong>{activityError ? <p style={hintStyle}>{activityError}</p> : activity === null ? <p style={hintStyle}>Cargando…</p> : activity.length === 0 ? <p style={hintStyle}>Aún no hay actividad.</p> : <ol style={{ paddingLeft: 18 }}>{activity.map((item) => <li key={item.id} style={hintStyle}>{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))} · {humanizeActivity(item)}</li>)}</ol>}</section>}<Dialog open={tabDialog !== null} onOpenChange={(open) => { if (!open) setTabDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{tabDialog?.mode === 'rename' ? 'Renombrar pestaña' : 'Nueva pestaña'}</DialogTitle></DialogHeader><input aria-label="Nombre de la pestaña" autoFocus value={tabTitle} maxLength={80} onChange={(event) => setTabTitle(event.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} onKeyDown={(event) => { if (event.key === 'Enter') void saveTab(); }} /><DialogFooter><Button variant="outline" onClick={() => setTabDialog(null)}>Cancelar</Button><Button disabled={!tabTitle.trim() || !canEdit} onClick={() => void saveTab()}>Guardar</Button></DialogFooter></DialogContent></Dialog></DndContext></div>;
}

function canvasWidgetFrame(widget: Record<string, unknown>): 'card' | 'full-bleed' | 'frameless' {
  return widget.presentation === 'full-bleed' || widget.presentation === 'frameless'
    ? widget.presentation : 'card';
}

function SortableWidget({ id, sizeW, children }: { id: string; sizeW: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const span = Number.isFinite(sizeW) ? Math.max(1, Math.min(12, Math.round(sizeW))) : 12;
  return <div ref={setNodeRef} className="native-canvas-board-widget" style={{ position: 'relative', gridColumn: `span ${span}`, '--canvas-narrow-span': Math.max(3, Math.min(6, Math.ceil(span / 2))), transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 } as CSSProperties}>
    <button type="button" aria-label="Arrastrar widget" title="Arrastrar widget" {...attributes} {...listeners} style={{ position: 'absolute', zIndex: 2, top: 8, left: 7, display: 'inline-flex', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'grab', padding: 2 }}><GripVertical size={15} /></button>
    {children}
  </div>;
}

function humanizeActivity(item: NativeCanvasActivity): string {
  const widget = item.widget_name ? ` «${item.widget_name}»` : '';
  const labels: Record<string, string> = {
    moved: `Se movió${widget}`,
    resized: `Se cambió el tamaño de${widget}`,
    removed: `Se quitó${widget}`,
    tab_changed: 'Se modificaron las pestañas',
    updated: 'Se actualizó el dashboard',
  };
  const action = labels[item.action] ?? `Se registró un cambio${widget}`;
  return item.actor?.display_name ? `${item.actor.display_name} · ${action}` : action;
}

/** A bounded picker for people already known to this Micelclaw instance.
 * It never exposes a raw Gateway identity or an arbitrary UUID field. */
function NativeCanvasGallery({ activeConversationId, onSelectConversation, forceOpen = false }: { activeConversationId: string | null; onSelectConversation?: (conversationId: string) => void; forceOpen?: boolean }) {
  const [open, setOpen] = useState(forceOpen);
  const [items, setItems] = useState<NativeCanvasGalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'mine' | 'shared'>('all');
  const load = async () => {
    setError(null);
    try { setItems(await nativeCanvasService.gallery()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la galería'); }
  };
  useEffect(() => { if (open || forceOpen) void load(); }, [open, forceOpen]);
  const visibleItems = items.filter((item) => {
    if (scope === 'shared' && !item.shared) return false;
    if (scope === 'mine' && item.shared) return false;
    return !query.trim() || item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  return <span style={{ position: 'relative' }}>
    {!forceOpen && <button aria-expanded={open} onClick={() => setOpen((value) => !value)}><PanelsTopLeft size={13} /> Galería</button>}
    {(open || forceOpen) && <section role={forceOpen ? undefined : 'dialog'} aria-label="Galería de dashboards" style={forceOpen ? { padding: 0, color: 'var(--text)' } : popoverStyle}>
      <strong style={{ fontSize: 12 }}>Dashboards disponibles</strong>
      <p style={hintStyle}>Los compartidos no muestran el título ni los mensajes de su conversación.</p>
      <input aria-label="Buscar dashboards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" style={{ width: '100%', boxSizing: 'border-box', ...inputStyle }} />
      <div role="group" aria-label="Filtrar dashboards" style={{ display: 'inline-flex', gap: 3, padding: 3, margin: '9px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>{([['all', 'Todos'], ['mine', 'Míos'], ['shared', 'Compartidos']] as const).map(([value, label]) => {
        const active = scope === value;
        return <button key={value} type="button" aria-pressed={active} onClick={() => setScope(value)} style={{ minHeight: 27, padding: '4px 9px', border: active ? '1px solid var(--amber)' : '1px solid transparent', borderRadius: 'calc(var(--radius-md) - 2px)', background: active ? 'var(--amber-dim)' : 'transparent', color: active ? 'var(--amber)' : 'var(--text-dim)', fontSize: 12, fontWeight: active ? 650 : 500, cursor: 'pointer', transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}>{label}</button>;
      })}</div>
      {error && <p style={{ ...hintStyle, color: 'var(--danger, #d66)' }}>{error}</p>}
      {!error && visibleItems.length === 0 && <p style={hintStyle}>{items.length ? 'No hay resultados con esos filtros.' : 'No hay dashboards con contenido todavía.'}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {visibleItems.map((item) => <button key={item.conversation_id} disabled={item.conversation_id === activeConversationId} onClick={() => { onSelectConversation?.(item.conversation_id); setOpen(false); }} style={{ textAlign: 'left', padding: '8px 7px', border: '1px solid var(--border)', borderRadius: 7 }}>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
          <small style={{ color: 'var(--text-muted)' }}>{item.shared ? 'Compartido' : 'Conversación propia'}</small>
        </button>)}
      </div>
    </section>}
  </span>;
}

function NativeCanvasMembers({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<NativeCanvasMember[]>([]);
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const [nextMembers, nextRecipients] = await Promise.all([
        nativeCanvasService.members(conversationId),
        listShareRecipients(),
      ]);
      setMembers(nextMembers);
      setRecipients(nextRecipients);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las personas'); }
  };
  useEffect(() => { if (open) void load(); }, [open, conversationId]);
  const memberIds = new Set(members.map((member) => member.user_id));
  const candidates = recipients.filter((recipient) => {
    if (memberIds.has(recipient.id)) return false;
    const text = `${recipient.display_name ?? ''} ${recipient.email ?? ''}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }).slice(0, 6);
  const label = (id: string) => {
    const recipient = recipients.find((candidate) => candidate.id === id);
    return recipient?.display_name || recipient?.email || 'Usuario de Micelclaw';
  };
  const add = async (userId: string) => {
    setBusyId(userId); setError(null);
    try { await nativeCanvasService.addMember(conversationId, userId); setQuery(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo compartir el dashboard'); }
    finally { setBusyId(null); }
  };
  const remove = async (userId: string) => {
    setBusyId(userId); setError(null);
    try { await nativeCanvasService.removeMember(conversationId, userId); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo retirar el acceso'); }
    finally { setBusyId(null); }
  };
  const updatePermission = async (userId: string, permission: 'view' | 'edit') => {
    setBusyId(userId); setError(null);
    try { await nativeCanvasService.updateMemberPermission(conversationId, userId, permission); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el permiso'); }
    finally { setBusyId(null); }
  };
  return <span style={{ position: 'relative' }}>
    <button aria-expanded={open} onClick={() => setOpen((value) => !value)}><Users size={13} /> Compartir</button>
    {open && <section aria-label="Personas con acceso al dashboard" style={{ position: 'absolute', right: 0, top: 28, zIndex: 5, width: 280, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', boxShadow: '0 10px 30px rgba(0,0,0,.22)', color: 'var(--text)' }}>
      <strong style={{ fontSize: 12 }}>Personas con acceso</strong>
      <p style={{ ...hintStyle, marginTop: 4 }}>Un acceso nuevo empieza en solo lectura. Las aprobaciones de widgets se gestionan desde el chat.</p>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input aria-label="Buscar persona" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o email…" style={{ minWidth: 0, flex: 1, ...inputStyle }} />
        {candidates[0] && <button aria-label="Añadir primera persona" disabled={busyId !== null} onClick={() => void add(candidates[0]!.id)}><UserPlus size={13} /></button>}
      </div>
      {candidates.length > 0 && <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>{candidates.map((candidate) => <button key={candidate.id} disabled={busyId !== null} onClick={() => void add(candidate.id)} style={{ textAlign: 'left', padding: '5px 6px' }}>{candidate.display_name || candidate.email || 'Usuario'}{candidate.email && candidate.display_name ? <small style={{ marginLeft: 5, color: 'var(--text-muted)' }}>{candidate.email}</small> : null}</button>)}</div>}
      {members.length > 0 && <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>{members.map((member) => <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1, fontSize: 12 }}>{label(member.user_id)}</span><select aria-label={`Permiso de ${label(member.user_id)}`} value={member.permission} disabled={busyId !== null} onChange={(event) => void updatePermission(member.user_id, event.target.value as 'view' | 'edit')} style={{ ...inputStyle, width: 98 }}><option value="view">Solo lectura</option><option value="edit">Puede editar</option></select><button aria-label={`Retirar a ${label(member.user_id)}`} disabled={busyId !== null} onClick={() => void remove(member.user_id)}><X size={13} /></button></div>)}</div>}
      {members.length === 0 && !error && <p style={hintStyle}>Aún no has compartido este dashboard.</p>}
      {error && <p style={{ ...hintStyle, color: 'var(--danger, #d66)' }}>{error}</p>}
    </section>}
  </span>;
}

function NativeCanvasDocumentFrame({ document }: { document: NativeCanvasDocument }) {
  const nonce = crypto.randomUUID();
  const securedHtml = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">${document.html}`;
  // Two opaque browsing contexts: the outer frame owns the deliberately tiny
  // versioned bridge, while the document never gets a reference to Dash or an
  // OpenClaw ticket. The only accepted command is a bounded resize.
  const frameSource = JSON.stringify(securedHtml).replace(/</g, '\\u003c');
  const bridge = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'"><style>html,body,iframe{margin:0;border:0;width:100%;min-height:320px;display:block}</style><iframe id="canvas" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><script>const nonce=${JSON.stringify(nonce)};const frame=document.getElementById('canvas');frame.srcdoc=${frameSource};window.addEventListener('message',(event)=>{const data=event.data;if(event.source!==frame.contentWindow||!data||data.v!==1||data.type!=='canvas.resize'||data.nonce!==nonce||!Number.isInteger(data.height))return;frame.style.height=Math.min(1200,Math.max(160,data.height))+'px';});</script>`;
  return <section style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
    <iframe title="Canvas preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={bridge} style={{ display: 'block', border: 0, width: '100%', minHeight: 320, background: 'white' }} />
  </section>;
}

/** Two opaque frames keep widget code away from Dash and the Core auth surface. */
function NativeCanvasWidgetFrame({ conversationId, name, title, onPrompt }: { conversationId: string; name: string; title: string; onPrompt: (text: string) => boolean }) {
  const [view, setView] = useState<NativeCanvasWidgetView | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outerFrame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let active = true;
    setView(null); setHtml(null); setError(null);
    void nativeCanvasService.createWidgetView(conversationId, name)
      .then(async (nextView) => {
        const nextHtml = await nativeCanvasService.widgetHtml(conversationId, name, nextView.frameId);
        if (active) { setView(nextView); setHtml(nextHtml); }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el widget'); });
    return () => { active = false; };
  }, [conversationId, name]);
  useEffect(() => {
    if (!view) return;
    const respond = (id: string, ok: boolean, result?: unknown, message?: string) => {
      outerFrame.current?.contentWindow?.postMessage({ type: 'micelclaw:canvas-bridge-response', frame_id: view.frameId, id, ok, ...(ok ? { result } : { error: message ?? 'Widget request failed' }) }, '*');
    };
    const handler = (event: MessageEvent<unknown>) => {
      if (event.source !== outerFrame.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      const data = event.data as Record<string, unknown>;
      if (data.type !== 'micelclaw:canvas-bridge-request' || data.frame_id !== view.frameId || typeof data.id !== 'string' || data.id.length < 1 || data.id.length > 128 || typeof data.method !== 'string') return;
      // Keep the narrowed value outside asynchronous callbacks below.
      // `data` originates in an untrusted postMessage event.
      const requestId = data.id;
      if (data.method === 'prompt.send') {
        const params = data.params && typeof data.params === 'object' && !Array.isArray(data.params) ? data.params as Record<string, unknown> : {};
        if (typeof params.text !== 'string' || !params.text.trim() || params.text.length > 8_000) { respond(data.id, false, undefined, 'Prompt de widget inválido'); return; }
        try { respond(data.id, onPrompt(params.text.trim())); } catch (cause) { respond(data.id, false, undefined, cause instanceof Error ? cause.message : 'Prompt de widget rechazado'); }
        return;
      }
      let command: NativeCanvasBridgeCommand;
      try { command = commandForWidgetBridge(data.method, data.params); }
      catch (cause) { respond(data.id, false, undefined, cause instanceof Error ? cause.message : 'Widget command rejected'); return; }
      void nativeCanvasService.bridgeWidget(conversationId, name, view.frameId, command)
        .then((result) => respond(requestId, true, result))
        .catch((cause) => respond(requestId, false, undefined, cause instanceof Error ? cause.message : 'Widget command failed'));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [conversationId, name, onPrompt, view]);
  if (error) return <p style={hintStyle}>{error}</p>;
  if (!view || !html) return <p style={hintStyle}>Cargando widget…</p>;
  const escapedHtml = JSON.stringify(html).replace(/</g, '\\u003c');
  const escapedFrameId = JSON.stringify(view.frameId).replace(/</g, '\\u003c');
  const bridge = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'"><style>html,body,iframe{margin:0;border:0;width:100%;min-height:320px;display:block}</style><iframe id="canvas-widget" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><script>const frameId=${escapedFrameId};const child=document.getElementById('canvas-widget');let port=null;function forwardResponse(data){if(!port||data.frame_id!==frameId)return;port.postMessage({type:'openclaw:widget-bridge-response',id:data.id,ok:data.ok,...(data.ok?{result:data.result}:{error:data.error||'Widget request failed'})});}window.addEventListener('message',(event)=>{if(event.source===parent&&event.data&&event.data.type==='micelclaw:canvas-bridge-response'){forwardResponse(event.data);return;}if(event.source!==child.contentWindow||!event.data)return;if(event.data.type==='openclaw:widget-bridge-port-offer'){const offered=event.ports&&event.ports[0];if(!offered||port)return;port=offered;port.onmessage=(message)=>{const data=message.data;if(!data||data.type!=='openclaw:widget-bridge-request'||data.ticket!==frameId||typeof data.id!=='string')return;parent.postMessage({type:'micelclaw:canvas-bridge-request',frame_id:frameId,id:data.id,method:data.method,params:data.params},'*');};port.start();port.postMessage({type:'openclaw:widget-host-init',ticket:frameId});}});child.srcdoc=${escapedHtml};</script>`;
  return <iframe ref={outerFrame} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={bridge} style={{ display: 'block', width: '100%', minHeight: 320, marginTop: 10, border: 0 }} />;
}

function commandForWidgetBridge(method: string, rawParams: unknown): NativeCanvasBridgeCommand {
  const params = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams) ? rawParams as Record<string, unknown> : {};
  if (method === 'state.emit' && params.payload && typeof params.payload === 'object' && !Array.isArray(params.payload)) return { kind: 'state', payload: params.payload as Record<string, unknown> };
  if (method === 'data.read' && typeof params.bindingId === 'string') return { kind: 'data', binding_id: params.bindingId, ...(params.params && typeof params.params === 'object' && !Array.isArray(params.params) ? { params: params.params as Record<string, unknown> } : {}) };
  if (method === 'action.run' && typeof params.action === 'string') return { kind: 'action', action: params.action, ...(params.params && typeof params.params === 'object' && !Array.isArray(params.params) ? { params: params.params as Record<string, unknown> } : {}) };
  if (method === 'cron.trigger' && typeof params.jobId === 'string') return { kind: 'cron', job_id: params.jobId };
  throw new Error('Operación de widget no permitida');
}

/** The 9.4 native report is structured data, never arbitrary report HTML. */
function NativeCanvasReport({ props }: { props: unknown }) {
  const blocks = props && typeof props === 'object' && !Array.isArray(props) && Array.isArray((props as Record<string, unknown>).blocks)
    ? (props as { blocks: unknown[] }).blocks : [];
  if (blocks.length === 0) return <p style={hintStyle}>Informe nativo sin bloques visibles.</p>;
  return <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{blocks.slice(0, 24).map((raw, index) => {
    const block = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const title = typeof block.title === 'string' ? block.title : null;
    if (block.type === 'text' && typeof block.text === 'string') return <section key={index}>{title && <strong>{title}</strong>}<p style={hintStyle}>{block.text}</p></section>;
    if (block.type === 'metrics' && Array.isArray(block.items)) return <div key={index} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{block.items.slice(0, 12).map((item, itemIndex) => { const metric = item && typeof item === 'object' ? item as Record<string, unknown> : {}; return <span key={itemIndex}><small>{typeof metric.label === 'string' ? metric.label : 'Métrica'}</small><br /><strong>{typeof metric.value === 'string' || typeof metric.value === 'number' ? metric.value : '—'}</strong></span>; })}</div>;
    if (block.type === 'table' && Array.isArray(block.columns) && Array.isArray(block.rows)) return <section key={index} style={{ overflowX: 'auto' }}>{title && <strong>{title}</strong>}<table><thead><tr>{block.columns.slice(0, 8).map((column, columnIndex) => <th key={columnIndex}>{typeof column === 'string' ? column : ''}</th>)}</tr></thead><tbody>{block.rows.slice(0, 40).map((row, rowIndex) => <tr key={rowIndex}>{Array.isArray(row) ? row.slice(0, 8).map((cell, cellIndex) => <td key={cellIndex}>{typeof cell === 'string' || typeof cell === 'number' ? cell : ''}</td>) : null}</tr>)}</tbody></table></section>;
    if (block.type === 'chart' && Array.isArray(block.points)) {
      const points = block.points.slice(0, 40).map((point) => point && typeof point === 'object' ? point as Record<string, unknown> : {}).filter((point) => typeof point.label === 'string' && typeof point.value === 'number' && Number.isFinite(point.value)) as Array<{ label: string; value: number }>;
      if (points.length === 0) return <p key={index} style={hintStyle}>Gráfica sin puntos válidos.</p>;
      const chartLabel = title ?? 'Gráfica';
      if (block.style === 'line') {
        const low = Math.min(0, ...points.map((point) => point.value));
        const high = Math.max(0, ...points.map((point) => point.value));
        const span = Math.max(1, high - low);
        const plot = points.map((point, pointIndex) => ({
          x: 18 + pointIndex * 284 / Math.max(1, points.length - 1),
          y: 102 - (point.value - low) * 84 / span,
          label: point.label,
          value: point.value,
        }));
        return <section key={index} aria-label={chartLabel}>{title && <strong>{title}</strong>}<svg role="img" aria-label={`${chartLabel}: ${points.map((point) => `${point.label} ${point.value}`).join(', ')}`} viewBox="0 0 320 120" style={{ width: '100%', maxHeight: 180, display: 'block', marginTop: 6 }}><line x1="18" y1="102" x2="302" y2="102" stroke="var(--border)" /><polyline points={plot.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--amber)" strokeWidth="2" />{plot.map((point, pointIndex) => <circle key={pointIndex} cx={point.x} cy={point.y} r="3.5" fill="var(--amber)"><title>{`${point.label}: ${point.value}`}</title></circle>)}</svg><div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>{points.map((point, pointIndex) => <span key={pointIndex}>{point.label}</span>)}</div></section>;
      }
      const maxAbs = Math.max(1, ...points.map((point) => Math.abs(point.value)));
      return <section key={index} aria-label={chartLabel}>{title && <strong>{title}</strong>}<div style={{ display: 'grid', gap: 4, marginTop: 6 }}>{points.map((point, pointIndex) => <div key={pointIndex} style={{ display: 'grid', gridTemplateColumns: 'minmax(60px,auto) 1fr auto', alignItems: 'center', gap: 6, fontSize: 11 }}><span>{point.label}</span><div style={{ height: 10, borderRadius: 4, background: 'var(--surface)' }}><div style={{ width: `${Math.max(2, Math.abs(point.value) / maxAbs * 100)}%`, height: '100%', borderRadius: 4, background: point.value < 0 ? 'var(--danger)' : 'var(--amber)' }} /></div><strong>{point.value}</strong></div>)}</div></section>;
    }
    if (block.type === 'links' && Array.isArray(block.items)) return <section key={index}>{title && <strong>{title}</strong>}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>{block.items.slice(0, 20).map((item, itemIndex) => { const link = item && typeof item === 'object' ? item as Record<string, unknown> : {}; let url: string | null = null; try { const parsed = new URL(String(link.url ?? '')); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href; } catch { /* Invalid links remain non-interactive. */ } return typeof link.label === 'string' ? url ? <a key={itemIndex} href={url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a> : <span key={itemIndex}>{link.label}</span> : null; })}</div></section>;
    return null;
  })}</div>;
}
const emptyStyle = { minHeight: 180, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 8, padding: 24, color: 'var(--text-muted)', textAlign: 'center' as const };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 10, padding: 12 };
const hintStyle = { margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' };
const inputStyle = { padding: '5px 7px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' };
const popoverStyle = { position: 'absolute' as const, zIndex: 20, top: 'calc(100% + 6px)', right: 0, width: 280, maxHeight: 360, overflow: 'auto' as const, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', boxShadow: '0 8px 24px rgba(0,0,0,.18)' };
