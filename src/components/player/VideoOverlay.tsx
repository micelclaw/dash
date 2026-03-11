import { X } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function VideoOverlay() {
  const currentItem = usePlayerStore((s) => s.currentItem);
  const videoOverlayVisible = usePlayerStore((s) => s.videoOverlayVisible);
  const closeVideoOverlay = usePlayerStore((s) => s.closeVideoOverlay);

  if (!videoOverlayVisible || !currentItem || currentItem.mediaType !== 'video') {
    return null;
  }

  const token = useAuthStore.getState().tokens?.accessToken;
  const streamUrl = currentItem.streamUrl.startsWith('http')
    ? `${currentItem.streamUrl}?token=${token}`
    : `${BASE_URL}/api/v1${currentItem.streamUrl}?token=${token}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-video-overlay, 350)' as any,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={closeVideoOverlay}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: '72rem', margin: '0 1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeVideoOverlay}
          style={{
            position: 'absolute',
            top: -36,
            right: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.85rem',
          }}
        >
          <X size={16} /> Close
        </button>
        <video
          src={streamUrl}
          controls
          autoPlay
          preload="metadata"
          style={{ width: '100%', borderRadius: 8 }}
        />
        <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
          {currentItem.title}
        </div>
      </div>
    </div>
  );
}
