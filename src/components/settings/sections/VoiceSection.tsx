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

// ─── Voice Settings Section ─────────────────────────────────────────
// Settings → Voice: STT engine, TTS voice, input mode, service status.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Mic, Volume2, Loader2, CheckCircle, XCircle, Power, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { PIPER_VOICES, LANGUAGE_NAMES } from '@/data/piper-voices';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API = `${BASE_URL}/api/v1`;

interface ServiceStatus {
  available: boolean;
  host: string;
  port: number;
}

interface VoiceStatus {
  stt: ServiceStatus;
  tts: ServiceStatus;
}

const INPUT_MODE_OPTIONS = [
  { value: 'hold', label: 'Hold to talk' },
  { value: 'toggle', label: 'Click to toggle' },
];

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'sv', label: 'Svenska' },
  { value: 'da', label: 'Dansk' },
  { value: 'fi', label: 'Suomi' },
  { value: 'no', label: 'Norsk' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'cs', label: 'Čeština' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'hu', label: 'Magyar' },
  { value: 'ro', label: 'Română' },
  { value: 'ca', label: 'Català' },
  { value: 'uk', label: 'Українська' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'th', label: 'ไทย' },
  { value: 'bg', label: 'Български' },
  { value: 'hr', label: 'Hrvatski' },
  { value: 'sk', label: 'Slovenčina' },
  { value: 'sl', label: 'Slovenščina' },
  { value: 'sr', label: 'Srpski' },
  { value: 'cy', label: 'Cymraeg' },
  { value: 'fa', label: 'فارسی' },
];

const MODEL_OPTIONS = [
  { value: 'tiny-int8', label: 'tiny-int8 (~75MB RAM)' },
  { value: 'base-int8', label: 'base-int8 (~200MB RAM)' },
  { value: 'small-int8', label: 'small-int8 (~500MB RAM)' },
  { value: 'medium', label: 'medium (~1.5GB RAM)' },
];

function StatusDot({ available }: { available: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: available ? 'var(--success)' : 'var(--error)',
      }}
    >
      {available ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {available ? 'Running' : 'Offline'}
    </span>
  );
}

