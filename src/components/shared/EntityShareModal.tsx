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

/**
 * Modal UNIFICADO de compartir — la única superficie de compartir de la app
 * (Fase A del roadmap Compartir→Ventanas). Cinco secciones por registro:
 *
 *   1. Compartir fuera   — share sheet nativo del móvil (ACTION_SEND)
 *   2. 2ª acción nativa  — calendario/contactos/galería/abrir-con/… por tipo
 *   3. Enlace público    — shared_links con password/caducidad/QR/email
 *                          (hoy solo ficheros/carpetas; resto "próximamente")
 *   4. Personas          — user_shares a usuarios de la instancia (view/edit)
 *   5. Ya compartido     — gestión de lo concedido (cambiar permiso/revocar)
 *
 * Absorbe los legacy ShareModal/ShareWithUserModal/ShareEmailModal del Drive.
 */

import { useState, useEffect, useCallback } from 'react';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import {
  X, Share2, CalendarPlus, UserPlus, MapPin, ExternalLink, ImageDown, Download,
  FileText, Mail, Globe, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationStore } from '@/stores/notification.store';
import {
  buildSharePayload, buildMultiSharePayload, shareTargetType, resolveSecondActions,
  canShareInternal, executeSecondAction,
  type ShareMeta, type SecondActionKind,
} from '@/lib/share-payload';
import { shareNative } from '@/lib/native-share';
import {
  listRecordShares, listFileLinks,
  type RecordShare, type FileShareLink,
} from '@/services/shares.service';
import { CollapsibleSection } from './share/CollapsibleSection';
import { PublicLinkSection } from './share/PublicLinkSection';
import { PeopleSection } from './share/PeopleSection';
import { SharedListSection } from './share/SharedListSection';

interface EntityShareModalProps {
  open: boolean;
  entityType: string;
  entityId: string;
  /** Multi-selección: comparte TODAS estas entidades (default [entityId]). Con
      varias, las acciones de un-solo-registro (share sheet, 2ª acción, enlace,
      gestión) se ocultan — aplica el compartir interno con usuarios. */
  entityIds?: string[];
  entityTitle: string;
  /** Pistas del registro (mime/url/location/isDirectory) para la 2ª acción y el enlace. */
  shareMeta?: ShareMeta;
  /** Compat del deep-link del indicador. "Ya compartido" es ahora SIEMPRE visible
      (decisión 2026-07-12: sin desplegable) — la prop queda como no-op aceptado. */
  initialSection?: 'shared';
  /** Tras cualquier mutación (compartir/revocar/permiso) — refresca indicadores. */
  onShared?: () => void;
  onClose: () => void;
}

const SECOND_ICON: Record<SecondActionKind, LucideIcon> = {
  calendar: CalendarPlus, contacts: UserPlus, maps: MapPin, openUrl: ExternalLink,
  gallery: ImageDown, downloads: Download, openWith: ExternalLink, saveText: FileText, emailDraft: Mail,
};

const ENTITY_LABELS: Record<string, string> = {
  note: 'nota',
  contact: 'contacto',
  email: 'correo',
  diary_entry: 'entrada de diario',
  photo: 'foto',
  event: 'evento',
  file: 'archivo',
  bookmark: 'marcador',
  feed: 'feed',
  article: 'artículo',
  book: 'libro',
  kanban_board: 'tablero',
  album: 'álbum',
};

