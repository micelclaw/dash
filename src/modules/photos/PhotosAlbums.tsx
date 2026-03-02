import { useState } from 'react';
import { Camera, Plus, Pencil, Upload, Share2, Trash2, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { simpleHash, getPreviewUrl } from '@/lib/file-utils';
import type { Album } from '@/types/files';

interface PhotosAlbumsProps {
  albums: Album[];
  loading: boolean;
  onAlbumClick: (albumId: string) => void;
  onCreateAlbumClick: () => void;
  onEditAlbum: (album: Album) => void;
  onRequestFiles: (album: Album) => void;
  onShareAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  bestOfCount?: number;
  bestOfCoverId?: string | null;
  onBestOfClick?: () => void;
}

function AlbumCard({
  album,
  onClick,
  onEdit,
  onRequestFiles,
  onShare,
  onDelete,
}: {
  album: Album;
  onClick: () => void;
  onEdit: () => void;
  onRequestFiles: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hue = simpleHash(album.id) % 360;

  const contextItems: ContextMenuItem[] = [
    { label: 'Edit', icon: Pencil, onClick: onEdit },
    { label: 'Request files', icon: Upload, onClick: onRequestFiles },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Share', icon: Share2, onClick: onShare },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  return (
    <ContextMenu
      trigger={
        <div
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            cursor: 'pointer',
            background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
            boxShadow: hovered ? 'var(--shadow-md)' : 'none',
            transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
          }}
        >
          {/* Cover area */}
          <div
            style={{
              height: 160,
              background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {album.cover_photo_id && !imgError ? (
              <img
                src={getPreviewUrl(album.cover_photo_id, 400)}
                alt=""
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
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
            ) : null}
            {(!album.cover_photo_id || imgError || !imgLoaded) && (
              <Camera size={36} style={{ opacity: 0.3, color: 'var(--text)' }} />
            )}
          </div>

          {/* Info */}
          <div style={{ padding: '10px 12px' }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {album.name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-sans)',
                marginTop: 2,
              }}
            >
              {album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      }
      items={contextItems}
    />
  );
}

function BestOfAlbumCard({ count, coverId, onClick }: { count: number; coverId: string | null; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: 'pointer',
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        border: '2px solid var(--amber)',
        transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
      }}
    >
      {/* Cover area */}
      <div
        style={{
          height: 160,
          background: 'linear-gradient(135deg, hsl(40, 50%, 22%), hsl(30, 45%, 16%))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {coverId && !imgError ? (
          <img
            src={getPreviewUrl(coverId, 400)}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
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
        ) : null}
        {(!coverId || imgError || !imgLoaded) && (
          <Sparkles size={36} style={{ opacity: 0.4, color: 'var(--amber)' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={13} style={{ color: 'var(--amber)' }} />
          Best Of
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--amber)',
            fontFamily: 'var(--font-sans)',
            marginTop: 2,
          }}
        >
          {count} photo{count !== 1 ? 's' : ''} · Auto-generated
        </div>
      </div>
    </div>
  );
}

function NewAlbumCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--radius-md)',
        border: '2px dashed var(--border)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 210,
        gap: 8,
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background var(--transition-fast)',
      }}
    >
      <Plus size={28} style={{ color: 'var(--text-muted)' }} />
      <span
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
        }}
      >
        New Album
      </span>
    </div>
  );
}

export function PhotosAlbums({
  albums,
  loading,
  onAlbumClick,
  onCreateAlbumClick,
  onEditAlbum,
  onRequestFiles,
  onShareAlbum,
  onDeleteAlbum,
  bestOfCount = 0,
  bestOfCoverId,
  onBestOfClick,
}: PhotosAlbumsProps) {
  if (!loading && albums.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <EmptyState
          icon={Camera}
          title="No albums"
          description="Create albums to organize your photos."
          actions={[
            {
              label: 'Create Album',
              variant: 'primary',
              onClick: onCreateAlbumClick,
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        overflowY: 'auto',
        flex: 1,
        padding: 16,
      }}
    >
      {loading ? (
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
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {bestOfCount > 0 && onBestOfClick && (
            <BestOfAlbumCard count={bestOfCount} coverId={bestOfCoverId ?? null} onClick={onBestOfClick} />
          )}
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => onAlbumClick(album.id)}
              onEdit={() => onEditAlbum(album)}
              onRequestFiles={() => onRequestFiles(album)}
              onShare={() => onShareAlbum(album)}
              onDelete={() => onDeleteAlbum(album)}
            />
          ))}
          <NewAlbumCard onClick={onCreateAlbumClick} />
        </div>
      )}
    </div>
  );
}
