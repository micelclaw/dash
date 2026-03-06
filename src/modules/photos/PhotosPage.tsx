import { useState, useEffect, useCallback } from 'react';
import { Image, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { usePhotos } from './hooks/use-photos';
import { useAlbums } from './hooks/use-albums';
import { useAlbumPhotos } from './hooks/use-album-photos';
import { usePhotoSelection } from './hooks/use-photo-selection';
import { usePhotoAiStore } from '@/stores/photo-ai.store';
import { usePhotoProcessingStore } from '@/stores/photo-processing.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { PhotosToolbar } from './PhotosToolbar';
import { PhotosTimeline } from './PhotosTimeline';
import { PhotosAlbums } from './PhotosAlbums';
import { PhotosPeople } from './PhotosPeople';
import { PhotosDejaVu } from './PhotosDejaVu';
import { AlbumDetail } from './AlbumDetail';
import { PhotoLightbox } from './PhotoLightbox';
import { ExifPanel } from './ExifPanel';
import { CreateAlbumDialog } from './CreateAlbumDialog';
import { EditAlbumDialog } from './EditAlbumDialog';
import { AlbumShareModal } from './AlbumShareModal';
import { AlbumPickerDropdown } from './AlbumPickerDropdown';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ShareModal } from '@/components/shared/ShareModal';
import { getPreviewUrl } from '@/lib/file-utils';
import type { PhotosView } from './types';
import type { Photo, Album } from '@/types/files';

// ─── Search Results Grid ────────────────────────────────

function SearchResultsGrid({
  results,
  loading,
  searchType,
  isPro,
  search,
  onPhotoClick,
}: {
  results: { id: string; filename: string; similarity: number; metadata: Record<string, unknown> | null; created_at: string }[];
  loading: boolean;
  searchType: 'semantic' | 'fulltext';
  isPro: boolean;
  search: string;
  onPhotoClick: (id: string) => void;
}) {
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
        Searching...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        <Image size={40} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '0.875rem' }}>No photos matching &quot;{search}&quot;</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Try a different search term</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Upsell banner for free tier */}
      {searchType === 'fulltext' && !isPro && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', margin: '12px 0 4px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)',
        }}>
          <Lock size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Upgrade to <strong style={{ color: 'var(--amber)' }}>Pro</strong> for AI-powered semantic search
          </span>
        </div>
      )}

      {/* Results grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 4,
        marginTop: 12,
      }}>
        {results.map((result) => (
          <SearchResultThumbnail
            key={result.id}
            result={result}
            showSimilarity={searchType === 'semantic'}
            onClick={() => onPhotoClick(result.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SearchResultThumbnail({
  result,
  showSimilarity,
  onClick,
}: {
  result: { id: string; filename: string; similarity: number };
  showSimilarity: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const previewUrl = getPreviewUrl(result.id, 300);

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
      }}
    >
      {!imgError ? (
        <img
          src={previewUrl}
          alt={result.filename}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s',
          }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Image size={32} style={{ opacity: 0.3, color: 'var(--text)' }} />
        </div>
      )}

      {/* Similarity badge */}
      {showSimilarity && result.similarity > 0 && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.7)', borderRadius: 'var(--radius-sm)',
          padding: '2px 5px', fontSize: '0.5625rem', fontWeight: 600,
          color: 'var(--amber)', fontFamily: 'var(--font-sans)',
          lineHeight: 1,
        }}>
          {Math.round(result.similarity * 100)}%
        </div>
      )}

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

