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

// ─── Voice Hook ─────────────────────────────────────────────────────
// Handles audio recording via MediaRecorder (WebM/Opus),
// STT transcription via POST /voice/stt, and TTS playback.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API = `${BASE_URL}/api/v1`;

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

export function useVoice() {
  const [state, setState] = useState<VoiceState>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const getToken = useCallback(() => useAuthStore.getState().tokens?.accessToken ?? '', []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // 100ms chunks for responsiveness
      mediaRecorderRef.current = recorder;
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      console.error('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        // Stop all tracks
        recorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          setState('idle');
          resolve(null);
          return;
        }

        setState('processing');

        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');

          const res = await fetch(`${API}/voice/stt`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
          });

          if (!res.ok) throw new Error('STT failed');

          const json = await res.json();
          const text = json.data?.text ?? '';
          setState('idle');
          resolve(text);
        } catch (err) {
          console.error('STT error:', err);
          setState('idle');
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, [getToken]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stream.getTracks().forEach((t) => t.stop());
      recorder.stop();
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    chunksRef.current = [];
    setState('idle');
    setDuration(0);
  }, []);

  const playTts = useCallback(async (text: string, voice?: string) => {
    setState('speaking');

    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState('idle');
      };

      await audio.play();
    } catch (err) {
      console.error('TTS playback error:', err);
      setState('idle');
    }
  }, [getToken]);

  const stopTts = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState('idle');
  }, []);

  return {
    state,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    playTts,
    stopTts,
  };
}
