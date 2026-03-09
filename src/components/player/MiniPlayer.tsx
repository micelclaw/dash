import { X, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';
import { PlaybackControls } from './PlaybackControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { TrackInfo } from './TrackInfo';
import { QueuePanel } from './QueuePanel';

export function MiniPlayer() {
  const stop = usePlayerStore((s) => s.stop);
  const queuePanelOpen = usePlayerStore((s) => s.queuePanelOpen);
  const toggleQueuePanel = usePlayerStore((s) => s.toggleQueuePanel);
  const queue = usePlayerStore((s) => s.queue);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          minHeight: 48,
        }}
      >
        <PlaybackControls />
        <TrackInfo />
        <ProgressBar />
        <VolumeControl />

        {queue.length > 0 && (
          <button
            onClick={toggleQueuePanel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              color: queuePanelOpen ? 'var(--accent)' : 'var(--text-muted)',
            }}
            title="Queue"
          >
            <ListMusic size={15} />
          </button>
        )}

        <button
          onClick={stop}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            color: 'var(--text-muted)',
          }}
          title="Close player"
        >
          <X size={14} />
        </button>
      </div>

      {queuePanelOpen && <QueuePanel />}
    </div>
  );
}
