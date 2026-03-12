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

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

type Mode = 'pomodoro' | 'timer' | 'stopwatch';
type Status = 'idle' | 'running' | 'paused';
type Phase = 'focus' | 'short-break' | 'long-break';

interface TimerState {
  status: Status;
  startedAt: number | null;
  pausedElapsed: number;
  duration: number;
}

const DEFAULT_FOCUS = 25 * 60 * 1000;
const DEFAULT_SHORT = 5 * 60 * 1000;
const DEFAULT_LONG = 15 * 60 * 1000;
const SESSIONS_BEFORE_LONG = 4;

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch { /* ignore audio errors */ }
}

function notifyComplete(phase: string) {
  playTone();
  if (Notification.permission === 'granted') {
    new Notification(`${phase === 'focus' ? 'Focus' : 'Break'} complete!`, {
      body: phase === 'focus' ? 'Time for a break.' : 'Ready to focus again?',
      tag: 'micelclaw-timer',
    });
  }
}

export function PomodoroTimer() {
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [timer, setTimer] = useState<TimerState>({ status: 'idle', startedAt: null, pausedElapsed: 0, duration: DEFAULT_FOCUS });
  const [displayMs, setDisplayMs] = useState(DEFAULT_FOCUS);

  // Pomodoro state
  const [phase, setPhase] = useState<Phase>('focus');
  const [session, setSession] = useState(1);
  const [focusMin, setFocusMin] = useState(25);
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(15);

  // Timer mode custom duration
  const [timerInput, setTimerInput] = useState('05:00');

  // Stopwatch laps
  const [laps, setLaps] = useState<number[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const getElapsed = useCallback((): number => {
    if (timer.status === 'running' && timer.startedAt) {
      return timer.pausedElapsed + (Date.now() - timer.startedAt);
    }
    return timer.pausedElapsed;
  }, [timer]);

  // Tick
  useEffect(() => {
    if (timer.status !== 'running') {
      clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      const elapsed = getElapsed();
      if (mode === 'stopwatch') {
        setDisplayMs(elapsed);
      } else {
        const remaining = timer.duration - elapsed;
        if (remaining <= 0) {
          setDisplayMs(0);
          // Timer complete
          setTimer({ status: 'idle', startedAt: null, pausedElapsed: 0, duration: timer.duration });
          if (mode === 'pomodoro') handlePomodoroComplete();
          else notifyComplete('timer');
          return;
        }
        setDisplayMs(remaining);
      }
    };

    intervalRef.current = setInterval(tick, 200);
    tick();
    return () => clearInterval(intervalRef.current);
  }, [timer.status, timer.startedAt, timer.duration, timer.pausedElapsed, mode, getElapsed]);

  const handlePomodoroComplete = useCallback(() => {
    notifyComplete(phase);
    if (phase === 'focus') {
      const isLong = session % SESSIONS_BEFORE_LONG === 0;
      const nextPhase: Phase = isLong ? 'long-break' : 'short-break';
      const nextDuration = isLong ? longMin * 60000 : shortMin * 60000;
      setPhase(nextPhase);
      setTimer({ status: 'running', startedAt: Date.now(), pausedElapsed: 0, duration: nextDuration });
      setDisplayMs(nextDuration);
    } else {
      setPhase('focus');
      setSession((s) => s + 1);
      const d = focusMin * 60000;
      setTimer({ status: 'running', startedAt: Date.now(), pausedElapsed: 0, duration: d });
      setDisplayMs(d);
    }
  }, [phase, session, focusMin, shortMin, longMin]);

  const start = useCallback(() => {
    if (timer.status === 'running') return;
    let duration = timer.duration;

    if (timer.status === 'idle') {
      if (mode === 'pomodoro') {
        duration = phase === 'focus' ? focusMin * 60000 : phase === 'short-break' ? shortMin * 60000 : longMin * 60000;
      } else if (mode === 'timer') {
        const parts = timerInput.split(':').map(Number);
        const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] || 0);
        duration = secs * 1000;
      } else {
        duration = 0;
      }
      setTimer({ status: 'running', startedAt: Date.now(), pausedElapsed: 0, duration });
      setDisplayMs(mode === 'stopwatch' ? 0 : duration);
    } else {
      // Resume from paused
      setTimer({ ...timer, status: 'running', startedAt: Date.now() });
    }
  }, [timer, mode, phase, focusMin, shortMin, longMin, timerInput]);

  const pause = useCallback(() => {
    if (timer.status !== 'running') return;
    setTimer({ ...timer, status: 'paused', startedAt: null, pausedElapsed: getElapsed() });
  }, [timer, getElapsed]);

  const reset = useCallback(() => {
    let d = DEFAULT_FOCUS;
    if (mode === 'pomodoro') d = focusMin * 60000;
    else if (mode === 'timer') {
      const parts = timerInput.split(':').map(Number);
      const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] || 0);
      d = secs * 1000;
    } else d = 0;

    setTimer({ status: 'idle', startedAt: null, pausedElapsed: 0, duration: d });
    setDisplayMs(mode === 'stopwatch' ? 0 : d);
    if (mode === 'pomodoro') { setPhase('focus'); setSession(1); }
    setLaps([]);
  }, [mode, focusMin, timerInput]);

  const lap = useCallback(() => {
    if (mode === 'stopwatch' && timer.status === 'running') {
      setLaps((prev) => [getElapsed(), ...prev]);
    }
  }, [mode, timer.status, getElapsed]);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setTimer({ status: 'idle', startedAt: null, pausedElapsed: 0, duration: m === 'pomodoro' ? focusMin * 60000 : 0 });
    setDisplayMs(m === 'pomodoro' ? focusMin * 60000 : m === 'stopwatch' ? 0 : 5 * 60000);
    setPhase('focus');
    setSession(1);
    setLaps([]);
  }, [focusMin]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const progress = mode !== 'stopwatch' && timer.duration > 0
    ? 1 - displayMs / timer.duration
    : 0;

  const phaseLabel = phase === 'focus' ? 'Focus' : phase === 'short-break' ? 'Short Break' : 'Long Break';
  const phaseColor = phase === 'focus' ? 'var(--mod-tools)' : phase === 'short-break' ? 'var(--success)' : 'var(--info)';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '4px 0', fontSize: '0.6875rem', fontWeight: 500,
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    background: active ? 'var(--mod-tools)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
  });

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-md)',
    cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: 12, gap: 10, fontFamily: 'var(--font-sans)',
    }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={tabStyle(mode === 'pomodoro')} onClick={() => switchMode('pomodoro')}>Pomodoro</button>
        <button style={tabStyle(mode === 'timer')} onClick={() => switchMode('timer')}>Timer</button>
        <button style={tabStyle(mode === 'stopwatch')} onClick={() => switchMode('stopwatch')}>Stopwatch</button>
      </div>

      {/* Circular display */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={80} cy={80} r={72} fill="none" stroke="var(--surface)" strokeWidth={6} />
            {mode !== 'stopwatch' && (
              <circle
                cx={80} cy={80} r={72} fill="none"
                stroke={phaseColor}
                strokeWidth={6}
                strokeDasharray={2 * Math.PI * 72}
                strokeDashoffset={2 * Math.PI * 72 * (1 - progress)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.2s ease' }}
              />
            )}
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: '2rem', fontWeight: 700,
              fontFamily: 'var(--font-mono)', color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}>
              {formatMs(displayMs)}
            </div>
            {mode === 'pomodoro' && (
              <div style={{ fontSize: '0.6875rem', color: phaseColor, fontWeight: 500 }}>
                {phaseLabel}
              </div>
            )}
          </div>
        </div>

        {/* Pomodoro session dots */}
        {mode === 'pomodoro' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: SESSIONS_BEFORE_LONG }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i < session ? 'var(--mod-tools)' : 'var(--surface)',
                  border: i < session ? 'none' : '1px solid var(--border)',
                }}
              />
            ))}
            <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)', marginLeft: 4 }}>
              Session {session} of {SESSIONS_BEFORE_LONG}
            </span>
          </div>
        )}

        {/* Timer mode input */}
        {mode === 'timer' && timer.status === 'idle' && (
          <input
            type="text"
            value={timerInput}
            onChange={(e) => {
              setTimerInput(e.target.value);
              const parts = e.target.value.split(':').map(Number);
              const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] || 0);
              setDisplayMs(secs * 1000);
            }}
            placeholder="MM:SS"
            style={{
              width: 100, textAlign: 'center',
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '4px 8px', fontSize: '0.875rem',
              fontFamily: 'var(--font-mono)', outline: 'none',
            }}
          />
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {timer.status === 'running' ? (
          <button onClick={pause} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text)' }}>
            <Pause size={16} /> Pause
          </button>
        ) : (
          <button onClick={start} style={{ ...btnBase, background: 'var(--mod-tools)', color: '#fff' }}>
            <Play size={16} /> {timer.status === 'paused' ? 'Resume' : 'Start'}
          </button>
        )}
        <button onClick={reset} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text-dim)' }}>
          <RotateCcw size={14} />
        </button>
        {mode === 'stopwatch' && timer.status === 'running' && (
          <button onClick={lap} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text)' }}>
            Lap
          </button>
        )}
        {mode === 'pomodoro' && timer.status === 'running' && (
          <button onClick={handlePomodoroComplete} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text-dim)' }}>
            <SkipForward size={14} />
          </button>
        )}
      </div>

      {/* Pomodoro settings (when idle) */}
      {mode === 'pomodoro' && timer.status === 'idle' && (
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center',
          fontSize: '0.6875rem', color: 'var(--text-dim)',
        }}>
          {[
            { label: 'Focus', value: focusMin, set: setFocusMin },
            { label: 'Short', value: shortMin, set: setShortMin },
            { label: 'Long', value: longMin, set: setLongMin },
          ].map(({ label, value, set }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {label}
              <input
                type="number"
                min={1}
                max={120}
                value={value}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1;
                  set(v);
                  if (label === 'Focus') {
                    setTimer((t) => ({ ...t, duration: v * 60000 }));
                    setDisplayMs(v * 60000);
                  }
                }}
                style={{
                  width: 36, textAlign: 'center',
                  background: 'var(--surface)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '2px 4px', fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
            </label>
          ))}
        </div>
      )}

      {/* Stopwatch laps */}
      {mode === 'stopwatch' && laps.length > 0 && (
        <div style={{
          maxHeight: 80, overflowY: 'auto',
          fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
        }}>
          {laps.map((ms, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', color: 'var(--text-dim)' }}>
              <span>Lap {laps.length - i}</span>
              <span style={{ color: 'var(--text)' }}>{formatMs(ms)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
