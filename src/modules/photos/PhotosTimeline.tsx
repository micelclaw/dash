import { useEffect, useRef, useState, useCallback } from 'react';
import { Image, Mail, FolderPlus, Info, Download, ImageIcon } from 'lucide-react';
import { DropZone } from '@/components/shared/DropZone';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { useIsMobile } from '@/hooks/use-media-query';
import { simpleHash } from '@/lib/file-utils';
import { formatMonthYear } from '@/lib/date-helpers';
import { toast } from 'sonner';
import type { Photo } from '@/types/files';
import type { PhotoGroup } from './types';

interface PhotosTimelineProps {
  photos: Photo[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPhotoClick: (index: number) => void;
  onFilesDropped: (files: File[]) => void;
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
}: {
  photo: Photo;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hue = simpleHash(photo.id) % 360;

  return (
    <EntityContextMenu
      entityType="photo"
      entityId={photo.id}
      entityTitle={photo.filename || 'Photo'}
      onEdit={onClick}
      extraItems={[
        { label: 'Add to album', icon: FolderPlus, onClick: () => toast.info('Add to album — coming soon') },
        { label: 'View EXIF', icon: Info, onClick: () => toast.info('View EXIF — coming soon') },
        { label: 'Download', icon: Download, onClick: () => toast.info('Download — coming soon') },
        { label: 'Set as cover', icon: ImageIcon, onClick: () => toast.info('Set as cover — coming soon') },
      ]}
      trigger={
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
          {/* Gradient placeholder */}
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
  );
}

export function PhotosTimeline({
  photos,
  loading,
  hasMore,
  onLoadMore,
  onPhotoClick,
  onFilesDropped,
}: PhotosTimelineProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