export function EntityShareModal({
  open, entityType, entityId, entityIds, entityTitle, shareMeta, initialSection, onShared, onClose,
}: EntityShareModalProps) {
  const addNotification = useNotificationStore(s => s.addNotification);
  const ids = entityIds && entityIds.length > 0 ? entityIds : [entityId];
  const multi = ids.length > 1;
  const isDirectory = !!shareMeta?.isDirectory;
  const [busyKind, setBusyKind] = useState<SecondActionKind | null>(null);
  const [externalBusy, setExternalBusy] = useState(false);
  const secondActions = multi ? [] : resolveSecondActions(entityType, shareMeta);
  const showInternal = canShareInternal(entityType);
  // Enlace público: hoy solo lo soportan ficheros/carpetas (shared_links vía
  // /files/:id/share). photo ES un file (mismo id). El resto de tipos internos
  // muestran la sección atenuada ("próximamente" = Fase B).
  const fileish = !multi && shareTargetType(entityType) === 'file';
  const linkComing = !multi && showInternal && !fileish;

  const [recordShares, setRecordShares] = useState<RecordShare[]>([]);
  const [fileLinks, setFileLinks] = useState<FileShareLink[]>([]);
  useEscapeToClose(onClose, { enabled: open });

  const refreshShares = useCallback(async () => {
    if (!showInternal || multi) return;
    try {
      setRecordShares(await listRecordShares(shareTargetType(entityType), entityId));
    } catch { /* backend viejo sin ?target_id — la sección queda vacía */ }
  }, [showInternal, multi, entityType, entityId]);

  const refreshLinks = useCallback(async () => {
    if (!fileish) return;
    try {
      setFileLinks(await listFileLinks(entityId));
    } catch { setFileLinks([]); }
  }, [fileish, entityId]);

  useEffect(() => {
    if (!open) return;
    void refreshShares();
    void refreshLinks();
  }, [open, refreshShares, refreshLinks]);

  const handleMutated = useCallback(() => {
    void refreshShares();
    onShared?.();
  }, [refreshShares, onShared]);

  const handleLinksMutated = useCallback(() => {
    void refreshLinks();
    onShared?.();
  }, [refreshLinks, onShared]);

  const handleShareExternal = useCallback(async () => {
    setExternalBusy(true);
    try {
      // Multi: comparte TODAS las entidades (todas las fotos), no solo la 1ª.
      const payload = multi
        ? await buildMultiSharePayload(entityType, ids, entityTitle || undefined)
        : await buildSharePayload(entityType, entityId, entityTitle);
      const result = await shareNative(payload);
      if (result === 'shared' || result === 'copied' || result === 'downloaded') onClose();
    } catch {
      addNotification({ type: 'system', title: 'Error', body: 'No se pudo preparar el contenido para compartir' });
    }
    setExternalBusy(false);
  }, [multi, ids, entityType, entityId, entityTitle, onClose, addNotification]);

  // Segunda acción nativa (añadir/abrir/guardar en la app del móvil correspondiente).
  const runSecond = useCallback(async (kind: SecondActionKind) => {
    setBusyKind(kind);
    try {
      await executeSecondAction(kind, entityType, entityId, entityTitle, shareMeta);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción');
    }
    setBusyKind(null);
  }, [entityType, entityId, entityTitle, shareMeta, onClose]);

  if (!open) return null;

  const label = ENTITY_LABELS[entityType] ?? entityType;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 480,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            {multi
              ? `Compartir ${ids.length} ${label}s`
              : `Compartir ${isDirectory ? 'carpeta' : label}${entityTitle ? `: ${entityTitle}` : ''}`}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── 1. Compartir fuera (share sheet nativo — 1 o varios registros, no carpetas) ── */}
          {!isDirectory && (
            <button
              onClick={handleShareExternal}
              disabled={externalBusy}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: externalBusy ? 'wait' : 'pointer',
                color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                textAlign: 'left',
              }}
            >
              <Share2 size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{externalBusy ? 'Preparando…' : 'Compartir fuera'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Telegram, WhatsApp, correo… (apps del móvil)
                </span>
              </span>
            </button>
          )}

          {/* ── 2. Segundas acciones nativas (según el tipo de registro) ── */}
          {secondActions.map(a => {
            const Icon = SECOND_ICON[a.kind];
            const busy = busyKind === a.kind;
            return (
              <button
                key={a.kind}
                onClick={() => runSecond(a.kind)}
                disabled={busyKind !== null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: busyKind ? 'wait' : 'pointer',
                  color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', textAlign: 'left',
                }}
              >
                <Icon size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{busy ? 'Abriendo…' : a.label}</span>
              </button>
            );
          })}

          {/* ── 3. Enlace público ── */}
          {fileish && (
            <CollapsibleSection icon={Globe} title="Enlace público" badge={fileLinks.length}>
              <PublicLinkSection fileId={entityId} links={fileLinks} onLinksChanged={handleLinksMutated} />
            </CollapsibleSection>
          )}
          {linkComing && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', opacity: 0.55,
            }}>
              <Globe size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                Enlace público — próximamente para {label}s
              </span>
            </div>
          )}

          {/* ── 4. Personas de Micelclaw ── */}
          {showInternal && (
            <CollapsibleSection icon={Users} title="Personas de Micelclaw" defaultOpen>
              <PeopleSection
                entityType={entityType}
                ids={ids}
                entityTitle={entityTitle}
                alreadySharedWith={multi ? [] : recordShares.map(s => s.shared_with_id)}
                onShared={handleMutated}
              />
            </CollapsibleSection>
          )}

          {/* ── 5. Ya compartido (gestión) — SIEMPRE visible, sin desplegable.
                 Si no hay nadie, la sección no aparece (Personas ya está arriba). ── */}
          {showInternal && !multi && recordShares.length > 0 && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserPlus size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)' }}>Ya compartido</span>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, padding: '1px 7px',
                  borderRadius: 'var(--radius-full)', background: 'var(--amber)', color: '#000',
                }}>
                  {recordShares.length}
                </span>
              </div>
              <SharedListSection shares={recordShares} onChanged={handleMutated} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
