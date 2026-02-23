import { useState } from 'react';
import { ChevronLeft, Share2, Trash2, Image, Mail } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { simpleHash } from '@/lib/file-utils';
import type { Album, Photo } from '@/types/files';

interface AlbumDetailProps {
  album: Album;
  photos: Photo[];
  onBack: () => void;
  onDelete: (albumId: string) => void;
  onPhotoClick: (index: number) => void;
}

function AlbumPhotoThumbnail({
  photo,
  onClick,
}: {
  photo: Photo;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hue = simpleHash(photo.id) % 360;

  return (
    <div
      onClick={onClick}
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
      }}
    >
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
        <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />
      </div>

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
  );
}

export function AlbumDetail({
  album,
  photos,
  onBack,
  onDelete,
  onPhotoClick,
}: AlbumDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          onMouseEnter={() => setHoveredBtn('back')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: hoveredBtn === 'back' ? 'var(--surface-hover)' : 'transparent',
            color: 'var(--text)',
            transition: 'background var(--transition-fast)',
          }}
        >
          <ChevronLeft size={16} />
          {album.name}
        </button>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Share (disabled) */}
        <button
          disabled
          style={actionBtnStyle('share', { disabled: true })}
          onMouseEnter={() => setHoveredBtn('share')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          <Share2 size={12} />
          Share
        </button>

        {/* Delete */}
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
      </div>

      {/* Photo grid (no month grouping) */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: 16,
        }}
      >
        {photos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            This album is empty.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 4,
            }}
          >
            {photos.map((photo, i) => (
              <AlbumPhotoThumbnail
                key={photo.id}
                photo={photo}
                onClick={() => onPhotoClick(i)}
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
