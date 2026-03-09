import { SkipBack, Play, Pause, SkipForward } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';

export function PlaybackControls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button onClick={playPrev} style={btnStyle} title="Previous">
        <SkipBack size={16} />
      </button>
      <button
        onClick={isPlaying ? pause : resume}
        style={{ ...btnStyle, padding: 6 }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button onClick={playNext} style={btnStyle} title="Next">
        <SkipForward size={16} />
      </button>
    </div>
  );
}
