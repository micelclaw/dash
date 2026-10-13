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

import { toast } from 'sonner';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { WsEvent } from '@/types/websocket';

interface RecorderSegment {
  recorder: MediaRecorder;
  generation: number;
  chunks: Blob[];
  stopped: Promise<void>;
  resolveStopped: () => void;
  stopRequested: boolean;
  restartOnStop: boolean;
}

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

  const generationRef = useRef(0);
  const activeRef = useRef(false);
  const endingRef = useRef(false);
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
  // Pre-confirmation audio only; recorder chunks belong to their own segment.
  const chunksRef = useRef<Blob[]>([]);
  const segmentsRef = useRef(new Map<MediaRecorder, RecorderSegment>());
  // Ordered conversion work, never a retry/replay queue for WS frames.
  const pendingAudioRef = useRef<Promise<void>>(Promise.resolve());
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TTS playback
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Cleanup refs
  const cleanupRef = useRef<Array<() => void>>([]);
  const sendSegmentRef = useRef<() => void>(() => {});
  const endSessionRef = useRef<() => void>(() => {});

  // ─── WS helpers ─────────────────────────────────────────────────

  const send = useCallback((action: string, data?: Record<string, unknown>) => {
    return useWebSocketStore.getState().send(action, data);
  }, []);

  const releaseLocal = useCallback(() => {
    generationRef.current++;
    activeRef.current = false;
    endingRef.current = false;
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (vadTimerRef.current) clearInterval(vadTimerRef.current);
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    durationTimerRef.current = vadTimerRef.current = segmentTimerRef.current = null;
    recorderRef.current = null;
    for (const segment of segmentsRef.current.values()) {
      segment.recorder.ondataavailable = null;
      segment.recorder.onstop = null;
      segment.recorder.onerror = null;
      if (segment.recorder.state !== 'inactive') segment.recorder.stop();
      segment.resolveStopped();
    }
    segmentsRef.current.clear();
    pendingAudioRef.current = Promise.resolve();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    void playbackCtxRef.current?.close();
    audioCtxRef.current = playbackCtxRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    sessionIdRef.current = null;
    setSessionActive(false);
    setState('idle');
  }, []);

  const rejectSend = useCallback(() => {
    releaseLocal();
    toast.error('No se pudo enviar la voz. Comprueba la conexión antes de iniciar otra sesión.');
  }, [releaseLocal]);

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
    const generation = generationRef.current;

    ctx.decodeAudioData(buffer.slice(0))
      .then((audioBuffer) => {
        if (generation !== generationRef.current || !activeRef.current) return;
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => { if (generation === generationRef.current) playNext(); };
        source.start();
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
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

  const sendSegment = useCallback((chunks: Blob[], generation: number) => {
    if (generation !== generationRef.current || !activeRef.current || !chunks.length) return;
    const sid = sessionIdRef.current;
    if (!sid) {
      chunksRef.current.push(...chunks);
      return;
    }
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (!blob.size) return;
    pendingAudioRef.current = pendingAudioRef.current.then(async () => {
      if (generation !== generationRef.current || !activeRef.current) return;
      try {
        const buffer = await blob.arrayBuffer();
        // Normal ending drains valid work; only retirement cancels it.
        if (generation !== generationRef.current || !activeRef.current) return;
        const audio_b64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''));
        const result = send('voice.audio', { session_id: sid, audio_b64, seq: seqRef.current });
        if (!result.accepted) { rejectSend(); return; }
        seqRef.current++;
      } catch {
        if (generation === generationRef.current && activeRef.current) rejectSend();
      }
    });
  }, [send, rejectSend]);

  sendSegmentRef.current = () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    sendSegment(chunks, generationRef.current);
  };

  // Use a ref to allow the VAD/timer to call rotateSegment without circular deps
  const rotateSegmentRef = useRef<() => void>(() => {});

  const startRecorderSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activeRef.current || endingRef.current) return;

    // Clear any existing max-segment timer
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    segmentStartRef.current = Date.now();
    silenceStartRef.current = null;

    try {
      const generation = generationRef.current;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      let resolveStopped!: () => void;
      const stopped = new Promise<void>((resolve) => { resolveStopped = resolve; });
      const segment: RecorderSegment = { recorder, generation, chunks: [], stopped, resolveStopped, stopRequested: false, restartOnStop: false };
      segmentsRef.current.set(recorder, segment);
      recorder.ondataavailable = (event) => {
        if (generation === generationRef.current && activeRef.current
          && segmentsRef.current.get(recorder) === segment && event.data.size > 0) {
          segment.chunks.push(event.data);
        }
      };
      // Final events can also come from natural track termination or errors.
      // Install once at creation: inactive alone does not mean data is delivered.
      recorder.onerror = () => {
        if (generation !== generationRef.current || !activeRef.current
          || segmentsRef.current.get(recorder) !== segment) return;
        rejectSend();
      };
      recorder.onstop = () => {
        if (generation !== generationRef.current || !activeRef.current
          || segmentsRef.current.get(recorder) !== segment) return;
        const chunks = segment.chunks;
        segment.chunks = [];
        sendSegment(chunks, generation);
        recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        segmentsRef.current.delete(recorder);
        if (recorderRef.current === recorder) recorderRef.current = null;
        segment.resolveStopped();
        if (segment.restartOnStop && !endingRef.current) startRecorderSegment();
        else if (!segment.stopRequested && !endingRef.current) endSessionRef.current();
      };
      recorderRef.current = recorder;
      recorder.start(100);
      vdbg('REC', 'MediaRecorder started');

      // Hard limit: force rotation at MAX_SEGMENT_MS regardless of silence
      segmentTimerRef.current = setTimeout(() => {
        if (generation !== generationRef.current || !activeRef.current || endingRef.current
          || recorderRef.current !== recorder || segmentsRef.current.get(recorder) !== segment) return;
        segmentTimerRef.current = null;
        vdbg('REC', `MAX_SEGMENT_MS (${MAX_SEGMENT_MS}ms) reached — rotating segment`);
        rotateSegmentRef.current();
      }, MAX_SEGMENT_MS);
    } catch {
      releaseLocal();
      toast.error('No se pudo iniciar la grabación de voz.');
    }
  }, [releaseLocal, rejectSend, sendSegment]);

  const stopRecorderSegment = useCallback((andRestart = false) => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    const segment = recorder ? segmentsRef.current.get(recorder) : undefined;
    if (!recorder || !segment || segment.stopRequested || recorder.state === 'inactive') return;
    segment.stopRequested = true;
    segment.restartOnStop = andRestart;
    try { recorder.stop(); }
    catch { rejectSend(); }
  }, [rejectSend]);

  // Keep the ref in sync so VAD and timer can call rotate
  rotateSegmentRef.current = () => stopRecorderSegment(true);

  // ─── VAD Monitor (silence detection for segment cutting) ──────

  const startVadMonitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const generation = generationRef.current;
    const dataArray = new Float32Array(analyser.fftSize);
    let vadTick = 0;

    vadTimerRef.current = setInterval(() => {
      if (generation !== generationRef.current || !activeRef.current || endingRef.current
        || analyserRef.current !== analyser) return;
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
        if (!activeRef.current) return;
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
        if (!activeRef.current) return;
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
        if (!activeRef.current) return;
        setState('processing');
      }),
    );

    unsubs.push(
      client.on('voice.tts.chunk', (e: WsEvent) => {
        if (!activeRef.current) return;
        vdbg('TTS', `chunk idx=${e.data.index}, b64Len=${(e.data.audio_b64 as string).length}, isLast=${e.data.is_last}`);
        setState('speaking');
        enqueueAudio(e.data.audio_b64 as string);
      }),
    );

    unsubs.push(
      client.on('voice.agent.done', () => {
        if (!activeRef.current) return;
        if (!isPlayingRef.current && playbackQueueRef.current.length === 0) {
          setState((s) => (s !== 'idle' ? 'listening' : s));
        }
      }),
    );

    unsubs.push(
      client.on('voice.session.error', (e: WsEvent) => {
        if (!activeRef.current) return;
        vdbg('ERR', e.data.error);
        console.error('Voice session error:', e.data.error);
        releaseLocal();
      }),
    );

    unsubs.push(
      client.on('voice.transcript.final', (e: WsEvent) => {
        if (!activeRef.current) return;
        const text = e.data.text as string;
        vdbg('TRANSCRIPT_FINAL', `"${text}"`);
        if (text) {
          setTranscript(text.trim());
        }
      }),
    );

    unsubs.push(
      client.on('voice.session.ended', () => {
        if (!activeRef.current) return;
        vdbg('SESSION', 'ended');
        releaseLocal();
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
  }, [enqueueAudio, wsClient, releaseLocal]);

  // ─── Start Session ──────────────────────────────────────────────

  const startSession = useCallback(async (conversationId: string) => {
    if (activeRef.current) return;
    if (useWebSocketStore.getState().status !== 'connected') { rejectSend(); return; }
    const generation = ++generationRef.current;
    pendingAudioRef.current = Promise.resolve();
    chunksRef.current = [];
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== generationRef.current || !activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
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
      const result = send('voice.session.start', { conversation_id: conversationId });
      if (!result.accepted) { rejectSend(); return; }
      setSessionActive(true);
      setState('listening');
      setDuration(0);
      durationTimerRef.current = setInterval(() => {
        if (generation === generationRef.current && activeRef.current && !endingRef.current) setDuration((d) => d + 1);
      }, 1000);
      startRecorderSegment();
      startVadMonitor();
    } catch (err) {
      if (generation !== generationRef.current) return;
      releaseLocal();
      console.error('Microphone access failed:', err);
      toast.error('No se pudo acceder al micrófono.');
    }
  }, [send, startRecorderSegment, startVadMonitor, releaseLocal, rejectSend]);

  const endSession = useCallback(() => {
    if (!activeRef.current || endingRef.current) return;
    endingRef.current = true;
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    stopVadMonitor();
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    segmentTimerRef.current = null;
    const sid = sessionIdRef.current;
    const generation = generationRef.current;
    const segments = [...segmentsRef.current.values()];
    // stop may be asynchronous, or a rotation may already be stopping. Its
    // callback submits conversion work before resolving stopped.
    stopRecorderSegment(false);
    void Promise.all(segments.map((segment) => segment.stopped)).then(async () => {
      if (generation !== generationRef.current || !activeRef.current) return;
      await pendingAudioRef.current;
      if (generation !== generationRef.current || !activeRef.current) return;
      if (!sid) { releaseLocal(); return; }
      if (!send('voice.session.end', { session_id: sid }).accepted) { rejectSend(); return; }
      setState('processing');
    });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, [send, stopVadMonitor, stopRecorderSegment, rejectSend, releaseLocal]);

  endSessionRef.current = endSession;

  // ─── Stop TTS ───────────────────────────────────────────────────

  const stopTts = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    if (sessionIdRef.current) {
      if (!send('voice.tts.stop', { session_id: sessionIdRef.current }).accepted) { rejectSend(); return; }
    }
    setState((s) => (s === 'speaking' ? 'listening' : s));
  }, [send, rejectSend]);

  // A dropped transport ends local capture; reconnect never replays voice frames.
  useEffect(() => useWebSocketStore.subscribe((next) => {
    if (activeRef.current && next.status !== 'connected') rejectSend();
  }), [rejectSend]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseLocal();
    };
  }, [releaseLocal]);

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
