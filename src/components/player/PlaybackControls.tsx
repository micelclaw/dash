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

import { SkipBack, Play, Pause, SkipForward } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';
import { useI18n } from '@/i18n';

export function PlaybackControls() {
  const { t } = useI18n();
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
      <button onClick={playPrev} style={btnStyle} title={t('player.previous')} aria-label={t('player.previous')}>
        <SkipBack size={16} />
      </button>
      <button
        onClick={isPlaying ? pause : resume}
        style={{ ...btnStyle, padding: 6 }}
        title={isPlaying ? t('player.pause') : t('player.play')}
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button onClick={playNext} style={btnStyle} title={t('player.next')} aria-label={t('player.next')}>
        <SkipForward size={16} />
      </button>
    </div>
  );
}
