import { X, Download } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';

interface YouTubeOverlayProps {
  videoId: string;
  onClose: () => void;
}

export function YouTubeOverlay({ videoId, onClose }: YouTubeOverlayProps) {
  const startDownload = usePlayerStore((s) => s.startDownload);

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
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: '72rem', margin: '0 1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => startDownload(`https://www.youtube.com/watch?v=${videoId}`)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: 'white',
              padding: '4px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.8rem',
            }}
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={onClose}
            style={{
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
        </div>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          allowFullScreen
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, border: 0 }}
        />
      </div>
    </div>
  );
}
