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

import { ArrowLeft, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';
import { PlaybackControls } from './PlaybackControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { Music } from 'lucide-react';

interface MobileNowPlayingProps {
  onClose: () => void;
}

export function MobileNowPlaying({ onClose }: MobileNowPlayingProps) {
  const currentItem = usePlayerStore((s) => s.currentItem);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);

  if (!currentItem) return null;

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 400)' as any,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
      }}
    >
      {/* Header */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          padding: 0,
          marginBottom: 24,
        }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      {/* Cover art */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentItem.coverBase64 ? (
          <img
            src={currentItem.coverBase64}
            alt=""
            style={{ width: '80%', maxWidth: 300, aspectRatio: '1', borderRadius: 12, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '80%',
              maxWidth: 300,
              aspectRatio: '1',
              borderRadius: 12,
              background: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Music size={64} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>

      {/* Track info */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{currentItem.title}</div>
        {currentItem.artist && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 4 }}>{currentItem.artist}</div>
        )}
      </div>

      {/* Progress */}
      <ProgressBar />

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, margin: '16px 0' }}>
        <PlaybackControls />
      </div>

      {/* Extras */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 12 }}>
        <button
          onClick={toggleShuffle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            color: shuffle ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          <Shuffle size={18} />
        </button>
        <VolumeControl />
        <button
          onClick={cycleRepeat}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            color: repeat !== 'none' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          <RepeatIcon size={18} />
        </button>
      </div>

      {/* Mini queue */}
      {queue.length > 1 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {queueIndex + 1} of {queue.length} in queue
        </div>
      )}
    </div>
  );
}
