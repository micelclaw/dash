import { useState } from 'react';
import {
  ChevronLeft, Share2, Trash2, Pencil, Image, Mail,
  FolderMinus, Info, Download, ImageIcon, X, Star,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { simpleHash, getPreviewUrl } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import { formatDateShort } from '@/lib/date-helpers';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import type { Album, Photo } from '@/types/files';

interface AlbumDetailProps {
  album: Album;
  photos: Photo[];
  loading?: boolean;
  onBack: () => void;
  onDelete: (albumId: string) => void;
  onPhotoClick: (index: number) => void;
  onShareAlbum: () => void;
  onEditAlbum: () => void;
  onRemoveFromAlbum: (fileId: string) => void;
  onViewExif: (photo: Photo) => void;
  onDeletePhoto: (photoId: string) => void;
  onSetAsCover: (photoId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onBatchRemove?: () => void;
  onBatchDelete?: () => void;
  onClearSelection?: () => void;
}

function AlbumPhotoThumbnail({
  photo,
  albumId,
  onClick,
  onRemove,
  onViewExif,
  onDelete,
  onSetAsCover,
  selected,
  showCheckbox,
  onToggleSelect,
}: {
  photo: Photo;
  albumId: string;
  onClick: () => void;
  onRemove: () => void;
  onViewExif: (photo: Photo) => void;
  onDelete: (photoId: string) => void;
  onSetAsCover: (photoId: string) => void;
  selected?: boolean;
  showCheckbox?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hue = simpleHash(photo.id) % 360;
  const previewUrl = getPreviewUrl(photo.id, 300);

  const showCb = showCheckbox || hovered || selected;

  return (
    <EntityContextMenu
      entityType="photo"
      entityId={photo.id}
      entityTitle={photo.filename || 'Photo'}
      onDelete={() => onDelete(photo.id)}
      extraItems={[
        { label: 'Remove from album', icon: FolderMinus, onClick: onRemove },
        { label: 'View details', icon: Info, onClick: () => onViewExif(photo) },
        { label: 'Download', icon: Download, onClick: () => downloadFile(photo.id, photo.filename) },
        { label: 'Set as cover', icon: ImageIcon, onClick: () => onSetAsCover(photo.id) },
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
          {showCb && (
            <input
              type="checkbox"
              checked={!!selected}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(e.shiftKey); }}
              onChange={() => {}}
              style={{
                position: 'absolute', top: 6, left: 6, width: 16, height: 16,
                accentColor: 'var(--amber)', cursor: 'pointer', zIndex: 2,
              }}
            />
          )}

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
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s',
                  }}
                />
                {!imgLoaded && <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />}
              </>
            ) : (
              <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />
            )}
          </div>

          {hovered && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
              pointerEvents: 'none',
            }} />
          )}

          {photo.source !== 'local' && (
            <div style={{
              position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)',
              borderRadius: 'var(--radius-sm)', padding: '2px 4px', display: 'flex', alignItems: 'center',
            }}>
              <Mail size={10} style={{ color: 'var(--text-dim)' }} />
            </div>
          )}
        </div>
      }
    />
  );
}

