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

// ─── Full-Duplex Voice Stream Hook ──────────────────────────────────
// Hold-to-talk: records audio in segments (2-5s, cut on silence),
// sends each to server for STT, and plays TTS audio responses.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { WsEvent } from '@/types/websocket';

export type VoiceStreamState = 'idle' | 'listening' | 'processing' | 'speaking';

// ─── Debug ──────────────────────────────────────────────────────────

const VOICE_DEBUG = import.meta.env.DEV;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vdbg = (tag: string, ...args: any[]) => {
  if (VOICE_DEBUG) {
    const now = new Date();
    const ts = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[${ts}][${tag}]`, ...args);
  }
};

// ─── Configuration ──────────────────────────────────────────────────

const MIN_SEGMENT_MS = 2500;       // Don't cut before 2.5s
const MAX_SEGMENT_MS = 6000;       // Force cut at 6s even if no silence
const SILENCE_THRESHOLD = 0.01;    // RMS below this = silence
const SILENCE_DURATION_MS = 300;   // 300ms of consecutive silence = confirmed pause
const VAD_INTERVAL_MS = 50;        // Check RMS every 50ms

export function useVoiceStream() {
  const [state, setState] = useState<VoiceStreamState>('idle');
  const [transcript, setTranscript] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);

  // Audio input
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // VAD for silence-based segment cutting
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentStartRef = useRef(0);            // When current segment started
  const silenceStartRef = useRef<number | null>(null); // When silence started (null = speaking)

  // MediaRecorder for capturing speech segments
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TTS playback
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Cleanup refs
  const cleanupRef = useRef<Array<() => void>>([]);
  const sendSegmentRef = useRef<() => void>(() => {});

  // ─── WS helpers ─────────────────────────────────────────────────

  const send = useCallback((action: string, data?: Record<string, unknown>) => {
    useWebSocketStore.getState().send(action, data);
  }, []);

  // ─── AudioContext TTS Playback ──────────────────────────────────

  const playNext = useCallback(() => {
    const ctx = playbackCtxRef.current;
    const queue = playbackQueueRef.current;

    if (!ctx || queue.length === 0) {
      isPlayingRef.current = false;
      if (queue.length === 0 && state === 'speaking') {
        setState((s) => (s === 'speaking' ? 'listening' : s));
      }
      return;
    }

    isPlayingRef.current = true;
    const buffer = queue.shift()!;

    ctx.decodeAudioData(buffer.slice(0))
      .then((audioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => playNext();
        source.start();
      })
      .catch((err) => {
        console.warn('TTS decode error:', err);
        playNext(); // Skip bad chunk
      });
  }, [state]);

  const enqueueAudio = useCallback((base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    playbackQueueRef.current.push(bytes.buffer);

    if (!isPlayingRef.current) {
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new AudioContext();
      }
      playNext();
    }
  }, [playNext]);

  // ─── Speech Segment Handling ────────────────────────────────────

  const sendSegment = useCallback(async () => {
    const chunks = chunksRef.current;

    if (chunks.length === 0) return;

    // If server hasn't confirmed session yet, keep chunks buffered
    if (!sessionIdRef.current) {
      vdbg('SEND', `Waiting for session ID, buffering ${chunks.length} chunks`);
      return;
    }

    chunksRef.current = [];

    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (blob.size === 0) return;

    const arrayBuf = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), ''),
    );

    const seq = seqRef.current++;
    vdbg('SEND', `Blob ${blob.size}B, b64 ${base64.length}, seq=${seq}`);

    send('voice.audio', {
      session_id: sessionIdRef.current,
      audio_b64: base64,
      seq,
    });
  }, [send]);

  sendSegmentRef.current = sendSegment;

  // Use a ref to allow the VAD/timer to call rotateSegment without circular deps
  const rotateSegmentRef = useRef<() => void>(() => {});

  const startRecorderSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    // Clear any existing max-segment timer
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    chunksRef.current = [];
    segmentStartRef.current = Date.now();
    silenceStartRef.current = null;

    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          vdbg('REC', `Chunk ${chunksRef.current.length}: ${e.data.size}B`);
        }
      };
      recorder.start(100);
      recorderRef.current = recorder;
      vdbg('REC', 'MediaRecorder started');

      // Hard limit: force rotation at MAX_SEGMENT_MS regardless of silence
      segmentTimerRef.current = setTimeout(() => {
        segmentTimerRef.current = null;
        vdbg('REC', `MAX_SEGMENT_MS (${MAX_SEGMENT_MS}ms) reached — rotating segment`);
        rotateSegmentRef.current();
      }, MAX_SEGMENT_MS);
    } catch {
      console.error('MediaRecorder start failed');
    }
  }, []);

  const stopRecorderSegment = useCallback((andRestart = false) => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    const durationMs = Date.now() - segmentStartRef.current;
    vdbg('REC', `MediaRecorder stopped, chunks=${chunksRef.current.length}, duration=${durationMs}ms, restart=${andRestart}`);
    recorder.onstop = () => {
      sendSegment();
      if (andRestart) {
        startRecorderSegment();
      }
    };
    recorder.stop();
    recorderRef.current = null;
  }, [sendSegment, startRecorderSegment]);

  // Keep the ref in sync so VAD and timer can call rotate
  rotateSegmentRef.current = () => stopRecorderSegment(true);

  // ─── VAD Monitor (silence detection for segment cutting) ──────

  const startVadMonitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Float32Array(analyser.fftSize);
    let vadTick = 0;

    vadTimerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);
      const rms = Math.sqrt(
        dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length,
      );
      const isSilent = rms < SILENCE_THRESHOLD;
      const segmentAge = Date.now() - segmentStartRef.current;

      // Heartbeat every ~1s
      if (VOICE_DEBUG && ++vadTick % 20 === 0) {
        vdbg('VAD', `RMS=${rms.toFixed(4)}, silent=${isSilent}, segAge=${segmentAge}ms`);
      }

      if (isSilent) {
        // Track how long silence has been continuous
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
        }

        const silenceDuration = Date.now() - silenceStartRef.current;

        // Cut on silence if segment is old enough (>= MIN_SEGMENT_MS)
        if (silenceDuration >= SILENCE_DURATION_MS && segmentAge >= MIN_SEGMENT_MS) {
          vdbg('VAD', `Silence cut: ${silenceDuration}ms silence, segment ${segmentAge}ms`);
          silenceStartRef.current = null;
          rotateSegmentRef.current();
        }
      } else {
        // Speaking — reset silence tracker
        silenceStartRef.current = null;
      }
    }, VAD_INTERVAL_MS);
  }, []);

  const stopVadMonitor = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  }, []);

  // ─── WS Event Handlers ─────────────────────────────────────────

  // Subscribe to client changes so listeners are re-registered on reconnect
  const wsClient = useWebSocketStore((s) => s.client);

  useEffect(() => {
    const client = wsClient;
    if (!client) return;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      client.on('voice.session.started', (e: WsEvent) => {
        sessionIdRef.current = e.data.session_id as string;
        setSessionActive(true);
        // Flush any chunks that were buffered while waiting for session ID
        if (chunksRef.current.length > 0) {
          vdbg('SEND', `Session confirmed, flushing ${chunksRef.current.length} buffered chunks`);
          sendSegmentRef.current();
        }
      }),
    );

    unsubs.push(
      client.on('voice.stt.result', (e: WsEvent) => {
        const text = e.data.text as string;
        vdbg('STT', `seq=${e.data.seq}: "${text}"`);
        if (text) {
          const clean = text.trim();
          if (clean) {
            setTranscript((prev) => (prev ? prev + ' ' + clean : clean));
          }
        }
      }),
    );

    unsubs.push(
      client.on('voice.agent.start', () => {
        setState('processing');
      }),
    );

    unsubs.push(
      client.on('voice.tts.chunk', (e: WsEvent) => {
        vdbg('TTS', `chunk idx=${e.data.index}, b64Len=${(e.data.audio_b64 as string).length}, isLast=${e.data.is_last}`);
        setState('speaking');
        enqueueAudio(e.data.audio_b64 as string);
      }),
    );

    unsubs.push(
      client.on('voice.agent.done', () => {
        if (!isPlayingRef.current && playbackQueueRef.current.length === 0) {
          setState((s) => (s !== 'idle' ? 'listening' : s));
        }
      }),
    );

    unsubs.push(
      client.on('voice.session.error', (e: WsEvent) => {
        vdbg('ERR', e.data.error);
        console.error('Voice session error:', e.data.error);
      }),
    );

    unsubs.push(
      client.on('voice.transcript.final', (e: WsEvent) => {
        const text = e.data.text as string;
        vdbg('TRANSCRIPT_FINAL', `"${text}"`);
        if (text) {
          setTranscript(text.trim());
        }
      }),
    );

    unsubs.push(
      client.on('voice.session.ended', () => {
        vdbg('SESSION', 'ended');
        sessionIdRef.current = null;
        setSessionActive(false);
        setState('idle');
        // Cleanup TTS playback
        playbackQueueRef.current = [];
        isPlayingRef.current = false;
        playbackCtxRef.current?.close();
        playbackCtxRef.current = null;
      }),
    );

    // Forward backend debug events to browser console
    unsubs.push(
      client.on('voice.debug', (e: WsEvent) => {
        if (VOICE_DEBUG) {
          console.log(`[SRV:${e.data.stage}]`, e.data);
        }
      }),
    );

    cleanupRef.current = unsubs;
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [enqueueAudio, wsClient]);

  // ─── Start Session ──────────────────────────────────────────────

  const startSession = useCallback(async (conversationId: string) => {
    if (sessionActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // AudioContext + analyser for VAD silence detection
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      conversationIdRef.current = conversationId;
      seqRef.current = 0;
      setTranscript('');

      send('voice.session.start', {
        conversation_id: conversationId,
      });

      setSessionActive(true);
      setState('listening');
      setDuration(0);
      durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      // Start recording + VAD monitor immediately
      startRecorderSegment();
      startVadMonitor();
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [send, startRecorderSegment, startVadMonitor, sessionActive]);

  // ─── End Session ────────────────────────────────────────────────

  const endSession = useCallback(() => {
    // Stop duration timer
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }

    // Stop VAD monitor
    stopVadMonitor();

    // Clear segment rotation timer
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    // Stop recorder — use onstop to capture ALL chunks (including flush from stop())
    const recorder = recorderRef.current;
    const sid = sessionIdRef.current;
    recorderRef.current = null;

    if (recorder?.state === 'recording' && sid) {
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          blob.arrayBuffer().then((buf) => {
            const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));
            const seq = seqRef.current++;
            vdbg('SEND', `Blob ${blob.size}B, b64 ${base64.length}, seq=${seq} (final)`);
            send('voice.audio', { session_id: sid, audio_b64: base64, seq });
            send('voice.session.end', { session_id: sid });
          }).catch(() => {
            send('voice.session.end', { session_id: sid });
          });
        } else {
          send('voice.session.end', { session_id: sid });
        }
      };
      recorder.stop();
    } else {
      if (sid) send('voice.session.end', { session_id: sid });
    }

    // Cleanup media resources
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    setState('processing');
  }, [send, stopVadMonitor]);

  // ─── Stop TTS ───────────────────────────────────────────────────

  const stopTts = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    if (sessionIdRef.current) {
      send('voice.tts.stop', { session_id: sessionIdRef.current });
    }
    setState((s) => (s === 'speaking' ? 'listening' : s));
  }, [send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        endSession();
      }
    };
  }, [endSession]);

  return {
    state,
    transcript,
    duration,
    isSessionActive: sessionActive,
    startSession,
    endSession,
    stopTts,
  };
}
