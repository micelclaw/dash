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

import { PhotoSource } from '@/components/shared/SourceBadge';
import { useEffect, useRef, useState, useCallback } from 'react';
import Selecto from 'react-selecto';
import { Image, FolderPlus, Info, Download, ImageIcon, Star, Loader2, Clock, CheckCircle2, PauseCircle, Cpu } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { usePhotoProcessingStore } from '@/stores/photo-processing.store';
import { DropZone } from '@/components/shared/DropZone';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { useIsMobile } from '@/hooks/use-media-query';
import { simpleHash, getPreviewUrl } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import { useTouchDragSelect } from './hooks/use-touch-drag-select';
import type { Photo, Album } from '@/types/files';
import type { PhotoGroup, PhotoSortField } from './types';
import { AlbumPickerDropdown } from './AlbumPickerDropdown';

interface PhotosTimelineProps {
  photos: Photo[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPhotoClick: (index: number) => void;
  onFilesDropped: (files: File[]) => void;
  albums: Album[];
  onAddToAlbum: (photoId: string, albumId: string) => void;
  onSetAsCover: (photoId: string, albumId: string) => void;
  onCreateAlbum: (name: string) => Promise<Album>;
  onViewExif: (photo: Photo) => void;
  onProcessPhoto: (photo: Photo) => void;
  onDeletePhoto: (photoId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  /** Selección por barrido (táctil) — reemplaza el set entero. */
  onSetSelection: (ids: Set<string>) => void;
  /** Marquee de escritorio (Selecto) — delta añadidos/quitados. */
  onApplyDelta: (added: string[], removed: string[]) => void;
  /** Campo de ordenación activo: 'date' agrupa por día; name/size = grid plano. */
  sortField: PhotoSortField;
}

/**
 * Agrupación por DÍA (estilo galería del móvil: "8 Aug 2025") cuando se ordena
 * por fecha; con name/size el orden no es cronológico → un solo grupo plano.
 */
export function groupPhotos(photos: Photo[], sortField: PhotoSortField): PhotoGroup[] {
  if (sortField !== 'date') {
    return photos.length ? [{ key: 'all', label: '', photos }] : [];
  }
  const map = new Map<string, Photo[]>();
  for (const photo of photos) {
    const d = new Date(photo.taken_at || photo.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const existing = map.get(key);
    if (existing) existing.push(photo);
    else map.set(key, [photo]);
  }
  const groups: PhotoGroup[] = [];
  for (const [key, groupPhotos] of map) {
    const d = new Date(groupPhotos[0]!.taken_at || groupPhotos[0]!.created_at);
    const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    groups.push({ key, label, photos: groupPhotos });
  }
  // El orden lo trae el servidor — se respeta el orden de aparición de los grupos.
  return groups;
}

function PhotoThumbnail({
  photo,
  onClick,
  albums,
  onAddToAlbum,
  onSetAsCover,
  onCreateAlbum,
  onViewExif,
  onProcessPhoto,
  onDelete,
  selected,
  showCheckbox,
  onToggleSelect,
}: {
  photo: Photo;
  onClick: () => void;
  albums: Album[];
  onAddToAlbum: (photoId: string, albumId: string) => void;
  onSetAsCover: (photoId: string, albumId: string) => void;
  onCreateAlbum: (name: string) => Promise<Album>;
  onViewExif: (photo: Photo) => void;
  onProcessPhoto: (photo: Photo) => void;
  onDelete: (photoId: string) => void;
  selected?: boolean;
  showCheckbox?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [albumPicker, setAlbumPicker] = useState<{ mode: 'add' | 'cover'; pos: { x: number; y: number } } | null>(null);
  const hue = simpleHash(photo.id) % 360;
  const previewUrl = getPreviewUrl(photo.id, 300);
  const processingPhase = usePhotoProcessingStore((s) => s.processingFiles.get(photo.id));
  const isCurrentFile = usePhotoProcessingStore((s) => s.currentFileId === photo.id);
  const isPipelinePaused = usePhotoProcessingStore((s) => s.isPaused);

  const showCb = showCheckbox || hovered || selected;

  return (
    <>
      <EntityContextMenu
        entityType="photo"
        entityId={photo.id}
        entityTitle={photo.filename || 'Photo'}
        onDelete={() => onDelete(photo.id)}
        extraItems={[
          {
            label: 'Add to album',
            icon: FolderPlus,
            onClick: () => {
              setAlbumPicker({ mode: 'add', pos: { x: window.innerWidth / 2, y: window.innerHeight / 3 } });
            },
          },
          { label: 'View details', icon: Info, onClick: () => onViewExif(photo) },
          { label: 'Download', icon: Download, onClick: () => downloadFile(photo.id, photo.filename) },
          { label: 'Process with AI', icon: Cpu, onClick: () => onProcessPhoto(photo) },
          {
            label: 'Assign stars',
            icon: Star,
            onClick: () => {},
            subItems: [
              { label: '★★★★★  5 stars', onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 5 } }); toast.success('5 stars'); } catch { toast.error('Failed'); } } },
              { label: '★★★★☆  4 stars', onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 4 } }); toast.success('4 stars'); } catch { toast.error('Failed'); } } },
              { label: '★★★☆☆  3 stars', onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 3 } }); toast.success('3 stars'); } catch { toast.error('Failed'); } } },
              { label: '★★☆☆☆  2 stars', onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 2 } }); toast.success('2 stars'); } catch { toast.error('Failed'); } } },
              { label: '★☆☆☆☆  1 star',  onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 1 } }); toast.success('1 star'); } catch { toast.error('Failed'); } } },
              { label: '☆☆☆☆☆  0 stars', onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: 0 } }); toast.success('0 stars'); } catch { toast.error('Failed'); } } },
              { label: '🤖  Auto (AI)',    onClick: async () => { try { await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: null } }); toast.success('Reset to AI score'); } catch { toast.error('Failed'); } } },
            ],
          },
          {
            label: 'Set as cover',
            icon: ImageIcon,
            onClick: () => {
              setAlbumPicker({ mode: 'cover', pos: { x: window.innerWidth / 2, y: window.innerHeight / 3 } });
            },
          },
        ]}
        trigger={
          <div
            data-photo-id={photo.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName === 'INPUT') return;
              // En modo selección (galería estándar): tap = alternar, no abrir.
              if (showCheckbox) { onToggleSelect?.(e.shiftKey); return; }
              onClick();
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              cursor: 'pointer',
              transform: hovered ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform var(--transition-fast)',
              outline: selected ? '2px solid var(--amber)' : 'none',
              outlineOffset: -2,
            }}
          >
            {/* Checkbox */}
            {showCb && (
              <input
                type="checkbox"
                checked={!!selected}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(e.shiftKey);
                }}
                onChange={() => {}}
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  width: 16,
                  height: 16,
                  accentColor: 'var(--amber)',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              />
            )}

            {/* Thumbnail image with gradient fallback */}
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!imgError ? (
                <>
                  <img
                    src={previewUrl}
                    alt={photo.filename}
                    loading="lazy"
                    draggable={false}
                    onError={() => setImgError(true)}
                    onLoad={() => setImgLoaded(true)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: imgLoaded ? 1 : 0,
                      transition: 'opacity 0.2s',
                      // Sin herencia: corta el callout/selección nativo de Android
                      // sobre la <img> (el long-press ya no abre menú, ver hook).
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  />
                  {!imgLoaded && (
                    <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />
                  )}
                </>
              ) : (
                <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />
              )}
            </div>

            {/* Hover overlay */}
            {hovered && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Video badge: ▶ + duración (el tile muestra el póster ffmpeg) */}
            {(photo.mime_type || '').startsWith('video/') && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'rgba(0,0,0,0.65)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 5px',
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  color: '#fff',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '0.5rem' }}>▶</span>
                {(() => {
                  const secs = (photo.metadata as { duration_seconds?: number } | null)?.duration_seconds;
                  if (typeof secs !== 'number' || !Number.isFinite(secs)) return null;
                  const m = Math.floor(secs / 60);
                  const s = Math.floor(secs % 60);
                  return <span>{m}:{String(s).padStart(2, '0')}</span>;
                })()}
              </div>
            )}

            {/* Star badge for aesthetic score >= 3 */}
            {(() => {
              const cf = photo.custom_fields as Record<string, number> | null;
              const aiFloat = photo.metadata?.ai_aesthetic_score;
              const aiStars = aiFloat != null
                ? (aiFloat >= 0.8 ? 5 : aiFloat >= 0.6 ? 4 : aiFloat >= 0.4 ? 3 : aiFloat >= 0.2 ? 2 : 1)
                : 0;
              const stars = cf?.aesthetic_override ?? aiStars;
              if (stars < 1) return null;
              return (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    background: 'rgba(0,0,0,0.65)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 5px',
                    fontSize: '0.5625rem',
                    fontWeight: 600,
                    color: 'var(--amber)',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  {'★'.repeat(stars)}
                </div>
              );
            })()}

            {/* Processed / Unprocessed badge */}
            {!processingPhase && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.65)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 5px',
                  fontSize: '0.5rem',
                  fontWeight: 600,
                  color: photo.metadata?.ai_processed_at ? '#22c55e' : '#f59e0b',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {photo.metadata?.ai_processed_at ? 'Processed' : 'Unprocessed'}
              </div>
            )}

            {/* Source badge for non-local photos */}
            <PhotoSource entity={photo} />

            {/* Processing overlay */}
            {processingPhase && (() => {
              const isPending = processingPhase.phase === 'pending';
              const isActive = isCurrentFile && !isPending && !isPipelinePaused;
              const showPaused = isPipelinePaused && (isCurrentFile || isPending);
              const Icon = showPaused ? PauseCircle : isPending ? Clock : isActive ? Loader2 : CheckCircle2;
              const iconColor = showPaused ? '#94a3b8' : processingPhase.color;
              const spin = isPending && !isPipelinePaused
                ? 'spin 2s ease-in-out infinite'
                : isActive ? 'spin 1s linear infinite' : undefined;
              return (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  <Icon
                    size={20}
                    style={{
                      color: iconColor,
                      animation: spin,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 600,
                      color: iconColor,
                      fontFamily: 'var(--font-sans)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {showPaused ? 'Paused' : processingPhase.label}
                  </span>
                </div>
              );
            })()}
          </div>
        }
      />

      {/* Album picker dropdown */}
      {albumPicker && (
        <AlbumPickerDropdown
          open
          anchorPos={albumPicker.pos}
          albums={albums}
          title={albumPicker.mode === 'add' ? 'Add to album' : 'Set as cover'}
          onSelect={(albumId) => {
            if (albumPicker.mode === 'add') {
              onAddToAlbum(photo.id, albumId);
            } else {
              onSetAsCover(photo.id, albumId);
            }
            setAlbumPicker(null);
          }}
          onCreate={onCreateAlbum}
          onClose={() => setAlbumPicker(null)}
        />
      )}
    </>
  );
}

