import { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { simpleHash } from '@/lib/file-utils';
import type { Album } from '@/types/files';

interface PhotosAlbumsProps {
  albums: Album[];
  loading: boolean;
  onAlbumClick: (albumId: string) => void;
  onCreateAlbum: (name: string) => void;
}

function AlbumCard({
  album,
  onClick,
}: {
  album: Album;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hue = simpleHash(album.id) % 360;

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
        }}
      >
        <Camera size={36} style={{ opacity: 0.3, color: 'var(--text)' }} />
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
  );
}

function NewAlbumCard({ onCreateAlbum }: { onCreateAlbum: (name: string) => void }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    const name = window.prompt('Album name:');
    if (name?.trim()) {
      onCreateAlbum(name.trim());
    }
  };

  return (
    <div
      onClick={handleClick}
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
  onCreateAlbum,
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
              onClick: () => {
                const name = window.prompt('Album name:');
                if (name?.trim()) onCreateAlbum(name.trim());
              },
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
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => onAlbumClick(album.id)}
            />
          ))}
          <NewAlbumCard onCreateAlbum={onCreateAlbum} />
        </div>
      )}
    </div>
  );
}
