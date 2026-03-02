import { useEffect, useCallback, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { simpleHash, formatFileSize, getPreviewUrl } from '@/lib/file-utils';
import { formatDateShort, formatTime } from '@/lib/date-helpers';
import { usePhotoAiStore } from '@/stores/photo-ai.store';
import { useAuthStore } from '@/stores/auth.store';
import { StarRating } from './StarRating';
import { SimilarPhotosPanel } from './SimilarPhotosPanel';
import type { Photo } from '@/types/files';

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onUpdatePhoto?: (photo: Photo) => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  onUpdatePhoto,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Photo AI state
  const similarPanelOpen = usePhotoAiStore((s) => s.similarPanelOpen);
  const fetchSimilar = usePhotoAiStore((s) => s.fetchSimilar);
  const closeSimilarPanel = usePhotoAiStore((s) => s.closeSimilarPanel);
  const isPro = useAuthStore((s) => s.user?.tier === 'pro');

  // Touch/swipe support
  const pointerStartX = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (similarPanelOpen) closeSimilarPanel();
        else onClose();
      }
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext, similarPanelOpen, closeSimilarPanel]);

  // Close similar panel on unmount
  useEffect(() => {
    return () => closeSimilarPanel();
  }, [closeSimilarPanel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) goPrev();
      else goNext();
    }
    pointerStartX.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0]!.clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]!.clientX;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  // Reset image state when photo changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [photo?.id]);

  // Star override handlers
  const handleSetStars = useCallback(async (id: string, value: number) => {
    try {
      await api.patch(`/files/${id}`, { custom_fields: { aesthetic_override: value } });
      toast.success(`Rating set to ${value} stars`);
      onUpdatePhoto?.({ ...photos[currentIndex]!, custom_fields: { ...photos[currentIndex]!.custom_fields, aesthetic_override: value } });
    } catch {
      toast.error('Failed to update rating');
    }
  }, [currentIndex, photos, onUpdatePhoto]);

  const handleResetStars = useCallback(async (id: string) => {
    try {
      await api.patch(`/files/${id}`, { custom_fields: { aesthetic_override: null } });
      toast.success('Rating reset to AI score');
      const cf = { ...photos[currentIndex]!.custom_fields };
      delete cf.aesthetic_override;
      onUpdatePhoto?.({ ...photos[currentIndex]!, custom_fields: cf });
    } catch {
      toast.error('Failed to reset rating');
    }
  }, [currentIndex, photos, onUpdatePhoto]);

  const handleFindSimilar = useCallback(() => {
    if (!photo) return;
    if (!isPro) {
      toast.error('Similar Photos is a Pro feature');
      return;
    }
    fetchSimilar(photo.id);
  }, [photo, isPro, fetchSimilar]);

  const handleNavigateToSimilar = useCallback((targetId: string) => {
    const idx = photos.findIndex((p) => p.id === targetId);
    if (idx >= 0) {
      onNavigate(idx);
    }
  }, [photos, onNavigate]);

  if (!photo) return null;

  const hue = simpleHash(photo.id) % 360;
  const previewUrl = getPreviewUrl(photo.id, 1200);
  const dateObj = photo.taken_at ? new Date(photo.taken_at) : new Date(photo.created_at);
  const camera = photo.metadata?.camera;
  const gps = photo.metadata?.gps;

  const cf = photo.custom_fields as Record<string, number> | null;
  const aestheticStars = cf?.aesthetic_override ?? cf?.aesthetic_stars ?? 0;
  const hasOverride = cf?.aesthetic_override != null;

  const navBtnStyle = (id: string, disabled: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: 'none',
    background: hoveredBtn === id && !disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
    color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-fast)',
    flexShrink: 0,
  });

  const actionBtnStyle = (id: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: hoveredBtn === id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.6875rem',
    fontFamily: 'var(--font-sans)',
    transition: 'background var(--transition-fast)',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        onMouseEnter={() => setHoveredBtn('close')}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          position: 'absolute',
          top: 16,
          right: similarPanelOpen ? 296 : 16,
          zIndex: 51,
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: hoveredBtn === 'close' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--transition-fast), right 0.2s',
        }}
      >
        <X size={18} />
      </button>

      {/* Main layout: photo area + optional similar panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Photo area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Main content area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '48px 16px 0',
              minHeight: 0,
            }}
          >
            {/* Prev arrow */}
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              onMouseEnter={() => setHoveredBtn('prev')}
              onMouseLeave={() => setHoveredBtn(null)}
              disabled={currentIndex === 0}
              style={navBtnStyle('prev', currentIndex === 0)}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Photo display */}
            <div
              style={{
                maxWidth: similarPanelOpen ? '70vw' : '90vw',
                maxHeight: '75vh',
                aspectRatio: photo.metadata?.width && photo.metadata?.height
                  ? `${photo.metadata.width} / ${photo.metadata.height}`
                  : '4 / 3',
                width: '100%',
                maxInlineSize: similarPanelOpen ? 700 : 900,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                position: 'relative',
                transition: 'max-width 0.2s, max-inline-size 0.2s',
              }}
            >
              {!imgError ? (
                <>
                  <img
                    src={previewUrl}
                    alt={photo.filename}
                    onError={() => setImgError(true)}
                    onLoad={() => setImgLoaded(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      opacity: imgLoaded ? 1 : 0,
                      transition: 'opacity 0.2s',
                    }}
                  />
                  {!imgLoaded && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Image size={56} style={{ opacity: 0.25, color: '#fff' }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Image size={56} style={{ opacity: 0.25, color: '#fff' }} />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'rgba(255,255,255,0.4)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {photo.filename}
                  </span>
                </>
              )}
            </div>

            {/* Next arrow */}
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              onMouseEnter={() => setHoveredBtn('next')}
              onMouseLeave={() => setHoveredBtn(null)}
              disabled={currentIndex === photos.length - 1}
              style={navBtnStyle('next', currentIndex === photos.length - 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 24px 0',
              flexShrink: 0,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleFindSimilar(); }}
              onMouseEnter={() => setHoveredBtn('similar')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={actionBtnStyle('similar')}
            >
              <Search size={12} /> Find similar
            </button>
          </div>

          {/* Info bar */}
          <div
            style={{
              padding: '8px 24px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <InfoChip label={photo.filename} />
            {aestheticStars > 0 && (
              <StarRating
                value={aestheticStars}
                onChange={(v) => handleSetStars(photo.id, v)}
                showValue
                isOverride={hasOverride}
                onReset={hasOverride ? () => handleResetStars(photo.id) : undefined}
                size={14}
              />
            )}
            {photo.size_bytes > 0 && <InfoChip label={formatFileSize(photo.size_bytes)} />}
            {camera && <InfoChip label={camera} />}
            <InfoChip label={`${formatDateShort(dateObj)} ${formatTime(dateObj)}`} />
            {gps && <InfoChip label={`${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`} />}
            {photo.tags?.length > 0 && <InfoChip label={photo.tags.join(', ')} />}
          </div>
        </div>

        {/* Similar photos panel */}
        {similarPanelOpen && (
          <SimilarPhotosPanel onNavigateToPhoto={handleNavigateToSimilar} />
        )}
      </div>
    </div>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