export function VoiceSection() {
  const [status, setStatus] = useState<VoiceStatus>({
    stt: { available: false, host: '127.0.0.1', port: 10300 },
    tts: { available: false, host: '127.0.0.1', port: 10200 },
  });
  const [activeVoice, setActiveVoice] = useState('es_ES-davefx-medium');
  const [testingSTT, setTestingSTT] = useState(false);
  const [testingTTS, setTestingTTS] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [model, setModel] = useState('base-int8');
  const [language, setLanguage] = useState('auto');
  const [startingSTT, setStartingSTT] = useState(false);
  const [startingTTS, setStartingTTS] = useState(false);
  const [stoppingSTT, setStoppingSTT] = useState(false);
  const [stoppingTTS, setStoppingTTS] = useState(false);
  const [savingConfig, setSavingConfig] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const getToken = useCallback(() => useAuthStore.getState().tokens?.accessToken ?? '', []);
  const voiceSettings = useSettingsStore((s) => s.settings?.voice);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const fetchWithTimeout = useCallback((url: string, opts?: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
  }, []);

  const voiceOptions = useMemo(() => {
    const grouped = new Map<string, typeof PIPER_VOICES>();
    for (const voice of PIPER_VOICES) {
      const lang = voice.locale.split('_')[0] ?? voice.locale;
      const list = grouped.get(lang) ?? [];
      list.push(voice);
      grouped.set(lang, list);
    }

    const options: Array<{ value: string; label: string }> = [];
    const sortedLangs = [...grouped.keys()].sort((a, b) => {
      const nameA = LANGUAGE_NAMES[a] ?? a;
      const nameB = LANGUAGE_NAMES[b] ?? b;
      return nameA.localeCompare(nameB);
    });

    for (const lang of sortedLangs) {
      const voices = grouped.get(lang) ?? [];
      for (const voice of voices) {
        const langName = LANGUAGE_NAMES[lang] ?? lang;
        const region = voice.locale.split('_')[1] ?? '';
        options.push({
          value: voice.id,
          label: `${langName} (${region}) — ${voice.speaker} [${voice.quality}]`,
        });
      }
    }
    return options;
  }, []);

  // Fetch status + config on mount
  useEffect(() => {
    const headers = { Authorization: `Bearer ${getToken()}` };

    fetchWithTimeout(`${API}/voice/status`, { headers })
      .then((r) => r.json())
      .then((json) => { if (json.data) setStatus(json.data); })
      .catch(() => { /* keep defaults */ });

    fetchWithTimeout(`${API}/voice/config`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          if (json.data.voice) setActiveVoice(json.data.voice);
          if (json.data.model) setModel(json.data.model);
          if (json.data.language) setLanguage(json.data.language);
        }
      })
      .catch(() => { /* keep defaults */ });
  }, [getToken, fetchWithTimeout]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const refreshStatus = useCallback(async (): Promise<VoiceStatus | null> => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      // TCP checks in backend can take up to 3s each when services are transitioning
      const res = await fetchWithTimeout(`${API}/voice/status`, { headers }, 10000);
      const json = await res.json();
      if (json.data) {
        setStatus(json.data);
        return json.data as VoiceStatus;
      }
    } catch { /* keep previous state */ }
    return null;
  }, [getToken, fetchWithTimeout]);

  const handleSaveConfig = useCallback(async (field: string, value: string) => {
    setSavingConfig(field);
    try {
      const res = await fetchWithTimeout(`${API}/voice/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      }, 120000);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.data) {
        if (json.data.voice) setActiveVoice(json.data.voice);
        if (json.data.model) setModel(json.data.model);
        if (json.data.language) setLanguage(json.data.language);
      }
      toast.success('Voice config updated — containers restarting');
      // Poll a few times to detect when services come back
      setTimeout(() => refreshStatus(), 5000);
      setTimeout(() => refreshStatus(), 15000);
      setTimeout(() => refreshStatus(), 30000);
    } catch (err) {
      toast.error(`Failed to update ${field}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setSavingConfig(null);
  }, [getToken, fetchWithTimeout, refreshStatus]);

  const handleStartService = useCallback(async (service: 'stt' | 'tts') => {
    const name = service === 'stt' ? 'wyoming-whisper' : 'wyoming-piper';
    const label = service === 'stt' ? 'Whisper (STT)' : 'Piper (TTS)';
    const setter = service === 'stt' ? setStartingSTT : setStartingTTS;

    // Cancel any previous poll
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setter(true);
    try {
      // The POST /services/:name/start now waits for TCP availability on the backend.
      // It only returns 200 when the Wyoming service is actually accepting connections.
      // Timeout 120s — Whisper model download on first run can take a while.
      const res = await fetchWithTimeout(`${API}/services/${name}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      }, 120000);

      if (abort.signal.aborted) return;

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }

      // Backend confirmed service is TCP-ready — refresh status to update UI
      await refreshStatus();
      toast.success(`${label} is running`);
    } catch (err) {
      if (abort.signal.aborted) return;
      toast.error(`Failed to start ${label}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setter(false);
  }, [getToken, fetchWithTimeout, refreshStatus]);

  const handleStopService = useCallback(async (service: 'stt' | 'tts') => {
    const name = service === 'stt' ? 'wyoming-whisper' : 'wyoming-piper';
    const label = service === 'stt' ? 'Whisper (STT)' : 'Piper (TTS)';
    const setter = service === 'stt' ? setStoppingSTT : setStoppingTTS;
    setter(true);
    try {
      // docker stop can take ~10s (SIGTERM + grace period), use 30s timeout
      const res = await fetchWithTimeout(`${API}/services/${name}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      }, 30000);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      toast.success(`${label} stopped`);
      // Optimistically update status immediately
      setStatus((prev) => ({
        ...prev,
        [service]: { ...prev[service], available: false },
      }));
      // Also refresh from backend to confirm
      refreshStatus().catch(() => {});
    } catch (err) {
      // Ignore abort errors (component unmount or navigation)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setter(false);
        return;
      }
      toast.error(`Failed to stop ${label}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setter(false);
  }, [getToken, fetchWithTimeout, refreshStatus]);

  const handleTestSTT = useCallback(async () => {
    setTestingSTT(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.start();
      await new Promise((r) => setTimeout(r, 3000));
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());

      await new Promise((r) => { recorder.onstop = r; });
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const form = new FormData();
      form.append('file', blob, 'test.webm');

      const res = await fetch(`${API}/voice/stt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const json = await res.json();
      toast.success(`STT: "${json.data?.text || '(empty)'}"`);
    } catch {
      toast.error('STT test failed');
    }
    setTestingSTT(false);
  }, [getToken]);

  const handleTestTTS = useCallback(async () => {
    setTestingTTS(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Hola, soy tu asistente de voz.' }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = speed;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      toast.success('TTS playback started');
    } catch {
      toast.error('TTS test failed');
    }
    setTestingTTS(false);
  }, [getToken, speed]);

  const renderStatusRow = (
    service: 'stt' | 'tts',
    available: boolean,
    starting: boolean,
    stopping: boolean,
  ) => (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {starting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--amber)' }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Starting...
            </span>
          ) : (
            <StatusDot available={available} />
          )}
          {!available && !starting && (
            <button
              onClick={() => handleStartService(service)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: '0.7rem', fontFamily: 'var(--font-sans)',
                background: 'var(--success)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}
            >
              <Power size={10} />
              Start
            </button>
          )}
          {available && !stopping && (
            <button
              onClick={() => handleStopService(service)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: '0.7rem', fontFamily: 'var(--font-sans)',
                background: 'var(--surface-hover)', color: 'var(--text-dim)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}
            >
              <Square size={10} />
              Stop
            </button>
          )}
          {stopping && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              Stopping...
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* STT Section */}
      <SettingSection
        title="Speech-to-Text (STT)"
        description="Transcribe spoken audio to text using Wyoming Whisper."
        action={
          <button
            onClick={handleTestSTT}
            disabled={testingSTT || !status.stt.available}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              cursor: testingSTT || !status.stt.available ? 'not-allowed' : 'pointer',
              opacity: testingSTT || !status.stt.available ? 0.5 : 1,
            }}
          >
            <Mic size={12} />
            {testingSTT ? 'Recording...' : 'Test STT'}
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Engine</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wyoming Whisper (local)</span>
        </div>
        {renderStatusRow('stt', status.stt.available, startingSTT, stoppingSTT)}
        <SettingSelect
          label="Model"
          description="Larger models are more accurate but use more RAM."
          value={model}
          options={MODEL_OPTIONS}
          onChange={(v) => { setModel(v); handleSaveConfig('model', v); }}
          disabled={savingConfig === 'model'}
        />
        <SettingSelect
          label="Language"
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => { setLanguage(v); handleSaveConfig('language', v); }}
          disabled={savingConfig === 'language'}
        />
      </SettingSection>

      {/* TTS Section */}
      <SettingSection
        title="Text-to-Speech (TTS)"
        description="Generate spoken audio from text using Wyoming Piper."
        action={
          <button
            onClick={handleTestTTS}
            disabled={testingTTS || !status.tts.available}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              cursor: testingTTS || !status.tts.available ? 'not-allowed' : 'pointer',
              opacity: testingTTS || !status.tts.available ? 0.5 : 1,
            }}
          >
            <Volume2 size={12} />
            {testingTTS ? 'Playing...' : 'Test TTS'}
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Engine</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wyoming Piper (local)</span>
        </div>
        {renderStatusRow('tts', status.tts.available, startingTTS, stoppingTTS)}
        <SettingSelect
          label="Voice"
          description="Changing voice will restart the TTS container."
          value={activeVoice}
          options={voiceOptions}
          onChange={(v) => { setActiveVoice(v); handleSaveConfig('voice', v); }}
          disabled={savingConfig === 'voice'}
        />
        {savingConfig === 'voice' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--amber)', padding: '8px 0' }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Downloading voice and restarting container...
          </div>
        )}
        {/* Speed slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Speed</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Playback speed for TTS audio.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range" min={0.5} max={2.0} step={0.1} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: 100, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'right' }}>
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>
      </SettingSection>

      {/* Voice Mode */}
      <SettingSection title="Voice Mode" description="Configure how voice input works in the chat.">
        <SettingSelect
          label="Input mode"
          value={voiceSettings?.input_mode ?? 'hold'}
          options={INPUT_MODE_OPTIONS}
          onChange={(v) => {
            setLocalValue('voice.input_mode', v);
            updateSection('voice', { ...voiceSettings, input_mode: v }).catch(() => toast.error('Failed to save input mode'));
          }}
        />
        <SettingToggle
          label="Auto-play responses"
          description="Automatically play TTS for agent responses."
          checked={voiceSettings?.autoplay_responses ?? false}
          onChange={(v) => {
            setLocalValue('voice.autoplay_responses', v);
            updateSection('voice', { ...voiceSettings, autoplay_responses: v }).catch(() => toast.error('Failed to save setting'));
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Keyboard shortcut</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Hold Space to record (when not typing).</div>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            Space
          </span>
        </div>
      </SettingSection>
    </>
  );
}
