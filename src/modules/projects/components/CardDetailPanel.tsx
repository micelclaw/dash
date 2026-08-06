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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { X, Trash2, Plus, Check, MessageSquare, GitBranch, Archive, ArchiveRestore, Link, FileText, Calendar, Mail, User, File, Bookmark, ExternalLink, BookOpen, Package, Receipt, ArrowLeftRight, Paperclip, Download, Image as ImageIcon, HardDrive } from 'lucide-react';
import { TagInput } from '@/components/shared/TagInput';
import { DropZone } from '@/components/shared/DropZone';
import { DrivePickerModal } from './DrivePickerModal';
import { useProjectsStore } from '@/stores/projects.store';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import { api } from '@/services/api';
import { getPreviewUrl } from '@/lib/file-utils';
import { PriorityBadge } from './PriorityDot';
import { EntityLinkPicker } from './EntityLinkPicker';
import { RelationIntelligence } from '@/components/shared/RelationIntelligence';
import { useCardLinks } from '../hooks/use-card-links';
import { getChecklistProgressColor } from '../utils/design-tokens';
import type { ChecklistItem, Comment, Dependency, CustomFieldDef, Column } from '../types';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];

// Humaniza una entrada de activity (kanban_comments type='activity'). El
// 'moved' guarda los UUID de columna en activity_meta {from,to}; se traducen a
// nombre con las columnas del board (las del store). Fallback legible para
// cualquier otra acción (sin volcar JSON crudo).
function formatActivity(
  action: string | null,
  meta: unknown,
  columns: Record<string, Column>,
): string {
  const m = (meta ?? {}) as Record<string, unknown>;
  const colName = (id: unknown) =>
    typeof id === 'string' ? (columns[id]?.title ?? 'deleted column') : '—';
  if (action === 'moved') {
    return `Moved from «${colName(m.from)}» to «${colName(m.to)}»`;
  }
  // Otras acciones: texto legible (capitaliza) + meta solo si trae valores simples
  const label = action ? action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ') : 'Activity';
  const extras = Object.values(m).filter(v => typeof v === 'string' || typeof v === 'number');
  return extras.length ? `${label}: ${extras.join(', ')}` : label;
}

const DOMAIN_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  event: Calendar,
  email: Mail,
  contact: User,
  file: File,
  bookmarks: Bookmark,
  diary: BookOpen, diary_entries: BookOpen,
  inventory_item: Package, inventory: Package,
  finance_document: Receipt,
  finance_journal_entry: ArrowLeftRight,
};

const DOMAIN_ROUTES: Record<string, string> = {
  note: '/notes',
  event: '/calendar',
  contact: '/contacts',
  email: '/mail',
  file: '/drive',
  diary: '/diary',
  kanban_card: '/projects',
  inventory_item: '/inventory',
  finance_document: '/finance',
  finance_journal_entry: '/finance',
};

interface CardDetailPanelProps {
  boardId: string;
  cardId: string;
  isMobile: boolean;
  /**
   * Cómo se presenta. `panel` (defecto) = la columna de 400px pegada al tablero.
   * `full` = ocupa todo el ancho disponible; lo usa la ficha de la pantalla de
   * entrada de Tareas, que SUSTITUYE la rejilla de tableros.
   *
   * Es el MISMO componente a propósito: las 13 secciones (título, prioridad,
   * descripción, fechas, campos propios, etiquetas, checklist, dependencias,
   * enlazados, inteligencia de relaciones, comentarios y acciones) no se
   * duplican en un segundo panel que acabaría divergiendo.
   */
  variant?: 'panel' | 'full';
  /** Cabecera opcional a la izquierda del título (el "← Tableros (N)"). */
  leadingAction?: React.ReactNode;
}

interface ApiEnvelope<T> { data: T }

