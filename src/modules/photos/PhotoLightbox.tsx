import { useEffect, useCallback, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image } from 'lucide-react';
import { simpleHash, formatFileSize } from '@/lib/file-utils';
import { formatDateShort, formatTime } from '@/lib/date-helpers';
import type { Photo } from '@/types/files';

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

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
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

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

  if (!photo) return null;

  const hue = simpleHash(photo.id) % 360;
  const dateObj = photo.taken_at ? new Date(photo.taken_at) : new Date(photo.created_at);
  const camera = photo.metadata?.camera;
  const gps = photo.metadata?.gps;

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
          right: 16,
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
          transition: 'background var(--transition-fast)',
        }}
      >
        <X size={18} />
      </button>

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

        {/* Photo display (gradient placeholder with filename) */}
        <div
          style={{
            maxWidth: '90vw',
            maxHeight: '75vh',
            aspectRatio: photo.metadata?.width && photo.metadata?.height
              ? `${photo.metadata.width} / ${photo.metadata.height}`
              : '4 / 3',
            width: '100%',
            maxInlineSize: 900,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
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

      {/* Info bar */}
      <div
        style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <InfoChip label={photo.filename} />
        <InfoChip label={formatFileSize(photo.size_bytes)} />
        {camera && <InfoChip label={camera} />}
        <InfoChip label={`${formatDateShort(dateObj)} ${formatTime(dateObj)}`} />
        {gps && <InfoChip label={`${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`} />}
        {photo.tags.length > 0 && <InfoChip label={photo.tags.join(', ')} />}
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
