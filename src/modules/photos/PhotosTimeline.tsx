import { useEffect, useRef, useState, useCallback } from 'react';
import { Image, Mail, FolderPlus, Info, Download, ImageIcon, Trash2 } from 'lucide-react';
import { DropZone } from '@/components/shared/DropZone';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { useIsMobile } from '@/hooks/use-media-query';
import { simpleHash, getPreviewUrl } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import { formatMonthYear } from '@/lib/date-helpers';
import type { Photo, Album } from '@/types/files';
import type { PhotoGroup } from './types';
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
  onDeletePhoto: (photoId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
}

function groupPhotosByMonth(photos: Photo[]): PhotoGroup[] {
  const map = new Map<string, Photo[]>();

  for (const photo of photos) {
    const dateStr = photo.taken_at || photo.created_at;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(photo);
    } else {
      map.set(key, [photo]);
    }
  }

  const groups: PhotoGroup[] = [];
  for (const [key, groupPhotos] of map) {
    const [year, month] = key.split('-');
    const label = formatMonthYear(new Date(Number(year), Number(month!) - 1));
    groups.push({ key, label, photos: groupPhotos });
  }

  groups.sort((a, b) => b.key.localeCompare(a.key));
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
          { label: 'View EXIF', icon: Info, onClick: () => onViewExif(photo) },
          { label: 'Download', icon: Download, onClick: () => downloadFile(photo.id, photo.filename) },
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
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName === 'INPUT') return;
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

            {/* Source badge for non-local photos */}
            {photo.source !== 'local' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Mail size={10} style={{ color: 'var(--text-dim)' }} />
              </div>
            )}
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
  onDeletePhoto,
  selectedIds,
  onToggleSelect,
}: PhotosTimelineProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const hasSelection = selectedIds.size > 0;

  // Compute the global index for a photo within a group
  const getGlobalIndex = useCallback((groupKey: string, localIndex: number) => {
    const groups = groupPhotosByMonth(photos);
    let globalIdx = 0;
    for (const g of groups) {
      if (g.key === groupKey) {
        return globalIdx + localIndex;
      }
      globalIdx += g.photos.length;
    }
    return 0;
  }, [photos]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  const groups = groupPhotosByMonth(photos);

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
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '0 16px 16px',
        }}
      >
        {groups.map((group) => (
          <div key={group.key}>
            {/* Sticky month header */}
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

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </DropZone>
  );
}