export function Component() {
  const [view, setView] = useState<PhotosView>('timeline');
  const [search, setSearch] = useState('');
  const [selectedStars, setSelectedStars] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Best Of state
  const [bestOfCount, setBestOfCount] = useState(0);
  const [bestOfCoverId, setBestOfCoverId] = useState<string | null>(null);

  // Photo AI store
  const searchResults = usePhotoAiStore((s) => s.searchResults);
  const searchLoading = usePhotoAiStore((s) => s.searchLoading);
  const searchMeta = usePhotoAiStore((s) => s.searchMeta);
  const searchPhotosAi = usePhotoAiStore((s) => s.searchPhotos);
  const clearSearch = usePhotoAiStore((s) => s.clearSearch);
  const fetchFaceClusters = usePhotoAiStore((s) => s.fetchFaceClusters);
  const selectedClusterId = usePhotoAiStore((s) => s.selectedClusterId);
  const clusterPhotos = usePhotoAiStore((s) => s.clusterPhotos);
  const selectCluster = usePhotoAiStore((s) => s.selectCluster);
  const isPro = useAuthStore((s) => s.user?.tier === 'pro');

  // Detail panel collapse state + responsive
  const [detailsCollapsed, setDetailsCollapsed] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setDetailsCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const { photos, loading: photosLoading, hasMore, loadMore, fetchPhotos } = usePhotos({ search, selectedStars });
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

  // Auto-open ExifPanel with first photo when photos load
  useEffect(() => {
    if (!exifPhoto && photos.length > 0 && !photosLoading) {
      setExifPhoto(photos[0]);
    }
  }, [photos, photosLoading]);

  // Fetch Best Of count
  useEffect(() => {
    api.get<{ data: Photo[]; meta?: { total?: number } }>('/photos/timeline', { min_stars: 4, limit: 1 })
      .then((res) => {
        const total = res.meta?.total ?? res.data.length;
        setBestOfCount(total);
        setBestOfCoverId(res.data[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  // Fetch face clusters when switching to people view
  useEffect(() => {
    if (view === 'people') fetchFaceClusters();
  }, [view, fetchFaceClusters]);

  // Track per-photo processing progress via WebSocket
  const wsClient = useWebSocketStore((s) => s.client);
  const setFilePhase = usePhotoProcessingStore((s) => s.setFilePhase);
  const setFilesPending = usePhotoProcessingStore((s) => s.setFilesPending);
  const clearNonPending = usePhotoProcessingStore((s) => s.clearNonPending);
  const clearAllProcessing = usePhotoProcessingStore((s) => s.clearAll);
  const clearFile = usePhotoProcessingStore((s) => s.clearFile);
  const setProcessingPaused = usePhotoProcessingStore((s) => s.setPaused);
  useEffect(() => {
    if (!wsClient) return;
    const unsub0 = wsClient.on('photo.worker.batch_start', (e) => {
      const { file_ids } = e.data as { file_ids: string[] };
      setFilesPending(file_ids);
    });
    const unsub1 = wsClient.on('photo.worker.progress', (e) => {
      const { file_id, phase } = e.data as { file_id: string; phase: string };
      setFilePhase(file_id, phase);
    });
    const unsub2 = wsClient.on('photo.worker.complete', () => {
      clearNonPending();
      fetchPhotos(true);
    });
    const unsub3 = wsClient.on('photo.worker.abort', () => {
      clearAllProcessing();
    });
    const unsub4 = wsClient.on('photo.worker.photo_done', (e) => {
      const { file_id } = e.data as { file_id: string };
      clearFile(file_id);
    });
    const unsub5 = wsClient.on('photo.worker.paused', () => {
      setProcessingPaused(true);
    });
    const unsub6 = wsClient.on('photo.worker.resumed', () => {
      setProcessingPaused(false);
    });
    return () => { unsub0(); unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [wsClient, setFilesPending, setFilePhase, clearNonPending, clearAllProcessing, clearFile, setProcessingPaused, fetchPhotos]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (value.trim()) {
      searchPhotosAi(value);
    } else {
      clearSearch();
    }
  }, [searchPhotosAi, clearSearch]);

  // Re-fetch timeline when search or selectedStars changes
  useEffect(() => {
    fetchPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedStars]);

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
    selectCluster(null);
  }, [timelineSelection, albumSelection, selectCluster]);

  // ── Photo actions ──────────────────────────────────────

  const handlePhotoClick = useCallback((index: number) => {
    setLightboxIndex(index);
    const photo = activePhotos[index];
    if (photo) setExifPhoto(photo);
  }, [activePhotos]);

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
    const photo = activePhotos[index];
    if (photo) setExifPhoto(photo);
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

  const handleBatchProcess = useCallback(async () => {
    const ids = [...activeSelection.selectedIds];
    setFilesPending(ids);
    try {
      const res = await api.post('/photos/ai/reprocess-selected', { file_ids: ids }) as any;
      const data = res.data ?? res;
      toast.success(`${data.reset} photo${data.reset !== 1 ? 's' : ''} queued for processing`);
      activeSelection.clearSelection();
    } catch {
      toast.error('Failed to queue photos for processing');
    }
  }, [activeSelection, setFilesPending]);

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
  // When search is active, build Photo-like objects from search results
  const searchPhotosForLightbox: Photo[] = searchResults?.map((r) => ({
    id: r.id,
    filename: r.filename,
    filepath: '',
    mime_type: 'image/jpeg',
    size_bytes: 0,
    checksum_sha256: null,
    source: 'local',
    source_id: null,
    parent_folder: '',
    is_directory: false,
    metadata: r.metadata as Photo['metadata'],
    tags: [],
    custom_fields: null,
    created_at: r.created_at,
    updated_at: r.created_at,
    synced_at: null,
    deleted_at: null,
    taken_at: null,
    thumbnail_url: '',
  })) ?? [];

  const isClusterView = view === 'people' && !!selectedClusterId;
  const lightboxPhotos = searchResults !== null
    ? searchPhotosForLightbox
    : isClusterView && clusterPhotos
      ? clusterPhotos
      : isAlbumView
        ? albumPhotos
        : photos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PhotosToolbar
        view={view}
        onViewChange={handleViewChange}
        search={search}
        onSearchChange={handleSearchChange}
        onUpload={handleUpload}
        selectedCount={activeSelection.selectedIds.size}
        onBatchAddToAlbum={handleBatchAddToAlbum}
        onBatchProcess={handleBatchProcess}
        onBatchDelete={() => setBatchDeleteOpen(true)}
        onClearSelection={activeSelection.clearSelection}
        selectedStars={selectedStars}
        onStarsToggle={(n) => setSelectedStars(prev => {
          const s = new Set(prev);
          s.has(n) ? s.delete(n) : s.add(n);
          return s;
        })}
      />

      {/* Content + Sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          {view === 'timeline' && searchResults !== null ? (
            <SearchResultsGrid
              results={searchResults}
              loading={searchLoading}
              searchType={searchMeta?.search_type ?? 'fulltext'}
              isPro={!!isPro}
              search={search}
              onPhotoClick={(id) => {
                const idx = searchResults.findIndex((r) => r.id === id);
                if (idx >= 0) setLightboxIndex(idx);
              }}
            />
          ) : view === 'timeline' ? (
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
          ) : null}

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
              bestOfCount={bestOfCount}
              bestOfCoverId={bestOfCoverId}
              onBestOfClick={() => { setMinStars(4); setView('timeline'); }}
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

          {view === 'people' && (
            <PhotosPeople
              onPhotoClick={handlePhotoClick}
            />
          )}

          {view === 'dejavu' && (
            <PhotosDejaVu />
          )}
        </div>

        {/* ExifPanel sidebar */}
        {exifPhoto && (
          <ExifPanel
            photo={exifPhoto}
            onSaved={() => { fetchPhotos(true); if (selectedAlbumId) fetchAlbumPhotos(true); }}
            collapsed={detailsCollapsed}
            onToggleCollapse={() => setDetailsCollapsed(c => !c)}
          />
        )}
      </div>

      {/* Lightbox overlay (outside flex — fullscreen) */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          onClose={handleLightboxClose}
          onNavigate={handleLightboxNavigate}
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