export function PhotosTimeline({
  photos,
  loading,
  hasMore,
  onLoadMore,
  onPhotoClick,
  onFilesDropped,
  albums,
  onAddToAlbum,
  onSetAsCover,
  onCreateAlbum,
  onViewExif,
  onProcessPhoto,
  onDeletePhoto,
  selectedIds,
  onToggleSelect,
  onSetSelection,
  onApplyDelta,
  sortField,
}: PhotosTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Elemento real del scroll para Selecto (montado tras el primer render).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const hasSelection = selectedIds.size > 0;

  // Barrido táctil (long-press + arrastre, estilo galería móvil).
  useTouchDragSelect({
    container: scrollEl,
    photoIds: photos.map((p) => p.id),
    selectedIds,
    setSelection: onSetSelection,
    enabled: isMobile,
  });

  // Compute the global index for a photo within a group
  const getGlobalIndex = useCallback((groupKey: string, localIndex: number) => {
    const groups = groupPhotos(photos, sortField);
    let globalIdx = 0;
    for (const g of groups) {
      if (g.key === groupKey) {
        return globalIdx + localIndex;
      }
      globalIdx += g.photos.length;
    }
    return 0;
  }, [photos, sortField]);

  // Infinite scroll via scroll event
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!hasMore || loading) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 300) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore]);

  const groups = groupPhotos(photos, sortField);

  if (!loading && photos.length === 0) {
    return (
      <DropZone onFilesDropped={onFilesDropped}>
        <EmptyState
          icon={Image}
          title="No photos yet"
          description="Upload photos or sync from your devices to see them here."
        />
      </DropZone>
    );
  }

  return (
    <DropZone onFilesDropped={onFilesDropped}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        ref={(el) => { scrollRef.current = el; setScrollEl(el); }}
        style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          padding: '0 16px 16px',
        }}
      >
        {groups.map((group) => (
          <div key={group.key}>
            {/* Sticky day header (oculto en orden name/size — grid plano) */}
            {group.label && (
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--amber)',
                  background: 'var(--surface)',
                  padding: '8px 16px',
                  margin: '0 -16px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {group.label}
              </div>
            )}

            {/* Photo grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? 'repeat(auto-fill, minmax(100px, 1fr))'
                  : 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 4,
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              {group.photos.map((photo, i) => (
                <PhotoThumbnail
                  key={photo.id}
                  photo={photo}
                  onClick={() => onPhotoClick(getGlobalIndex(group.key, i))}
                  albums={albums}
                  onAddToAlbum={onAddToAlbum}
                  onSetAsCover={onSetAsCover}
                  onCreateAlbum={onCreateAlbum}
                  onViewExif={onViewExif}
                  onProcessPhoto={onProcessPhoto}
                  onDelete={onDeletePhoto}
                  selected={selectedIds.has(photo.id)}
                  showCheckbox={hasSelection}
                  onToggleSelect={(shiftKey) => onToggleSelect(photo.id, shiftKey)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: 24,
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
          >
            Loading...
          </div>
        )}

        {/* Spacer for scroll trigger */}
        <div style={{ height: 1 }} />
      </div>

      {/* Marquee de escritorio (react-selecto): arrastrar desde hueco vacío
          selecciona por rectángulo; los clicks sobre tiles siguen abriendo. */}
      {!isMobile && scrollEl && (
        <Selecto
          dragContainer={scrollEl}
          selectableTargets={['[data-photo-id]']}
          hitRate={0}
          selectByClick={false}
          selectFromInside={false}
          continueSelectWithoutDeselect
          scrollOptions={{ container: scrollEl, throttleTime: 30, threshold: 30 }}
          onScroll={({ direction }) => scrollEl.scrollBy(direction[0]! * 12, direction[1]! * 12)}
          onSelect={(e) => {
            const ids = (els: (HTMLElement | SVGElement)[]) =>
              els.map((el) => (el as HTMLElement).dataset.photoId!).filter(Boolean);
            onApplyDelta(ids(e.added), ids(e.removed));
          }}
        />
      )}
    </DropZone>
  );
}
