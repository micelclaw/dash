import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { usePhotos } from './hooks/use-photos';
import { useAlbums } from './hooks/use-albums';
import { PhotosToolbar } from './PhotosToolbar';
import { PhotosTimeline } from './PhotosTimeline';
import { PhotosAlbums } from './PhotosAlbums';
import { AlbumDetail } from './AlbumDetail';
import { PhotoLightbox } from './PhotoLightbox';
import type { PhotosView } from './types';

export function Component() {
  const [view, setView] = useState<PhotosView>('timeline');
  const [search, setSearch] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { photos, loading: photosLoading, hasMore, loadMore, fetchPhotos } = usePhotos({ search });
  const { albums, loading: albumsLoading, createAlbum, deleteAlbum } = useAlbums();

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

  const handleUpload = useCallback((_files: File[]) => {
    // In a real app, we would upload files via api.upload
    toast.success(`${_files.length} photo${_files.length !== 1 ? 's' : ''} queued for upload`);
  }, []);

  const handleAlbumClick = useCallback((albumId: string) => {
    setSelectedAlbumId(albumId);
  }, []);

  const handleAlbumBack = useCallback(() => {
    setSelectedAlbumId(null);
  }, []);

  const handleAlbumDelete = useCallback(async (albumId: string) => {
    await deleteAlbum(albumId);
    setSelectedAlbumId(null);
  }, [deleteAlbum]);

  const handleCreateAlbum = useCallback(async (name: string) => {
    await createAlbum(name);
  }, [createAlbum]);

  const handlePhotoClick = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const selectedAlbum = selectedAlbumId ? albums.find(a => a.id === selectedAlbumId) : null;

  // When viewing album detail and viewing photos, toggle back view
  const handleViewChange = useCallback((newView: PhotosView) => {
    setView(newView);
    setSelectedAlbumId(null);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PhotosToolbar
        view={view}
        onViewChange={handleViewChange}
        search={search}
        onSearchChange={handleSearchChange}
        onUpload={handleUpload}
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
        />
      )}

      {view === 'albums' && !selectedAlbum && (
        <PhotosAlbums
          albums={albums}
          loading={albumsLoading}
          onAlbumClick={handleAlbumClick}
          onCreateAlbum={handleCreateAlbum}
        />
      )}

      {view === 'albums' && selectedAlbum && (
        <AlbumDetail
          album={selectedAlbum}
          photos={photos}
          onBack={handleAlbumBack}
          onDelete={handleAlbumDelete}
          onPhotoClick={handlePhotoClick}
        />
      )}

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={handleLightboxClose}
          onNavigate={handleLightboxNavigate}
        />
      )}
    </div>
  );
}
