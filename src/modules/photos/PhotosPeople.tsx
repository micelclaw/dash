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

import { useState, useCallback, useEffect, useRef } from 'react';
import { Users, ArrowLeft, Pencil, Trash2, Image, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { api } from '@/services/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { getPreviewUrl, getFaceCropUrl } from '@/lib/file-utils';
import { usePhotoAiStore, type FaceCluster } from '@/stores/photo-ai.store';
import { ContactLinkDialog } from './ContactLinkDialog';
import { useDndFaceMerge } from './hooks/use-dnd-face-merge';

interface PhotosPeopleProps {
  onPhotoClick: (index: number) => void;
}

function ClusterCard({
  cluster,
  onClick,
  onRename,
  onMerge,
  onDelete,
  onLinkContact,
  allClusters,
}: {
  cluster: FaceCluster;
  onClick: () => void;
  onRename: (name: string) => void;
  onMerge: (targetClusterId: string) => void;
  onDelete: () => void;
  onLinkContact: () => void;
  allClusters: FaceCluster[];
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cluster.name ?? '');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      setHighlightIdx(-1);
    }
  }, [editing]);

  // Autocomplete suggestions: named clusters that match the current input
  const suggestions = editing && editValue.trim().length > 0
    ? allClusters.filter(
        (c) => c.id !== cluster.id && c.name &&
          c.name.toLowerCase().startsWith(editValue.trim().toLowerCase()),
      )
    : [];

  const handleSubmitName = () => {
    // If a suggestion is highlighted, merge instead of rename
    if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
      const target = suggestions[highlightIdx];
      if (target) handleMergeSuggestion(target);
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== cluster.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleMergeSuggestion = (target: FaceCluster) => {
    setEditing(false);
    onMerge(target.id);
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
    ? getFaceCropUrl(cluster.id)
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
            {/* Hover overlay: link contact button */}
            {hovered && !editing && (
              <button
                onClick={(e) => { e.stopPropagation(); onLinkContact(); }}
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: cluster.linked_contact_id ? 'var(--green, #22c55e)' : 'var(--amber)',
                  border: '2px solid var(--card, #1a1a1a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: 2,
                }}
                title={cluster.linked_contact_id ? 'Change linked contact' : 'Link to contact'}
              >
                <UserPlus size={12} style={{ color: '#000' }} />
              </button>
            )}
            {/* Linked indicator (always visible) */}
            {!hovered && cluster.linked_contact_id && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--green, #22c55e)',
                  border: '2px solid var(--card, #1a1a1a)',
                  zIndex: 2,
                }}
              />
            )}
          </div>

          {/* Name */}
          {editing ? (
            <div style={{ position: 'relative', width: '100%' }} onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => { setEditValue(e.target.value); setHighlightIdx(-1); }}
                onBlur={(e) => {
                  // Delay to allow dropdown click to fire first
                  if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
                  handleSubmitName();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightIdx((i) => Math.max(i - 1, -1));
                  } else if (e.key === 'Enter') {
                    handleSubmitName();
                  } else if (e.key === 'Escape') {
                    setEditing(false);
                  }
                }}
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
              {suggestions.length > 0 && (
                <div
                  ref={dropdownRef}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: 2,
                    maxHeight: 160,
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      onMouseDown={(e) => { e.preventDefault(); handleMergeSuggestion(s); }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '4px 8px',
                        border: 'none',
                        background: i === highlightIdx ? 'var(--surface-hover)' : 'transparent',
                        color: 'var(--text)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6875rem' }}>
                        {s.photo_count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: cluster.name ? 'var(--text)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                cursor: 'text',
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

function DraggableClusterCard(props: {
  cluster: FaceCluster;
  allClusters: FaceCluster[];
  isDropTarget: boolean;
  isDragging: boolean;
  onClick: () => void;
  onRename: (name: string) => void;
  onMerge: (targetClusterId: string) => void;
  onDelete: () => void;
  onLinkContact: () => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging: dndDragging } = useDraggable({ id: props.cluster.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: props.cluster.id });

  const ref = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);

  const showDropTarget = (props.isDropTarget || isOver) && !props.isDragging;

  return (
    <div
      ref={ref}
      {...listeners}
      {...attributes}
      style={{
        opacity: props.isDragging || dndDragging ? 0.4 : 1,
        boxShadow: showDropTarget ? '0 0 0 3px var(--amber)' : 'none',
        borderRadius: 'var(--radius-md)',
        transform: showDropTarget ? 'scale(1.05)' : undefined,
        transition: 'box-shadow 0.15s, transform 0.15s, opacity 0.15s',
      }}
    >
      <ClusterCard
        cluster={props.cluster}
        allClusters={props.allClusters}
        onClick={props.onClick}
        onRename={props.onRename}
        onMerge={props.onMerge}
        onDelete={props.onDelete}
        onLinkContact={props.onLinkContact}
      />
    </div>
  );
}

function ClusterCardPreview({ cluster }: { cluster: FaceCluster }) {
  const previewUrl = cluster.representative_file_id ? getFaceCropUrl(cluster.id) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.85 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)', border: '2px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {previewUrl ? (
          <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Users size={24} style={{ opacity: 0.3, color: 'var(--text)' }} />
        )}
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        {cluster.name ?? '???'}
      </span>
    </div>
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
  const mergeFaceClusters = usePhotoAiStore((s) => s.mergeFaceClusters);
  const linkFaceToContact = usePhotoAiStore((s) => s.linkFaceToContact);
  const deleteFaceCluster = usePhotoAiStore((s) => s.deleteFaceCluster);

  const [linkDialogCluster, setLinkDialogCluster] = useState<FaceCluster | null>(null);
  const selectedCluster = faceClusters?.find((c) => c.id === selectedClusterId) ?? null;

  // DnD for merging clusters
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { activeId, overId, onDragStart, onDragOver, onDragEnd, onDragCancel } = useDndFaceMerge();
  const draggedCluster = faceClusters?.find((c) => c.id === activeId) ?? null;

  const handleRename = useCallback(async (clusterId: string, name: string) => {
    try {
      await renameFaceCluster(clusterId, name);
      toast.success('Cluster renamed');
    } catch {
      toast.error('Failed to rename cluster');
    }
  }, [renameFaceCluster]);

  const handleMerge = useCallback(async (targetId: string, sourceId: string) => {
    try {
      await mergeFaceClusters(targetId, sourceId);
      toast.success('Clusters merged');
    } catch {
      toast.error('Failed to merge clusters');
    }
  }, [mergeFaceClusters]);

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

  const handleCreateAndLink = useCallback(async (clusterId: string, displayName: string) => {
    try {
      const res = await api.post<{ data: { id: string } }>('/contacts', { display_name: displayName });
      const contactId = res.data?.id;
      if (contactId) {
        await linkFaceToContact(clusterId, contactId);
        toast.success(`Contact "${displayName}" created and linked`);
      }
    } catch {
      toast.error('Failed to create contact');
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {faceClusters.map((cluster) => (
            <DraggableClusterCard
              key={cluster.id}
              cluster={cluster}
              allClusters={faceClusters}
              isDropTarget={overId === cluster.id && activeId !== cluster.id}
              isDragging={activeId === cluster.id}
              onClick={() => selectCluster(cluster.id)}
              onRename={(name) => handleRename(cluster.id, name)}
              onMerge={(targetId) => handleMerge(targetId, cluster.id)}
              onDelete={() => handleDelete(cluster.id)}
              onLinkContact={() => setLinkDialogCluster(cluster)}
            />
          ))}
        </div>
        <DragOverlay>
          {draggedCluster && <ClusterCardPreview cluster={draggedCluster} />}
        </DragOverlay>
      </DndContext>

      <ContactLinkDialog
        open={linkDialogCluster !== null}
        clusterName={linkDialogCluster?.name ?? null}
        linkedContactId={linkDialogCluster?.linked_contact_id ?? null}
        onClose={() => setLinkDialogCluster(null)}
        onLink={(contactId) => linkDialogCluster && handleLinkContact(linkDialogCluster.id, contactId)}
        onUnlink={() => linkDialogCluster && handleUnlinkContact(linkDialogCluster.id)}
        onCreateAndLink={(name) => linkDialogCluster && handleCreateAndLink(linkDialogCluster.id, name)}
      />
    </div>
  );
}
