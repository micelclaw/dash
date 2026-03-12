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

import { useState, useRef, useCallback, useEffect } from 'react';
import { Circle, Pause, Square, Play, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Waveform } from './Waveform';

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export function VoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleRecord = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for waveform
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
        setStatus('stopped');
        stopTimer();
        // Stop mic
        stream.getTracks().forEach((t) => t.stop());
        setAnalyser(null);
      };

      recorder.start(250); // collect data every 250ms
      setStatus('recording');
      setElapsed(0);
      startTimer();
    } catch {
      toast.error('Microphone access denied');
    }
  }, [audioUrl, startTimer, stopTimer]);

  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      stopTimer();
    }
  }, [stopTimer]);

  const handleResume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      startTimer();
    }
  }, [startTimer]);

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleNewRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setStatus('idle');
    setElapsed(0);
  }, [audioUrl]);

  const handleSave = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    setSaving(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const now = new Date();
      const filename = `Recording ${now.toISOString().slice(0, 16).replace('T', ' ')}.webm`;
      const file = new File([blob], filename, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parent_folder', '/Tools/Recordings');
      await api.upload('/files/upload', formData);
      toast.success(`Saved: ${filename}`);
    } catch {
      toast.error('Failed to save recording');
    } finally {
      setSaving(false);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: 16, gap: 12, fontFamily: 'var(--font-sans)',
    }}>
      {/* Waveform */}
      <Waveform
        analyser={analyser}
        active={status === 'recording'}
        height={60}
      />

      {/* Timer */}
      <div style={{
        textAlign: 'center', fontSize: '2rem', fontWeight: 600,
        fontFamily: 'var(--font-mono)', color: status === 'recording' ? '#ef4444' : 'var(--text)',
        letterSpacing: '0.05em',
      }}>
        {formatTime(elapsed)}
      </div>

      {/* Status label */}
      <div style={{
        textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-dim)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {status === 'idle' && 'Ready'}
        {status === 'recording' && 'Recording'}
        {status === 'paused' && 'Paused'}
        {status === 'stopped' && 'Recorded'}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 'auto' }}>
        {status === 'idle' && (
          <ControlButton icon={<Circle size={18} />} label="Record" color="#ef4444" onClick={handleRecord} />
        )}

        {status === 'recording' && (
          <>
            <ControlButton icon={<Pause size={18} />} label="Pause" onClick={handlePause} />
            <ControlButton icon={<Square size={16} />} label="Stop" color="#ef4444" onClick={handleStop} />
          </>
        )}

        {status === 'paused' && (
          <>
            <ControlButton icon={<Circle size={18} />} label="Resume" color="#ef4444" onClick={handleResume} />
            <ControlButton icon={<Square size={16} />} label="Stop" onClick={handleStop} />
          </>
        )}

        {status === 'stopped' && (
          <>
            <ControlButton icon={<Circle size={18} />} label="New" color="#ef4444" onClick={handleNewRecording} />
            <ControlButton icon={<Save size={16} />} label={saving ? 'Saving...' : 'Save'} color="var(--amber)" onClick={handleSave} disabled={saving} />
          </>
        )}
      </div>

      {/* Playback */}
      {status === 'stopped' && audioUrl && (
        <audio
          controls
          src={audioUrl}
          style={{
            width: '100%', height: 32, marginTop: 4,
            borderRadius: 'var(--radius-sm)',
          }}
        />
      )}
    </div>
  );
}

function ControlButton({
  icon, label, color, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '8px 16px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'default' : 'pointer', color: color || 'var(--text)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--transition-fast)',
      }}
    >
      {icon}
      <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>{label}</span>
    </button>
  );
}
