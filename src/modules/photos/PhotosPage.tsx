import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { usePhotos } from './hooks/use-photos';
import { useAlbums } from './hooks/use-albums';
import { useAlbumPhotos } from './hooks/use-album-photos';
import { usePhotoSelection } from './hooks/use-photo-selection';
import { PhotosToolbar } from './PhotosToolbar';
import { PhotosTimeline } from './PhotosTimeline';
import { PhotosAlbums } from './PhotosAlbums';
import { AlbumDetail } from './AlbumDetail';
import { PhotoLightbox } from './PhotoLightbox';
import { ExifPanel } from './ExifPanel';
import { CreateAlbumDialog } from './CreateAlbumDialog';
import { EditAlbumDialog } from './EditAlbumDialog';
import { AlbumShareModal } from './AlbumShareModal';
import { AlbumPickerDropdown } from './AlbumPickerDropdown';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ShareModal } from '@/components/shared/ShareModal';
import type { PhotosView } from './types';
import type { Photo, Album } from '@/types/files';

export function Component() {
  const [view, setView] = useState<PhotosView>('timeline');
  const [search, setSearch] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Modal/panel state
  const [exifPhoto, setExifPhoto] = useState<Photo | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchAlbumPicker, setBatchAlbumPicker] = useState<{ x: number; y: number } | null>(null);
  const [sharePhoto, setSharePhoto] = useState<Photo | null>(null);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [editAlbum, setEditAlbum] = useState<Album | null>(null);
  const [shareAlbum, setShareAlbum] = useState<Album | null>(null);
  const [requestFilesAlbum, setRequestFilesAlbum] = useState<Album | null>(null);
  const [deleteAlbumConfirm, setDeleteAlbumConfirm] = useState<Album | null>(null);
  // Batch remove from album
  const [batchRemoveOpen, setBatchRemoveOpen] = useState(false);

  const { photos, loading: photosLoading, hasMore, loadMore, fetchPhotos } = usePhotos({ search });
  const {
    albums, loading: albumsLoading,
    createAlbum, deleteAlbum,
    addPhotosToAlbum, removePhotoFromAlbum,
    setAlbumCover, updateAlbum,
  } = useAlbums();

  // Album photos (only when viewing a specific album)
  const {
    photos: albumPhotos,
    loading: albumPhotosLoading,
    fetchPhotos: fetchAlbumPhotos,
  } = useAlbumPhotos(selectedAlbumId);

  // Multi-select
  const timelineSelection = usePhotoSelection(photos);
  const albumSelection = usePhotoSelection(albumPhotos);

  // Use the right selection depending on view
  const isAlbumView = view === 'albums' && !!selectedAlbumId;
  const activeSelection = isAlbumView ? albumSelection : timelineSelection;
  const activePhotos = isAlbumView ? albumPhotos : photos;

  // Initial load
  useEffect(() => {
    fetchPhotos(true);
  }, [fetchPhotos]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  // Re-fetch when search changes
  useEffect(() => {
    fetchPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleUpload = useCallback(async (incoming: File[]) => {
    let success = 0;
    for (const file of incoming) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('parent_folder', '/Photos');
        await api.upload('/files/upload', formData);
        success++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (success > 0) {
      toast.success(`${success} photo${success !== 1 ? 's' : ''} uploaded`);
      fetchPhotos(true);
      if (selectedAlbumId) fetchAlbumPhotos(true);
    }
  }, [fetchPhotos, selectedAlbumId, fetchAlbumPhotos]);

  const handleAlbumClick = useCallback((albumId: string) => {
    setSelectedAlbumId(albumId);
    albumSelection.clearSelection();
  }, [albumSelection]);

  const handleAlbumBack = useCallback(() => {
    setSelectedAlbumId(null);
    albumSelection.clearSelection();
  }, [albumSelection]);

  const handleViewChange = useCallback((newView: PhotosView) => {
    setView(newView);
    setSelectedAlbumId(null);
    timelineSelection.clearSelection();
    albumSelection.clearSelection();
  }, [timelineSelection, albumSelection]);

  // ── Photo actions ──────────────────────────────────────

  const handlePhotoClick = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleAddToAlbum = useCallback(async (photoId: string, albumId: string) => {
    try {
      await addPhotosToAlbum(albumId, [photoId]);
    } catch {
      toast.error('Failed to add to album');
    }
  }, [addPhotosToAlbum]);

  const handleSetAsCover = useCallback(async (photoId: string, albumId: string) => {
    try {
      await setAlbumCover(albumId, photoId);
    } catch {
      toast.error('Failed to set cover');
    }
  }, [setAlbumCover]);

  const handleCreateAlbumInline = useCallback(async (name: string): Promise<Album> => {
    return await createAlbum(name);
  }, [createAlbum]);

  const handleDeletePhoto = useCallback(async () => {
    if (!deletePhotoId) return;
    try {
      await api.delete(`/files/${deletePhotoId}`);
      toast.success('Photo deleted');
      setDeletePhotoId(null);
      fetchPhotos(true);
      if (selectedAlbumId) fetchAlbumPhotos(true);
    } catch {
      toast.error('Failed to delete photo');
    }
  }, [deletePhotoId, fetchPhotos, selectedAlbumId, fetchAlbumPhotos]);

  const handleRemoveFromAlbum = useCallback(async (fileId: string) => {
    if (!selectedAlbumId) return;
    try {
      await removePhotoFromAlbum(selectedAlbumId, fileId);
      fetchAlbumPhotos(true);
    } catch {
      toast.error('Failed to remove from album');
    }
  }, [selectedAlbumId, removePhotoFromAlbum, fetchAlbumPhotos]);

  const handleSetAsCoverForCurrentAlbum = useCallback(async (photoId: string) => {
    if (!selectedAlbumId) return;
    try {
      await setAlbumCover(selectedAlbumId, photoId);
    } catch {
      toast.error('Failed to set cover');
    }
  }, [selectedAlbumId, setAlbumCover]);

  // ── Batch actions ──────────────────────────────────────

  const handleBatchAddToAlbum = useCallback(() => {
    setBatchAlbumPicker({ x: window.innerWidth / 2 - 110, y: 80 });
  }, []);

  const handleBatchAddSelect = useCallback(async (albumId: string) => {
    const ids = [...activeSelection.selectedIds];
    setBatchAlbumPicker(null);
    try {
      await addPhotosToAlbum(albumId, ids);
      activeSelection.clearSelection();
    } catch {
      toast.error('Failed to add to album');
    }
  }, [activeSelection, addPhotosToAlbum]);

  const handleBatchDelete = useCallback(async () => {
    const ids = [...activeSelection.selectedIds];
    setBatchDeleteOpen(false);
    try {
      for (const id of ids) {
        await api.delete(`/files/${id}`);
      }
      toast.success(`${ids.length} photo${ids.length !== 1 ? 's' : ''} deleted`);
      activeSelection.clearSelection();
      fetchPhotos(true);
      if (selectedAlbumId) fetchAlbumPhotos(true);
    } catch {
      toast.error('Failed to delete photos');
    }
  }, [activeSelection, fetchPhotos, selectedAlbumId, fetchAlbumPhotos]);

  const handleBatchRemoveFromAlbum = useCallback(async () => {
    if (!selectedAlbumId) return;
    const ids = [...albumSelection.selectedIds];
    setBatchRemoveOpen(false);
    try {
      for (const id of ids) {
        await removePhotoFromAlbum(selectedAlbumId, id);
      }
      toast.success(`${ids.length} photo${ids.length !== 1 ? 's' : ''} removed from album`);
      albumSelection.clearSelection();
      fetchAlbumPhotos(true);
    } catch {
      toast.error('Failed to remove photos');
    }
  }, [selectedAlbumId, albumSelection, removePhotoFromAlbum, fetchAlbumPhotos]);

  // ── Album actions ──────────────────────────────────────

  const handleCreateAlbumDialog = useCallback(async (data: { name: string; description?: string }) => {
    await createAlbum(data.name, data.description);
  }, [createAlbum]);

  const handleEditAlbumConfirm = useCallback(async (albumId: string, data: { name: string; description?: string }) => {
    try {
      await updateAlbum(albumId, data);
    } catch {
      toast.error('Failed to update album');
    }
  }, [updateAlbum]);

  const handleDeleteAlbumConfirm = useCallback(async () => {
    if (!deleteAlbumConfirm) return;
    await deleteAlbum(deleteAlbumConfirm.id);
    if (selectedAlbumId === deleteAlbumConfirm.id) {
      setSelectedAlbumId(null);
    }
    setDeleteAlbumConfirm(null);
  }, [deleteAlbumConfirm, deleteAlbum, selectedAlbumId]);

  const selectedAlbum = selectedAlbumId ? albums.find(a => a.id === selectedAlbumId) : null;

  // Determine which photos to show in lightbox
  const lightboxPhotos = isAlbumView ? albumPhotos : photos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PhotosToolbar
        view={view}
        onViewChange={handleViewChange}
        search={search}
        onSearchChange={handleSearchChange}
        onUpload={handleUpload}
        selectedCount={view === 'timeline' ? timelineSelection.selectedIds.size : 0}
        onBatchAddToAlbum={handleBatchAddToAlbum}
        onBatchDelete={() => setBatchDeleteOpen(true)}
        onClearSelection={timelineSelection.clearSelection}
      />

      {/* Content */}
      {view === 'timeline' && (
        <PhotosTimeline
          photos={photos}
          loading={photosLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onPhotoClick={handlePhotoClick}
          onFilesDropped={handleUpload}
          albums={albums}
          onAddToAlbum={handleAddToAlbum}
          onSetAsCover={handleSetAsCover}
          onCreateAlbum={handleCreateAlbumInline}
          onViewExif={(photo) => setExifPhoto(photo)}
          onDeletePhoto={(id) => setDeletePhotoId(id)}
          selectedIds={timelineSelection.selectedIds}
          onToggleSelect={timelineSelection.toggleSelection}
        />
      )}

      {view === 'albums' && !selectedAlbum && (
        <PhotosAlbums
          albums={albums}
          loading={albumsLoading}
          onAlbumClick={handleAlbumClick}
          onCreateAlbumClick={() => setCreateAlbumOpen(true)}
          onEditAlbum={(album) => setEditAlbum(album)}
          onRequestFiles={(album) => setRequestFilesAlbum(album)}
          onShareAlbum={(album) => setShareAlbum(album)}
          onDeleteAlbum={(album) => setDeleteAlbumConfirm(album)}
        />
      )}

      {view === 'albums' && selectedAlbum && (
        <AlbumDetail
          album={selectedAlbum}
          photos={albumPhotos}
          loading={albumPhotosLoading}
          onBack={handleAlbumBack}
          onDelete={async (albumId) => { await deleteAlbum(albumId); setSelectedAlbumId(null); }}
          onPhotoClick={handlePhotoClick}
          onShareAlbum={() => setShareAlbum(selectedAlbum)}
          onEditAlbum={() => setEditAlbum(selectedAlbum)}
          onRemoveFromAlbum={handleRemoveFromAlbum}
          onViewExif={(photo) => setExifPhoto(photo)}
          onDeletePhoto={(id) => setDeletePhotoId(id)}
          onSetAsCover={handleSetAsCoverForCurrentAlbum}
          selectedIds={albumSelection.selectedIds}
          onToggleSelect={albumSelection.toggleSelection}
          onBatchRemove={() => setBatchRemoveOpen(true)}
          onBatchDelete={() => setBatchDeleteOpen(true)}
          onClearSelection={albumSelection.clearSelection}
        />
      )}

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          onClose={handleLightboxClose}
          onNavigate={handleLightboxNavigate}
        />
      )}

      {/* EXIF panel */}
      {exifPhoto && (
        <ExifPanel
          photo={exifPhoto}
          onClose={() => setExifPhoto(null)}
          onSaved={() => { fetchPhotos(true); if (selectedAlbumId) fetchAlbumPhotos(true); }}
        />
      )}

      {/* Share photo modal */}
      {sharePhoto && (
        <ShareModal
          open
          file={sharePhoto}
          onClose={() => setSharePhoto(null)}
        />
      )}

      {/* Delete photo confirm */}
      <ConfirmDialog
        open={!!deletePhotoId}
        onClose={() => setDeletePhotoId(null)}
        onConfirm={handleDeletePhoto}
        title="Delete photo?"
        description="This photo will be moved to trash."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Batch delete confirm */}
      <ConfirmDialog
        open={batchDeleteOpen}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={handleBatchDelete}
        title={`Delete ${activeSelection.selectedIds.size} photos?`}
        description="Selected photos will be moved to trash."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Batch remove from album confirm */}
      <ConfirmDialog
        open={batchRemoveOpen}
        onClose={() => setBatchRemoveOpen(false)}
        onConfirm={handleBatchRemoveFromAlbum}
        title={`Remove ${albumSelection.selectedIds.size} photos from album?`}
        description="Photos will be removed from this album but not deleted."
        confirmLabel="Remove"
        variant="warning"
      />

      {/* Batch album picker */}
      {batchAlbumPicker && (
        <AlbumPickerDropdown
          open
          anchorPos={batchAlbumPicker}
          albums={albums}
          title="Add to album"
          onSelect={handleBatchAddSelect}
          onCreate={handleCreateAlbumInline}
          onClose={() => setBatchAlbumPicker(null)}
        />
      )}

      {/* Create album dialog */}
      <CreateAlbumDialog
        open={createAlbumOpen}
        onClose={() => setCreateAlbumOpen(false)}
        onConfirm={handleCreateAlbumDialog}
      />

      {/* Edit album dialog */}
      <EditAlbumDialog
        open={!!editAlbum}
        album={editAlbum}
        onClose={() => setEditAlbum(null)}
        onConfirm={handleEditAlbumConfirm}
      />

      {/* Share album modal */}
      <AlbumShareModal
        open={!!shareAlbum}
        album={shareAlbum}
        onClose={() => setShareAlbum(null)}
      />

      {/* Request files modal */}
      <AlbumShareModal
        open={!!requestFilesAlbum}
        album={requestFilesAlbum}
        onClose={() => setRequestFilesAlbum(null)}
        requestMode
      />

      {/* Delete album confirm */}
      <ConfirmDialog
        open={!!deleteAlbumConfirm}
        onClose={() => setDeleteAlbumConfirm(null)}
        onConfirm={handleDeleteAlbumConfirm}
        title="Delete album?"
        description={deleteAlbumConfirm ? `"${deleteAlbumConfirm.name}" will be permanently deleted. Photos inside will not be removed.` : ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