function BatchButton({ icon: Icon, label, onClick, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  const [hovered, setHovered] = useState(false);
  const color = variant === 'danger' ? 'var(--error)' : 'var(--text)';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        color, fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

export function AlbumDetail({
  album,
  photos,
  loading,
  onBack,
  onDelete,
  onPhotoClick,
  onShareAlbum,
  onEditAlbum,
  onRemoveFromAlbum,
  onViewExif,
  onDeletePhoto,
  onSetAsCover,
  selectedIds,
  onToggleSelect,
  onBatchRemove,
  onBatchDelete,
  onClearSelection,
}: AlbumDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [coverImgLoaded, setCoverImgLoaded] = useState(false);
  const [coverImgError, setCoverImgError] = useState(false);
  const isMobile = useIsMobile();

  const hue = simpleHash(album.id) % 360;
  const hasSelection = selectedIds.size > 0;
  const dateStr = album.created_at ? formatDateShort(new Date(album.created_at)) : '';

  const actionBtnStyle = (
    id: string,
    opts?: { disabled?: boolean },
  ): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-sans)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: opts?.disabled ? 'not-allowed' : 'pointer',
    background: hoveredBtn === id && !opts?.disabled ? 'var(--surface-hover)' : 'transparent',
    color: opts?.disabled ? 'var(--text-muted)' : 'var(--text-dim)',
    opacity: opts?.disabled ? 0.5 : 1,
    transition: 'background var(--transition-fast)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button
          onClick={onBack}
          onMouseEnter={() => setHoveredBtn('back')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            fontWeight: 500, border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: hoveredBtn === 'back' ? 'var(--surface-hover)' : 'transparent',
            color: 'var(--text-dim)',
            transition: 'background var(--transition-fast)',
            marginBottom: 12,
          }}
        >
          <ChevronLeft size={16} />
          Back to Albums
        </button>

        {/* Album info row */}
        <div style={{ display: 'flex', gap: 16, alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
          {/* Cover photo */}
          <div style={{
            width: isMobile ? 80 : 120,
            height: isMobile ? 60 : 90,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            flexShrink: 0,
            background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            {album.cover_photo_id && !coverImgError ? (
              <img
                src={getPreviewUrl(album.cover_photo_id, 400)}
                alt=""
                onLoad={() => setCoverImgLoaded(true)}
                onError={() => setCoverImgError(true)}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', opacity: coverImgLoaded ? 1 : 0, transition: 'opacity 0.2s',
                }}
              />
            ) : null}
            {(!album.cover_photo_id || coverImgError || !coverImgLoaded) && (
              <Image size={24} style={{ opacity: 0.3, color: 'var(--text)' }} />
            )}
          </div>

          {/* Title + metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              margin: 0, fontSize: '1.125rem', fontWeight: 600,
              color: 'var(--text)', fontFamily: 'var(--font-sans)',
            }}>
              {album.name}
            </h2>
            {album.description && (
              <p style={{
                margin: '2px 0 0', fontSize: '0.8125rem',
                color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
              }}>
                {album.description}
              </p>
            )}
            <div style={{
              display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap',
              fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
            }}>
              {dateStr && <span>{dateStr}</span>}
              <span>{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {hasSelection ? (
              <>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                  {selectedIds.size} selected
                </span>
                {onBatchRemove && <BatchButton icon={FolderMinus} label="Remove" onClick={onBatchRemove} />}
                {onBatchDelete && <BatchButton icon={Trash2} label="Delete" onClick={onBatchDelete} variant="danger" />}
                {onClearSelection && (
                  <button
                    onClick={onClearSelection}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', background: 'transparent',
                      color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                    Clear
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onShareAlbum}
                  onMouseEnter={() => setHoveredBtn('share')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={actionBtnStyle('share')}
                >
                  <Share2 size={12} />
                  Share
                </button>
                <button
                  onClick={onEditAlbum}
                  onMouseEnter={() => setHoveredBtn('edit')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={actionBtnStyle('edit')}
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  onMouseEnter={() => setHoveredBtn('delete')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    ...actionBtnStyle('delete'),
                    borderColor: hoveredBtn === 'delete' ? 'var(--error)' : 'var(--border)',
                    color: hoveredBtn === 'delete' ? 'var(--error)' : 'var(--text-dim)',
                  }}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Photo grid */}
      <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Loading...
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            This album is empty.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'repeat(auto-fill, minmax(100px, 1fr))'
              : 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 4,
          }}>
            {photos.map((photo, i) => (
              <AlbumPhotoThumbnail
                key={photo.id}
                photo={photo}
                albumId={album.id}
                onClick={() => onPhotoClick(i)}
                onRemove={() => onRemoveFromAlbum(photo.id)}
                onViewExif={onViewExif}
                onDelete={onDeletePhoto}
                onSetAsCover={(photoId) => onSetAsCover(photoId)}
                selected={selectedIds.has(photo.id)}
                showCheckbox={hasSelection}
                onToggleSelect={(shiftKey) => onToggleSelect(photo.id, shiftKey)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => onDelete(album.id)}
        title="Delete album?"
        description={`"${album.name}" will be permanently deleted. Photos inside will not be removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