export function CardDetailPanel({ boardId, cardId, isMobile, variant = 'panel', leadingAction }: CardDetailPanelProps) {
  const navigate = useNavigate();
  const card = useProjectsStore((s) => s.cards[cardId]);
  const columns = useProjectsStore((s) => s.columns);
  const customFieldDefs = useProjectsStore((s) => s.customFieldDefs);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const deleteCard = useProjectsStore((s) => s.deleteCard);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const archiveCard = useProjectsStore((s) => s.archiveCard);
  const unarchiveCard = useProjectsStore((s) => s.unarchiveCard);

  // Usuarios asignables. `GET /projects/users` ya existía y ninguna pantalla lo
  // consumía. (Nota: hoy devuelve TODOS los usuarios activos del sistema sin
  // filtro de relación — anotado como deuda de privacidad, no se agrava aquí.)
  const [boardUsers, setBoardUsers] = useState<Array<{ id: string; email?: string; display_name?: string }>>([]);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await api.get<{ data: Array<{ id: string; email?: string; display_name?: string }> }>('/projects/users');
        if (!cancelado) setBoardUsers(res.data ?? []);
      } catch { /* sin usuarios: la sección lo dice */ }
    })();
    return () => { cancelado = true; };
  }, []);

  // Subida de portada y adjuntos. Molde real del repo: subir a /files/upload y
  // guardar el id devuelto en el registro (igual que inventory/StockTab).
  const [subiendo, setSubiendo] = useState(false);
  // Visor de la portada: en el panel se ve recortada tipo banner (objectFit
  // cover); al pulsarla se abre completa, sin recortar.
  const [portadaAbierta, setPortadaAbierta] = useState(false);
  /** Selector del Drive: 'portada' | 'adjuntos' | null. */
  const [drivePara, setDrivePara] = useState<null | 'portada' | 'adjuntos'>(null);
  const [nombresAdjuntos, setNombresAdjuntos] = useState<Record<string, string>>({});

  async function subirFichero(f: File, carpeta: string): Promise<string | null> {
    const form = new FormData();
    form.append('file', f);
    form.append('parent_folder', carpeta);
    const up = await api.upload<{ data: { id: string; filename?: string } }>('/files/upload', form);
    if (up.data.filename) setNombresAdjuntos((m) => ({ ...m, [up.data.id]: up.data.filename! }));
    return up.data.id ?? null;
  }

  async function subirPortada(f: File) {
    setSubiendo(true);
    try {
      const id = await subirFichero(f, '/Projects/covers/');
      if (id) handleSaveField('cover_image_id', id);
    } catch {
      toast.error('No se pudo subir la portada');
    } finally { setSubiendo(false); }
  }

  async function subirAdjuntos(files: File[]) {
    setSubiendo(true);
    try {
      const ids: string[] = [];
      for (const f of files) {
        const id = await subirFichero(f, '/Projects/attachments/');
        if (id) ids.push(id);
      }
      if (ids.length) handleSaveField('attachment_ids', [...(card?.attachment_ids ?? []), ...ids]);
    } catch {
      toast.error('No se pudieron subir los adjuntos');
    } finally { setSubiendo(false); }
  }

  // Nombres de los adjuntos ya guardados (los recién subidos ya los tenemos).
  useEffect(() => {
    const faltan = (card?.attachment_ids ?? []).filter((id) => !nombresAdjuntos[id]);
    if (faltan.length === 0) return;
    let cancelado = false;
    (async () => {
      const nuevos: Record<string, string> = {};
      for (const id of faltan) {
        try {
          const r = await api.get<{ data: { filename?: string } }>(`/files/${id}`);
          if (r.data?.filename) nuevos[id] = r.data.filename;
        } catch { /* fichero borrado: se queda con el nombre genérico */ }
      }
      if (!cancelado && Object.keys(nuevos).length) setNombresAdjuntos((m) => ({ ...m, ...nuevos }));
    })();
    return () => { cancelado = true; };
  }, [card?.attachment_ids, nombresAdjuntos]);

  // Lo que se pinta = quien PUEDE asignarse (relación de tablero compartido) MÁS
  // quien YA está asignado. Si no, un asignado de antes —o de cuando el endpoint
  // devolvía medio sistema— se volvería invisible y no habría forma de quitarlo.
  const asignables = (() => {
    const vistos = new Set(boardUsers.map((u) => u.id));
    const extra = (card?.assignee_ids ?? [])
      .filter((id) => !vistos.has(id))
      .map((id) => ({ id, display_name: undefined, email: undefined }));
    return [...boardUsers, ...extra];
  })();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Comments / activity state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Dependencies state
  const [dependencies, setDependencies] = useState<{ blocking: (Dependency & { _card?: { id: string; title: string } })[]; blockedBy: (Dependency & { _card?: { id: string; title: string } })[] }>({ blocking: [], blockedBy: [] });
  const [showDeps, setShowDeps] = useState(false);

  // Linked items
  const [showLinks, setShowLinks] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const { links: linkedItems, loading: linksLoading, fetchLinks, removeLink } = useCardLinks(boardId, cardId);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
      setPriority(card.priority ?? 'medium');
      setStartDate(card.start_date ? card.start_date.slice(0, 10) : '');
      setDueDate(card.due_date ? card.due_date.slice(0, 10) : '');
    }
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load comments
  useEffect(() => {
    if (showComments && cardId) {
      api.get<ApiEnvelope<Comment[]>>(`/projects/boards/${boardId}/cards/${cardId}/comments`)
        .then(res => setComments(res.data))
        .catch(() => {});
    }
  }, [showComments, cardId, boardId]);

  // Load dependencies
  useEffect(() => {
    if (showDeps && cardId) {
      api.get<ApiEnvelope<Record<string, unknown>>>(`/projects/boards/${boardId}/cards/${cardId}/dependencies`)
        .then(res => {
          const raw = res.data as Record<string, unknown>;
          setDependencies({
            blocking: (raw.blocking as any[] ?? []).map((d: any) => d.dependency ? { ...d.dependency, _card: d.card } : d),
            blockedBy: (raw.blocked_by as any[] ?? raw.blockedBy as any[] ?? []).map((d: any) => d.dependency ? { ...d.dependency, _card: d.card } : d),
          });
        })
        .catch(() => {});
    }
  }, [showDeps, cardId, boardId]);

  const handleClose = useCallback(() => selectCard(null), [selectCard]);
  // Cerrar con Escape (salvo escribiendo en un campo: hay edición inline de
  // checklist con su propio Escape, y no queremos cerrar a media edición).
  // Con el visor de portada abierto, Escape cierra el VISOR, no el panel: si no,
  // una tecla haría desaparecer las dos capas de golpe.
  useEscapeToClose(useCallback(() => {
    if (portadaAbierta) { setPortadaAbierta(false); return; }
    handleClose();
  }, [portadaAbierta, handleClose]));

  const handleSaveField = useCallback(
    (field: string, value: unknown) => {
      updateCard(boardId, cardId, { [field]: value });
    },
    [boardId, cardId, updateCard],
  );

  const handleDelete = useCallback(() => {
    if (confirm('Delete this card?')) {
      deleteCard(boardId, cardId);
    }
  }, [boardId, cardId, deleteCard]);

  const handleToggleCheck = useCallback(
    (itemId: string) => {
      if (!card) return;
      const newChecklist = (card.checklist ?? []).map((c) =>
        c.id === itemId ? { ...c, checked: !c.checked } : c,
      );
      handleSaveField('checklist', newChecklist);
    },
    [card, handleSaveField],
  );

  const handleAddCheckItem = useCallback(() => {
    if (!newCheckItem.trim() || !card) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newCheckItem.trim(),
      checked: false,
    };
    handleSaveField('checklist', [...(card.checklist ?? []), newItem]);
    setNewCheckItem('');
  }, [newCheckItem, card, handleSaveField]);

  const handleRemoveCheckItem = useCallback(
    (itemId: string) => {
      if (!card) return;
      handleSaveField(
        'checklist',
        (card.checklist ?? []).filter((c) => c.id !== itemId),
      );
    },
    [card, handleSaveField],
  );

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim()) return;
    try {
      const res = await api.post<ApiEnvelope<Comment>>(`/projects/boards/${boardId}/cards/${cardId}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch { /* ignore */ }
  }, [newComment, boardId, cardId]);

  const handleSaveCheckItemText = useCallback(() => {
    if (!card || !editingItemId) return;
    const text = editingText.trim();
    if (text) {
      handleSaveField('checklist', (card.checklist ?? []).map((c) =>
        c.id === editingItemId ? { ...c, text } : c,
      ));
    }
    setEditingItemId(null);
    setEditingText('');
  }, [card, editingItemId, editingText, handleSaveField]);

  if (!card) return null;

  const panelStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', overflow: 'auto' }
    : variant === 'full'
    ? { flex: 1, minWidth: 0, background: 'var(--bg)', overflow: 'auto', height: '100%' }
    : {
        width: 400,
        minWidth: 400,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg)',
        overflow: 'auto',
        height: '100%',
      };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {leadingAction}
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {columns[card.column_id]?.title ?? 'Column'}
          </span>
          {card.card_number && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{card.card_number}</span>
          )}
        </div>
        <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() !== card.title) handleSaveField('title', title.trim()); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            padding: 0,
          }}
        />

        {/* Priority */}
        <div>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => { setPriority(p); handleSaveField('priority', p); }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: priority === p ? '1px solid var(--border-hover)' : '1px solid transparent',
                  background: priority === p ? 'var(--surface-hover)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <PriorityBadge priority={p} />
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleSaveField('description', description || null)}
            placeholder="Add a description..."
            rows={4}
            style={{
              width: '100%',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 8px',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Dates */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                handleSaveField('start_date', e.target.value ? new Date(e.target.value).toISOString() : null);
              }}
              style={dateInputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                handleSaveField('due_date', e.target.value ? new Date(e.target.value).toISOString() : null);
              }}
              style={dateInputStyle}
            />
          </div>
        </div>

        {/* Custom Fields / Properties */}
        {Object.keys(customFieldDefs).length > 0 && (
          <div>
            <label style={labelStyle}>Properties</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.values(customFieldDefs)
                .sort((a, b) => a.position - b.position)
                .map(fd => {
                  const value = (card.custom_fields as Record<string, unknown> ?? {})[fd.id];
                  return (
                    <CustomFieldInput
                      key={fd.id}
                      fieldDef={fd}
                      value={value}
                      onSave={(val) => {
                        const cf = { ...(card.custom_fields as Record<string, unknown> ?? {}), [fd.id]: val };
                        handleSaveField('custom_fields', cf);
                      }}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags</label>
          <TagInput
            tags={card.tags ?? []}
            onChange={(next) => handleSaveField('tags', next)}
          />
        </div>

        {/* Asignados — el campo `assignee_ids` existía en la tabla desde siempre,
            se escribía por API y NINGUNA pantalla lo pintaba: un campo fantasma.
            Los enlaces automáticos a contactos ya se sincronizan al guardarlo. */}
        <div>
          <label style={labelStyle}>Asignados</label>
          {asignables.length === 0 ? (
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Sin usuarios disponibles</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {asignables.map((u) => {
                const asignado = (card.assignee_ids ?? []).includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      const actuales = card.assignee_ids ?? [];
                      handleSaveField('assignee_ids', asignado
                        ? actuales.filter((a) => a !== u.id)
                        : [...actuales, u.id]);
                    }}
                    title={u.email ?? u.display_name ?? u.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                      fontSize: 12, fontFamily: 'var(--font-sans)',
                      background: asignado ? 'var(--amber)' : 'transparent',
                      color: asignado ? '#06060a' : 'var(--text-dim)',
                      border: `1px solid ${asignado ? 'var(--amber)' : 'var(--border)'}`,
                    }}
                  >
                    {(u.display_name ?? u.email ?? '?').slice(0, 24)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Portada y adjuntos. Los dos campos existían en la tabla desde siempre
            (`cover_image_id`, `attachment_ids`) y NINGUNA pantalla dejaba ponerlos:
            solo se podían rellenar por API. Este es el único componente que edita
            una tarjeta —se monta como panel del tablero y como ficha de la bandeja—
            así que basta con añadirlo aquí. */}
        <div>
          <label style={labelStyle}>Portada</label>
          {card.cover_image_id ? (
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img
                // `/files/:id/content` NO sirve bytes: devuelve un envelope JSON y
                // responde 404 TEXT_NOT_AVAILABLE para cualquier mime que no sea
                // texto o PDF. Y `<img>` no puede mandar cabeceras, así que el token
                // va en la query — es lo que hacen Drive, Fotos y Contactos.
                src={getPreviewUrl(card.cover_image_id, 640)}
                alt="Portada de la tarjeta"
                onClick={() => setPortadaAbierta(true)}
                title="Ver completa"
                style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'cover', cursor: 'zoom-in' }}
              />
              <button
                onClick={() => handleSaveField('cover_image_id', null)}
                style={{ position: 'absolute', top: 6, right: 6, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none' }}
              >
                Quitar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 8px)', cursor: subiendo ? 'wait' : 'pointer', color: 'var(--text-dim)', fontSize: 12 }}>
                <ImageIcon size={13} />
                {subiendo ? 'Subiendo…' : 'Subir imagen'}
                <input
                  type="file" accept="image/*" hidden disabled={subiendo}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subirPortada(f); }}
                />
              </label>
              <button
                onClick={() => setDrivePara('portada')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12, background: 'transparent', fontFamily: 'var(--font-sans)' }}
              >
                <HardDrive size={13} />
                Del Drive
              </button>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Adjuntos</label>
          <DropZone onFilesDropped={(files) => void subirAdjuntos(files)} disabled={subiendo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(card.attachment_ids ?? []).map((fid) => (
                <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', fontSize: 12 }}>
                  <Paperclip size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {nombresAdjuntos[fid] ?? 'Archivo'}
                  </span>
                  <a
                    href={api.mediaUrl(`/files/${fid}/download`)}
                    download
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--text-dim)', display: 'inline-flex' }}
                    title="Descargar"
                  >
                    <Download size={12} />
                  </a>
                  <button
                    onClick={() => handleSaveField('attachment_ids', (card.attachment_ids ?? []).filter((x) => x !== fid))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                    title="Quitar"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 8px)', cursor: subiendo ? 'wait' : 'pointer', color: 'var(--text-dim)', fontSize: 12 }}>
                  <Paperclip size={13} />
                  {subiendo ? 'Subiendo…' : 'Subir archivo'}
                  <input
                    type="file" multiple hidden disabled={subiendo}
                    onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) void subirAdjuntos(fs); }}
                  />
                </label>
                <button
                  onClick={() => setDrivePara('adjuntos')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 8px)', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12, background: 'transparent', fontFamily: 'var(--font-sans)' }}
                >
                  <HardDrive size={13} />
                  Del Drive
                </button>
              </div>
            </div>
          </DropZone>
        </div>

        {/* Checklist */}
        <div>
          <label style={labelStyle}>
            Checklist
            {card.checklist && card.checklist.length > 0 && (
              <span style={{ fontWeight: 400, marginLeft: 6, color: getChecklistProgressColor(card.checklist.filter((c) => c.checked).length, card.checklist.length) }}>
                {card.checklist.filter((c) => c.checked).length}/{card.checklist.length}
              </span>
            )}
          </label>

          {(card.checklist ?? []).map((item) => (
            // flex-start: the checkbox sits at the TOP of multi-line items
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <button
                onClick={() => handleToggleCheck(item.id)}
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: item.checked ? 'var(--success)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {item.checked && <Check size={10} color="#fff" />}
              </button>
              {editingItemId === item.id ? (
                <textarea
                  value={editingText}
                  autoFocus
                  rows={1}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onChange={(e) => {
                    setEditingText(e.target.value);
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveCheckItemText(); }
                    if (e.key === 'Escape') { setEditingItemId(null); setEditingText(''); }
                  }}
                  onBlur={handleSaveCheckItemText}
                  style={{
                    flex: 1, ...inputStyle,
                    resize: 'none', overflow: 'hidden',
                    lineHeight: 1.5, minHeight: 28,
                  }}
                />
              ) : (
                <span
                  onClick={() => { setEditingItemId(item.id); setEditingText(item.text); }}
                  title="Click to edit"
                  style={{
                    color: item.checked ? 'var(--text-dim)' : 'var(--text)',
                    fontSize: 13, textDecoration: item.checked ? 'line-through' : 'none', flex: 1,
                    cursor: 'text', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                  }}
                >
                  {item.text}
                </span>
              )}
              <button onClick={() => handleRemoveCheckItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0, marginTop: 1 }}>
                <X size={12} />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCheckItem(); }}
              placeholder="Add item..."
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={handleAddCheckItem} style={smallBtnStyle}><Plus size={12} /></button>
          </div>
        </div>

        {/* Dependencies section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowDeps(!showDeps)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitBranch size={10} /> Dependencies
              {(dependencies.blocking.length + dependencies.blockedBy.length > 0) && (
                <span style={{ fontWeight: 400 }}>({dependencies.blocking.length + dependencies.blockedBy.length})</span>
              )}
            </span>
          </label>
          {showDeps && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {dependencies.blocking.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Blocks:</span>
                  {dependencies.blocking.map(d => (
                    <div key={d.id} style={{ padding: '2px 0', marginLeft: 8 }}>{d._card?.title || `Card ${d.blocked_card_id.slice(0, 8)}...`}</div>
                  ))}
                </div>
              )}
              {dependencies.blockedBy.length > 0 && (
                <div>
                  <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Blocked by:</span>
                  {dependencies.blockedBy.map(d => (
                    <div key={d.id} style={{ padding: '2px 0', marginLeft: 8 }}>{d._card?.title || `Card ${d.blocking_card_id.slice(0, 8)}...`}</div>
                  ))}
                </div>
              )}
              {dependencies.blocking.length === 0 && dependencies.blockedBy.length === 0 && (
                <div style={{ padding: '4px 0' }}>No dependencies</div>
              )}
            </div>
          )}
        </div>

        {/* Linked Items section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowLinks(!showLinks)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link size={10} /> Linked Items
              {linkedItems.length > 0 && <span style={{ fontWeight: 400 }}>({linkedItems.length})</span>}
            </span>
          </label>
          {showLinks && (
            <div style={{ fontSize: 12 }}>
              {linksLoading && linkedItems.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>Loading...</div>
              )}
              {linkedItems.map(link => {
                const Icon = DOMAIN_ICONS[link.domain] ?? FileText;
                const route = DOMAIN_ROUTES[link.domain];
                return (
                  <div key={link.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 6px', borderRadius: 4, marginBottom: 2,
                    cursor: route ? 'pointer' : undefined,
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    onClick={() => route && navigate(`${route}?id=${link.domainId}`)}
                  >
                    <Icon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{
                      flex: 1, color: 'var(--text)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {link.title}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
                      {link.domain.replace('_', ' ')}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeLink(link.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {!linksLoading && linkedItems.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>No linked items</div>
              )}
              <button
                onClick={() => setLinkPickerOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 6px', marginTop: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
              >
                <Plus size={12} /> Link entity
              </button>
            </div>
          )}
        </div>

        {/* Inteligencia de relaciones: Related Entities + Similar Semantic + Graph Proximity */}
        <RelationIntelligence sourceType="kanban_card" sourceId={cardId} />

        {/* Comments / Activity section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowComments(!showComments)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={10} /> Comments & Activity
              {comments.length > 0 && <span style={{ fontWeight: 400 }}>({comments.length})</span>}
            </span>
          </label>
          {showComments && (
            <div>
              {comments.map(c => (
                <div key={c.id} style={{
                  padding: '6px 8px', marginBottom: 4, borderRadius: 4,
                  background: c.type === 'activity' ? 'transparent' : 'var(--card)',
                  border: c.type === 'activity' ? 'none' : '1px solid var(--border)',
                  fontSize: 12, color: c.type === 'activity' ? 'var(--text-dim)' : 'var(--text)',
                  fontStyle: c.type === 'activity' ? 'italic' : 'normal',
                }}>
                  {c.type === 'activity' ? (
                    <span>{formatActivity(c.activity_action, c.activity_meta, columns)}</span>
                  ) : (
                    <span>{c.content}</span>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                  placeholder="Write a comment..."
                  style={{ flex: 1, ...inputStyle }}
                />
                <button onClick={handleAddComment} style={smallBtnStyle}>Send</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', background: 'none',
              border: '1px solid var(--error)', borderRadius: 6,
              color: 'var(--error)', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
          {card.archived ? (
            <button
              onClick={() => unarchiveCard(boardId, cardId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', background: 'none',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-dim)', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <ArchiveRestore size={14} /> Unarchive
            </button>
          ) : (
            <button
              onClick={() => archiveCard(boardId, cardId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', background: 'none',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-dim)', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      {linkPickerOpen && (
        <EntityLinkPicker
          boardId={boardId}
          cardId={cardId}
          onClose={() => setLinkPickerOpen(false)}
          onLinksChanged={fetchLinks}
        />
      )}

      {drivePara && (
        <DrivePickerModal
          soloImagenes={drivePara === 'portada'}
          titulo={drivePara === 'portada' ? 'Elegir portada del Drive' : 'Adjuntar del Drive'}
          onClose={() => setDrivePara(null)}
          onPick={(files) => {
            if (files.length === 0) { setDrivePara(null); return; }
            if (drivePara === 'portada') {
              handleSaveField('cover_image_id', files[0].id);
            } else {
              // Sin duplicar: adjuntar dos veces el mismo fichero no aporta nada.
              const yaEstan = new Set(card.attachment_ids ?? []);
              const nuevos = files.map((f) => f.id).filter((id) => !yaEstan.has(id));
              setNombresAdjuntos((m) => ({ ...m, ...Object.fromEntries(files.map((f) => [f.id, f.filename])) }));
              if (nuevos.length) handleSaveField('attachment_ids', [...(card.attachment_ids ?? []), ...nuevos]);
            }
            setDrivePara(null);
          }}
        />
      )}

      {/* Visor de la portada COMPLETA. En el panel se ve recortada como banner
          (cover); aquí entera (contain). No se reutiliza `PhotoLightbox` porque
          está atado al tipo `Photo` con navegación y panel de detalles: para una
          sola imagen habría que fabricar un objeto falso. */}
      {portadaAbierta && card.cover_image_id && (
        <div
          onClick={() => setPortadaAbierta(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Portada a tamaño completo"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, cursor: 'zoom-out',
          }}
        >
          <img
            src={getPreviewUrl(card.cover_image_id, 2048)}
            alt="Portada de la tarjeta"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'default' }}
          />
          <button
            onClick={() => setPortadaAbierta(false)}
            aria-label="Cerrar"
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 999, color: '#fff', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 8px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  colorScheme: 'dark',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '3px 6px',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: '2px 6px',
  display: 'flex',
  alignItems: 'center',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};

function CustomFieldInput({ fieldDef, value, onSave }: {
  fieldDef: CustomFieldDef;
  value: unknown;
  onSave: (val: unknown) => void;
}) {
  const fieldInputStyle: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '3px 6px', color: 'var(--text)',
    fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 70, flexShrink: 0 }}>
        {fieldDef.name}
      </span>
      {fieldDef.type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onSave(e.target.checked)}
          style={{ accentColor: 'var(--amber)' }}
        />
      ) : fieldDef.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={e => onSave(e.target.value || null)}
          style={{ ...fieldInputStyle, cursor: 'pointer' }}
        >
          <option value="">—</option>
          {(Array.isArray(fieldDef.options) ? fieldDef.options as string[] : []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : fieldDef.type === 'date' ? (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={e => onSave(e.target.value || null)}
          style={{ ...fieldInputStyle, colorScheme: 'dark' }}
        />
      ) : fieldDef.type === 'number' ? (
        <input
          type="number"
          defaultValue={value != null ? String(value) : ''}
          onBlur={e => onSave(e.target.value ? Number(e.target.value) : null)}
          style={fieldInputStyle}
        />
      ) : fieldDef.type === 'url' ? (
        <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
          <input
            type="url"
            defaultValue={String(value ?? '')}
            onBlur={e => onSave(e.target.value || null)}
            placeholder="https://..."
            style={{ ...fieldInputStyle, flex: 1 }}
          />
          {!!value && (
            <a href={String(value)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ) : (
        <input
          type="text"
          defaultValue={String(value ?? '')}
          onBlur={e => onSave(e.target.value || null)}
          style={fieldInputStyle}
        />
      )}
    </div>
  );
}
