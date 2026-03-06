import { useState, useCallback, useEffect, useRef } from 'react';
import { Users, ArrowLeft, Pencil, Trash2, Image, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { getPreviewUrl } from '@/lib/file-utils';
import { usePhotoAiStore, type FaceCluster } from '@/stores/photo-ai.store';
import { ContactLinkDialog } from './ContactLinkDialog';

interface PhotosPeopleProps {
  onPhotoClick: (index: number) => void;
}

function ClusterCard({
  cluster,
  onClick,
  onRename,
  onDelete,
  onLinkContact,
}: {
  cluster: FaceCluster;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onLinkContact: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cluster.name ?? '');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSubmitName = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== cluster.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const contextItems: ContextMenuItem[] = [
    { label: 'Rename', icon: Pencil, onClick: () => setEditing(true) },
    {
      label: cluster.linked_contact_id ? 'Change Contact' : 'Link Contact',
      icon: UserPlus,
      onClick: onLinkContact,
    },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  const previewUrl = cluster.representative_file_id
    ? getPreviewUrl(cluster.representative_file_id, 300)
    : null;

  return (
    <ContextMenu
      trigger={
        <div
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            background: hovered ? 'var(--surface-hover)' : 'transparent',
            transition: 'background var(--transition-fast)',
          }}
        >
          {/* Circular face thumbnail */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '2px solid var(--border)',
            }}
          >
            {previewUrl && !imgError ? (
              <>
                <img
                  src={previewUrl}
                  alt={cluster.name ?? 'Face'}
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
                {!imgLoaded && (
                  <Users size={28} style={{ opacity: 0.3, color: 'var(--text)' }} />
                )}
              </>
            ) : (
              <Users size={28} style={{ opacity: 0.3, color: 'var(--text)' }} />
            )}
          </div>

          {/* Name */}
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitName();
                if (e.key === 'Escape') setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                textAlign: 'center',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                background: 'var(--surface)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                padding: '2px 6px',
                outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={(e) => {
                if (!cluster.name) {
                  e.stopPropagation();
                  setEditing(true);
                }
              }}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: cluster.name ? 'var(--text)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                cursor: cluster.name ? 'pointer' : 'text',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cluster.name ?? '???'}
            </span>
          )}

          {/* Photo count + linked indicator */}
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {cluster.photo_count} photo{cluster.photo_count !== 1 ? 's' : ''}
            {cluster.linked_contact_id && (
              <span style={{ color: 'var(--amber)', marginLeft: 4 }}> (linked)</span>
            )}
          </span>
        </div>
      }
      items={contextItems}
    />
  );
}

function ClusterDetail({
  cluster,
  onBack,
  onPhotoClick,
  onRename,
}: {
  cluster: FaceCluster;
  onBack: () => void;
  onPhotoClick: (index: number) => void;
  onRename: (name: string) => void;
}) {
  const clusterPhotos = usePhotoAiStore((s) => s.clusterPhotos);
  const clusterPhotosLoading = usePhotoAiStore((s) => s.clusterPhotosLoading);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cluster.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSubmitName = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== cluster.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitName();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              background: 'var(--surface)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              padding: '2px 8px',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              cursor: 'text',
            }}
          >
            {cluster.name ?? '???'}
          </span>
        )}
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {cluster.photo_count} photo{cluster.photo_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Photo grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {clusterPhotosLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Loading...
          </div>
        ) : clusterPhotos && clusterPhotos.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 4,
            }}
          >
            {clusterPhotos.map((photo, i) => (
              <ClusterPhotoThumb key={photo.id} photo={photo} onClick={() => onPhotoClick(i)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No photos in this cluster.
          </div>
        )}
      </div>
    </div>
  );
}

function ClusterPhotoThumb({ photo, onClick }: { photo: { id: string; filename: string }; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

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
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!imgError ? (
        <>
          <img
            src={getPreviewUrl(photo.id, 300)}
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
  );
}

export function PhotosPeople({ onPhotoClick }: PhotosPeopleProps) {
  const faceClusters = usePhotoAiStore((s) => s.faceClusters);
  const faceClustersLoading = usePhotoAiStore((s) => s.faceClustersLoading);
  const selectedClusterId = usePhotoAiStore((s) => s.selectedClusterId);
  const selectCluster = usePhotoAiStore((s) => s.selectCluster);
  const renameFaceCluster = usePhotoAiStore((s) => s.renameFaceCluster);
  const linkFaceToContact = usePhotoAiStore((s) => s.linkFaceToContact);
  const deleteFaceCluster = usePhotoAiStore((s) => s.deleteFaceCluster);

  const [linkDialogCluster, setLinkDialogCluster] = useState<FaceCluster | null>(null);
  const selectedCluster = faceClusters?.find((c) => c.id === selectedClusterId) ?? null;

  const handleRename = useCallback(async (clusterId: string, name: string) => {
    try {
      await renameFaceCluster(clusterId, name);
      toast.success('Cluster renamed');
    } catch {
      toast.error('Failed to rename cluster');
    }
  }, [renameFaceCluster]);

  const handleDelete = useCallback(async (clusterId: string) => {
    try {
      await deleteFaceCluster(clusterId);
      toast.success('Cluster deleted');
    } catch {
      toast.error('Failed to delete cluster');
    }
  }, [deleteFaceCluster]);

  const handleLinkContact = useCallback(async (clusterId: string, contactId: string) => {
    try {
      await linkFaceToContact(clusterId, contactId);
      toast.success('Contact linked');
    } catch {
      toast.error('Failed to link contact');
    }
  }, [linkFaceToContact]);

  const handleUnlinkContact = useCallback(async (clusterId: string) => {
    try {
      await linkFaceToContact(clusterId, null);
      toast.success('Contact unlinked');
    } catch {
      toast.error('Failed to unlink contact');
    }
  }, [linkFaceToContact]);

  // Show cluster detail if a cluster is selected
  if (selectedCluster) {
    return (
      <ClusterDetail
        cluster={selectedCluster}
        onBack={() => selectCluster(null)}
        onPhotoClick={onPhotoClick}
        onRename={(name) => handleRename(selectedCluster.id, name)}
      />
    );
  }

  // Loading state
  if (faceClustersLoading && !faceClusters) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Loading face clusters...
      </div>
    );
  }

  // Empty state
  if (!faceClusters || faceClusters.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <EmptyState
          icon={Users}
          title="No faces detected yet"
          description="Face detection runs automatically on your photos. Check back later."
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        {faceClusters.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            onClick={() => selectCluster(cluster.id)}
            onRename={(name) => handleRename(cluster.id, name)}
            onDelete={() => handleDelete(cluster.id)}
            onLinkContact={() => setLinkDialogCluster(cluster)}
          />
        ))}
      </div>

      <ContactLinkDialog
        open={linkDialogCluster !== null}
        clusterName={linkDialogCluster?.name ?? null}
        linkedContactId={linkDialogCluster?.linked_contact_id ?? null}
        onClose={() => setLinkDialogCluster(null)}
        onLink={(contactId) => linkDialogCluster && handleLinkContact(linkDialogCluster.id, contactId)}
        onUnlink={() => linkDialogCluster && handleUnlinkContact(linkDialogCluster.id)}
      />
    </div>
  );
}
