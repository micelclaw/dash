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

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, Gauge, Headphones, Moon, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useBooksStore } from '@/stores/books.store';
import { usePlayerStore } from '@/stores/player.store';
import { audioCoverUrl, type AudioItemDetail } from '@/services/books.service';
import { formatClock, formatTotalDuration } from '../lib/format';

const SPEED_OPTIONS = [0.8, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];

const selectStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-sans)',
  padding: '4px 8px',
  cursor: 'pointer',
};

/**
 * Audiobook detail panel: cover + metadata, Play/Resume into the global
 * player, playback-speed picker, sleep timer and the chapter list with
 * live current-chapter highlight (click to seek across tracks).
 */
export function AudiobookDetail({ detail }: { detail: AudioItemDetail }) {
  const closeAudiobook = useBooksStore((s) => s.closeAudiobook);
  const playAudiobook = useBooksStore((s) => s.playAudiobook);
  const jumpToPosition = useBooksStore((s) => s.jumpToPosition);
  const listItem = useBooksStore((s) => s.audioItems.find((i) => i.id === detail.id));

  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const currentItem = usePlayerStore((s) => s.currentItem);
  const playerTime = usePlayerStore((s) => s.currentTime);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const [coverError, setCoverError] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sleep timer: pause the global player after N minutes; cleared on change/unmount.
  useEffect(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (sleepMinutes > 0) {
      sleepTimerRef.current = setTimeout(() => {
        usePlayerStore.getState().pause();
        setSleepMinutes(0);
        toast('Sleep timer — playback paused');
      }, sleepMinutes * 60_000);
    }
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [sleepMinutes]);

  const playingThis = currentItem?.source === 'abs' && currentItem.fileId.startsWith(`${detail.id}:`);
  const bookPosition = playingThis ? (currentItem?.trackStartOffset ?? 0) + playerTime : null;
  const currentChapterId =
    bookPosition != null
      ? detail.chapters.find((c) => bookPosition >= c.start && bookPosition < c.end)?.id ?? null
      : null;

  const resumeTime = listItem?.progress?.current_time ?? 0;
  const playLabel = playingThis ? (isPlaying ? 'Playing' : 'Resume') : resumeTime > 0 ? 'Resume' : 'Play';

  const handlePlay = () => {
    if (playingThis) {
      if (!isPlaying) usePlayerStore.getState().resume();
      return;
    }
    void playAudiobook(detail);
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-sans)' }}>
      {/* Back */}
      <button
        onClick={closeAudiobook}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          padding: '2px 0',
          marginBottom: 14,
        }}
      >
        <ChevronLeft size={14} />
        Back to audiobooks
      </button>

      {/* Header: cover + meta + controls */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 180,
            height: 180,
            flexShrink: 0,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!coverError ? (
            <img
              src={audioCoverUrl(detail.id)}
              alt=""
              onError={() => setCoverError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Headphones size={48} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
            {detail.title}
          </h2>
          {detail.author && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{detail.author}</div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatTotalDuration(detail.duration_seconds)}
            {detail.chapters.length > 0 && ` · ${detail.chapters.length} chapters`}
            {resumeTime > 0 && !listItem?.progress?.is_finished && (
              <> · at {formatClock(resumeTime)}</>
            )}
          </div>

          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handlePlay}
              disabled={playingThis && isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'var(--amber)',
                color: '#06060a',
                fontWeight: 600,
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: playingThis && isPlaying ? 'default' : 'pointer',
                opacity: playingThis && isPlaying ? 0.6 : 1,
              }}
            >
              <Play size={14} fill="currentColor" />
              {playLabel}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <Gauge size={13} />
              <select
                value={String(playbackRate)}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                title="Playback speed"
                style={selectStyle}
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s} value={String(s)}>{s}×</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <Moon size={13} />
              <select
                value={String(sleepMinutes)}
                onChange={(e) => setSleepMinutes(Number(e.target.value))}
                title="Sleep timer"
                style={selectStyle}
              >
                {SLEEP_OPTIONS.map((o) => (
                  <option key={o.value} value={String(o.value)}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {detail.description && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: 'var(--text-dim)',
                maxWidth: 640,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {detail.description}
            </p>
          )}
        </div>
      </div>

      {/* Chapters */}
      {detail.chapters.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Chapters
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {detail.chapters.map((chapter) => {
              const isCurrent = chapter.id === currentChapterId;
              return (
                <button
                  key={chapter.id}
                  onClick={() => {
                    if (detail.tracks.length === 0) {
                      toast.error('This audiobook has no playable tracks');
                      return;
                    }
                    void jumpToPosition(detail, chapter.start);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: isCurrent ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: isCurrent ? 'var(--amber)' : 'transparent',
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.8125rem',
                      color: isCurrent ? 'var(--text)' : 'var(--text-dim)',
                      fontWeight: isCurrent ? 600 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {chapter.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {formatClock(chapter.start)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
